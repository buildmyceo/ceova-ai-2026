-- ============================================================
-- Phase 7: Subscription Renewal — Schema + Stored Procedure
-- Migration: 20260604000005_renewal_procedure.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Schema Additions to subscription_usage
--    a) renewed_at: audit timestamp of last auto-renewal
--    b) UNIQUE(subscription_id, cycle_start): hard idempotency
--       guard — makes duplicate cycle rows physically impossible
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.subscription_usage
  ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ;

ALTER TABLE public.subscription_usage
  DROP CONSTRAINT IF EXISTS usage_unique_cycle;

ALTER TABLE public.subscription_usage
  ADD CONSTRAINT usage_unique_cycle
  UNIQUE (subscription_id, cycle_start);

-- ─────────────────────────────────────────────────────────────
-- 2. Renewal Stored Procedure: process_subscription_renewals()
--
--    Processes all active subscriptions where cycle has ended:
--      a) Creates a fresh subscription_usage row for the new cycle
--      b) Advances current_period_start and current_period_end
--      c) Handles cancel_at_period_end: downgrades to Free plan
--
--    Safety guarantees:
--      - ON CONFLICT DO NOTHING: re-runnable with zero side effects
--      - All historical usage rows are preserved (never deleted)
--      - Each batch is atomic per subscription record
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE public.process_subscription_renewals()
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sub             RECORD;
    free_plan_id    UUID;
    new_cycle_start TIMESTAMPTZ;
    new_cycle_end   TIMESTAMPTZ;
    rows_renewed    INT := 0;
    rows_cancelled  INT := 0;
BEGIN
    -- Fetch the Free plan ID once (used for downgrades)
    SELECT id INTO free_plan_id
    FROM public.subscription_plans
    WHERE slug = 'free'
    LIMIT 1;

    -- ──────────────────────────────────────────────────────────
    -- LOOP 1: Active renewals (not cancelling at period end)
    -- ──────────────────────────────────────────────────────────
    FOR sub IN
        SELECT us.id, us.user_id, us.billing_cycle
        FROM public.user_subscriptions us
        WHERE us.status IN ('active', 'trialing')
          AND us.current_period_end <= NOW()
          AND us.cancel_at_period_end = FALSE
    LOOP
        new_cycle_start := NOW();

        -- Respect billing_cycle: monthly vs annual
        IF sub.billing_cycle = 'annual' THEN
            new_cycle_end := NOW() + INTERVAL '1 year';
        ELSE
            new_cycle_end := NOW() + INTERVAL '30 days';
        END IF;

        -- Insert fresh usage row for new cycle.
        -- ON CONFLICT: if this cycle was already renewed, skip silently.
        INSERT INTO public.subscription_usage
            (subscription_id, user_id, cycle_start, cycle_end, total_tokens, total_requests, renewed_at)
        VALUES
            (sub.id, sub.user_id, new_cycle_start, new_cycle_end, 0, 0, NOW())
        ON CONFLICT (subscription_id, cycle_start) DO NOTHING;

        -- Advance the billing period on the subscription itself
        UPDATE public.user_subscriptions
        SET
            current_period_start = new_cycle_start,
            current_period_end   = new_cycle_end,
            updated_at           = NOW()
        WHERE id = sub.id;

        rows_renewed := rows_renewed + 1;
        RAISE LOG '[RENEWAL] Renewed subscription_id=% user_id=% new_cycle_end=%',
            sub.id, sub.user_id, new_cycle_end;
    END LOOP;

    -- ──────────────────────────────────────────────────────────
    -- LOOP 2: Cancellation at period end
    -- User explicitly cancelled — downgrade to Free after expiry
    -- ──────────────────────────────────────────────────────────
    FOR sub IN
        SELECT us.id, us.user_id
        FROM public.user_subscriptions us
        WHERE us.status = 'active'
          AND us.current_period_end <= NOW()
          AND us.cancel_at_period_end = TRUE
    LOOP
        -- Downgrade plan to Free, mark as canceled
        UPDATE public.user_subscriptions
        SET
            status               = 'canceled',
            plan_id              = free_plan_id,
            cancel_at_period_end = FALSE,
            updated_at           = NOW()
        WHERE id = sub.id;

        -- Provision a fresh Free-tier usage row for the new cycle
        -- so they can still track any usage on the free tier
        new_cycle_start := NOW();
        new_cycle_end   := NOW() + INTERVAL '30 days';

        INSERT INTO public.subscription_usage
            (subscription_id, user_id, cycle_start, cycle_end, total_tokens, total_requests, renewed_at)
        VALUES
            (sub.id, sub.user_id, new_cycle_start, new_cycle_end, 0, 0, NOW())
        ON CONFLICT (subscription_id, cycle_start) DO NOTHING;

        -- Re-activate the subscription at Free tier
        UPDATE public.user_subscriptions
        SET
            status               = 'active',
            current_period_start = new_cycle_start,
            current_period_end   = new_cycle_end,
            updated_at           = NOW()
        WHERE id = sub.id;
 
        rows_cancelled := rows_cancelled + 1;
        RAISE LOG '[RENEWAL] Cancelled+downgraded subscription_id=% user_id=%',
            sub.id, sub.user_id;
    END LOOP;

    RAISE LOG '[RENEWAL] Cycle complete. Renewed: %, Cancelled: %', rows_renewed, rows_cancelled;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Grant execution to service_role only
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON PROCEDURE public.process_subscription_renewals() FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE public.process_subscription_renewals() TO service_role;
