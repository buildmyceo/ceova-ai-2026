import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { CircleDashed, Shield } from 'lucide-react';

export default function PermissionsSettingsView({ activeWorkspace }) {
    const [permissions, setPermissions] = useState({ member: null, visitor: null });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!activeWorkspace) return;
        fetchPermissions();
    }, [activeWorkspace]);

    const fetchPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('workspace_permissions')
                .select('*')
                .eq('workspace_id', activeWorkspace.id);
            
            if (error) throw error;
            
            const perms = { member: null, visitor: null };
            data.forEach(p => {
                if (p.role === 'member') perms.member = p;
                if (p.role === 'visitor') perms.visitor = p;
            });
            setPermissions(perms);
        } catch (e) {
            console.error("Error fetching permissions:", e);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (role, field) => {
        if (!permissions[role]) return;
        
        const newValue = !permissions[role][field];
        setPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [field]: newValue
            }
        }));

        setSaving(true);
        try {
            const { error } = await supabase
                .from('workspace_permissions')
                .update({ [field]: newValue, updated_at: new Date().toISOString() })
                .eq('workspace_id', activeWorkspace.id)
                .eq('role', role);
                
            if (error) throw error;
        } catch (e) {
            console.error("Error updating permission:", e);
            // Revert on error
            setPermissions(prev => ({
                ...prev,
                [role]: { ...prev[role], [field]: !newValue }
            }));
        } finally {
            setSaving(false);
        }
    };

    const renderToggle = (role, field, label) => {
        const value = permissions[role]?.[field];
        return (
            <div className="settings-row no-hover" style={{ padding: '8px 12px' }}>
                <div className="row-left">
                    <span style={{ fontSize: '13px' }}>{label}</span>
                </div>
                <button 
                    onClick={() => togglePermission(role, field)}
                    className={`toggle-btn ${value ? 'active' : ''}`}
                    style={{
                        width: '32px',
                        height: '16px',
                        borderRadius: '16px',
                        background: value ? '#10b981' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: value ? '18px' : '2px',
                        transition: 'all 0.3s ease'
                    }} />
                </button>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <CircleDashed className="spinning" size={24} />
            </div>
        );
    }

    return (
        <div className="permissions-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
                Configure what Members and Visitors can access within <strong>{activeWorkspace?.name}</strong>.
            </p>
            
            <div className="settings-section" style={{ padding: '8px' }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--brand-main)', marginBottom: '8px', paddingLeft: '8px' }}>Members</h4>
                {renderToggle('member', 'can_use_apps', 'Use Connected Apps')}
                {renderToggle('member', 'can_use_memory', 'Use AI Memory')}
                {renderToggle('member', 'can_access_library', 'Access Shared Library')}
                {renderToggle('member', 'can_create_chat', 'Create AI Chats')}
                {renderToggle('member', 'can_view_chats', 'View All AI Chats')}
                {renderToggle('member', 'can_upload_files', 'Upload Files')}
                {renderToggle('member', 'can_delete_files', 'Delete Files')}
            </div>

            <div className="settings-section" style={{ padding: '8px' }}>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--brand-main)', marginBottom: '8px', paddingLeft: '8px' }}>Visitors</h4>
                {renderToggle('visitor', 'can_use_apps', 'Use Connected Apps')}
                {renderToggle('visitor', 'can_use_memory', 'Use AI Memory')}
                {renderToggle('visitor', 'can_access_library', 'View Library')}
                {renderToggle('visitor', 'can_create_chat', 'Create AI Chats')}
                {renderToggle('visitor', 'can_view_chats', 'View AI Chats')}
                {renderToggle('visitor', 'can_upload_files', 'Upload Files')}
                {renderToggle('visitor', 'can_delete_files', 'Delete Files')}
            </div>
        </div>
    );
}
