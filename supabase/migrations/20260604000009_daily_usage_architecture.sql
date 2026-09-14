-- ============================================================
-- Phase 8: Correct Daily Token Architecture
-- Migration: 20260604000009_daily_usage_architecture.sql
-- ============================================================
-- This migration removes all cycle-based token enforcement.
-- Daily quota is now driven by user_ai_usage (one row per request,
-- keyed by date). No cron reset needed — new day = no rows = 0 usage.
-- ============================================================

-- 1. Ensure user_ai_usage has the date column indexed for fast daily lookups
CREATE INDEX IF NOT EXISTS idx_user_ai_usage_user_date 
    ON public.user_ai_usage (user_id, date);

-- 2. Add mode column to user_ai_usage if it doesn't already exist
--    (needed to filter only ceova_ai requests for quota)
ALTER TABLE public.user_ai_usage 
    ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'ceova_ai';

-- 3. Drop the old cycle-based usage trigger (no longer needed)
DROP TRIGGER IF EXISTS on_usage_inserted ON public.user_ai_usage;
DROP FUNCTION IF EXISTS public.increment_subscription_usage();

-- 4. Create a helper function to get today's token usage for a user
--    This is used by the edge function for fast quota checks.
CREATE OR REPLACE FUNCTION public.get_daily_tokens_used(p_user_id UUID)
RETURNS BIGINT AS $$
    SELECT COALESCE(SUM(total_tokens), 0)
    FROM public.user_ai_usage
    WHERE user_id = p_user_id
      AND date = CURRENT_DATE
      AND mode = 'ceova_ai';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
