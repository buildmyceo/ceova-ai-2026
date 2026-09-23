-- SECURITY: Use Supabase vault/settings for the service role key instead of hardcoding it.
-- Before running this, set the key:  ALTER ROLE postgres SET app.settings.service_role_key = 'your-key-here';
SELECT cron.schedule(
    'ceova-process-email-queue',
    '* * * * *',
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
