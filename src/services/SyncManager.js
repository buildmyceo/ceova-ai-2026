import { supabase } from './supabase';
import { cacheManager } from './CacheManager';

export class SyncManager {
    constructor() {
        this.syncInProgress = false;
    }

    async getProfile(userId) {
        try {
            const cached = await cacheManager.getProfile(userId);
            if (cached) {
                this.syncProfile(userId); // Sync in bg
                return cached;
            }
        } catch(e) {}
        return this.syncProfile(userId);
    }

    async syncProfile(userId) {
        // Fetch from supabase
        const { data } = await supabase.from('users').select('*').eq('id', userId).single();
        if (data) {
            await cacheManager.setProfile(data);
        }
        return data;
    }

    async getChats(userId) {
        try {
            const cached = await cacheManager.getChats();
            if (cached && cached.length > 0) {
                this.syncChats(userId); // Sync in bg
                return cached;
            }
        } catch(e) {}
        return this.syncChats(userId);
    }

    async syncChats(userId) {
        const { data } = await supabase.from('chats').select('*').eq('user_id', userId);
        if (data) {
            await cacheManager.setChats(data);
        }
        return data;
    }

    async getMessages(chatId) {
        try {
            const cached = await cacheManager.getMessages(chatId);
            if (cached && cached.length > 0) {
                // Sync in bg
                this.syncMessages(chatId).catch(console.error);
                return cached;
            }
        } catch(e) {}
        return this.syncMessages(chatId);
    }

    async syncMessages(chatId) {
        const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
        if (data) {
            await cacheManager.setMessages(data);
        }
        return data;
    }

    async saveMessage(message) {
        // Save to cache immediately
        await cacheManager.setMessage(message);
        
        // Sync to Supabase
        const { error } = await supabase.from('messages').insert(message);
        if (error) {
            console.error("Background sync failed for message", error);
            // In a full implementation, we'd add to syncQueue here
        }
        return { error };
    }
}

export const syncManager = new SyncManager();
