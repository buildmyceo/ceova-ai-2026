-- Migration: Add phone_dispute_reports table and update check_phone_link_limit to return linked_email

CREATE TABLE IF NOT EXISTS public.phone_dispute_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    reported_email TEXT,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.phone_dispute_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and service role dispute insert" ON public.phone_dispute_reports;
CREATE POLICY "Allow authenticated and service role dispute insert" ON public.phone_dispute_reports
    FOR ALL USING (true) WITH CHECK (true);

-- Update check_phone_link_limit to return linked_email for conflict slide
CREATE OR REPLACE FUNCTION public.check_phone_link_limit(target_phone text, check_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    clean_digits text;
    existing_count integer;
    user_plan text := 'Spark';
    max_emails integer := 1;
    curr_user_id uuid;
    curr_email text;
    first_linked_email text;
BEGIN
    curr_user_id := COALESCE(check_user_id, auth.uid());
    clean_digits := regexp_replace(target_phone, '[^0-9]', '', 'g');

    IF clean_digits IS NULL OR length(clean_digits) < 7 THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Invalid phone number format.'
        );
    END IF;

    -- Get current user email if available
    IF curr_user_id IS NOT NULL THEN
        SELECT email INTO curr_email FROM auth.users WHERE id = curr_user_id;
    END IF;

    -- Determine user subscription plan (Spark = 1 mail, Flow / Orbit = 5 mails)
    IF curr_user_id IS NOT NULL THEN
        SELECT 
            CASE 
                WHEN p.name ILIKE '%flow%' OR p.slug = 'pro' OR p.name ILIKE '%orbit%' OR p.slug = 'business' THEN 'Flow'
                ELSE 'Spark'
            END
        INTO user_plan
        FROM public.user_subscriptions s
        JOIN public.subscription_plans p ON s.plan_id = p.id
        WHERE s.user_id = curr_user_id AND s.status = 'active'
        LIMIT 1;

        IF user_plan IS NULL THEN
            user_plan := 'Spark';
        END IF;
    ELSE
        user_plan := 'Spark';
    END IF;

    -- Quota based on plan: Flow = 5, Spark = 1
    IF user_plan = 'Flow' THEN
        max_emails := 5;
    ELSE
        max_emails := 1;
    END IF;

    -- Find first linked other email
    SELECT email INTO first_linked_email
    FROM (
        SELECT email FROM public.user_phone_links
        WHERE regexp_replace(phone, '[^0-9]', '', 'g') = clean_digits
          AND (curr_user_id IS NULL OR user_id != curr_user_id)
        UNION
        SELECT email FROM auth.users
        WHERE (phone IS NOT NULL AND phone != '')
          AND regexp_replace(phone, '[^0-9]', '', 'g') = clean_digits
          AND (curr_user_id IS NULL OR id != curr_user_id)
    ) linked_accounts
    WHERE email IS NOT NULL AND email != ''
    LIMIT 1;

    -- Count distinct other emails already linked to this phone number
    SELECT count(DISTINCT email) INTO existing_count
    FROM (
        SELECT email FROM public.user_phone_links
        WHERE regexp_replace(phone, '[^0-9]', '', 'g') = clean_digits
          AND (curr_user_id IS NULL OR user_id != curr_user_id)
        UNION
        SELECT email FROM auth.users
        WHERE (phone IS NOT NULL AND phone != '')
          AND regexp_replace(phone, '[^0-9]', '', 'g') = clean_digits
          AND (curr_user_id IS NULL OR id != curr_user_id)
    ) linked_accounts;

    IF existing_count >= max_emails THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'limit_reached', true,
            'plan', user_plan,
            'count', existing_count,
            'max_allowed', max_emails,
            'linked_email', first_linked_email,
            'reason', 'This phone number is already linked to another email.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'plan', user_plan,
        'count', existing_count,
        'max_allowed', max_emails,
        'remaining', max_emails - existing_count
    );
END;
$function$;
