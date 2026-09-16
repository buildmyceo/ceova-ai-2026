-- Create user_files bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('user_files', 'user_files', false) ON CONFLICT DO NOTHING;

-- RLS for user_files bucket
CREATE POLICY "Users can upload their own files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read their own files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'user_files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create user_files table
CREATE TABLE IF NOT EXISTS public.user_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    extracted_text TEXT,
    page_count INTEGER,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for user_files table
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own file metadata" ON public.user_files FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read their own file metadata" ON public.user_files FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update their own file metadata" ON public.user_files FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own file metadata" ON public.user_files FOR DELETE TO authenticated USING (user_id = auth.uid());
