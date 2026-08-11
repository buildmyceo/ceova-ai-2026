-- Cleanup unused tables and functions from discarded features

-- Dev System & Workspaces
DROP TABLE IF EXISTS public.user_github_tokens CASCADE;
DROP TABLE IF EXISTS public.user_vercel_tokens CASCADE;
DROP TABLE IF EXISTS public.ceova_projects CASCADE;
DROP TABLE IF EXISTS public.dev_workspaces CASCADE;
DROP TABLE IF EXISTS public.dev_file_audit_log CASCADE;
DROP TABLE IF EXISTS public.dev_terminal_logs CASCADE;
DROP TABLE IF EXISTS public.dev_sessions CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- Custom AIs (Avatars)
DROP TABLE IF EXISTS public.user_ai_configs CASCADE;
DROP TABLE IF EXISTS public.user_ai_keys CASCADE;

-- Workspaces Storage Bucket (from deleted migration)
DELETE FROM storage.buckets WHERE id = 'workspaces';

-- Telegram columns
ALTER TABLE public.user_tokens DROP COLUMN IF EXISTS telegram_chat_id CASCADE;
ALTER TABLE public.user_tokens DROP COLUMN IF EXISTS telegram_link_code CASCADE;

-- Workspace tables
DROP TABLE IF EXISTS public.workspace_permissions CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
