-- ============================================================
-- Phase 9: Razorpay Subscription Integration
-- Migration: 20260604000010_razorpay_subscription.sql
-- ============================================================

-- 1. Add razorpay_plan_id to subscription_plans
ALTER TABLE public.subscription_plans
    ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT;

-- Free plan has no Razorpay plan (it's free)
UPDATE public.subscription_plans SET razorpay_plan_id = NULL WHERE slug = 'free';
-- Pro and Business plan IDs to be filled in after creating plans in Razorpay dashboard:
-- UPDATE public.subscription_plans SET razorpay_plan_id = 'plan_XXXXXX' WHERE slug = 'pro';
-- UPDATE public.subscription_plans SET razorpay_plan_id = 'plan_YYYYYY' WHERE slug = 'business';

-- 2. Add payment_history to user_subscriptions for audit trail
ALTER TABLE public.user_subscriptions
    ADD COLUMN IF NOT EXISTS payment_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Ensure razorpay_subscription_id and razorpay_customer_id exist (they're in original schema but confirming)
ALTER TABLE public.user_subscriptions
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- 4. Add index for quick razorpay subscription lookups (used by webhook)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_sub_id
    ON public.user_subscriptions (razorpay_subscription_id)
    WHERE razorpay_subscription_id IS NOT NULL;
