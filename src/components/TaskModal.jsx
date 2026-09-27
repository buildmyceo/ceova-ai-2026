import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, SquareCheck, Check, Trash2, Plus, X, ListTodo, Calendar, Clock } from 'lucide-react';

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
                        background: 'rgba(0, 0, 0, 0.72)', 
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
                        initial={{ opacity: 0, scale: 0.96, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 14 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        style={{ 
                            width: '100%', 
                            maxWidth: '520px', 
                            background: 'rgba(22, 22, 26, 0.92)', 
                            backdropFilter: 'blur(32px) saturate(190%)',
                            WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                            border: '1px solid rgba(255, 255, 255, 0.12)', 
                            borderRadius: '24px',
                            display: 'flex', 
                            flexDirection: 'column',
                            maxHeight: '85vh',
                            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '20px 24px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'rgba(66, 133, 244, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#4285F4',
                                    border: '1px solid rgba(66, 133, 244, 0.25)'
                                }}>
                                    <SquareCheck size={20} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>
                                        Tasks
                                    </h2>
                                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                        {pendingCount} pending · {completedCount} completed
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        cursor: 'pointer',
                                        padding: '6px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                    }}
                                    title="Close (Esc)"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Input Row */}
                        <form onSubmit={handleAddTask} style={{
                            padding: '16px 24px',
                            display: 'flex',
                            gap: '10px',
                            background: 'rgba(255, 255, 255, 0.015)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                        }}>
                            <input 
                                type="text"
                                placeholder="Add a new task..."
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                autoFocus
                                style={{
                                    flex: 1,
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    padding: '11px 16px',
                                    color: '#ffffff',
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    fontFamily: 'inherit'
                                }}
                                onFocus={e => e.currentTarget.style.borderColor = 'rgba(66, 133, 244, 0.6)'}
                                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                            />
                            <button
                                type="submit"
                                disabled={!newTaskText.trim()}
                                style={{
                                    background: newTaskText.trim() ? '#4285F4' : 'rgba(255, 255, 255, 0.06)',
                                    color: newTaskText.trim() ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                                    border: 'none',
                                    padding: '0 18px',
                                    borderRadius: '12px',
                                    fontWeight: 500,
                                    fontSize: '13.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: newTaskText.trim() ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Plus size={16} />
                                <span>Add</span>
                            </button>
                        </form>

                        {/* Filter Tabs */}
                        <div style={{
                            padding: '12px 24px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                {[
                                    { id: 'all', label: 'All', count: tasks.length },
                                    { id: 'pending', label: 'Pending', count: pendingCount },
                                    { id: 'completed', label: 'Done', count: completedCount }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setFilter(tab.id)}
                                        style={{
                                            background: filter === tab.id ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                                            color: filter === tab.id ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                                            border: 'none',
                                            padding: '5px 12px',
                                            borderRadius: '8px',
                                            fontSize: '12.5px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <span>{tab.label}</span>
                                        <span style={{
                                            fontSize: '11px',
                                            opacity: 0.7,
                                            background: filter === tab.id ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            padding: '1px 5px',
                                            borderRadius: '6px'
                                        }}>{tab.count}</span>
                                    </button>
                                ))}
                            </div>

                            {completedCount > 0 && (
                                <button
                                    onClick={clearCompleted}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.4)',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        transition: 'color 0.15s ease'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.color = '#EA4335'}
                                    onMouseOut={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'}
                                >
                                    Clear completed
                                </button>
                            )}
                        </div>

                        {/* Task List */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '8px 24px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            minHeight: '220px'
                        }}>
                            {filteredTasks.length === 0 ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '48px 16px',
                                    color: 'rgba(255, 255, 255, 0.35)',
                                    textAlign: 'center'
                                }}>
                                    <ListTodo size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
                                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500 }}>
                                        {filter === 'completed' ? 'No completed tasks' : (filter === 'pending' ? 'No pending tasks' : 'No tasks yet')}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
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
                                            padding: '12px 14px',
                                            borderRadius: '12px',
                                            background: task.completed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                                            border: `1px solid ${task.completed ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.08)'}`,
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggleTask(task.id)}
                                            style={{
                                                width: '22px',
                                                height: '22px',
                                                borderRadius: '6px',
                                                border: `2px solid ${task.completed ? '#4285F4' : 'rgba(255, 255, 255, 0.3)'}`,
                                                background: task.completed ? '#4285F4' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0,
                                                flexShrink: 0,
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {task.completed && <Check size={14} color="#ffffff" strokeWidth={3} />}
                                        </button>

                                        <span style={{
                                            flex: 1,
                                            fontSize: '14px',
                                            color: task.completed ? 'rgba(255, 255, 255, 0.4)' : '#f4f4f5',
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
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'rgba(255, 255, 255, 0.3)',
                                                cursor: 'pointer',
                                                padding: '6px',
                                                borderRadius: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s ease',
                                                flexShrink: 0
                                            }}
                                            onMouseOver={e => {
                                                e.currentTarget.style.color = '#EA4335';
                                                e.currentTarget.style.background = 'rgba(234, 67, 53, 0.1)';
                                            }}
                                            onMouseOut={e => {
                                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.3)';
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                            title="Delete task"
                                        >
                                            <Trash2 size={15} />
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
