import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Trash2, Plus, X, ListTodo, CheckSquare } from 'lucide-react';

const STORAGE_KEY = 'ceova_user_tasks';

export default function TaskModal({ isOpen, onClose }) {
    const [tasks, setTasks] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch {}
        return [
            { id: '1', title: 'Review meeting schedule with Harshit', completed: false, createdAt: Date.now() - 3600000 },
            { id: '2', title: 'Prepare project updates for CEOVA', completed: true, createdAt: Date.now() - 86400000 }
        ];
    });

    const [newTaskText, setNewTaskText] = useState('');
    const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'
    const inputRef = useRef(null);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (e) {
            console.warn('[TaskModal] Failed to save tasks:', e);
        }
    }, [tasks]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddTask = (e) => {
        e?.preventDefault();
        const text = newTaskText.trim();
        if (!text) return;
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: text,
            completed: false,
            createdAt: Date.now()
        };
        setTasks(prev => [newTask, ...prev]);
        setNewTaskText('');
    };

    const toggleTask = (id) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const deleteTask = (id) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const clearCompleted = () => {
        setTasks(prev => prev.filter(t => !t.completed));
    };

    const filteredTasks = tasks.filter(t => {
        if (filter === 'pending') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
    });

    const pendingCount = tasks.filter(t => !t.completed).length;
    const completedCount = tasks.filter(t => t.completed).length;

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    onClick={onClose}
                    style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        backgroundColor: 'rgba(0, 0, 0, 0.75)', 
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
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        style={{ 
                            width: '100%', 
                            maxWidth: '520px', 
                            backgroundColor: '#0c0c0e', 
                            border: '1px solid #27272a', 
                            borderRadius: '16px',
                            display: 'flex', 
                            flexDirection: 'column',
                            maxHeight: '85vh',
                            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
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
                                    <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>
                                        Tasks
                                    </h2>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '3px 9px',
                                    borderRadius: '9999px',
                                    backgroundColor: '#1f1f23',
                                    border: '1px solid #3f3f46',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    color: '#f4f4f5'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
                                    <span>{pendingCount} pending · {completedCount} done</span>
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
                                    onMouseEnter={e => {
                                        e.currentTarget.style.backgroundColor = '#27272a';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.backgroundColor = '#1f1f23';
                                        e.currentTarget.style.color = '#a1a1aa';
                                    }}
                                    title="Close (Esc)"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>

                        {/* Input Row */}
                        <form onSubmit={handleAddTask} style={{
                            padding: '14px 18px',
                            display: 'flex',
                            gap: '8px',
                            backgroundColor: '#0c0c0e',
                            borderBottom: '1px solid #27272a'
                        }}>
                            <input 
                                ref={inputRef}
                                type="text"
                                placeholder="Add a new task..."
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
                                type="submit"
                                disabled={!newTaskText.trim()}
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
                                onMouseEnter={e => {
                                    if (newTaskText.trim()) {
                                        e.currentTarget.style.backgroundColor = '#e4e4e7';
                                        e.currentTarget.style.borderColor = '#e4e4e7';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (newTaskText.trim()) {
                                        e.currentTarget.style.backgroundColor = '#ffffff';
                                        e.currentTarget.style.borderColor = '#ffffff';
                                    }
                                }}
                            >
                                <Plus size={14} color={newTaskText.trim() ? '#000000' : '#52525b'} />
                                <span>Add</span>
                            </button>
                        </form>

                        {/* Filter Tabs & Clear Completed */}
                        <div style={{
                            padding: '12px 18px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#0c0c0e'
                        }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {[
                                    { id: 'all', label: 'All', count: tasks.length },
                                    { id: 'pending', label: 'Pending', count: pendingCount },
                                    { id: 'completed', label: 'Done', count: completedCount }
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
                                            onMouseEnter={e => {
                                                if (!isActive) {
                                                    e.currentTarget.style.backgroundColor = '#1f1f23';
                                                    e.currentTarget.style.borderColor = '#3f3f46';
                                                    e.currentTarget.style.color = '#ffffff';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isActive) {
                                                    e.currentTarget.style.backgroundColor = '#141417';
                                                    e.currentTarget.style.borderColor = '#27272a';
                                                    e.currentTarget.style.color = '#a1a1aa';
                                                }
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
                                    onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
                                >
                                    Clear completed
                                </button>
                            )}
                        </div>

                        {/* Task List */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '10px 18px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            minHeight: '200px',
                            backgroundColor: '#0c0c0e'
                        }}>
                            {filteredTasks.length === 0 ? (
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
                                        {filter === 'completed' ? 'No completed tasks' : (filter === 'pending' ? 'No pending tasks' : 'No tasks yet')}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#71717a' }}>
                                        Add tasks to stay focused and track your productivity.
                                    </p>
                                </div>
                            ) : (
                                filteredTasks.map(task => (
                                    <div
                                        key={task.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            backgroundColor: '#141417',
                                            border: '1px solid #27272a',
                                            transition: 'border-color 0.15s ease'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = '#3f3f46'}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = '#27272a'}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleTask(task.id)}
                                            style={{
                                                width: '20px',
                                                height: '20px',
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
                                            onMouseEnter={e => {
                                                if (!task.completed) e.currentTarget.style.borderColor = '#ffffff';
                                            }}
                                            onMouseLeave={e => {
                                                if (!task.completed) e.currentTarget.style.borderColor = '#52525b';
                                            }}
                                        >
                                            {task.completed && <Check size={13} color="#000000" strokeWidth={3} />}
                                        </button>

                                        <span style={{
                                            flex: 1,
                                            fontSize: '13px',
                                            color: task.completed ? '#71717a' : '#f4f4f5',
                                            textDecoration: task.completed ? 'line-through' : 'none',
                                            wordBreak: 'break-word',
                                            lineHeight: 1.4
                                        }}>
                                            {task.title}
                                        </span>

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
                                                transition: 'all 0.15s ease',
                                                flexShrink: 0
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.color = '#ffffff';
                                                e.currentTarget.style.backgroundColor = '#1f1f23';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.color = '#52525b';
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                            title="Delete task"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
