-- Supabase Migration: CEOVA Library System & Google Drive Integration

-- 1. Folders table
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drive_id TEXT UNIQUE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Files table (Metadata-only repository for Drive, local, and AI-generated files)
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drive_id TEXT UNIQUE,
    storage_source TEXT NOT NULL DEFAULT 'gdrive', -- 'gdrive' | 'local' | 'ai_generated'
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    category TEXT NOT NULL DEFAULT 'documents', -- 'documents' | 'images' | 'videos' | 'audio' | 'pdfs' | 'presentations' | 'spreadsheets' | 'archives' | 'ai_generated' | 'other'
    size BIGINT DEFAULT 0,
    thumbnail_url TEXT,
    web_view_link TEXT,
    web_download_link TEXT,
    parent_folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
    owner_email TEXT,
    owner_name TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    ocr_text TEXT,
    summary TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Generated Files table (Audit trail & reference)
CREATE TABLE IF NOT EXISTS public.ai_generated_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
    prompt TEXT,
    tool_used TEXT NOT NULL, -- 'generator' | 'ocr' | 'converter' | 'quiz' | 'flashcard' | 'summary' | 'presentation' | 'action_items'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. File Embeddings table (For RAG Chat with Files)
CREATE TABLE IF NOT EXISTS public.file_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Drive Sync Logs (Tracks page tokens and delta synchronization state)
CREATE TABLE IF NOT EXISTS public.drive_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'failed'
    page_token TEXT,
    synced_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON public.files(category);
CREATE INDEX IF NOT EXISTS idx_files_drive_id ON public.files(drive_id);
CREATE INDEX IF NOT EXISTS idx_files_trashed ON public.files(is_trashed);
CREATE INDEX IF NOT EXISTS idx_files_favorite ON public.files(is_favorite);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_drive_id ON public.folders(drive_id);

-- Row Level Security (RLS)
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Folders
DO $$ BEGIN
    CREATE POLICY "Users can access own folders" ON public.folders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for Files
DO $$ BEGIN
    CREATE POLICY "Users can access own files" ON public.files FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for AI Generated Files
DO $$ BEGIN
    CREATE POLICY "Users can access own ai files" ON public.ai_generated_files FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for File Embeddings
DO $$ BEGIN
    CREATE POLICY "Users can access own embeddings" ON public.file_embeddings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for Drive Sync Logs
DO $$ BEGIN
    CREATE POLICY "Users can access own sync logs" ON public.drive_sync_logs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
