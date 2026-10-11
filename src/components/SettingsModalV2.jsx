import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
    X, AudioLines, Bug, HelpCircle, FileText, Lock, 
    LogOut, ChevronRight, Wand2, Sparkles, AppWindow,
    CircleDashed, Mail, CreditCard, ArrowUpCircle, 
    Settings2, Bell, LayoutGrid, Database, Archive, Shield,
    ArrowLeft, RotateCcw, Trash2, Download, UserMinus, Plus, Edit2, Save, Zap,
    Power, Check, Calendar, HardDrive, Scissors, Scan, Eye, Key, Palette, Film, Minimize2, RefreshCw, Receipt, Megaphone, BookOpen, Terminal, FolderOpen, Code,
    Smartphone, User, Cookie
} from 'lucide-react';
import { supabase } from '../services/supabase';
import UsageSection from './UsageSection';
import { useTheme } from '../contexts/ThemeContext';
import GoogleConnectModal from './GoogleConnectModal';
import TelegramConnectModal from './TelegramConnectModal';
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";

const legalDocuments = [
    { id: 'privacy-policy', title: 'Privacy Policy', icon: Shield },
    { id: 'terms-conditions', title: 'Terms & Conditions', icon: FileText },
    { id: 'refund-cancellation', title: 'Refund & Cancellation', icon: RotateCcw },
    { id: 'cookie-policy', title: 'Cookie Policy', icon: Cookie },
    { id: 'acceptable-use', title: 'Acceptable Use Policy', icon: Check },
    { id: 'ai-usage-disclaimer', title: 'AI Usage & Disclaimer', icon: Sparkles },
    { id: 'data-retention', title: 'Data Retention', icon: Database },
    { id: 'security-policy', title: 'Security Policy', icon: Lock },
    { id: 'copyright-ip', title: 'Copyright & IP', icon: BookOpen },
    { id: 'third-party-services', title: 'Third-Party Services', icon: AppWindow },
    { id: 'childrens-privacy', title: "Children's Privacy", icon: Eye },
    { id: 'community-guidelines', title: 'Community Guidelines', icon: Megaphone },
    { id: 'contact-support', title: 'Contact & Support', icon: Mail }
];

export default function SettingsModal({ isOpen, onClose, onLogout, userEmail, userId, session, onOpenPhoneModal, archivedChats = [], onUnarchive, onBulkArchive, onBulkDelete, onDeleteAccount, onPersonalizationChange }) {
    const { themePref, setThemePref } = useTheme();
    const [view, setView] = useState('main'); // 'main', 'archived', 'terms', 'privacy', 'data-controls', 'memories', 'personalization'
    const [personalization, setPersonalization] = useState({
        user_message_color: '#3373E8',
        base_tone: 'professional',
        custom_instructions: '',
        instruction_image_url: ''
    });
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
    const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
    const [isTelegramConnected, setIsTelegramConnected] = useState(false);
    const [planName, setPlanName] = useState(() => {
        try {
            if (userId) {
                const cached = localStorage.getItem(`usage_userSub_${userId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    return parsed?.subscription_plans?.name || 'Spark';
                }
            }
        } catch (e) {}
        return 'Spark';
    });

    useEffect(() => {
        if (isOpen && userId) {
            supabase
                .from('user_subscriptions')
                .select('*, subscription_plans(*)')
                .eq('user_id', userId)
                .in('status', ['active', 'trialing'])
                .maybeSingle()
                .then(({ data }) => {
                    if (data?.subscription_plans?.name) {
                        setPlanName(data.subscription_plans.name);
                    } else {
                        setPlanName('Spark');
                    }
                })
                .catch(() => {});
        }
    }, [isOpen, userId]);

    useEffect(() => {
        if (isOpen && userId) {
            supabase
                .from('user_telegram')
                .select('connected')
                .eq('user_id', userId)
                .eq('connected', true)
                .maybeSingle()
                .then(({ data }) => {
                    setIsTelegramConnected(!!data?.connected);
                })
                .catch(() => {});
        }
    }, [isOpen, userId, view]);
    
    // Email Preferences state
    const [emailPrefs, setEmailPrefs] = useState({ marketing_emails: true, educational_emails: true });
    const [savingPrefs, setSavingPrefs] = useState(false);
    const [prefsSaved, setPrefsSaved] = useState(false);

    const [memories, setMemories] = useState([]);
    const [summarySections, setSummarySections] = useState([]);  // ChatGPT-style summaries
    const [summaryUpdatedAt, setSummaryUpdatedAt] = useState(null);
    const [editingMemoryId, setEditingMemoryId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [newMemoryInput, setNewMemoryInput] = useState("");
    const [isLoadingMemories, setIsLoadingMemories] = useState(false);
    const [isAddingMemory, setIsAddingMemory] = useState(false);
    const [showRawMemories, setShowRawMemories] = useState(false); // toggle between summary and raw list
    const navigate = useNavigate();
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
    const [autoStartEnabled, setAutoStartEnabled] = useState(false);

    const [isAdvancedEnabled, setIsAdvancedEnabled] = useState(false);
    const [isAdvancedAppsEnabled, setIsAdvancedAppsEnabled] = useState(false);
    const [showAdvancedOnboarding, setShowAdvancedOnboarding] = useState(false);
    

    useEffect(() => {
        if (userId) {
            const val = localStorage.getItem(`ceova_advanced_${userId}`);
            if (val === 'true') {
                setIsAdvancedEnabled(true);
            }
            const appsVal = localStorage.getItem(`ceova_advanced_apps_${userId}`);
            if (appsVal === 'true') {
                setIsAdvancedAppsEnabled(true);
            }
        }
    }, [userId]);

    const toggleAdvancedSettings = () => {
        const newVal = !isAdvancedEnabled;
        setIsAdvancedEnabled(newVal);
        if (newVal) {
            setShowAdvancedOnboarding(true);
        }
        if (userId) {
            localStorage.setItem(`ceova_advanced_${userId}`, newVal ? 'true' : 'false');
        }
    };

    const toggleAdvancedApps = () => {
        const newVal = !isAdvancedAppsEnabled;
        setIsAdvancedAppsEnabled(newVal);
        if (userId) {
            localStorage.setItem(`ceova_advanced_apps_${userId}`, newVal ? 'true' : 'false');
        }
    };
    
    useEffect(() => {
        if (isOpen && userId) {
            loadPersonalization();
            loadEmailPrefs();
        }
    }, [isOpen, userId]);

    const loadPersonalization = async () => {
        try {
            const { data } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
            if (data) {
                setPersonalization({
                    user_message_color: data.user_message_color || '#3373E8',
                    base_tone: data.base_tone || 'professional',
                    custom_instructions: data.custom_instructions || '',
                    instruction_image_url: data.instruction_image_url || ''
                });
            }
        } catch (e) { console.error("Load Personalization Error:", e); }
    };

    const savePersonalization = async () => {
        setIsSaving(true);
        try {
            await supabase.from('user_preferences').upsert({
                user_id: userId,
                ...personalization
            });
            // Update CSS variable globally
            document.documentElement.style.setProperty('--bubble-user', personalization.user_message_color);
            if (onPersonalizationChange) onPersonalizationChange();
            setView('main');
        } catch (e) { console.error("Save Personalization Error:", e); }
        finally { setIsSaving(false); }
    };

    const loadEmailPrefs = async () => {
        try {
            const { data } = await supabase
                .from('user_email_preferences')
                .select('marketing_emails, educational_emails')
                .eq('user_id', userId)
                .single();
            if (data) setEmailPrefs(data);
        } catch (e) { console.error("Load Email Prefs Error:", e); }
    };

    const handleSaveEmailPrefs = async () => {
        setSavingPrefs(true);
        try {
            await supabase
                .from('user_email_preferences')
                .upsert({ user_id: userId, ...emailPrefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 3000);
        } catch (err) {
            console.error('Error saving email preferences:', err);
        } finally {
            setSavingPrefs(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploadingImage(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `instruction_${userId}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${userId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('user-files')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('user-files')
                .getPublicUrl(filePath);

            setPersonalization(p => ({ ...p, instruction_image_url: publicUrl }));
        } catch (e) { console.error("Image Upload Error:", e); }
        finally { setIsUploadingImage(false); }
    };

    const toggleAutoStart = async () => {
        try {
            if (autoStartEnabled) {
                await disable();
                setAutoStartEnabled(false);
            } else {
                await enable();
                setAutoStartEnabled(true);
            }
        } catch (e) { console.error(e); }
    };
    
    useEffect(() => {
        if (isTauri) {
            isEnabled().then(setAutoStartEnabled);
        }
    }, [isTauri]);

    useEffect(() => {
        if (view === 'memories' && userId) {
            fetchMemories();
        }
    }, [view, userId]);

    const fetchMemories = async () => {
        setIsLoadingMemories(true);
        try {
            // Fetch raw memories
            const { data, error } = await supabase
                .from('user_memory_longterm')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setMemories(data || []);

            // Fetch AI-generated summaries
            const { data: summaryData } = await supabase
                .from('memory_summaries')
                .select('category, summary, updated_at')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            setSummarySections(summaryData || []);
            if (summaryData && summaryData.length > 0) {
                setSummaryUpdatedAt(summaryData[0].updated_at);
            }
        } catch (e) {
            console.error('Memory Fetch Error:', e);
        } finally {
            setIsLoadingMemories(false);
        }
    };

    const handleAddMemory = async () => {
        if (!newMemoryInput.trim()) return;
        setIsAddingMemory(true);
        try {
            // Check quota first
            const { data: usageData, error: usageError } = await supabase.rpc('get_usage_and_limits', { p_user_id: userId });
            if (!usageError && usageData) {
                if (usageData.usage.memory_used >= usageData.limits.memory_limit) {
                    alert("Memory limit reached. Please delete old memories or upgrade your plan to add new ones.");
                    setIsAddingMemory(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('user_memory_longterm')
                .insert({
                    user_id: userId,
                    category: 'General',
                    title: 'Manual Note',
                    value: newMemoryInput.trim(),
                    confidence: 1.0
                });
            if (error) throw error;
            
            setNewMemoryInput("");
            setIsAddingMemory(false);
            fetchMemories();
        } catch (e) { 
            console.error("Add Memory Error:", e);
            setIsAddingMemory(false); 
        }
    };

    const handleDeleteMemory = async (id) => {
        try {
            const { error } = await supabase
                .from('user_memory_longterm')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
            fetchMemories();
        } catch (e) { console.error('Delete Memory Error:', e); }
    };

    const handleClearAllMemories = async () => {
        if (!window.confirm('This will delete ALL your saved memories. Ceova will start fresh. Continue?')) return;
        try {
            await supabase.from('user_memory_longterm').delete().eq('user_id', userId);
            await supabase.from('memory_summaries').delete().eq('user_id', userId);
            setMemories([]);
            setSummarySections([]);
            setSummaryUpdatedAt(null);
        } catch (e) { console.error('Clear All Error:', e); }
    };

    const handleUpdateMemory = async (id) => {
        try {
            const { error } = await supabase
                .from('user_memory_longterm')
                .update({ value: editContent.trim(), updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
            setEditingMemoryId(null);
            fetchMemories();
        } catch (e) { console.error('Update Memory Error:', e); }
    };

    const handleExport = async () => {
        try {
            const resp = await fetch(`/api/data/export/${userId}`);
            const data = await resp.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ceova-data-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch (e) { console.error("Export Error:", e); }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClose = () => {
        setView('main');
        onClose();
    };

    const getTitle = () => {
        switch(view) {
            case 'archived': return 'Archived Chats';
            case 'terms': return 'Terms of Use';
            case 'privacy': return 'Privacy Policy';
            case 'data-controls': return 'Data Controls';
            case 'memories': return 'Memory';
            case 'personalization': return 'Personalization';
            case 'notifications': return 'Notifications';
            case 'advanced': return 'Advanced Settings';
            case 'connectors': return 'Connectors';
            case 'tools': return 'Tools';
            case 'usage': return 'Usage & Billing';
            case 'about': return 'About';
            default: return 'Settings';
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} />
                    <motion.div 
                        className="settings-card"
                        {...(isMobile ? mobileAnimation : desktopAnimation)}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={!isMobile ? { top: "50%", left: "50%", position: "fixed" } : { bottom: 0, left: 0, position: "fixed" }}
                    >
                        <header className="settings-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                {view !== 'main' ? (
                                    <button 
                                        className="settings-back-btn" 
                                        onClick={() => setView('main')}
                                        title="Back"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '8px',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: '#e5e7eb',
                                            padding: 0,
                                            margin: 0,
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.color = '#ffffff';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            e.currentTarget.style.color = '#e5e7eb';
                                        }}
                                    >
                                        <ArrowLeft size={16} />
                                    </button>
                                ) : null}
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f3f4f6', letterSpacing: '-0.01em' }}>
                                    {getTitle()}
                                </h3>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {view === 'personalization' && (
                                    <button className="settings-save-btn" onClick={savePersonalization} disabled={isSaving}>
                                        {isSaving ? <RotateCcw size={14} className="spin" /> : <Save size={14} />}
                                        <span>Save</span>
                                    </button>
                                )}
                                <button 
                                    className="settings-close-x" 
                                    onClick={handleClose} 
                                    title="Close"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '8px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: 'rgba(255, 255, 255, 0.65)',
                                        padding: 0,
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </header>

                        <div className="settings-body">
                            {view === 'main' && (
                                <>
                                    <div className="settings-profile-card">
                                        <div className="settings-profile-left">
                                            <div className="settings-avatar-circle">
                                                {session?.user?.user_metadata?.avatar_url ? (
                                                    <img src={session.user.user_metadata.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <User size={18} color="#ffffff" />
                                                )}
                                            </div>
                                            <div className="settings-profile-info">
                                                <span className="settings-profile-email">{userEmail || session?.user?.email || "Account"}</span>
                                                <span className="settings-profile-sub">
                                                    {session?.user?.phone ? `${session.user.phone} linked` : "Personal Workspace"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="settings-plan-pill">
                                            {planName.toUpperCase()}
                                        </div>
                                    </div>

                                    <h4 className="section-label">Account</h4>
                                    <div className="settings-section">
                                        <div className="settings-row clickable" onClick={() => onOpenPhoneModal?.()}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <Smartphone size={16} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>Phone Login</span>
                                                    <span style={{ fontSize: '11px', color: '#71717a' }}>
                                                        {session?.user?.phone ? `${session.user.phone} linked` : "Not linked — click to add"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="version-info" style={{ color: session?.user?.phone ? '#e4e4e7' : 'inherit' }}>
                                                    {session?.user?.phone || "Link Phone"}
                                                </span>
                                                <ChevronRight size={14} className="chevron" />
                                            </div>
                                        </div>
                                        <div className="settings-row clickable" onClick={() => { navigate('/subscription'); handleClose(); }}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <CreditCard size={16} />
                                                </div>
                                                <span>Subscription & Billing</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="plan-sub-tag">
                                                    {planName}
                                                </span>
                                                <ChevronRight size={14} className="chevron" />
                                            </div>
                                        </div>
                                        <div className="settings-row clickable" onClick={() => setView('usage')}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <Receipt size={16} />
                                                </div>
                                                <span>Usage</span>
                                            </div>
                                            <ChevronRight size={14} className="chevron" />
                                        </div>
                                        <div className="settings-row clickable" onClick={() => setView('data-controls')}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <Database size={16} />
                                                </div>
                                                <span>Data controls</span>
                                            </div>
                                            <ChevronRight size={14} className="chevron" />
                                        </div>
                                        <div className="settings-row clickable" onClick={() => setView('connectors')}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <AppWindow size={16} />
                                                </div>
                                                <span>Connectors</span>
                                            </div>
                                            <ChevronRight size={14} className="chevron" />
                                        </div>
                                        <div className="settings-row clickable" onClick={() => setView('tools')}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <Zap size={16} />
                                                </div>
                                                <span>Tools</span>
                                            </div>
                                            <ChevronRight size={14} className="chevron" />
                                        </div>
                                    </div>

                                    {isTauri && (
                                        <>
                                            <h4 className="section-label">DESKTOP</h4>
                                            <div className="settings-section">
                                                <div className="settings-row no-hover">
                                                    <div className="row-left">
                                                        <div className="settings-icon-squircle">
                                                            <Power size={16} />
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span>Launch at Login</span>
                                                            <span style={{ fontSize: '11px', color: '#71717a' }}>Automatically start CEOVA on system startup.</span>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={toggleAutoStart}
                                                        className={`toggle-btn ${autoStartEnabled ? 'active' : ''}`}
                                                        style={{
                                                            width: '40px',
                                                            height: '20px',
                                                            borderRadius: '20px',
                                                            background: autoStartEnabled ? '#10b981' : '#27272a',
                                                            border: 'none',
                                                            position: 'relative',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '16px',
                                                            height: '16px',
                                                            borderRadius: '50%',
                                                            background: 'white',
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: autoStartEnabled ? '22px' : '2px',
                                                            transition: 'all 0.3s ease'
                                                        }} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <h4 className="section-label">General</h4>
                                    <div className="settings-section">
                                        <div className="settings-row clickable" onClick={() => setView('about')}>
                                            <div className="row-left">
                                                <div className="settings-icon-squircle">
                                                    <HelpCircle size={16} />
                                                </div>
                                                <span>About</span>
                                            </div>
                                            <ChevronRight size={14} className="chevron" />
                                        </div>
                                    </div>

                                    <div className="settings-section logout-section" onClick={onLogout}>
                                        <div className="settings-row clickable">
                                            <div className="row-left logout-text">
                                                <div className="settings-icon-squircle logout-squircle">
                                                    <LogOut size={16} />
                                                </div>
                                                <span>Log out</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {view === 'about' && (
                                <div className="about-view">
                                    <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#ffffff', letterSpacing: '-0.01em' }}>CEOVA AI</h3>
                                        <p style={{ color: '#71717a', fontSize: '12px', marginTop: '4px' }}>Version 1.2.6 (Production)</p>
                                    </div>

                                    <h4 className="section-label">Legal Center</h4>
                                    <div className="settings-section">
                                        {legalDocuments.map((doc) => {
                                            const IconComponent = doc.icon;
                                            return (
                                                <div 
                                                    key={doc.id}
                                                    className="settings-row clickable" 
                                                    onClick={() => { navigate(`/legal/${doc.id}`); handleClose(); }}
                                                >
                                                    <div className="row-left">
                                                        <div className="settings-icon-squircle">
                                                            <IconComponent size={16} />
                                                        </div>
                                                        <span>{doc.title}</span>
                                                    </div>
                                                    <ChevronRight size={14} className="chevron" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {view === 'usage' && (
                                <div className="usage-view-container" style={{ padding: '0' }}>
                                    <UsageSection />
                                </div>
                            )}

                            {view === 'data-controls' && (
                                <div className="data-controls-view">
                                    <div className="settings-section">
                                        <div className="settings-row clickable" onClick={() => setView('memories')}>
                                            <div className="row-left"><Wand2 size={18} /> <span>Memory</span></div>
                                            <div className="row-right"><span className="archive-count">{memories.length} entries</span><ChevronRight size={14} className="chevron" /></div>
                                        </div>
                                        <div className="settings-row clickable" onClick={handleExport}>
                                            <div className="row-left"><Download size={18} /> <span>Export data</span></div>
                                        </div>
                                        <div className="settings-row clickable" onClick={onBulkArchive}>
                                            <div className="row-left text-blue"><Archive size={18} /> <span>Archive all chats</span></div>
                                        </div>
                                        <div className="settings-row clickable" onClick={onBulkDelete}>
                                            <div className="row-left text-danger"><Trash2 size={18} /> <span>Delete all chats</span></div>
                                        </div>
                                        <div className="settings-row clickable" onClick={onDeleteAccount}>
                                            <div className="row-left text-danger"><UserMinus size={18} /> <span>Delete account</span></div>
                                        </div>
                                    </div>
                                    <p className="data-disclaimer">Archive all chats moves them to the Archive Vault. Delete account is permanent and cannot be undone.</p>
                                </div>
                            )}

                            {view === 'tools' && (
                                <div className="connectors-view">
                                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Type <code>/</code> in the chat input to quickly access and use these tools.</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                        <ExtensionCard 
                                            icon={<Scissors size={24} color="#a1a1aa" />} 
                                            title="Background Remover" 
                                            desc="Remove backgrounds from images instantly." 
                                        />
                                        <ExtensionCard 
                                            icon={<Scan size={24} color="#a1a1aa" />} 
                                            title="QR & Barcode" 
                                            desc="Generate or decode QR codes & barcodes." 
                                        />
                                        <ExtensionCard 
                                            icon={<Receipt size={24} color="#a1a1aa" />} 
                                            title="Invoice Generator" 
                                            desc="Create beautiful PDF invoices in seconds." 
                                        />
                                        <ExtensionCard 
                                            icon={<Eye size={24} color="#a1a1aa" />} 
                                            title="Image Analysis" 
                                            desc="Analyze images and extract text (OCR)." 
                                        />
                                        <ExtensionCard 
                                            icon={<FileText size={24} color="#a1a1aa" />} 
                                            title="PDF Toolkit" 
                                            desc="Merge, split, compress, and edit PDFs." 
                                        />
                                        <ExtensionCard 
                                            icon={<Key size={24} color="#a1a1aa" />} 
                                            title="Password & Hash" 
                                            desc="Generate strong passwords securely." 
                                        />
                                        <ExtensionCard 
                                            icon={<Palette size={24} color="#a1a1aa" />} 
                                            title="Color Toolkit" 
                                            desc="Extract colors, generate palettes." 
                                        />
                                        <ExtensionCard 
                                            icon={<Film size={24} color="#a1a1aa" />} 
                                            title="Media Converter" 
                                            desc="Convert audio/video and compress media." 
                                        />
                                        <ExtensionCard 
                                            icon={<Minimize2 size={24} color="#a1a1aa" />} 
                                            title="Reduce File Size" 
                                            desc="Compress images to save space." 
                                        />
                                        <ExtensionCard 
                                            icon={<RefreshCw size={24} color="#a1a1aa" />} 
                                            title="File Converter" 
                                            desc="Convert between PNG, JPG, WEBP, etc." 
                                        />
                                    </div>
                                </div>
                            )}

                            {view === 'connectors' && (
                                <div className="connectors-view">
                                    <div className="settings-section">
                                        <div className="settings-row clickable" onClick={() => setIsGoogleModalOpen(true)}>
                                            <div className="row-left">
                                                <div style={{ 
                                                    background: '#fff', 
                                                    borderRadius: '50%', 
                                                    width: '18px', 
                                                    height: '18px', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center'
                                                }}>
                                                    <img src="/google-logo.png" alt="Google" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>Connect Google</span>
                                                    <span style={{ fontSize: '10px', opacity: 0.5 }}>Connect Gmail, Drive, and Calendar for a unified experience.</span>
                                                </div>
                                            </div>
                                            <div className="row-right"><ChevronRight size={14} className="chevron" /></div>
                                        </div>

                                        <div className="settings-row clickable" onClick={() => setIsTelegramModalOpen(true)}>
                                            <div className="row-left">
                                                <div style={{ 
                                                    background: '#fff', 
                                                    borderRadius: '50%', 
                                                    width: '18px', 
                                                    height: '18px', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center'
                                                }}>
                                                    <img src="/telegram.png" alt="Telegram" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>Connect Telegram</span>
                                                    <span style={{ fontSize: '10px', opacity: 0.5 }}>Manage your Telegram messages and chats.</span>
                                                </div>
                                            </div>
                                            <div className="row-right">
                                                {isTelegramConnected ? (
                                                    <span style={{ fontSize: '10px', color: '#22c55e', marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Connected
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '10px', color: '#a1a1aa', marginRight: '8px' }}>Connect</span>
                                                )}
                                                <ChevronRight size={14} className="chevron" />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {view === 'memories' && (
                                <div className="memories-view">
                                    {isLoadingMemories ? (
                                        <div className="empty-memories">
                                            <CircleDashed size={32} className="spinning" />
                                            <p>Fetching memories...</p>
                                        </div>
                                    ) : !showRawMemories ? (
                                        // ── ChatGPT-style Summary View ────────────────────────────────
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                            {/* Header */}
                                            <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                                    <div>
                                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f3f4f6' }}>
                                                            Memory Summary
                                                        </h3>
                                                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                                                            {summaryUpdatedAt
                                                                ? `Updated ${new Date(summaryUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                                                : 'Updated automatically after each conversation'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={handleClearAllMemories}
                                                        title="Clear all memories"
                                                        style={{
                                                            background: 'none', border: 'none', cursor: 'pointer',
                                                            color: '#6b7280', padding: '4px', borderRadius: '6px',
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                            fontSize: '0.72rem', transition: 'color 0.15s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                        onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                                                    >
                                                        <Trash2 size={13} /> Clear all
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Summary sections */}
                                            {summarySections.length > 0 ? (
                                                <div style={{ padding: '4px 0 8px' }}>
                                                    {summarySections.map(sec => {
                                                        const LABELS = {
                                                            overview: 'Overview',
                                                            current_projects: 'Current Projects',
                                                            design_preferences: 'Design Preferences',
                                                            development_tools: 'Development Tools',
                                                            learning_goals: 'Learning Goals',
                                                            business_context: 'Business Context',
                                                        };
                                                        const label = LABELS[sec.category] || sec.category;
                                                        return (
                                                            <div key={sec.category} style={{
                                                                padding: '14px 20px',
                                                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                            }}>
                                                                <p style={{ margin: '0 0 5px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6b7280' }}>
                                                                    {label}
                                                                </p>
                                                                <p style={{ margin: 0, fontSize: '0.88rem', color: '#d1d5db', lineHeight: 1.6 }}>
                                                                    {sec.summary}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : memories.length > 0 ? (
                                                // Summaries not generated yet but raw memories exist
                                                <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                                                    <CircleDashed size={28} style={{ color: '#6b7280', marginBottom: '8px' }} />
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>
                                                        Summary is being generated...
                                                    </p>
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#6b7280' }}>
                                                        It will appear here after your next conversation.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="empty-memories">
                                                    <div className="empty-icon-stack">
                                                        <Sparkles size={32} />
                                                        <Wand2 size={16} className="sparkle-mini" />
                                                    </div>
                                                    <p>No memories yet. Chat with Ceova and it will automatically remember important things about you.</p>
                                                </div>
                                            )}

                                            {/* Footer toggle to raw list */}
                                            {memories.length > 0 && (
                                                <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => setShowRawMemories(true)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '0.78rem' }}
                                                    >
                                                        View all {memories.length} raw entries →
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // ── Raw memory card list (legacy) ─────────────────────────────
                                        <div className="settings-section">
                                            <div style={{ padding: '10px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <button
                                                    onClick={() => setShowRawMemories(false)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '0.78rem' }}
                                                >
                                                    ← Back to summary
                                                </button>
                                            </div>
                                            {Object.entries(
                                                memories.reduce((acc, mem) => {
                                                    const cat = mem.category || 'Other';
                                                    if (!acc[cat]) acc[cat] = [];
                                                    acc[cat].push(mem);
                                                    return acc;
                                                }, {})
                                            ).map(([category, catMemories]) => (
                                                <div key={category} style={{ marginBottom: '16px' }}>
                                                    <h4 style={{ margin: '16px 20px 8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>
                                                        {category}
                                                    </h4>
                                                    {catMemories.map(mem => (
                                                        <div key={mem.id} className="memory-item">
                                                            <div className="memory-text" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <img src="/ceova logo dark.png" alt="Ceova" style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }} />
                                                                    <span><strong>{mem.title}:</strong> {mem.value}</span>
                                                                </div>
                                                                <span className="memory-date" style={{ marginLeft: '26px' }}>
                                                                    Saved on: {new Date(mem.created_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="memory-actions">
                                                                <button className="del-btn" onClick={() => handleDeleteMemory(mem.id)} title="Delete memory">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="memory-footer-note">
                                        Ceova automatically remembers important details to serve you better.
                                    </div>
                                </div>
                            )}

                            {view === 'archived' && (
                                <div className="archived-view">
                                    {archivedChats.length > 0 ? (
                                        <div className="settings-section">
                                            {archivedChats.map(chat => (
                                                <div key={chat.id} className="settings-row no-hover">
                                                    <div className="row-left"><Archive size={16} className="text-muted" /><span className="archived-title">{chat.title || "Untitled Chat"}</span></div>
                                                    <button className="unarchive-btn" onClick={() => onUnarchive(chat.id)}><RotateCcw size={16} /> <span>Restore</span></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : ( <div className="empty-archive"><Archive size={48} /><p>No archived chats found.</p></div> )}
                                </div>
                            )}

                            {view === 'personalization' && (
                                <div className="personalization-view">
                                    <h4 className="section-label">APPEARANCE</h4>
                                    <div className="settings-section">
                                        <div className="settings-row no-hover">
                                            <div className="row-left"><span>User Message Color</span></div>
                                            <div className="color-options">
                                                {['#3373E8', '#10b981', '#8b5cf6', '#2d2d2d'].map(color => (
                                                    <button 
                                                        key={color}
                                                        className={`color-dot ${personalization.user_message_color === color ? 'active' : ''}`}
                                                        style={{ background: color }}
                                                        onClick={() => {
                                                            setPersonalization(p => ({ ...p, user_message_color: color }));
                                                            document.documentElement.style.setProperty('--bubble-user', color);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <h4 className="section-label">AI PERSONALITY</h4>
                                    <div className="settings-section">
                                        <div className="settings-row no-hover" style={{ padding: '12px 16px' }}>
                                            <div className="row-left" style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>Base style and tone</span>
                                                <span style={{ fontSize: '11px', opacity: 0.5 }}>How Ceova addresses you</span>
                                            </div>
                                            <select 
                                                className="settings-select"
                                                value={personalization.base_tone}
                                                onChange={(e) => setPersonalization(p => ({ ...p, base_tone: e.target.value }))}
                                            >
                                                <option value="professional">Professional</option>
                                                <option value="casual">Casual / Friendly</option>
                                                <option value="creative">Creative / Expressive</option>
                                            </select>
                                        </div>
                                    </div>

                                    <h4 className="section-label">INSTRUCTION IMAGE</h4>
                                    <div className="settings-section" style={{ padding: '16px' }}>
                                        <div className="image-upload-wrapper">
                                            {personalization.instruction_image_url ? (
                                                <div className="preview-container">
                                                    <img src={personalization.instruction_image_url} alt="Instruction" className="instruction-preview" />
                                                    <button className="remove-img-btn" onClick={() => setPersonalization(p => ({ ...p, instruction_image_url: '' }))}>
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="upload-label">
                                                    <div className="upload-placeholder">
                                                        {isUploadingImage ? <RotateCcw size={24} className="spin" /> : <Plus size={24} />}
                                                        <span>{isUploadingImage ? "Uploading..." : "Upload Reference Image"}</span>
                                                    </div>
                                                    <input type="file" accept="image/*" onChange={handleImageUpload} hidden disabled={isUploadingImage} />
                                                </label>
                                            )}
                                        </div>
                                        <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '8px' }}>Add an image that Ceova should always keep in mind when responding.</p>
                                    </div>

                                    <h4 className="section-label">CUSTOM INSTRUCTIONS</h4>
                                    <div className="settings-section" style={{ padding: '12px' }}>
                                        <textarea 
                                            className="custom-instructions-area"
                                            placeholder="Example: Always explain things in bullet points. Call me Captain. Don't use emojis."
                                            value={personalization.custom_instructions}
                                            onChange={(e) => setPersonalization(p => ({ ...p, custom_instructions: e.target.value }))}
                                        />
                                    </div>
                                    <p className="data-disclaimer">These instructions are added to every AI response to customize Ceova's behavior for you.</p>
                                </div>
                            )}

                            {view === 'notifications' && (
                                <div className="settings-section">
                                    <div className="settings-row">
                                        <div className="row-left">
                                            <Shield size={18} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>Account & Security emails</span>
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>Login alerts, password changes, account activity</span>
                                            </div>
                                        </div>
                                        <div className="row-right">
                                            <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '600', marginRight: '8px' }}>Always On</span>
                                            <button className="toggle-btn active" style={{ opacity: 0.6, cursor: 'not-allowed' }} disabled>
                                                <div className="toggle-circle"></div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="row-left">
                                            <CreditCard size={18} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>Billing emails</span>
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>Subscription confirmations, payment receipts, renewal notices</span>
                                            </div>
                                        </div>
                                        <div className="row-right">
                                            <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: '600', marginRight: '8px' }}>Always On</span>
                                            <button className="toggle-btn active" style={{ opacity: 0.6, cursor: 'not-allowed' }} disabled>
                                                <div className="toggle-circle"></div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="row-left">
                                            <Megaphone size={18} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>Re-engagement & Marketing emails</span>
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>Tips for getting back into Ceova, feature announcements, new plans</span>
                                            </div>
                                        </div>
                                        <div className="row-right">
                                            <button
                                                id="toggle-marketing-emails"
                                                onClick={() => setEmailPrefs(p => ({ ...p, marketing_emails: !p.marketing_emails }))}
                                                className={`toggle-btn ${emailPrefs.marketing_emails ? 'active' : ''}`}
                                            >
                                                <div className="toggle-circle"></div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="settings-row">
                                        <div className="row-left">
                                            <BookOpen size={18} />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>Educational & Learning emails</span>
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>Pro tips, feature tutorials, and Ceova usage guides (every 20 days)</span>
                                            </div>
                                        </div>
                                        <div className="row-right">
                                            <button
                                                id="toggle-educational-emails"
                                                onClick={() => setEmailPrefs(p => ({ ...p, educational_emails: !p.educational_emails }))}
                                                className={`toggle-btn ${emailPrefs.educational_emails ? 'active' : ''}`}
                                            >
                                                <div className="toggle-circle"></div>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'flex-start' }}>
                                        <button 
                                            className="action-button primary" 
                                            onClick={handleSaveEmailPrefs}
                                            disabled={savingPrefs}
                                            style={{
                                                margin: 0,
                                                background: prefsSaved ? '#22c55e' : '#7a5af8', color: '#fff', border: 'none',
                                                padding: '10px 24px', borderRadius: '24px', cursor: savingPrefs ? 'not-allowed' : 'pointer',
                                                fontWeight: '600', transition: 'all 0.2s ease',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {savingPrefs ? 'Saving...' : prefsSaved ? 'Saved!' : 'Save Preferences'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {view === 'advanced' && (
                                <div className="advanced-view">
                                    <h4 className="section-label">FEATURES</h4>
                                    <div className="settings-section">
                                        <div className="settings-row no-hover">
                                            <div className="row-left">
                                                <AppWindow size={18} /> 
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>Enable Advance Apps</span>
                                                <span style={{ fontSize: '10px', opacity: 0.5 }}>Show advanced apps like Shopify.</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={toggleAdvancedApps}
                                                className={`toggle-btn ${isAdvancedAppsEnabled ? 'active' : ''}`}
                                                style={{ width: '40px', height: '20px', borderRadius: '20px', background: isAdvancedAppsEnabled ? '#10b981' : 'rgba(255,255,255,0.1)', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease' }}
                                            >
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: isAdvancedAppsEnabled ? '22px' : '2px', transition: 'all 0.3s ease' }} />
                                            </button>
                                        </div>
                                        <div className="settings-row no-hover">
                                            <div className="row-left">
                                                <Zap size={18} /> 
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>Enable Custom API</span>
                                                    <span style={{ fontSize: '10px', opacity: 0.5 }}>Unlock Custom APIs, Ollama, and developer features.</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={toggleAdvancedSettings}
                                                className={`toggle-btn ${isAdvancedEnabled ? 'active' : ''}`}
                                                style={{ width: '40px', height: '20px', borderRadius: '20px', background: isAdvancedEnabled ? '#10b981' : 'rgba(255,255,255,0.1)', border: 'none', position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease' }}
                                            >
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: isAdvancedEnabled ? '22px' : '2px', transition: 'all 0.3s ease' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(view === 'terms' || view === 'privacy') && (
                                <div className="legal-view-content" style={{ padding: '0 20px 20px', overflowY: 'auto', maxHeight: '400px', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                    {view === 'privacy' && (
                                        <div className="legal-section">
                                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Privacy Policy</h4>
                                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '10px' }}>Last Updated: 19 April 2026</p>
                                            <p>CEOVA AI is currently in development. This Privacy Policy explains how we handle your data during this phase.</p>
                                            
                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>1. Data We Collect</h5>
                                            <p>We may collect:</p>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Basic user data (email, user ID)</li>
                                                <li>Chat messages and AI interactions</li>
                                                <li>AI interactions and preferences</li>
                                            </ul>
                                            
                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>2. How We Use Data</h5>
                                            <p>Your data is used to:</p>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Test and improve AI features</li>
                                                <li>Provide chat and automation services</li>
                                                <li>Monitor usage (tokens, API actions)</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>3. Third-Party Services</h5>
                                            <p>We use:</p>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>AI providers (OpenAI)</li>
                                                <li>Backend services (Supabase)</li>
                                            </ul>
                                            <p>Your data may be processed by these services to provide functionality.</p>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>4. Data Storage</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Interaction data may be stored temporarily</li>
                                                <li>Data may be modified or deleted during development</li>
                                                <li><strong>Media & Files:</strong> Photos or files sent to us are only saved for <strong>7 days</strong> on our servers, after which they are deleted.</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>5. Security</h5>
                                            <p>We take reasonable measures, but the system is still under development and may have vulnerabilities.</p>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>6. Changes</h5>
                                            <p>This policy may change frequently as the product evolves.</p>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>7. Contact</h5>
                                            <p><strong>buildmyceo@gmail.com</strong></p>
                                        </div>
                                    )}

                                    {view === 'terms' && (
                                        <div className="legal-section">
                                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Terms and Conditions</h4>
                                            <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '10px' }}>Last Updated: 19 April 2026</p>
                                            <p>CEOVA AI is currently in development. By using it, you agree to the following:</p>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>1. Experimental Service</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>This is an early-stage product</li>
                                                <li>Features may break, change, or be removed at any time</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>2. No Guarantees</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>AI responses may be incorrect</li>
                                                <li>Automations may fail or behave unexpectedly</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>3. Usage Limits (Planned)</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Token and API action limits will be introduced</li>
                                                <li>These limits may change anytime</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>4. No Payment System Yet</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Paid features are not fully implemented</li>
                                                <li>Future purchases (tokens/actions) will follow separate terms</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>5. User Responsibility</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Do not misuse the system</li>
                                                <li>Do not attempt to exploit bugs or limits</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>6. Data Risk</h5>
                                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                                <li>Data may be lost during development</li>
                                                <li>Do not rely on the system for critical operations</li>
                                                <li><strong>Media & Files:</strong> Photos or files sent to us are only saved for <strong>7 days</strong> on our servers, after which they are automatically deleted.</li>
                                            </ul>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>7. Termination</h5>
                                            <p>We may restrict access at any time during development.</p>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>8. Updates</h5>
                                            <p>Terms will evolve as features (tokens, payments, etc.) are added.</p>

                                            <h5 style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px' }}>9. Contact</h5>
                                            <p><strong>buildmyceo@gmail.com</strong></p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
        <GoogleConnectModal 
            isOpen={isGoogleModalOpen} 
            onClose={() => setIsGoogleModalOpen(false)} 
            onProceed={async () => {
                setIsGoogleModalOpen(false);
                try {
                    localStorage.setItem('oauth_provider', 'google');
                    const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: `${window.location.origin}/auth/callback`,
                            scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive',
                            queryParams: {
                                access_type: 'offline',
                                prompt: 'consent'
                            }
                        }
                    });
                    if (error) throw error;
                } catch (e) {
                    console.error("Failed to connect Google:", e);
                    alert("Failed to connect Google: " + e.message);
                }
            }} 
        />
        <TelegramConnectModal 
            isOpen={isTelegramModalOpen} 
            onClose={() => setIsTelegramModalOpen(false)} 
            onStatusChange={(status) => setIsTelegramConnected(status)}
        />
            <AnimatePresence>
                {showAdvancedOnboarding && (
                    <>
                        <motion.div 
                            className="modal-backdrop" 
                            style={{ zIndex: 1100 }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                            onClick={() => setShowAdvancedOnboarding(false)}
                        />
                        <motion.div 
                            className="advanced-onboarding-card"
                            initial={{ opacity: 0, scale: 0.95, y: 20, x: "-50%" }}
                            animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
                            exit={{ opacity: 0, scale: 0.95, y: 20, x: "-50%" }}
                            style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                background: 'rgba(25, 25, 25, 0.85)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '24px',
                                padding: '32px',
                                width: '90%',
                                maxWidth: '420px',
                                zIndex: 1101,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center',
                                boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                                color: '#fff'
                            }}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.14)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '20px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                            }}>
                                <Zap size={30} color="#f3f4f6" />
                            </div>
                            
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px' }}>Advanced Settings Enabled</h2>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', margin: '0 0 24px', lineHeight: '1.5' }}>
                                Unlock powerful AI options and gain more control over how Ceova works.
                            </p>

                            <div style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                padding: '16px',
                                width: '100%',
                                textAlign: 'left',
                                marginBottom: '24px'
                            }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 12px' }}>Benefits:</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981"/> Save money by using your own API keys</li>
                                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981"/> Connect powerful AI models</li>
                                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981"/> Use local AI with Ollama</li>
                                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981"/> Greater privacy and control</li>
                                    <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="#10b981"/> Access future developer features</li>
                                </ul>
                            </div>

                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 24px', fontStyle: 'italic' }}>
                                Note: These features are designed for advanced users. If you're unsure, Ceova AI works perfectly without any additional setup.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                                <button 
                                    onClick={() => {
                                        setShowAdvancedOnboarding(false);
                                        handleClose();
                                    }}
                                    style={{
                                        background: 'var(--text-main)',
                                        color: 'var(--bg-main)',
                                        border: 'none',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'opacity 0.2s',
                                        width: '100%'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    Explore Advanced Features
                                </button>
                                <button 
                                    onClick={() => setShowAdvancedOnboarding(false)}
                                    style={{
                                        background: 'transparent',
                                        color: 'var(--text-dim)',
                                        border: '1px solid var(--border-color)',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        width: '100%'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    Got It
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

const desktopAnimation = { initial: { opacity: 0, scale: 0.95, x: "-50%", y: "-45%" }, animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%" }, exit: { opacity: 0, scale: 0.95, x: "-50%", y: "-45%" } };
const mobileAnimation = { initial: { y: "100%", x: 0 }, animate: { y: 0, x: 0 }, exit: { y: "100%", x: 0 } };

export function ExtensionCard({ icon, title, desc, onClick, disabled = false }) {
    return (
        <div 
            onClick={!disabled ? onClick : undefined}
            style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: '12px', 
                padding: '16px', 
                cursor: disabled || !onClick ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s',
                opacity: disabled ? 0.5 : 1,
            }}
            onMouseOver={(e) => {
                if(!disabled && onClick) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }
            }}
            onMouseOut={(e) => {
                if(!disabled && onClick) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                    width: 40, height: 40, borderRadius: '8px', 
                    background: 'rgba(255,255,255,0.05)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                    {icon}
                </div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{title}</div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                {desc}
            </div>
        </div>
    );
}
