-- Create the user_usage table for tracking token and task limits
CREATE TABLE IF NOT EXISTS public.user_usage (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tokens_used BIGINT DEFAULT 0,
    tasks_used INT DEFAULT 0,
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to handle auto-updating the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.user_usage;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.user_usage
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Policies for usage tracking
CREATE POLICY "Users can view their own usage" 
ON public.user_usage FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" 
ON public.user_usage FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage" 
ON public.user_usage FOR INSERT 
WITH CHECK (auth.uid() = user_id);
