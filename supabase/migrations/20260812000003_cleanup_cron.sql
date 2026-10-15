-- Enable pg_cron extension if not already enabled (might require superuser, usually enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run every 5 minutes
SELECT cron.schedule(
  'cleanup-temp-videos-cron', -- name of the cron job
  '*/5 * * * *',              -- every 5 minutes
  $$
    -- Call the Edge Function using pg_net or http extension
    -- Note: We use the local REST API or pg_net if available.
    -- Assuming pg_net is available for webhooks. If not, it can be triggered externally.
    SELECT net.http_post(
        url:='https://jqpbgcmrlpfqnellznhz.supabase.co/functions/v1/cleanup-temp-videos',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
    );
  $$
);
