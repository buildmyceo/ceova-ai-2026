// Helper class to manage workspace permissions on the frontend

export const DEFAULT_PERMISSIONS = {
    owner: {
        can_use_apps: true,
        can_access_accounts: true,
        can_use_memory: true,
        can_access_library: true,
        can_create_chat: true,
        can_view_chats: true,
        can_upload_files: true,
        can_delete_files: true,
        can_edit_memory: true
    },
    member: {
        can_use_apps: true,
        can_access_accounts: false,
        can_use_memory: true,
        can_access_library: true,
        can_create_chat: true,
        can_view_chats: false,
        can_upload_files: true,
        can_delete_files: false,
        can_edit_memory: false
    },
    visitor: {
        can_use_apps: false,
        can_access_accounts: false,
        can_use_memory: false,
        can_access_library: true,
        can_create_chat: false,
        can_view_chats: false,
        can_upload_files: false,
        can_delete_files: false,
        can_edit_memory: false
    }
};

export class PermissionService {
    /**
     * @param {string} userRole 'owner', 'member', 'visitor'
     * @param {Object} workspacePermissions The permissions object fetched from the DB for this role
     */
    constructor(userRole, workspacePermissions) {
        this.role = userRole || 'visitor';
        
        if (this.role === 'owner') {
            this.permissions = DEFAULT_PERMISSIONS.owner;
        } else {
            // Fallback to default if not yet synced from DB
            this.permissions = workspacePermissions || DEFAULT_PERMISSIONS[this.role] || DEFAULT_PERMISSIONS.visitor;
        }
    }

    hasPermission(permissionName) {
        if (this.role === 'owner') return true;
        return !!this.permissions[permissionName];
    }

    canUseApps() { return this.hasPermission('can_use_apps'); }
    canAccessAccounts() { return this.hasPermission('can_access_accounts'); }
    canUseMemory() { return this.hasPermission('can_use_memory'); }
    canAccessLibrary() { return this.hasPermission('can_access_library'); }
    canCreateChat() { return this.hasPermission('can_create_chat'); }
    canViewChats() { return this.hasPermission('can_view_chats'); }
    canUploadFiles() { return this.hasPermission('can_upload_files'); }
    canDeleteFiles() { return this.hasPermission('can_delete_files'); }
    canEditMemory() { return this.hasPermission('can_edit_memory'); }
    
    // Owner-only abilities
    isOwner() { return this.role === 'owner'; }
    canManageWorkspace() { return this.isOwner(); }
}
