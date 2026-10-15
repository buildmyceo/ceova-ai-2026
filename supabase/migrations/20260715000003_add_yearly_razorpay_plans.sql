-- ============================================================
-- Add razorpay_yearly_plan_id to subscription_plans
-- ============================================================

ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS razorpay_yearly_plan_id TEXT;

-- Update Flow plan price
UPDATE public.subscription_plans
SET monthly_price = 499.00,
    annual_price = 5389.00
WHERE slug = 'pro';
