CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own waitlist" ON public.waitlist;
CREATE POLICY "Users can insert their own waitlist"
    ON public.waitlist FOR INSERT
    WITH CHECK (true);
