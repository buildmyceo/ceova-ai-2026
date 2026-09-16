-- 1. Wipe all existing workspace data to start fresh as requested
DELETE FROM public.workspace_invites;
DELETE FROM public.workspace_members;
DELETE FROM public.workspace_permissions;
DELETE FROM public.workspaces;

-- 2. Modify `workspaces` table
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_type_check;
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS type;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_team_mode BOOLEAN DEFAULT false NOT NULL;

-- 3. Modify roles (keep only owner and member)
DELETE FROM public.workspace_roles WHERE name IN ('admin', 'visitor');
-- Re-insert member if it was deleted
INSERT INTO public.workspace_roles (name, description) VALUES ('member', 'Standard member access') ON CONFLICT DO NOTHING;

-- 3.5 Rewrite handle_new_workspace_permissions to not insert visitor
CREATE OR REPLACE FUNCTION public.handle_new_workspace_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- Default Member permissions
    INSERT INTO public.workspace_permissions (
        workspace_id, role, 
        can_use_apps, can_access_accounts, can_use_memory, can_access_library, 
        can_create_chat, can_view_chats, can_upload_files, can_delete_files, can_edit_memory
    ) VALUES (
        NEW.id, 'member',
        true, false, true, true,
        true, false, true, false, false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update the trigger for new users to only create a default workspace
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER AS $$
DECLARE
    new_workspace_id UUID;
BEGIN
    INSERT INTO public.workspaces (name, is_team_mode, owner_id)
    VALUES ('My Workspace', false, NEW.id)
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, invitation_status)
    VALUES (new_workspace_id, NEW.id, 'owner', 'accepted');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate workspaces for existing users
DO $$
DECLARE
    u RECORD;
    new_workspace_id UUID;
BEGIN
    FOR u IN SELECT id FROM auth.users LOOP
        INSERT INTO public.workspaces (name, is_team_mode, owner_id)
        VALUES ('My Workspace', false, u.id)
        RETURNING id INTO new_workspace_id;

        INSERT INTO public.workspace_members (workspace_id, user_id, role, invitation_status)
        VALUES (new_workspace_id, u.id, 'owner', 'accepted');
    END LOOP;
END;
$$;

-- 6. Update Policies on Workspaces
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON public.workspaces;
CREATE POLICY "Users can view workspaces they are members of" ON public.workspaces FOR SELECT USING (
    owner_id = auth.uid() OR (
        is_team_mode = true AND id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND invitation_status = 'accepted'
        )
    )
);

-- 7. Update Policies on user_google_tokens so members can read the owner's tokens IF team mode is on
DROP POLICY IF EXISTS "Users can manage their own google tokens" ON public.user_google_tokens;
CREATE POLICY "Users can read own google tokens or workspace owner tokens" ON public.user_google_tokens FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IN (
        SELECT owner_id FROM public.workspaces 
        WHERE is_team_mode = true AND id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND invitation_status = 'accepted'
        )
    )
);

CREATE POLICY "Users can insert their own google tokens" ON public.user_google_tokens FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

CREATE POLICY "Users can update their own google tokens" ON public.user_google_tokens FOR UPDATE USING (
    user_id = auth.uid()
);

CREATE POLICY "Users can delete their own google tokens" ON public.user_google_tokens FOR DELETE USING (
    user_id = auth.uid()
);
