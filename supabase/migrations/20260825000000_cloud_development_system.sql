-- =============================================================
-- Migration: 20260825000000_cloud_development_system
-- Date: 2026-08-25
-- Purpose: CEOVA Cloud Development & Hosting Architecture
--          Projects, Files, Versions, Builds, Deployments,
--          Environment Variables, Audit Logs, and Storage Buckets.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Storage Bucket for Deployments
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('deployments', 'deployments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read Access on deployments"
ON storage.objects FOR SELECT
USING (bucket_id = 'deployments');

CREATE POLICY "Service and Auth Users Upload to deployments"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'deployments');

-- ─────────────────────────────────────────────────────────────
-- 2. Projects Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'CREATING', -- CREATING, PLANNING, GENERATING, BUILDING, TESTING, FIXING, DEPLOYING, READY, FAILED
  framework             TEXT NOT NULL DEFAULT 'react-vite',
  runtime               TEXT NOT NULL DEFAULT 'nodejs',
  current_deployment_id UUID,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_slug_unique UNIQUE (slug),
  CONSTRAINT projects_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. Project Files Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  content     TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_files_project_path_unique UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Project Versions Table (Snapshots & Rollbacks)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL DEFAULT 1,
  source_tree     JSONB NOT NULL DEFAULT '{}'::jsonb, -- Map of path -> content
  commit_message  TEXT NOT NULL DEFAULT 'Auto-generated version',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_versions_project_version_unique UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id, version_number DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. Project Builds Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_builds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_id      UUID REFERENCES public.project_versions(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, BUILDING, SUCCESS, FAILED
  build_logs      TEXT NOT NULL DEFAULT '',
  error_summary   JSONB,
  build_duration_ms INTEGER,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_builds_project_id ON public.project_builds(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_builds_status ON public.project_builds(status);

-- ─────────────────────────────────────────────────────────────
-- 6. Deployments Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  build_id        UUID REFERENCES public.project_builds(id) ON DELETE SET NULL,
  version_id      UUID REFERENCES public.project_versions(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'DEPLOYED', -- DEPLOYING, DEPLOYED, ROLLED_BACK, FAILED
  deployment_url  TEXT NOT NULL,
  bundle_path     TEXT NOT NULL, -- Path in 'deployments' storage bucket
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON public.deployments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_url ON public.deployments(deployment_url);

-- Add foreign key constraint for projects.current_deployment_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_current_deployment_id_fkey'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects 
    ADD CONSTRAINT projects_current_deployment_id_fkey 
    FOREIGN KEY (current_deployment_id) REFERENCES public.deployments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 7. Project Environment Variables Table (Encrypted)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_env_vars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  is_build_time   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_env_vars_project_key_unique UNIQUE (project_id, key),
  CONSTRAINT project_env_vars_key_format CHECK (key ~ '^[A-Z_][A-Z0-9_]{0,63}$')
);

CREATE INDEX IF NOT EXISTS idx_project_env_vars_project_id ON public.project_env_vars(project_id);

-- ─────────────────────────────────────────────────────────────
-- 8. Project Audit Logs Table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL, -- project.created, project.build.started, project.build.completed, deployment.completed, etc.
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_audit_logs_project ON public.project_audit_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_audit_logs_user ON public.project_audit_logs(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 9. Row Level Security (RLS) Policies
-- ─────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. projects policies
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- 2. project_files policies
DROP POLICY IF EXISTS "project_files_select_own" ON public.project_files;
CREATE POLICY "project_files_select_own"
  ON public.project_files FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_files_insert_own" ON public.project_files;
CREATE POLICY "project_files_insert_own"
  ON public.project_files FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_files_update_own" ON public.project_files;
CREATE POLICY "project_files_update_own"
  ON public.project_files FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_files_delete_own" ON public.project_files;
CREATE POLICY "project_files_delete_own"
  ON public.project_files FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

-- 3. project_versions policies
DROP POLICY IF EXISTS "project_versions_select_own" ON public.project_versions;
CREATE POLICY "project_versions_select_own"
  ON public.project_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_versions_insert_own" ON public.project_versions;
CREATE POLICY "project_versions_insert_own"
  ON public.project_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()));

-- 4. project_builds policies
DROP POLICY IF EXISTS "project_builds_select_own" ON public.project_builds;
CREATE POLICY "project_builds_select_own"
  ON public.project_builds FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_builds.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_builds_insert_own" ON public.project_builds;
CREATE POLICY "project_builds_insert_own"
  ON public.project_builds FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_builds.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_builds_update_own" ON public.project_builds;
CREATE POLICY "project_builds_update_own"
  ON public.project_builds FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_builds.project_id AND projects.user_id = auth.uid()));

-- 5. deployments policies
-- Public select for serving deployed web projects by slug/URL lookup
DROP POLICY IF EXISTS "deployments_select_public" ON public.deployments;
CREATE POLICY "deployments_select_public"
  ON public.deployments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "deployments_insert_own" ON public.deployments;
CREATE POLICY "deployments_insert_own"
  ON public.deployments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid()));

-- 6. project_env_vars policies
DROP POLICY IF EXISTS "project_env_vars_select_own" ON public.project_env_vars;
CREATE POLICY "project_env_vars_select_own"
  ON public.project_env_vars FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_env_vars.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "project_env_vars_manage_own" ON public.project_env_vars;
CREATE POLICY "project_env_vars_manage_own"
  ON public.project_env_vars FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_env_vars.project_id AND projects.user_id = auth.uid()));

-- 7. project_audit_logs policies
DROP POLICY IF EXISTS "project_audit_logs_select_own" ON public.project_audit_logs;
CREATE POLICY "project_audit_logs_select_own"
  ON public.project_audit_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "project_audit_logs_insert_service_or_auth" ON public.project_audit_logs;
CREATE POLICY "project_audit_logs_insert_service_or_auth"
  ON public.project_audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- ─────────────────────────────────────────────────────────────
-- 10. Reserved Subdomains Validation Helper
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_reserved_slug(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_slug = ANY(ARRAY[
    'api', 'app', 'admin', 'auth', 'mail', 'email', 'status', 'docs',
    'support', 'help', 'blog', 'billing', 'pay', 'cdn', 'static',
    'dev', 'stage', 'staging', 'prod', 'production', 'www', 'root',
    'ceova', 'internal', 'dashboard', 'settings', 'account', 'login', 'signup'
  ]);
END;
$$;
