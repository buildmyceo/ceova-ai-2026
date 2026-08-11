import { supabase } from '../supabaseClient'; // Adjust path if needed

/**
 * Pluggable Embedding Provider Interface
 * V1 defaults to None, falling back to full-text search.
 */
export class EmbeddingProvider {
  constructor(type = 'none') {
    this.type = type;
  }

  async generateEmbedding(text) {
    if (this.type === 'none') return null;
    // Future implementations for 'local', 'openai' can be added here
    return null;
  }
}

/**
 * Production-Ready 3-Layer Memory Engine
 */
export class MemoryEngine {
  constructor() {
    this.embeddingProvider = new EmbeddingProvider('none');
    
    // Layer 1: Session Memory (Client-side only)
    this.sessionMemory = {
      messages: [],
      uploads: [],
      toolCalls: []
    };
  }

  // ==========================================
  // Layer 1: Session Memory Methods
  // ==========================================
  
  addSessionMessage(msg) {
    this.sessionMemory.messages.push(msg);
  }

  getRecentMessages(limit = 50) {
    return this.sessionMemory.messages.slice(-limit);
  }

  addSessionUpload(file) {
    this.sessionMemory.uploads.push(file);
  }

  getRecentUploads() {
    return this.sessionMemory.uploads;
  }

  addSessionToolCall(call) {
    this.sessionMemory.toolCalls.push(call);
  }

  getRecentToolCalls() {
    return this.sessionMemory.toolCalls;
  }

  clearSession() {
    this.sessionMemory = { messages: [], uploads: [], toolCalls: [] };
  }

  // ==========================================
  // Layer 2: User Memory Methods
  // ==========================================

  async saveMemory(category, title, value, confidence = 1.0) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("Unauthorized");

    // Check memory quota
    const { data: usageData, error: usageError } = await supabase.rpc('get_usage_and_limits', { p_user_id: user.user.id });
    if (!usageError && usageData) {
      if (usageData.usage.memory_used >= usageData.limits.memory_limit) {
        const error = new Error("Memory limit reached. Delete old memories or upgrade to continue saving new ones.");
        error.code = "QuotaExceeded";
        throw error;
      }
    }

    const { data, error } = await supabase
      .from('user_memory_longterm')
      .insert([{
        user_id: user.user.id,
        category,
        title,
        value,
        confidence
      }])
      .select();
      
    if (error) throw error;
    return data;
  }

  async updateMemory(id, value) {
    const { data, error } = await supabase
      .from('user_memory_longterm')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    return data;
  }

  async deleteMemory(id) {
    const { error } = await supabase
      .from('user_memory_longterm')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return true;
  }

  async searchMemory(query, maxResults = 5) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return [];

    const { data, error } = await supabase.rpc('search_memory_longterm_fts', {
      search_query: query,
      user_id_filter: user.user.id,
      max_results: maxResults
    });

    if (error) throw error;
    return data;
  }

  async getAllMemories() {
    const { data, error } = await supabase
      .from('user_memory_longterm')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  }

  // ==========================================
  // Layer 3: Knowledge Memory Methods
  // ==========================================

  async addKnowledge(content, metadata = {}) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("Unauthorized");

    const embedding = await this.embeddingProvider.generateEmbedding(content);

    const { data, error } = await supabase
      .from('knowledge_memory')
      .insert([{
        user_id: user.user.id,
        content,
        metadata,
        embedding // Will be null for V1
      }])
      .select();
      
    if (error) throw error;
    return data;
  }

  async deleteKnowledge(id) {
    const { error } = await supabase
      .from('knowledge_memory')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return true;
  }

  async keywordSearch(query, maxResults = 10) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return [];

    const { data, error } = await supabase.rpc('search_knowledge_memory_fts', {
      search_query: query,
      user_id_filter: user.user.id,
      max_results: maxResults
    });

    if (error) throw error;
    return data;
  }
}

export const memoryEngine = new MemoryEngine();
