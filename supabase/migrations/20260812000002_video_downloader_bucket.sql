-- Create temp_videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'temp_videos',
    'temp_videos',
    false, -- private bucket
    524288000, -- 500 MB limit
    '{video/mp4,video/webm,audio/mpeg,audio/m4a,video/x-matroska}'
) ON CONFLICT (id) DO NOTHING;

-- RLS Policies for temp_videos
-- Users can only insert files in their own folder
CREATE POLICY "Users can upload temp videos to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'temp_videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own temp videos
CREATE POLICY "Users can view their own temp videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'temp_videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own temp videos
CREATE POLICY "Users can delete their own temp videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'temp_videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Note: The cleanup edge function uses the service_role key, 
-- so it bypasses RLS to delete expired videos.

-- Setup pg_cron for the cleanup function
-- This requires the pg_net extension to invoke the edge function.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job to run every 5 minutes
-- Make sure to replace YOUR_PROJECT_REF with the actual ref or use the generic pg_net call
-- For Supabase environments, pg_net is standard for invoking Edge Functions from cron.
-- Alternatively, we can use pg_cron if we had a direct DB-level cleanup, but the file cleanup
-- requires calling the Storage API, which is why an Edge Function is used.
SELECT cron.schedule(
    'cleanup-temp-videos-cron',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url', true) || '/cleanup-temp-videos',
        headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
    )
    $$
);

-- Alter public.files to support temporary video downloader items
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
