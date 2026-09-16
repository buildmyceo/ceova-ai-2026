-- ================================================================
-- Migration: memory_summaries table
-- ChatGPT-style AI-generated summaries derived from user_memory_longterm
-- ================================================================

CREATE TABLE IF NOT EXISTS memory_summaries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  summary     text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

-- RLS
ALTER TABLE memory_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their memory summaries"
  ON memory_summaries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_memory_summaries_user_id ON memory_summaries(user_id);

-- Service role can manage summaries (for edge functions)
CREATE POLICY "Service role can manage memory summaries"
  ON memory_summaries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
