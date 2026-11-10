/**
 * CEOVA Task Manager Service
 * Multi-device cloud sync (Supabase + localStorage), Google Calendar integration,
 * reminder alerts, and AI automation bridge.
 */
import { supabase } from './supabase';
import { createGoogleCalendarEvent } from './gcalendarSyncEngine';

export const TASK_STORAGE_KEY = 'ceova_user_tasks';
export const TASK_REMINDERS_ALERTED_KEY = 'ceova_task_reminders_alerted';

/**
 * Generate a standard Google Calendar Web URL for a task
 */
export function getGoogleCalendarUrl(task) {
    if (!task) return 'https://calendar.google.com';
    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    
    let datesParam = '';
    const dueDate = task.dueDate || new Date().toISOString().split('T')[0];
    const dueTime = task.dueTime || '09:00';

    try {
        const dateStr = dueDate.replace(/-/g, '');
        const timeStr = dueTime.replace(/:/g, '') + '00';
        const startStr = `${dateStr}T${timeStr}`;

        // Add 1 hour for end time
        const startDt = new Date(`${dueDate}T${dueTime}:00`);
        const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
        const endYear = endDt.getFullYear();
        const endMonth = String(endDt.getMonth() + 1).padStart(2, '0');
        const endDay = String(endDt.getDate()).padStart(2, '0');
        const endHours = String(endDt.getHours()).padStart(2, '0');
        const endMins = String(endDt.getMinutes()).padStart(2, '0');
        const endStr = `${endYear}${endMonth}${endDay}T${endHours}${endMins}00`;
        
        datesParam = `&dates=${startStr}/${endStr}`;
    } catch {
        datesParam = '';
    }

    const title = encodeURIComponent(task.title || 'CEOVA Task');
    const details = encodeURIComponent(
        `${task.notes ? task.notes + '\n\n' : ''}Scheduled via CEOVA AI Assistant.${task.isAutomated ? '\n⚡️ AI Automation Enabled' : ''}`
    );

    return `${baseUrl}&text=${title}&details=${details}${datesParam}`;
}

/**
 * Load tasks with multi-device cloud merge (Supabase + localStorage fallback)
 */
export async function loadTasks(userId = null) {
    let localTasks = [];
    try {
        const saved = localStorage.getItem(TASK_STORAGE_KEY);
        if (saved) localTasks = JSON.parse(saved);
    } catch (e) {
        console.warn('[TaskManager] Failed to load local tasks:', e);
    }

    if (!localTasks || localTasks.length === 0) {
        localTasks = [
            { 
                id: '1', 
                title: 'Review meeting schedule with Harshit', 
                completed: false, 
                createdAt: Date.now() - 3600000,
                dueDate: new Date().toISOString().split('T')[0],
                dueTime: '17:00',
                reminder: true,
                isAutomated: true,
                priority: 'high',
                notes: 'Prepare meeting agenda and review action points with CEOVA.'
            },
            { 
                id: '2', 
                title: 'Prepare project updates for CEOVA', 
                completed: true, 
                createdAt: Date.now() - 86400000,
                dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                dueTime: '11:00',
                reminder: false,
                isAutomated: false,
                priority: 'medium',
                notes: 'Summarize development progress and milestones.'
            }
        ];
    }

    if (!userId) return localTasks;

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user?.user_metadata?.ceova_tasks) {
            const remoteTasks = user.user_metadata.ceova_tasks;
            if (Array.isArray(remoteTasks) && remoteTasks.length > 0) {
                // Merge remote and local by id
                const taskMap = new Map();
                localTasks.forEach(t => taskMap.set(t.id, t));
                remoteTasks.forEach(t => {
                    const existing = taskMap.get(t.id);
                    if (!existing || (t.updatedAt || t.createdAt || 0) >= (existing.updatedAt || existing.createdAt || 0)) {
                        taskMap.set(t.id, t);
                    }
                });
                const merged = Array.from(taskMap.values());
                localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(merged));
                return merged;
            }
        }
    } catch (err) {
        console.warn('[TaskManager] Cloud sync error during load:', err);
    }

    return localTasks;
}

/**
 * Save tasks locally and sync to cloud across devices
 */
let syncDebounceTimer = null;
export async function saveTasks(tasks, userId = null) {
    if (!Array.isArray(tasks)) return;

    try {
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
        // Broadcast change for other tabs/listeners
        window.dispatchEvent(new CustomEvent('ceova_tasks_updated', { detail: tasks }));
    } catch (e) {
        console.warn('[TaskManager] Failed to save tasks to storage:', e);
    }

    if (!userId) return;

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
        try {
            await supabase.auth.updateUser({
                data: { ceova_tasks: tasks }
            });
        } catch (err) {
            console.warn('[TaskManager] Failed to sync tasks to Supabase user_metadata:', err);
        }
    }, 1200);
}

/**
 * Directly sync a task to Google Calendar
 */
export async function syncTaskToGoogleCalendar(userId, task) {
    if (!task || !task.dueDate) {
        return { success: false, error: 'A valid due date is required to sync to Google Calendar.' };
    }

    const eventData = {
        title: task.title,
        description: task.notes || 'Created via CEOVA AI Assistant',
        startDate: task.dueDate,
        startTime: task.dueTime || '09:00',
        endDate: task.dueDate,
        endTime: task.dueTime ? getNextHour(task.dueTime) : '10:00',
        isAllDay: !task.dueTime
    };

    if (userId) {
        try {
            const res = await createGoogleCalendarEvent(userId, eventData);
            if (res?.success) {
                return { 
                    success: true, 
                    htmlLink: res.event?.htmlLink || getGoogleCalendarUrl(task) 
                };
            }
        } catch (e) {
            console.warn('[TaskManager] Direct GCal sync error:', e);
        }
    }

    // Fallback: return instant web calendar link
    return {
        success: true,
        fallback: true,
        htmlLink: getGoogleCalendarUrl(task)
    };
}

function getNextHour(timeStr) {
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const nextH = (h + 1) % 24;
        return `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } catch {
        return '10:00';
    }
}

/**
 * Play a gentle, high-quality dual-tone audio chime for task reminders
 */
export function playReminderChime() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // First Bell Note (D5 ~587Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.38);

        // Second Bell Note (A5 ~880Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.14);
        gain2.gain.setValueAtTime(0.18, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.14);
        osc2.stop(now + 0.65);
    } catch (e) {
        console.warn('[TaskManager] Audio chime error:', e);
    }
}

/**
 * Request system/browser notification permission
 */
export async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission;
    }
    return Notification.permission;
}

/**
 * Show a native or browser notification
 */
export function sendBrowserNotification(title, options = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    if (Notification.permission === 'granted') {
        try {
            return new Notification(title, {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                ...options
            });
        } catch (e) {
            console.warn('[TaskManager] Notification launch error:', e);
        }
    }
    return null;
}
