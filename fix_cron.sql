-- Set the service role key so current_setting() works
ALTER DATABASE postgres SET "app.service_role_key" = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwOTIyNywiZXhwIjoyMDg3Njg1MjI3fQ.87TvzMkkZb8t4vhOdhdzRQ19vQklVYF382uhUJR73jE';

-- Ensure pg_net is available
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule the old job
SELECT cron.unschedule('ceova-process-email-queue');

-- Re-schedule with the correct jsonb_build_object syntax
SELECT cron.schedule(
    'ceova-process-email-queue',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/process-email-queue',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{"source": "cron"}'::jsonb
    );
    $$
);
