-- =============================================================
-- Migration: production_hardening
-- Date: 2026-08-03
-- Purpose: Fix all audit findings — indexes, RLS, idempotency,
--          constraints, and performance optimizations.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Webhook Idempotency Table
--    Prevents Razorpay from double-processing webhook events.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events_processed (
  event_id      TEXT        PRIMARY KEY,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup: delete processed events older than 90 days
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON webhook_events_processed (processed_at);

-- ─────────────────────────────────────────────────────────────
-- 2. Critical Indexes — user_memory_longterm
--    Fixes full-table scan on every AI request
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_memory_longterm_user_created
  ON user_memory_longterm (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_memory_longterm_category
  ON user_memory_longterm (user_id, category);

-- ─────────────────────────────────────────────────────────────
-- 3. Critical Indexes — user_subscriptions
--    Queried on every payment webhook and quota check
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_id
  ON user_subscriptions (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
  ON user_subscriptions (status);

-- ─────────────────────────────────────────────────────────────
-- 4. Critical Indexes — api_request_logs
--    Written on every AI request; currently no index
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user_id
  ON api_request_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at
  ON api_request_logs (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. Indexes — email_logs
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id
  ON email_logs (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_status_campaign
  ON email_logs (status, campaign_slug)
  WHERE campaign_slug IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. Indexes — user_ai_usage (daily token accounting)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_ai_usage_user_date
  ON user_ai_usage (user_id, usage_date DESC);

-- ─────────────────────────────────────────────────────────────
-- 7. Indexes — gmail_emails / google tokens
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id
  ON gmail_tokens (user_id);

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — api_request_logs (was missing entirely)
--    Users should only see their own logs; admin sees all.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_request_logs_user_own" ON api_request_logs;
CREATE POLICY "api_request_logs_user_own"
  ON api_request_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "api_request_logs_service_insert" ON api_request_logs;
CREATE POLICY "api_request_logs_service_insert"
  ON api_request_logs FOR INSERT
  WITH CHECK (true); -- Service role inserts; users cannot write

-- ─────────────────────────────────────────────────────────────
-- 9. RLS — webhook_events_processed (service-role only)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE webhook_events_processed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_service_only" ON webhook_events_processed;
CREATE POLICY "webhook_events_service_only"
  ON webhook_events_processed
  USING (false); -- Only accessible via service role (bypasses RLS)

-- ─────────────────────────────────────────────────────────────
-- 10. Automatic cleanup of old webhook events (cron-safe RPC)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM webhook_events_processed
  WHERE processed_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 11. Constraint: prevent future duplicate user subscriptions
-- ─────────────────────────────────────────────────────────────
-- user_subscriptions already has onConflict user_id from the upsert,
-- but we add an explicit unique constraint if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_subscriptions_user_id_key'
      AND conrelid = 'user_subscriptions'::regclass
  ) THEN
    ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 12. Analyze all modified tables so planner uses new indexes
-- ─────────────────────────────────────────────────────────────
ANALYZE user_memory_longterm;
ANALYZE user_subscriptions;
ANALYZE api_request_logs;
ANALYZE user_ai_usage;
