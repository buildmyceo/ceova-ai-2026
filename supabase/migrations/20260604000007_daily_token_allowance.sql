-- ============================================================
-- Phase 6: Daily Token Allowance Architecture
-- Migration: 20260604000007_daily_token_allowance.sql
-- ============================================================

-- 1. Rename columns
ALTER TABLE public.subscription_plans RENAME COLUMN token_limit_per_cycle TO daily_token_limit;
ALTER TABLE public.subscription_usage RENAME COLUMN total_tokens TO daily_tokens_used;
ALTER TABLE public.subscription_usage ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Update existing default plans to new daily limits
UPDATE public.subscription_plans SET daily_token_limit = 2000 WHERE slug = 'free';
UPDATE public.subscription_plans SET daily_token_limit = 50000 WHERE slug = 'pro';
UPDATE public.subscription_plans SET daily_token_limit = 250000 WHERE slug = 'business';

-- 3. Replace the usage synchronization trigger
-- This ensures that only daily_tokens_used is updated
CREATE OR REPLACE FUNCTION public.increment_subscription_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment if it's an official Ceova AI request
    IF NEW.mode = 'ceova_ai' THEN
        UPDATE public.subscription_usage
        SET total_requests = total_requests + NEW.requests_count,
            daily_tokens_used = daily_tokens_used + NEW.total_tokens,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND cycle_start <= NEW.created_at
          AND cycle_end >= NEW.created_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
