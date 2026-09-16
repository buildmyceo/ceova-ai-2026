-- ============================================================
-- Update Flow plan Razorpay Plan ID (₹499/month)
-- Migration: 20260823000000_update_flow_razorpay_plan.sql
-- ============================================================

UPDATE public.subscription_plans
SET razorpay_plan_id = 'plan_TT6X5KSCKOILMn',
    monthly_price = 499.00
WHERE slug = 'pro';
