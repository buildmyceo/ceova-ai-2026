-- 1. Create Google Mail emails table
CREATE TABLE IF NOT EXISTS public.gmail_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gmail_id TEXT UNIQUE NOT NULL,
    thread_id TEXT,
    name TEXT NOT NULL,
    from_sender TEXT,
    snippet TEXT,
    label_ids TEXT[],
    web_view_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Google Calendar events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gcal_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    attendees TEXT[],
    html_link TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_gmail_emails_user_id ON public.gmail_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);

-- Row Level Security (RLS)
ALTER TABLE public.gmail_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies for Gmail Emails
DROP POLICY IF EXISTS "Users can read own emails or workspace owner emails" ON public.gmail_emails;
DROP POLICY IF EXISTS "Users can read their own emails" ON public.gmail_emails;
CREATE POLICY "Users can read their own emails" ON public.gmail_emails FOR SELECT USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can insert their own emails" ON public.gmail_emails;
CREATE POLICY "Users can insert their own emails" ON public.gmail_emails FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own emails" ON public.gmail_emails;
CREATE POLICY "Users can update their own emails" ON public.gmail_emails FOR UPDATE USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their own emails" ON public.gmail_emails;
CREATE POLICY "Users can delete their own emails" ON public.gmail_emails FOR DELETE USING (
    user_id = auth.uid()
);


-- Policies for Calendar Events
DROP POLICY IF EXISTS "Users can read own events or workspace owner events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can read their own events" ON public.calendar_events;
CREATE POLICY "Users can read their own events" ON public.calendar_events FOR SELECT USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can insert their own events" ON public.calendar_events;
CREATE POLICY "Users can insert their own events" ON public.calendar_events FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their own events" ON public.calendar_events;
CREATE POLICY "Users can update their own events" ON public.calendar_events FOR UPDATE USING (
    user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their own events" ON public.calendar_events;
CREATE POLICY "Users can delete their own events" ON public.calendar_events FOR DELETE USING (
    user_id = auth.uid()
);
