CREATE TABLE IF NOT EXISTS public.user_ai_usage (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    requests_count INTEGER DEFAULT 1,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.user_ai_usage ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own usage
DROP POLICY IF EXISTS "Users can view their own AI usage" ON public.user_ai_usage;
CREATE POLICY "Users can view their own AI usage"
    ON public.user_ai_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (bypasses RLS anyway, but good practice to be explicit if needed)
