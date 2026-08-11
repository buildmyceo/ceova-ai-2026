import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthProvider';
import { PermissionService } from '../services/PermissionService';

const WorkspaceContext = createContext();

export function WorkspaceProvider({ children }) {
    const { user, session } = useAuth();
    const [workspaces, setWorkspaces] = useState([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState(new PermissionService('visitor', null));

    useEffect(() => {
        if (!user || !session) {
            setWorkspaces([]);
            setActiveWorkspaceId(null);
            setLoading(false);
            return;
        }

        const fetchWorkspaces = async () => {
            try {
                setLoading(true);
                // Fetch workspaces where user is owner OR a member
                const { data, error } = await supabase
                    .from('workspaces')
                    .select(`
                        id, 
                        name, 
                        is_team_mode, 
                        owner_id, 
                        workspace_members!inner(role, invitation_status)
                    `)
                    .eq('workspace_members.user_id', user.id)
                    .eq('workspace_members.invitation_status', 'accepted')
                    .order('created_at', { ascending: true });

                if (error) {
                    console.error("Error fetching workspaces:", error);
                    return;
                }

                if (data && data.length > 0) {
                    const formattedWorkspaces = data.map(ws => ({
                        id: ws.id,
                        name: ws.name,
                        is_team_mode: ws.is_team_mode,
                        owner_id: ws.owner_id,
                        role: ws.workspace_members[0]?.role
                    }));
                    
                    setWorkspaces(formattedWorkspaces);

                    // Restore last active workspace from localStorage or default to own workspace
                    const savedWorkspaceId = localStorage.getItem('ceova_active_workspace');
                    const ownWorkspace = formattedWorkspaces.find(ws => ws.owner_id === user.id);
                    
                    if (savedWorkspaceId && formattedWorkspaces.find(ws => ws.id === savedWorkspaceId)) {
                        setActiveWorkspaceId(savedWorkspaceId);
                    } else if (ownWorkspace) {
                        setActiveWorkspaceId(ownWorkspace.id);
                        localStorage.setItem('ceova_active_workspace', ownWorkspace.id);
                    } else if (formattedWorkspaces.length > 0) {
                        setActiveWorkspaceId(formattedWorkspaces[0].id);
                        localStorage.setItem('ceova_active_workspace', formattedWorkspaces[0].id);
                    }
                }
            } catch (err) {
                console.error("Error in fetchWorkspaces:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchWorkspaces();
    }, [user, session]);

    const switchWorkspace = (workspaceId) => {
        if (workspaces.find(ws => ws.id === workspaceId)) {
            setActiveWorkspaceId(workspaceId);
            localStorage.setItem('ceova_active_workspace', workspaceId);
            // Optionally, trigger a re-fetch of workspace-specific data (e.g. chats, library)
            window.dispatchEvent(new Event('workspaceChanged'));
        }
    };

    // Effect to fetch and set permissions whenever the active workspace changes
    useEffect(() => {
        const loadPermissions = async () => {
            const activeWs = workspaces.find(ws => ws.id === activeWorkspaceId);
            if (!activeWs) return;

            if (activeWs.role === 'owner') {
                setPermissions(new PermissionService('owner', null));
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('workspace_permissions')
                    .select('*')
                    .eq('workspace_id', activeWs.id)
                    .eq('role', activeWs.role)
                    .maybeSingle();
                
                if (error) throw error;
                setPermissions(new PermissionService(activeWs.role, data));
            } catch (err) {
                console.error("Error fetching workspace permissions:", err);
                setPermissions(new PermissionService(activeWs.role, null)); // fallback to defaults
            }
        };

        loadPermissions();
    }, [activeWorkspaceId, workspaces]);

    const createWorkspace = async (name) => {
        // Since we moved to a single primary workspace model, this function might no longer be needed 
        // for regular users to create arbitrary teams, but kept for legacy/admin flows if needed.
        return { success: false, error: "Workspace creation is handled automatically on sign-up." };
    };

    const activeWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId);

    return (
        <WorkspaceContext.Provider value={{
            workspaces,
            activeWorkspace,
            activeWorkspaceId,
            switchWorkspace,
            createWorkspace,
            loading,
            permissions
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    return useContext(WorkspaceContext);
}
