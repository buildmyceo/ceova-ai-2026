-- ============================================================
-- Phase 5: Usage Counter Synchronization Trigger
-- Migration: 20260604000004_usage_sync_trigger.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Trigger Function: increment_subscription_usage
--    Syncs immutable usage logs (user_ai_usage) with the
--    rolling cycle counters (subscription_usage).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_subscription_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment if it's an official Ceova API request
    -- Custom API and Ollama requests bypass quota logic
    IF NEW.mode = 'ceova_ai' THEN
        UPDATE public.subscription_usage
        SET total_requests = total_requests + NEW.requests_count,
            total_tokens = total_tokens + NEW.total_tokens,
            updated_at = NOW()
        WHERE user_id = NEW.user_id
          AND cycle_start <= NEW.created_at
          AND cycle_end >= NEW.created_at;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_usage_inserted ON public.user_ai_usage;

-- Attach trigger to user_ai_usage
CREATE TRIGGER on_usage_inserted
    AFTER INSERT ON public.user_ai_usage
    FOR EACH ROW EXECUTE FUNCTION public.increment_subscription_usage();
