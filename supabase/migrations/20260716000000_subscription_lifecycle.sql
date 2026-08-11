-- ============================================================
-- Phase 8: Subscription Lifecycle & Quota Management
-- Migration: 20260716000000_subscription_lifecycle.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Renewal Stored Procedure Update
--    - Uses exactly 1 month / 1 year for precise expiry dates.
--    - Downgrades to Spark (Free) plan cleanly on expiration,
--      regardless of whether cancelled explicitly or past_due.
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
    -- LOOP 1: Active renewals (not cancelling, not unpaid)
    -- ──────────────────────────────────────────────────────────
    FOR sub IN
        SELECT us.id, us.user_id, us.billing_cycle
        FROM public.user_subscriptions us
        WHERE us.status IN ('active', 'trialing')
          AND us.current_period_end <= NOW()
          AND us.cancel_at_period_end = FALSE
    LOOP
        new_cycle_start := NOW();

        -- Exact 1 month or 1 year intervals
        IF sub.billing_cycle = 'annual' THEN
            new_cycle_end := NOW() + INTERVAL '1 year';
        ELSE
            new_cycle_end := NOW() + INTERVAL '1 month';
        END IF;

        -- Insert fresh usage row for new cycle
        INSERT INTO public.subscription_usage
            (subscription_id, user_id, cycle_start, cycle_end, total_tokens, total_requests, renewed_at)
        VALUES
            (sub.id, sub.user_id, new_cycle_start, new_cycle_end, 0, 0, NOW())
        ON CONFLICT (subscription_id, cycle_start) DO NOTHING;

        -- Advance the billing period
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
    -- LOOP 2: Cancellations, Past Due, Unpaid Expired
    -- User explicitly cancelled or payment failed — downgrade to Free
    -- ──────────────────────────────────────────────────────────
    FOR sub IN
        SELECT us.id, us.user_id
        FROM public.user_subscriptions us
        WHERE us.current_period_end <= NOW()
          AND (us.cancel_at_period_end = TRUE OR us.status IN ('canceled', 'past_due', 'unpaid'))
    LOOP
        -- Re-activate the subscription at Free tier (Spark)
        new_cycle_start := NOW();
        new_cycle_end   := NOW() + INTERVAL '1 month';

        UPDATE public.user_subscriptions
        SET
            status               = 'active', -- Back to active but on the free plan
            plan_id              = free_plan_id,
            cancel_at_period_end = FALSE,
            billing_cycle        = 'monthly',
            current_period_start = new_cycle_start,
            current_period_end   = new_cycle_end,
            updated_at           = NOW()
        WHERE id = sub.id;

        -- Provision a fresh Free-tier usage row
        INSERT INTO public.subscription_usage
            (subscription_id, user_id, cycle_start, cycle_end, total_tokens, total_requests, renewed_at)
        VALUES
            (sub.id, sub.user_id, new_cycle_start, new_cycle_end, 0, 0, NOW())
        ON CONFLICT (subscription_id, cycle_start) DO NOTHING;

        rows_cancelled := rows_cancelled + 1;
        RAISE LOG '[RENEWAL] Downgraded to Spark subscription_id=% user_id=%',
            sub.id, sub.user_id;
    END LOOP;

    RAISE LOG '[RENEWAL] Cycle complete. Renewed: %, Downgraded: %', rows_renewed, rows_cancelled;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Enhanced RPC: get_usage_and_limits
--    Calculates true memory size and true storage size in MB
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_usage_and_limits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_daily_metrics RECORD;
    v_plan_limits RECORD;
    v_memory_used BIGINT := 0;
    v_storage_used_bytes BIGINT := 0;
    v_storage_used_mb NUMERIC := 0;
BEGIN
    -- 1. Daily Metrics
    INSERT INTO public.daily_metrics (user_id, date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, date) DO NOTHING;

    SELECT ai_tokens_used, tool_calls_used, connector_calls_used 
    INTO v_daily_metrics
    FROM public.daily_metrics
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    -- 2. Plan Limits (Use Spark as fallback if expired or not active)
    SELECT p.id as plan_id, p.slug, p.daily_ai_tokens, p.daily_tool_calls, p.daily_connector_calls, p.memory_limit, p.storage_limit_mb
    INTO v_plan_limits
    FROM public.user_subscriptions s
    JOIN public.subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active' AND s.current_period_end > NOW()
    LIMIT 1;

    IF v_plan_limits IS NULL THEN
        SELECT id as plan_id, slug, daily_ai_tokens, daily_tool_calls, daily_connector_calls, memory_limit, storage_limit_mb
        INTO v_plan_limits
        FROM public.subscription_plans
        WHERE slug = 'free'
        LIMIT 1;
    END IF;

    -- 3. Calculate Memory Usage
    SELECT COUNT(*)
    INTO v_memory_used
    FROM public.user_memory_longterm
    WHERE user_id = p_user_id;

    -- 4. Calculate Storage Usage
    SELECT COALESCE(SUM(size_bytes), 0)
    INTO v_storage_used_bytes
    FROM public.user_files
    WHERE user_id = p_user_id;
    
    v_storage_used_mb := (v_storage_used_bytes::NUMERIC / 1024.0 / 1024.0);

    RETURN json_build_object(
        'plan_slug', v_plan_limits.slug,
        'usage', json_build_object(
            'ai_tokens_used', v_daily_metrics.ai_tokens_used,
            'tool_calls_used', v_daily_metrics.tool_calls_used,
            'connector_calls_used', v_daily_metrics.connector_calls_used,
            'memory_used', v_memory_used,
            'storage_used_mb', v_storage_used_mb
        ),
        'limits', json_build_object(
            'daily_ai_tokens', v_plan_limits.daily_ai_tokens,
            'daily_tool_calls', v_plan_limits.daily_tool_calls,
            'daily_connector_calls', v_plan_limits.daily_connector_calls,
            'memory_limit', v_plan_limits.memory_limit,
            'storage_limit_mb', v_plan_limits.storage_limit_mb
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
