-- Create attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create processed_images bucket (used by background_remover)
INSERT INTO storage.buckets (id, name, public)
VALUES ('processed_images', 'processed_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access on attachments
CREATE POLICY "Public Read Access on attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

-- Allow authenticated users to upload to attachments
CREATE POLICY "Auth Users Upload to attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Allow public read access on processed_images
CREATE POLICY "Public Read Access on processed_images"
ON storage.objects FOR SELECT
USING (bucket_id = 'processed_images');

-- Allow anon and auth to upload to processed_images (since Edge Functions might use service role or anon)
CREATE POLICY "Upload to processed_images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'processed_images');
