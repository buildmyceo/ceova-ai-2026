import React, { useState, useEffect } from 'react';
import { memoryEngine } from '../services/memoryEngine';
import { Trash2, Edit2, Search } from 'lucide-react';
import './MemoryManager.css';

export default function MemoryManager() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const results = await memoryEngine.searchMemory(searchQuery);
        setMemories(results);
      } else {
        const results = await memoryEngine.getAllMemories();
        setMemories(results);
      }
    } catch (err) {
      console.error("Failed to load memories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadMemories();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this memory?")) {
      try {
        await memoryEngine.deleteMemory(id);
        setMemories(memories.filter(m => m.id !== id));
      } catch (err) {
        console.error("Failed to delete memory", err);
        alert("Failed to delete memory");
      }
    }
  };

  const handleEdit = async (memory) => {
    const newValue = window.prompt("Edit Memory Value:", memory.value);
    if (newValue && newValue !== memory.value) {
      try {
        const updated = await memoryEngine.updateMemory(memory.id, newValue);
        if (updated && updated.length > 0) {
          setMemories(memories.map(m => m.id === memory.id ? updated[0] : m));
        }
      } catch (err) {
        console.error("Failed to update memory", err);
        alert("Failed to update memory");
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("WARNING: Are you sure you want to delete ALL your long-term memories? This cannot be undone.")) {
      try {
        // We delete them one by one or need a bulk delete in the engine.
        // For V1, we'll iterate and delete
        for (const m of memories) {
           await memoryEngine.deleteMemory(m.id);
        }
        setMemories([]);
      } catch(err) {
        console.error("Error clearing memories", err);
      }
    }
  };

  return (
    <div className="memory-manager-container">
      <div className="memory-header">
        <h2>Memory Engine</h2>
        <p>Manage the long-term facts and preferences Ceova remembers about you.</p>
      </div>

      <div className="memory-search-bar">
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search memories..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {memories.length > 0 && (
            <button className="clear-all-btn" onClick={handleClearAll}>Clear All</button>
        )}
      </div>

      <div className="memory-list">
        {loading ? (
          <div className="memory-loading">Loading memories...</div>
        ) : memories.length === 0 ? (
          <div className="memory-empty">No memories found.</div>
        ) : (
          memories.map(memory => (
            <div key={memory.id} className="memory-card">
              <div className="memory-card-header">
                <span className="memory-category">{memory.category}</span>
                <span className="memory-date">{new Date(memory.created_at).toLocaleDateString()}</span>
              </div>
              <div className="memory-title">{memory.title}</div>
              <div className="memory-value">{memory.value}</div>
              <div className="memory-actions">
                <button onClick={() => handleEdit(memory)} className="action-btn edit" title="Edit"><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(memory.id)} className="action-btn delete" title="Delete"><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
