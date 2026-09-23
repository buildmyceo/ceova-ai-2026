-- Revert the cron job back to hourly schedule
-- SECURITY: Use Supabase vault/settings for the service role key instead of hardcoding it.
SELECT cron.schedule(
    'ceova-process-email-queue',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/process-email-queue',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{"source": "cron"}'::jsonb
    );
    $$
);
