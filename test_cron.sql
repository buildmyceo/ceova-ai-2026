-- SECURITY: Use Supabase vault for the service role key instead of hardcoding it.
-- 1. Enable vault extension (if not already enabled):
--    CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
-- 2. Store your new key in the vault:
--    SELECT vault.create_secret('your-new-rotated-key-here', 'service_role_key');

SELECT cron.schedule(
    'ceova-process-email-queue',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/process-email-queue',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
            'Content-Type', 'application/json'
        ),
        body := '{"source": "cron"}'::jsonb
    );
    $$
);
