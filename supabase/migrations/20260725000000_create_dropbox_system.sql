-- Supabase Migration: CEOVA Dropbox Storage Provider Integration

-- 1. user_dropbox_tokens table (Secure storage for OAuth tokens and sync cursor per user)
CREATE TABLE IF NOT EXISTS public.user_dropbox_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    account_id TEXT,
    cursor TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. dropbox_sync_logs table (Tracks initial and incremental delta synchronization state)
CREATE TABLE IF NOT EXISTS public.dropbox_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'failed'
    cursor TEXT,
    synced_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for rapid user lookup
CREATE INDEX IF NOT EXISTS idx_user_dropbox_tokens_user_id ON public.user_dropbox_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_dropbox_sync_logs_user_id ON public.dropbox_sync_logs(user_id);

-- Row Level Security (RLS)
ALTER TABLE public.user_dropbox_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dropbox_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for user_dropbox_tokens
DO $$ BEGIN
    CREATE POLICY "Users can manage their own dropbox tokens"
        ON public.user_dropbox_tokens
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for dropbox_sync_logs
DO $$ BEGIN
    CREATE POLICY "Users can access own dropbox sync logs"
        ON public.dropbox_sync_logs
        FOR ALL
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
