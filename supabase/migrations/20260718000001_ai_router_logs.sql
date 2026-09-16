-- Create AI Router Logs table
CREATE TABLE IF NOT EXISTS public.ai_router_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    task_type TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost NUMERIC DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_router_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own logs
CREATE POLICY "Users can view their own AI logs"
    ON public.ai_router_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_user_id ON public.ai_router_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_router_logs_created_at ON public.ai_router_logs(created_at DESC);
