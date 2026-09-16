CREATE TABLE IF NOT EXISTS user_google_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

-- Only users can see their own tokens (and service role can see all)
CREATE POLICY "Users can manage their own google tokens"
    ON user_google_tokens
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
