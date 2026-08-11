-- 1. Create a unified usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.usage_unified (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    mode TEXT DEFAULT 'unknown',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Migrate existing data from user_usage
INSERT INTO public.usage_unified (user_id, input_tokens, output_tokens, total_tokens, provider, model, mode, date, created_at)
SELECT user_id, input_tokens, output_tokens, total_tokens, provider, model, 'unknown', date, created_at
FROM public.user_usage
ON CONFLICT DO NOTHING;

-- 3. Migrate existing data from user_ai_usage
INSERT INTO public.usage_unified (user_id, input_tokens, output_tokens, total_tokens, provider, model, mode, date, created_at)
SELECT user_id, input_tokens, output_tokens, total_tokens, provider, model, mode, date, created_at
FROM public.user_ai_usage
ON CONFLICT DO NOTHING;

-- Note: We are NOT dropping user_usage or user_ai_usage yet to ensure zero downtime.
-- Once the API is fully migrated to use usage_unified, they can be safely dropped.
