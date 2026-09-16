-- ============================================================
-- Phase X: Subscription Upgrade (Spark, Flow, Orbit)
-- Migration: 20260715000000_subscription_upgrade.sql
-- ============================================================

-- 1. Rename existing plans and update limits natively
-- Spark (Free)
UPDATE public.subscription_plans
SET name = 'Spark',
    monthly_price = 0,
    annual_price = 0,
    features = '{"has_priority_support": false, "has_custom_api": true, "has_ollama": true, "has_ceova_ai": true, "max_file_uploads": 5}',
    daily_ai_tokens = 20000,
    daily_tool_calls = 10,
    daily_connector_calls = 5,
    memory_limit = 75,
    storage_limit_mb = 20,
    upload_limit_mb = 10,
    connected_accounts = 2,
    ai_models = '["gemini-2.5-flash", "gemini-2.5-flash-lite"]'::jsonb
WHERE slug = 'free';

-- Flow (Pro)
UPDATE public.subscription_plans
SET name = 'Flow',
    monthly_price = 399.00,
    annual_price = 3990.00,
    features = '{"has_priority_support": false, "has_custom_api": true, "has_ollama": true, "has_ceova_ai": true, "max_file_uploads": 20}',
    daily_ai_tokens = 100000,
    daily_tool_calls = 100,
    daily_connector_calls = 50,
    memory_limit = 750,
    storage_limit_mb = 2048,
    upload_limit_mb = 100,
    connected_accounts = 10,
    ai_models = '["gemini-2.5-flash", "gemini-2.5-flash-lite"]'::jsonb
WHERE slug = 'pro';

-- Orbit (Business)
UPDATE public.subscription_plans
SET name = 'Orbit',
    monthly_price = 1999.00,
    annual_price = 19990.00,
    features = '{"has_priority_support": true, "has_custom_api": true, "has_ollama": true, "has_ceova_ai": true, "max_file_uploads": 100}',
    daily_ai_tokens = 500000,
    daily_tool_calls = 500,
    daily_connector_calls = 250,
    memory_limit = 2000,
    storage_limit_mb = 10240,
    upload_limit_mb = 500,
    connected_accounts = 20,
    ai_models = '["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]'::jsonb
WHERE slug = 'business';

-- 2. Daily Metrics Table (No Cron)
CREATE TABLE IF NOT EXISTS public.daily_metrics (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_tokens_used BIGINT NOT NULL DEFAULT 0,
    tool_calls_used BIGINT NOT NULL DEFAULT 0,
    connector_calls_used BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

CREATE OR REPLACE FUNCTION public.set_daily_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_metrics_updated_at ON public.daily_metrics;
CREATE TRIGGER daily_metrics_updated_at
    BEFORE UPDATE ON public.daily_metrics
    FOR EACH ROW EXECUTE FUNCTION public.set_daily_metrics_updated_at();

-- RLS for Daily Metrics
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own daily metrics" ON public.daily_metrics;
CREATE POLICY "Users can read own daily metrics"
    ON public.daily_metrics FOR SELECT
    USING (auth.uid() = user_id);

-- Helper RPC to safely increment metrics (called by edge functions via Service Role)
CREATE OR REPLACE FUNCTION increment_daily_metrics(
    p_user_id UUID,
    p_ai_tokens BIGINT DEFAULT 0,
    p_tool_calls BIGINT DEFAULT 0,
    p_connector_calls BIGINT DEFAULT 0
) RETURNS void AS $$
BEGIN
    INSERT INTO public.daily_metrics (user_id, date, ai_tokens_used, tool_calls_used, connector_calls_used)
    VALUES (p_user_id, CURRENT_DATE, p_ai_tokens, p_tool_calls, p_connector_calls)
    ON CONFLICT (user_id, date) DO UPDATE 
    SET ai_tokens_used = daily_metrics.ai_tokens_used + EXCLUDED.ai_tokens_used,
        tool_calls_used = daily_metrics.tool_calls_used + EXCLUDED.tool_calls_used,
        connector_calls_used = daily_metrics.connector_calls_used + EXCLUDED.connector_calls_used,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. API Request Logs
CREATE TABLE IF NOT EXISTS public.api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens BIGINT NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
    response_time_ms BIGINT NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own api logs" ON public.api_request_logs;
CREATE POLICY "Users can read own api logs"
    ON public.api_request_logs FOR SELECT
    USING (auth.uid() = user_id);


-- 4. Admin Users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: To make someone an admin, you must insert their user_id into admin_users manually.

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for Admin Dashboard
CREATE OR REPLACE VIEW public.admin_cost_dashboard AS
SELECT 
    u.id as user_id,
    u.email as user_email,
    -- Revenue: Assuming a basic calculation from active subscriptions
    COALESCE((
        SELECT p.monthly_price 
        FROM public.user_subscriptions s 
        JOIN public.subscription_plans p ON s.plan_id = p.id 
        WHERE s.user_id = u.id AND s.status = 'active'
        LIMIT 1
    ), 0) as monthly_revenue,
    -- Costs
    COALESCE(SUM(l.estimated_cost), 0) as total_api_cost,
    (COALESCE(SUM(l.estimated_cost), 0) + 0.10) as total_estimated_cost, -- add tiny baseline cost
    -- Profit
    COALESCE((
        SELECT p.monthly_price 
        FROM public.user_subscriptions s 
        JOIN public.subscription_plans p ON s.plan_id = p.id 
        WHERE s.user_id = u.id AND s.status = 'active'
        LIMIT 1
    ), 0) - (COALESCE(SUM(l.estimated_cost), 0) + 0.10) as estimated_profit
FROM auth.users u
LEFT JOIN public.api_request_logs l ON u.id = l.user_id
GROUP BY u.id, u.email;
