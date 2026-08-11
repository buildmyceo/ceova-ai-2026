-- Fix user_telegram table:
-- The current table has a composite PK of (user_id, chat_id) with chat_id NOT NULL.
-- This breaks the connect flow where we insert a pending row with only user_id + connect_token.
-- Fix: drop old PK, make user_id the sole PK, make chat_id nullable.

-- 1. Drop the existing composite primary key
ALTER TABLE public.user_telegram DROP CONSTRAINT IF EXISTS user_telegram_pkey;

-- 2. Add user_id as the sole primary key
ALTER TABLE public.user_telegram ADD PRIMARY KEY (user_id);

-- 3. Make chat_id nullable (it will be filled in after Telegram confirms the link)
ALTER TABLE public.user_telegram ALTER COLUMN chat_id DROP NOT NULL;

-- 4. Add a unique index on chat_id (non-null) to prevent one Telegram account linking to multiple users
CREATE UNIQUE INDEX IF NOT EXISTS user_telegram_chat_id_unique 
  ON public.user_telegram (chat_id) 
  WHERE chat_id IS NOT NULL;
