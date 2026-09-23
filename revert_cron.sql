-- Revert the cron job back to hourly schedule
-- SECURITY: Use Supabase vault for the service role key instead of hardcoding it.
SELECT cron.schedule(
    'ceova-process-email-queue',
    '0 * * * *',
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
