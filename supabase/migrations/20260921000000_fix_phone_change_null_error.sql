-- Fix GoTrue sql: Scan error on column index 22, name "phone_change": converting NULL to string is unsupported
-- GoTrue expects phone_change and phone_change_token to be empty string '', not NULL.

UPDATE auth.users
SET phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, '')
WHERE phone_change IS NULL 
   OR phone_change_token IS NULL
   OR email_change_token_current IS NULL
   OR reauthentication_token IS NULL;

-- Update unlink_user_phone to always reset phone_change to '' instead of NULL
CREATE OR REPLACE FUNCTION public.unlink_user_phone(target_user_id uuid, target_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    clean_phone text;
    digits text;
BEGIN
    clean_phone := trim(target_phone);
    IF NOT clean_phone LIKE '+%' THEN
        clean_phone := '+' || clean_phone;
    END IF;
    digits := regexp_replace(target_phone, '\D', '', 'g');

    -- 1. Remove from user_phone_links
    DELETE FROM public.user_phone_links 
    WHERE user_id = target_user_id 
      AND (phone = clean_phone OR phone = target_phone OR regexp_replace(phone, '\D', '', 'g') = digits);

    -- 2. Clear phone in auth.users safely using empty string for phone_change fields
    UPDATE auth.users
    SET phone = NULL,
        phone_confirmed_at = NULL,
        phone_change = '',
        phone_change_token = '',
        updated_at = now()
    WHERE id = target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Phone disconnected successfully',
        'unlinked_phone', clean_phone
    );
END;
$function$;
