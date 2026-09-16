-- Fix RLS for user_google_tokens so users can insert and update their own tokens
CREATE POLICY "Users can insert their own google tokens" ON public.user_google_tokens FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Users can update their own google tokens" ON public.user_google_tokens FOR UPDATE USING (
    user_id = auth.uid()
) WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Users can delete their own google tokens" ON public.user_google_tokens FOR DELETE USING (
    user_id = auth.uid()
);
