-- ============================================================
-- Phase 4: Subscription Data Architecture
-- Migration: 20260604000002_subscription_schema.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. subscription_plans
--    Source of truth for all plan limits and pricing.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    slug                    TEXT NOT NULL UNIQUE,
    monthly_price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
    annual_price            NUMERIC(10, 2) NOT NULL DEFAULT 0,
    token_limit_per_cycle   BIGINT NOT NULL DEFAULT 50000,
    request_limit_per_cycle BIGINT NOT NULL DEFAULT 100,
    features                JSONB NOT NULL DEFAULT '{}',
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: public read-only (plans are not user-specific)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can read subscription plans"
    ON public.subscription_plans FOR SELECT
    USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2. user_subscriptions
--    Binds a user to a plan + billing cycle.
--    Includes Razorpay placeholders for future payment integration.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id                     UUID NOT NULL REFERENCES public.subscription_plans(id),
    status                      TEXT NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
    billing_cycle               TEXT NOT NULL DEFAULT 'monthly'
                                    CHECK (billing_cycle IN ('monthly', 'annual')),
    current_period_start        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
    cancel_at_period_end        BOOLEAN NOT NULL DEFAULT false,
    -- Razorpay placeholders (populated when payment is integrated)
    razorpay_subscription_id    TEXT,
    razorpay_customer_id        TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: users can only read/update their own subscription
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscription"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription"
    ON public.user_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. subscription_usage
--    Rolling counter for the current billing cycle.
--    Fast O(1) quota checks — no SUM() across user_ai_usage needed.
--    Supports future add-on token packs.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_usage (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id                 UUID NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
    user_id                         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cycle_start                     TIMESTAMPTZ NOT NULL,
    cycle_end                       TIMESTAMPTZ NOT NULL,
    total_requests                  BIGINT NOT NULL DEFAULT 0,
    total_tokens                    BIGINT NOT NULL DEFAULT 0,
    additional_tokens_purchased     BIGINT NOT NULL DEFAULT 0,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscription_usage_updated_at
    BEFORE UPDATE ON public.subscription_usage
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: users can only read their own usage
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscription usage"
    ON public.subscription_usage FOR SELECT
    USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Seed subscription_plans
--    Free / Pro / Business defaults (amounts in INR)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.subscription_plans
    (name, slug, monthly_price, annual_price, token_limit_per_cycle, request_limit_per_cycle, features)
VALUES
    (
        'Free',
        'free',
        0,
        0,
        50000,
        100,
        '{"has_priority_support": false, "has_custom_api": true, "has_ollama": true, "has_ceova_ai": true, "max_file_uploads": 3}'
    ),
    (
        'Pro',
        'pro',
        499.00,
        4990.00,
        1000000,
        2000,
        '{"has_priority_support": false, "has_custom_api": true, "has_ollama": true, "has_ceova_ai": true, "max_file_uploads": 20}'
    ),
    (
        'Business',
        'business',
        1999.00,
        19990.00,
        5000000,
        10000,
        '{"has_priority_support": true, "has_custom_api": true, "has_ollama": true, "has_ceova_ai": true, "max_file_uploads": 100}'
    )
ON CONFLICT (slug) DO NOTHING;
