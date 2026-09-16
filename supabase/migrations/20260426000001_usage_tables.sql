-- =============================================
-- USER TOKENS TABLE
-- Used exclusively for Ceova AI responses
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_tokens (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens_remaining  INT NOT NULL DEFAULT 2000,
  last_refill_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tokens" ON public.user_tokens;
CREATE POLICY "Users can read own tokens"
  ON public.user_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Service role handles writes (Edge Function uses service role key)
DROP POLICY IF EXISTS "Service role can manage tokens" ON public.user_tokens;
CREATE POLICY "Service role can manage tokens"
  ON public.user_tokens FOR ALL
  USING (true)
  WITH CHECK (true);


-- =============================================
-- USER ACTIONS TABLE
-- Used exclusively for external API / integration calls
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_actions (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_actions_used       INT NOT NULL DEFAULT 0,
  paid_actions_remaining  INT NOT NULL DEFAULT 0
);

ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own actions" ON public.user_actions;
CREATE POLICY "Users can read own actions"
  ON public.user_actions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role handles writes
DROP POLICY IF EXISTS "Service role can manage actions" ON public.user_actions;
CREATE POLICY "Service role can manage actions"
  ON public.user_actions FOR ALL
  USING (true)
  WITH CHECK (true);
