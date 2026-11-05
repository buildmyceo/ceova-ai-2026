import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Check, Trash2, Plus, X, ListTodo, CheckSquare, 
    Calendar, Clock, Bell, BellRing, Zap, 
    ExternalLink, CalendarDays, ChevronDown, ChevronUp, 
    AlertCircle, Sparkles, Filter
} from 'lucide-react';
import { 
    loadTasks, saveTasks, syncTaskToGoogleCalendar, 
    getGoogleCalendarUrl, playReminderChime, 
    requestNotificationPermission, sendBrowserNotification 
} from '../services/taskManagerService';

export default function TaskModal({ isOpen, onClose, userId = null, onAutomateTask = null }) {
    const [tasks, setTasks] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
    const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'scheduled' | 'automated'
    const [searchQuery, setSearchQuery] = useState('');
    
    // Quick Add Form State
    const [newTaskText, setNewTaskText] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [dueDate, setDueDate] = useState('');
    const [dueTime, setDueTime] = useState('');
    const [reminder, setReminder] = useState(true);
    const [syncGCal, setSyncGCal] = useState(false);
    const [isAutomated, setIsAutomated] = useState(false);
    const [taskNotes, setTaskNotes] = useState('');
    const [priority, setPriority] = useState('medium'); // 'low' | 'medium' | 'high'
    
    // Active Reminder Alert state
    const [activeAlert, setActiveAlert] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState('default');
    const [isSyncingGCal, setIsSyncingGCal] = useState(false);
    const [statusToast, setStatusToast] = useState(null);

    const inputRef = useRef(null);
    const alertedTasksRef = useRef(new Set());

    // Initial Load & Multi-device Cloud Sync
    useEffect(() => {
        let isMounted = true;
        async function fetchInitialTasks() {
            const loaded = await loadTasks(userId);
            if (isMounted) {
                setTasks(loaded);
            }
        }
        fetchInitialTasks();

        // Check Notification Permission
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }

        // Listen for cross-tab or external task updates
        const handleExternalUpdate = (e) => {
            if (e.detail && Array.isArray(e.detail)) {
                setTasks(e.detail);
            }
        };
        window.addEventListener('ceova_tasks_updated', handleExternalUpdate);

        return () => {
            isMounted = false;
            window.removeEventListener('ceova_tasks_updated', handleExternalUpdate);
        };
    }, [userId]);

    // Save tasks on changes
    const updateTasksState = (newTasks) => {
        setTasks(newTasks);
        saveTasks(newTasks, userId);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Active Reminder Engine: Checks every 20 seconds for due tasks
    useEffect(() => {
        const checkReminders = () => {
            if (!tasks || tasks.length === 0) return;
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMins = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMins}`;

            tasks.forEach(task => {
                if (task.completed || !task.reminder || !task.dueDate) return;
                
                // Compare date and time
                const isTodayOrPast = task.dueDate <= todayStr;
                const isDueNow = task.dueDate === todayStr && task.dueTime && task.dueTime <= currentTimeStr;
                const isOverdue = task.dueDate < todayStr;
                
                const alertKey = `${task.id}_${todayStr}`;
                if ((isDueNow || isOverdue) && !alertedTasksRef.current.has(alertKey)) {
                    alertedTasksRef.current.add(alertKey);
                    
                    // Trigger sound chime
                    playReminderChime();

                    // Trigger browser notification
                    sendBrowserNotification(`⏰ Task Reminder: ${task.title}`, {
                        body: task.notes || (task.isAutomated ? '⚡️ Ready for AI automation' : `Due at ${task.dueTime || 'today'}`),
                        tag: task.id
                    });

                    // Trigger in-app toast
                    setActiveAlert(task);
                }
            });
        };

        checkReminders();
        const interval = setInterval(checkReminders, 20000);
        return () => clearInterval(interval);
    }, [tasks]);

    // Toast helper
    const showToast = (message) => {
        setStatusToast(message);
        setTimeout(() => setStatusToast(null), 3500);
    };

    // Quick Date/Time Helpers
    const setPresetSchedule = (type) => {
        const today = new Date();
        if (type === 'today_evening') {
            setDueDate(today.toISOString().split('T')[0]);
            setDueTime('18:00');
        } else if (type === 'tomorrow_morning') {
            const tom = new Date(today);
            tom.setDate(tom.getDate() + 1);
            setDueDate(tom.toISOString().split('T')[0]);
            setDueTime('09:00');
        } else if (type === 'weekend') {
            const sat = new Date(today);
            const daysToSat = (6 - sat.getDay() + 7) % 7 || 7;
            sat.setDate(sat.getDate() + daysToSat);
            setDueDate(sat.toISOString().split('T')[0]);
            setDueTime('10:00');
        } else if (type === 'clear') {
            setDueDate('');
            setDueTime('');
        }
    };

    // Add Task Handler
    const handleAddTask = async (e) => {
        e?.preventDefault();
        const text = newTaskText.trim();
        if (!text) return;

        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: text,
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            dueDate: dueDate || null,
            dueTime: dueTime || null,
            reminder: Boolean(reminder && dueDate),
            isAutomated: Boolean(isAutomated),
            notes: taskNotes.trim() || null,
            priority: priority || 'medium',
            syncedWithGCal: false,
            gcalLink: null
        };

        // If Google Calendar sync requested
        if (syncGCal && dueDate) {
            setIsSyncingGCal(true);
            try {
                const gcalRes = await syncTaskToGoogleCalendar(userId, newTask);
                if (gcalRes.success) {
                    newTask.syncedWithGCal = true;
                    newTask.gcalLink = gcalRes.htmlLink;
                    showToast('Task synced to Google Calendar!');
                }
            } catch (err) {
                console.warn('GCal sync failed:', err);
            } finally {
                setIsSyncingGCal(false);
            }
        }

        updateTasksState([newTask, ...tasks]);
        
        // Reset inputs
        setNewTaskText('');
        setTaskNotes('');
        setDueDate('');
        setDueTime('');
        setShowAdvanced(false);
        setSyncGCal(false);
        setIsAutomated(false);
    };

    const toggleTask = (id) => {
        const updated = tasks.map(t => 
            t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t
        );
        updateTasksState(updated);
    };

    const deleteTask = (id) => {
        const updated = tasks.filter(t => t.id !== id);
        updateTasksState(updated);
    };

    const clearCompleted = () => {
        const updated = tasks.filter(t => !t.completed);
        updateTasksState(updated);
    };

    // Sync individual existing task to Google Calendar
    const handleSyncToGCal = async (task) => {
        if (!task.dueDate) {
            showToast('Set a due date first to sync to Google Calendar');
            return;
        }
        setIsSyncingGCal(true);
        const res = await syncTaskToGoogleCalendar(userId, task);
        setIsSyncingGCal(false);

        if (res.success) {
            const updated = tasks.map(t => 
                t.id === task.id ? { ...t, syncedWithGCal: true, gcalLink: res.htmlLink, updatedAt: Date.now() } : t
            );
            updateTasksState(updated);
            if (res.fallback) {
                window.open(res.htmlLink, '_blank');
                showToast('Opened in Google Calendar!');
            } else {
                showToast('Synced directly with your Google Calendar!');
            }
        } else {
            showToast(res.error || 'Failed to sync with Google Calendar');
        }
    };

    // Run / Automate task with AI
    const handleRunTask = (task) => {
        if (onAutomateTask) {
            onAutomateTask(task);
        } else {
            // Default fallback
            showToast(`⚡️ Automating: "${task.title}" with CEOVA AI`);
        }
    };

    // Request notification permission button
    const handleEnableNotifications = async () => {
        const perm = await requestNotificationPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
            playReminderChime();
            showToast('Reminders and sound alerts activated!');
        }
    };

    // Task counts
    const pendingCount = tasks.filter(t => !t.completed).length;
    const completedCount = tasks.filter(t => t.completed).length;
    const scheduledCount = tasks.filter(t => t.dueDate && !t.completed).length;
    const automatedCount = tasks.filter(t => t.isAutomated && !t.completed).length;

    // Filtered tasks for List view
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = t.title?.toLowerCase().includes(q);
                const matchNotes = t.notes?.toLowerCase().includes(q);
                if (!matchTitle && !matchNotes) return false;
            }

            if (filter === 'pending') return !t.completed;
            if (filter === 'completed') return t.completed;
            if (filter === 'scheduled') return Boolean(t.dueDate);
            if (filter === 'automated') return Boolean(t.isAutomated);
            return true;
        });
    }, [tasks, filter, searchQuery]);

    // Grouped tasks for Calendar Schedule View
    const scheduleGroups = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const overdue = [];
        const today = [];
        const tomorrowList = [];
        const upcoming = [];
        const unscheduled = [];

        tasks.forEach(task => {
            if (!task.dueDate) {
                unscheduled.push(task);
            } else if (task.dueDate < todayStr && !task.completed) {
                overdue.push(task);
            } else if (task.dueDate === todayStr) {
                today.push(task);
            } else if (task.dueDate === tomorrowStr) {
                tomorrowList.push(task);
            } else {
                upcoming.push(task);
            }
        });

        // Sort by time within groups
        const sortByTime = (a, b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
        overdue.sort(sortByTime);
        today.sort(sortByTime);
        tomorrowList.sort(sortByTime);
        upcoming.sort((a, b) => (a.dueDate + (a.dueTime || '')).localeCompare(b.dueDate + (b.dueTime || '')));

        return { overdue, today, tomorrow: tomorrowList, upcoming, unscheduled };
    }, [tasks]);

    // Helper for date formatting
    const formatDueBadge = (dueDate, dueTime) => {
        if (!dueDate) return null;
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        let label = dueDate;
        let isPast = dueDate < todayStr;
        let isToday = dueDate === todayStr;
        let isTomorrow = dueDate === tomorrowStr;

        if (isToday) label = 'Today';
        else if (isTomorrow) label = 'Tomorrow';

        const timeStr = dueTime ? `, ${formatTime12(dueTime)}` : '';
        return {
            text: `${label}${timeStr}`,
            isPast,
            isToday,
            isTomorrow
        };
    };

    function formatTime12(time24) {
        if (!time24) return '';
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    onClick={onClose}
                    style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        backgroundColor: 'rgba(0, 0, 0, 0.78)', 
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        padding: '16px',
                        zIndex: 3000 
                    }}
                >
                    <motion.div 
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        style={{ 
                            width: '100%', 
                            maxWidth: '680px', 
                            backgroundColor: '#0c0c0e', 
                            border: '1px solid #27272a', 
                            borderRadius: '16px',
                            display: 'flex', 
                            flexDirection: 'column',
                            maxHeight: '90vh',
                            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header Bar */}
                        <div style={{
                            padding: '14px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #27272a',
                            backgroundColor: '#141417'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: '#18181b',
                                    border: '1px solid #27272a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff'
                                }}>
                                    <CheckSquare size={16} color="#ffffff" />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>Tasks & Reminders</span>
                                        <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 400 }}>· Google Calendar & AI Automated</span>
                                    </h2>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* View Mode Switcher */}
                                <div style={{
                                    display: 'flex',
                                    backgroundColor: '#18181b',
                                    borderRadius: '8px',
                                    padding: '2px',
                                    border: '1px solid #27272a'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: viewMode === 'list' ? '#27272a' : 'transparent',
                                            color: viewMode === 'list' ? '#ffffff' : '#71717a',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <ListTodo size={13} />
                                        <span>List</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('calendar')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            backgroundColor: viewMode === 'calendar' ? '#27272a' : 'transparent',
                                            color: viewMode === 'calendar' ? '#ffffff' : '#71717a',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <CalendarDays size={13} />
                                        <span>Schedule</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    style={{
                                        backgroundColor: '#1f1f23',
                                        border: '1px solid #27272a',
                                        color: '#a1a1aa',
                                        cursor: 'pointer',
                                        padding: '6px',
                                        borderRadius: '7px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s ease'
                                    }}
                                    title="Close (Esc)"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* In-app Notification Alert Banner */}
                        {activeAlert && (
                            <div style={{
                                padding: '10px 18px',
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '12px' }}>
                                    <BellRing size={16} color="#ef4444" className="animate-pulse" />
                                    <span>
                                        <strong>Task Due:</strong> {activeAlert.title}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {activeAlert.isAutomated && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleRunTask(activeAlert);
                                                setActiveAlert(null);
                                            }}
                                            style={{
                                                backgroundColor: '#ef4444',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '3px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <Zap size={12} />
                                            <span>Run with CEOVA</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            toggleTask(activeAlert.id);
                                            setActiveAlert(null);
                                        }}
                                        style={{
                                            backgroundColor: '#1f1f23',
                                            color: '#ffffff',
                                            border: '1px solid #3f3f46',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Mark Done
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAlert(null)}
                                        style={{
                                            backgroundColor: 'transparent',
                                            color: '#a1a1aa',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px 4px'
                                        }}
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status Toast */}
                        {statusToast && (
                            <div style={{
                                padding: '8px 18px',
                                backgroundColor: '#18181b',
                                borderBottom: '1px solid #27272a',
                                color: '#10b981',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Sparkles size={14} color="#10b981" />
                                <span>{statusToast}</span>
                            </div>
                        )}

                        {/* Notification Permission Request banner (if not yet granted) */}
                        {notificationPermission === 'default' && (
                            <div style={{
                                padding: '8px 18px',
                                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: '#93c5fd'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Bell size={13} color="#60a5fa" />
                                    <span>Enable reminders to get sound alerts and desktop notifications for scheduled tasks.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleEnableNotifications}
                                    style={{
                                        backgroundColor: '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '3px 9px',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '11px'
                                    }}
                                >
                                    Enable Alerts
                                </button>
                            </div>
                        )}

                        {/* Task Creation Form */}
                        <form onSubmit={handleAddTask} style={{
                            padding: '14px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            backgroundColor: '#0c0c0e',
                            borderBottom: '1px solid #27272a'
                        }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Add a new task, reminder, or automation..."
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    style={{
                                        flex: 1,
                                        backgroundColor: '#141417',
                                        border: '1px solid #27272a',
                                        borderRadius: '8px',
                                        padding: '9px 14px',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        transition: 'border-color 0.15s ease',
                                        fontFamily: 'inherit'
                                    }}
                                    onFocus={e => e.currentTarget.style.borderColor = '#52525b'}
                                    onBlur={e => e.currentTarget.style.borderColor = '#27272a'}
                                />
                                
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    style={{
                                        backgroundColor: showAdvanced || dueDate || isAutomated ? '#27272a' : '#141417',
                                        color: showAdvanced || dueDate || isAutomated ? '#ffffff' : '#a1a1aa',
                                        border: '1px solid #27272a',
                                        padding: '0 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer'
                                    }}
                                    title="Schedule, Remind & Automate"
                                >
                                    <Calendar size={14} />
                                    <span>Schedule</span>
                                    {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>

                                <button
                                    type="submit"
                                    disabled={!newTaskText.trim() || isSyncingGCal}
                                    style={{
                                        backgroundColor: newTaskText.trim() ? '#ffffff' : '#1f1f23',
                                        color: newTaskText.trim() ? '#000000' : '#52525b',
                                        border: newTaskText.trim() ? '1px solid #ffffff' : '1px solid #27272a',
                                        padding: '0 16px',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: newTaskText.trim() ? 'pointer' : 'default',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <Plus size={14} color={newTaskText.trim() ? '#000000' : '#52525b'} />
                                    <span>{isSyncingGCal ? 'Syncing...' : 'Add'}</span>
                                </button>
                            </div>

                            {/* Advanced Scheduling & Automation Drawer */}
                            {showAdvanced && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{
                                        backgroundColor: '#141417',
                                        border: '1px solid #27272a',
                                        borderRadius: '10px',
                                        padding: '12px 14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px'
                                    }}
                                >
                                    {/* Preset Quick Chips */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', color: '#71717a', marginRight: '4px' }}>Quick Presets:</span>
                                        <button
                                            type="button"
                                            onClick={() => setPresetSchedule('today_evening')}
                                            style={{
                                                backgroundColor: '#1f1f23',
                                                border: '1px solid #27272a',
                                                color: '#e4e4e7',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Today 6:00 PM
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPresetSchedule('tomorrow_morning')}
                                            style={{
                                                backgroundColor: '#1f1f23',
                                                border: '1px solid #27272a',
                                                color: '#e4e4e7',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Tomorrow 9:00 AM
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPresetSchedule('weekend')}
                                            style={{
                                                backgroundColor: '#1f1f23',
                                                border: '1px solid #27272a',
                                                color: '#e4e4e7',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            This Weekend
                                        </button>
                                        {dueDate && (
                                            <button
                                                type="button"
                                                onClick={() => setPresetSchedule('clear')}
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid #3f3f46',
                                                    color: '#f87171',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Clear Date
                                            </button>
                                        )}
                                    </div>

                                    {/* Date & Time Selectors */}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} /> Due Date (Google Calendar style)
                                            </label>
                                            <input 
                                                type="date" 
                                                value={dueDate}
                                                onChange={e => setDueDate(e.target.value)}
                                                style={{
                                                    backgroundColor: '#18181b',
                                                    border: '1px solid #27272a',
                                                    color: '#ffffff',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    outline: 'none',
                                                    colorScheme: 'dark'
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} /> Time
                                            </label>
                                            <input 
                                                type="time" 
                                                value={dueTime}
                                                onChange={e => setDueTime(e.target.value)}
                                                style={{
                                                    backgroundColor: '#18181b',
                                                    border: '1px solid #27272a',
                                                    color: '#ffffff',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    outline: 'none',
                                                    colorScheme: 'dark'
                                                }}
                                            />
                                        </div>

                                        <div style={{ flex: 1, minWidth: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Priority</label>
                                            <select
                                                value={priority}
                                                onChange={e => setPriority(e.target.value)}
                                                style={{
                                                    backgroundColor: '#18181b',
                                                    border: '1px solid #27272a',
                                                    color: '#ffffff',
                                                    borderRadius: '6px',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Action Toggles: Reminders, Google Calendar & AI Automation */}
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '4px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#e4e4e7', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={reminder}
                                                onChange={e => setReminder(e.target.checked)}
                                                style={{ accentColor: '#ffffff', cursor: 'pointer' }}
                                            />
                                            <Bell size={13} color="#a1a1aa" />
                                            <span>Sound & Banner Reminder</span>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#e4e4e7', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={syncGCal}
                                                onChange={e => setSyncGCal(e.target.checked)}
                                                style={{ accentColor: '#ffffff', cursor: 'pointer' }}
                                            />
                                            <CalendarDays size={13} color="#38bdf8" />
                                            <span>Sync to Google Calendar</span>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#e4e4e7', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={isAutomated}
                                                onChange={e => setIsAutomated(e.target.checked)}
                                                style={{ accentColor: '#ffffff', cursor: 'pointer' }}
                                            />
                                            <Zap size={13} color="#eab308" />
                                            <span>Automate with CEOVA AI</span>
                                        </label>
                                    </div>

                                    {/* Optional Notes / Instructions for AI */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '11px', color: '#71717a' }}>
                                            Task Notes or AI Automation Instructions (Optional):
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="e.g. Prepare meeting brief, draft email response, review financials..."
                                            value={taskNotes}
                                            onChange={e => setTaskNotes(e.target.value)}
                                            style={{
                                                backgroundColor: '#18181b',
                                                border: '1px solid #27272a',
                                                borderRadius: '6px',
                                                padding: '6px 10px',
                                                color: '#ffffff',
                                                fontSize: '12px',
                                                outline: 'none',
                                                resize: 'vertical',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </form>

                        {/* Search & Filter Bar */}
                        <div style={{
                            padding: '10px 18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#0c0c0e',
                            borderBottom: '1px solid #1f1f23',
                            gap: '10px',
                            flexWrap: 'wrap'
                        }}>
                            {/* Filter Chips */}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {[
                                    { id: 'all', label: 'All', count: tasks.length },
                                    { id: 'pending', label: 'Pending', count: pendingCount },
                                    { id: 'done', label: 'Done', count: completedCount },
                                    { id: 'scheduled', label: '📅 Scheduled', count: scheduledCount },
                                    { id: 'automated', label: '⚡️ Automated', count: automatedCount }
                                ].map(tab => {
                                    const isActive = filter === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setFilter(tab.id)}
                                            style={{
                                                backgroundColor: isActive ? '#ffffff' : '#141417',
                                                color: isActive ? '#000000' : '#a1a1aa',
                                                border: isActive ? '1px solid #ffffff' : '1px solid #27272a',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                fontWeight: isActive ? 600 : 500,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <span>{tab.label}</span>
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                backgroundColor: isActive ? '#000000' : '#27272a',
                                                color: isActive ? '#ffffff' : '#a1a1aa',
                                                padding: '1px 5px',
                                                borderRadius: '4px'
                                            }}>{tab.count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Clear completed */}
                            {completedCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearCompleted}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: '#71717a',
                                        fontSize: '11px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                        transition: 'color 0.15s ease'
                                    }}
                                >
                                    Clear completed
                                </button>
                            )}
                        </div>

                        {/* Main Content Area */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '12px 18px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            minHeight: '220px',
                            backgroundColor: '#0c0c0e'
                        }}>
                            {viewMode === 'list' ? (
                                // LIST VIEW
                                filteredTasks.length === 0 ? (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '42px 16px',
                                        color: '#71717a',
                                        textAlign: 'center'
                                    }}>
                                        <ListTodo size={32} color="#52525b" style={{ marginBottom: '10px' }} />
                                        <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                                            No tasks found
                                        </p>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#71717a' }}>
                                            Add a task or reminder above to schedule and automate your work.
                                        </p>
                                    </div>
                                ) : (
                                    filteredTasks.map(task => renderTaskCard(task))
                                )
                            ) : (
                                // CALENDAR SCHEDULE VIEW (Agenda style like Google Calendar)
                                renderCalendarScheduleView()
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    // Render an individual Task Card
    function renderTaskCard(task) {
        const dueInfo = formatDueBadge(task.dueDate, task.dueTime);

        return (
            <div
                key={task.id}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#141417',
                    border: task.dueDate && dueInfo?.isPast && !task.completed ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #27272a',
                    transition: 'border-color 0.15s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {/* Checkbox */}
                    <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        style={{
                            width: '20px',
                            height: '20px',
                            marginTop: '2px',
                            borderRadius: '5px',
                            border: task.completed ? '1.5px solid #ffffff' : '1.5px solid #52525b',
                            backgroundColor: task.completed ? '#ffffff' : '#18181b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {task.completed && <Check size={13} color="#000000" strokeWidth={3} />}
                    </button>

                    {/* Task Title & Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: task.completed ? '#71717a' : '#f4f4f5',
                                textDecoration: task.completed ? 'line-through' : 'none',
                                wordBreak: 'break-word',
                                lineHeight: 1.4
                            }}>
                                {task.title}
                            </span>

                            {/* AI Automated Badge */}
                            {task.isAutomated && (
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                    color: '#facc15',
                                    border: '1px solid rgba(234, 179, 8, 0.3)'
                                }}>
                                    <Zap size={10} /> AI Automated
                                </span>
                            )}

                            {/* Priority tag */}
                            {task.priority === 'high' && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    color: '#fca5a5'
                                }}>
                                    High
                                </span>
                            )}
                        </div>

                        {/* Notes snippet */}
                        {task.notes && (
                            <p style={{
                                margin: '4px 0 0',
                                fontSize: '12px',
                                color: '#a1a1aa',
                                lineHeight: 1.3
                            }}>
                                {task.notes}
                            </p>
                        )}

                        {/* Schedule & Calendar Metadata Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {dueInfo && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    backgroundColor: dueInfo.isPast && !task.completed
                                        ? 'rgba(239, 68, 68, 0.15)' 
                                        : (dueInfo.isToday ? 'rgba(34, 197, 94, 0.15)' : '#1f1f23'),
                                    color: dueInfo.isPast && !task.completed
                                        ? '#f87171' 
                                        : (dueInfo.isToday ? '#4ade80' : '#d4d4d8'),
                                    border: '1px solid #27272a'
                                }}>
                                    <Clock size={11} />
                                    <span>{dueInfo.text}</span>
                                    {dueInfo.isPast && !task.completed && <strong>(Overdue)</strong>}
                                </div>
                            )}

                            {/* Google Calendar Link / Sync Badge */}
                            {task.syncedWithGCal || task.dueDate ? (
                                <button
                                    type="button"
                                    onClick={() => handleSyncToGCal(task)}
                                    title="View or Sync in Google Calendar"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '11px',
                                        padding: '2px 7px',
                                        borderRadius: '5px',
                                        backgroundColor: '#1f1f23',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <CalendarDays size={11} />
                                    <span>{task.syncedWithGCal ? 'In Google Calendar' : 'Sync to GCal'}</span>
                                    <ExternalLink size={9} />
                                </button>
                            ) : null}

                            {/* Reminder indicator */}
                            {task.reminder && task.dueDate && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#a1a1aa' }}>
                                    <Bell size={10} color="#a1a1aa" /> Alert on
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right Action Icons: Automate with CEOVA & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* ⚡️ Automate / Run with AI Button */}
                        <button
                            type="button"
                            onClick={() => handleRunTask(task)}
                            title="Automate or execute this task using CEOVA AI"
                            style={{
                                backgroundColor: task.isAutomated ? 'rgba(234, 179, 8, 0.15)' : '#1f1f23',
                                color: task.isAutomated ? '#facc15' : '#e4e4e7',
                                border: task.isAutomated ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid #27272a',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <Zap size={12} />
                            <span>Run AI</span>
                        </button>

                        {/* Delete button */}
                        <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: '#52525b',
                                cursor: 'pointer',
                                padding: '5px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                            }}
                            title="Delete task"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render Calendar / Schedule View (Google Calendar agenda grouping)
    function renderCalendarScheduleView() {
        const { overdue, today, tomorrow, upcoming, unscheduled } = scheduleGroups;
        const totalScheduled = overdue.length + today.length + tomorrow.length + upcoming.length;

        if (totalScheduled === 0 && unscheduled.length === 0) {
            return (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#71717a' }}>
                    <CalendarDays size={32} color="#52525b" style={{ marginBottom: '10px' }} />
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>No scheduled events or tasks</p>
                    <p style={{ margin: 0, fontSize: '11px' }}>Pick a due date or time above to schedule future work on your calendar.</p>
                </div>
            );
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Overdue Section */}
                {overdue.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#f87171' }}>
                            <AlertCircle size={14} />
                            <span>OVERDUE ({overdue.length})</span>
                        </div>
                        {overdue.map(t => renderTaskCard(t))}
                    </div>
                )}

                {/* Today Section */}
                {today.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#4ade80' }}>
                            <Calendar size={14} />
                            <span>TODAY · {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ({today.length})</span>
                        </div>
                        {today.map(t => renderTaskCard(t))}
                    </div>
                )}

                {/* Tomorrow Section */}
                {tomorrow.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#60a5fa' }}>
                            <Clock size={14} />
                            <span>TOMORROW ({tomorrow.length})</span>
                        </div>
                        {tomorrow.map(t => renderTaskCard(t))}
                    </div>
                )}

                {/* Upcoming Section */}
                {upcoming.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#c084fc' }}>
                            <CalendarDays size={14} />
                            <span>UPCOMING SCHEDULE ({upcoming.length})</span>
                        </div>
                        {upcoming.map(t => renderTaskCard(t))}
                    </div>
                )}

                {/* Unscheduled / Anytime Section */}
                {unscheduled.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.85 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#a1a1aa' }}>
                            <ListTodo size={14} />
                            <span>ANYTIME / NO DUE DATE ({unscheduled.length})</span>
                        </div>
                        {unscheduled.map(t => renderTaskCard(t))}
                    </div>
                )}
            </div>
        );
    }
}
