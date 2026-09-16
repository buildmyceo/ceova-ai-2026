-- ============================================================
-- Phase 4.1: Subscription Auto-Provisioning Triggers & Backfill
-- Migration: 20260604000003_subscription_triggers.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Trigger Function: handle_new_user_subscription
--    Automatically assigns the Free plan to newly registered users
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
    new_sub_id UUID;
BEGIN
    -- Fetch the Free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'free' LIMIT 1;
    
    IF free_plan_id IS NOT NULL THEN
        -- Insert subscription (Ignore if it somehow exists)
        INSERT INTO public.user_subscriptions 
            (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
        VALUES 
            (NEW.id, free_plan_id, 'active', 'monthly', NOW(), NOW() + INTERVAL '30 days')
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id INTO new_sub_id;
        
        -- If subscription inserted, initialize usage limits
        IF new_sub_id IS NOT NULL THEN
            INSERT INTO public.subscription_usage 
                (subscription_id, user_id, cycle_start, cycle_end)
            VALUES 
                (new_sub_id, NEW.id, NOW(), NOW() + INTERVAL '30 days');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- ─────────────────────────────────────────────────────────────
-- 2. Backfill Existing Users
--    Loops through all users missing a subscription and assigns Free
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    free_plan_id UUID;
    user_record RECORD;
    new_sub_id UUID;
BEGIN
    -- Get Free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'free' LIMIT 1;
    
    IF free_plan_id IS NOT NULL THEN
        FOR user_record IN 
            SELECT id FROM auth.users 
            WHERE id NOT IN (SELECT user_id FROM public.user_subscriptions) 
        LOOP
            -- Create subscription
            INSERT INTO public.user_subscriptions 
                (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
            VALUES 
                (user_record.id, free_plan_id, 'active', 'monthly', NOW(), NOW() + INTERVAL '30 days')
            RETURNING id INTO new_sub_id;
            
            -- Initialize usage
            INSERT INTO public.subscription_usage 
                (subscription_id, user_id, cycle_start, cycle_end)
            VALUES 
                (new_sub_id, user_record.id, NOW(), NOW() + INTERVAL '30 days');
        END LOOP;
    END IF;
END;
$$;
