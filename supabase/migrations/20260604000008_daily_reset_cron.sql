-- ============================================================
-- Phase 7: Daily Token Reset Job
-- Migration: 20260604000008_daily_reset_cron.sql
-- ============================================================

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Procedure to reset daily token allowance for all active subscriptions
CREATE OR REPLACE PROCEDURE public.reset_daily_tokens()
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.subscription_usage
    SET daily_tokens_used = 0,
        last_reset_at = NOW();
END;
$$;

-- Schedule the reset job to run daily at midnight UTC
SELECT cron.schedule(
    'reset_daily_tokens_job',
    '0 0 * * *', -- At 00:00 UTC every day
    'CALL public.reset_daily_tokens();'
);
