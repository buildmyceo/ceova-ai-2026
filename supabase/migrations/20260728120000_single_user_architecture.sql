-- Revert RLS Policies to Clean Single-User Architecture

-- 1. Reset user_google_tokens policies
DROP POLICY IF EXISTS "Users can read own google tokens or workspace owner tokens" ON public.user_google_tokens;
DROP POLICY IF EXISTS "Users can read their own google tokens" ON public.user_google_tokens;
CREATE POLICY "Users can read their own google tokens" ON public.user_google_tokens FOR SELECT USING (
    user_id = auth.uid()
);

-- 2. Reset files policies
DROP POLICY IF EXISTS "Users can read own files or workspace owner files" ON public.files;
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
CREATE POLICY "Users can view their own files" ON public.files FOR SELECT USING (
    user_id = auth.uid()
);

-- 3. Reset folders policies
DROP POLICY IF EXISTS "Users can read own folders or workspace owner folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders" ON public.folders FOR SELECT USING (
    user_id = auth.uid()
);

-- 4. Reset gmail_emails policies
DROP POLICY IF EXISTS "Users can read own emails or workspace owner emails" ON public.gmail_emails;
DROP POLICY IF EXISTS "Users can read their own emails" ON public.gmail_emails;
CREATE POLICY "Users can read their own emails" ON public.gmail_emails FOR SELECT USING (
    user_id = auth.uid()
);

-- 5. Reset calendar_events policies
DROP POLICY IF EXISTS "Users can read own events or workspace owner events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can read their own events" ON public.calendar_events;
CREATE POLICY "Users can read their own events" ON public.calendar_events FOR SELECT USING (
    user_id = auth.uid()
);

-- 6. Clean up temporary / team tables if desired
DROP TABLE IF EXISTS public.workspace_invites CASCADE;
