-- CEOVA Hardening: Database Optimization
-- Adds critical indexes for performance scaling and adds missing constraints

-- 1. Index for memory fetching (called on every chat message)
CREATE INDEX IF NOT EXISTS idx_user_memory_longterm_user_created 
ON user_memory_longterm (user_id, created_at DESC);

-- 2. Index for subscription lookups (called in payment path webhooks)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_sub_id 
ON user_subscriptions (razorpay_subscription_id);

-- 3. Index for API logs (appended to constantly, queried for usage)
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user_id 
ON api_request_logs (user_id);

-- 4. Index for email logs (queried for status)
CREATE INDEX IF NOT EXISTS idx_email_logs_status_campaign 
ON email_logs (status, campaign_slug);

-- Ensure RLS on api_request_logs to prevent data leakage (mentioned in audit)
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view their own request logs" ON api_request_logs;
CREATE POLICY "Users can only view their own request logs"
ON api_request_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only service role can insert into api_request_logs
DROP POLICY IF EXISTS "Service role can insert request logs" ON api_request_logs;
CREATE POLICY "Service role can insert request logs"
ON api_request_logs FOR INSERT
TO service_role
WITH CHECK (true);
