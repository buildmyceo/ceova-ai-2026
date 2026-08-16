-- Fix: Change drive_id UNIQUE to unique per user (user_id + drive_id)
-- This allows different users to have files with same drive_id (shouldn't happen in practice)
-- and more importantly allows the upsert to work correctly

-- Drop old global unique constraints
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_drive_id_key;
ALTER TABLE public.folders DROP CONSTRAINT IF EXISTS folders_drive_id_key;

-- Add composite unique constraints (per user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'files_user_drive_id_unique'
  ) THEN
    ALTER TABLE public.files ADD CONSTRAINT files_user_drive_id_unique UNIQUE (user_id, drive_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'folders_user_drive_id_unique'
  ) THEN
    ALTER TABLE public.folders ADD CONSTRAINT folders_user_drive_id_unique UNIQUE (user_id, drive_id);
  END IF;
END $$;
