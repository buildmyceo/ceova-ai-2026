-- ============================================================
-- Phase 7: Subscription Renewal — pg_cron Scheduler
-- Migration: 20260604000006_renewal_cron.sql
--
-- PREREQUISITE: pg_cron extension must be enabled in the
-- Supabase Dashboard before running this migration:
--   Database → Extensions → pg_cron → Enable
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Enable pg_cron extension (idempotent)
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─────────────────────────────────────────────────────────────
-- 2. Remove any previous version of this job (safe re-run)
-- ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('process-subscription-renewals')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-subscription-renewals'
);

-- ─────────────────────────────────────────────────────────────
-- 3. Register the hourly renewal cron job
--    Fires at the top of every hour (e.g. 01:00, 02:00 ...)
--    A user's cycle_end is processed within 60 minutes of expiry
-- ─────────────────────────────────────────────────────────────
SELECT cron.schedule(
    'process-subscription-renewals',   -- unique job name
    '0 * * * *',                        -- every hour at :00
    $$ CALL public.process_subscription_renewals(); $$
);

-- ─────────────────────────────────────────────────────────────
-- 4. Verify the job was registered correctly
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    job_count INT;
BEGIN
    SELECT COUNT(*) INTO job_count
    FROM cron.job
    WHERE jobname = 'process-subscription-renewals';

    IF job_count = 0 THEN
        RAISE EXCEPTION '[CRON] Registration failed: job not found in cron.job table';
    ELSE
        RAISE LOG '[CRON] process-subscription-renewals registered successfully';
    END IF;
END;
$$;
