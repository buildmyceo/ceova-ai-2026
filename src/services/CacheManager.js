import { openDB } from 'idb';

const DB_NAME = 'ceova-cache';
const DB_VERSION = 2;

class CacheManager {
    constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
                    msgStore.createIndex('chat_id', 'chat_id');
                }
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('memory')) {
                    db.createObjectStore('memory', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('profile')) {
                    db.createObjectStore('profile', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('syncQueue')) {
                    db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('libraryItems')) {
                    db.createObjectStore('libraryItems', { keyPath: 'id' });
                }
            }
        });
    }

    // --- Profile ---
    async getProfile(userId) {
        const db = await this.dbPromise;
        return db.get('profile', userId);
    }

    async setProfile(profile) {
        const db = await this.dbPromise;
        await db.put('profile', profile);
    }

    // --- Chats ---
    async getChats() {
        const db = await this.dbPromise;
        const chats = await db.getAll('chats');
        return chats.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
    
    async getChat(chatId) {
        const db = await this.dbPromise;
        return db.get('chats', chatId);
    }

    async setChat(chat) {
        const db = await this.dbPromise;
        await db.put('chats', chat);
    }

    async setChats(chats) {
        const db = await this.dbPromise;
        const tx = db.transaction('chats', 'readwrite');
        await Promise.all(chats.map(chat => tx.store.put(chat)));
        await tx.done;
    }
    
    async deleteChat(chatId) {
        const db = await this.dbPromise;
        await db.delete('chats', chatId);
        // Also delete messages
        const tx = db.transaction('messages', 'readwrite');
        const index = tx.store.index('chat_id');
        let cursor = await index.openCursor(chatId);
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
        await tx.done;
    }

    // --- Messages ---
    async getMessages(chatId) {
        const db = await this.dbPromise;
        const msgs = await db.getAllFromIndex('messages', 'chat_id', chatId);
        return msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    async getAllMessages() {
        const db = await this.dbPromise;
        const msgs = await db.getAll('messages');
        return msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    async setMessages(messages) {
        const db = await this.dbPromise;
        const tx = db.transaction('messages', 'readwrite');
        await Promise.all(messages.map(msg => tx.store.put(msg)));
        await tx.done;
    }

    async setMessage(message) {
        const db = await this.dbPromise;
        await db.put('messages', message);
    }

    // --- Files ---
    async getFiles() {
        const db = await this.dbPromise;
        return db.getAll('files');
    }

    async setFile(file) {
        const db = await this.dbPromise;
        await db.put('files', file);
    }

    // --- Images ---
    async getImage(id) {
        const db = await this.dbPromise;
        return db.get('images', id);
    }

    async setImage(image) {
        const db = await this.dbPromise;
        await db.put('images', image);
    }

    // --- Library Items ---
    async getLibraryItems() {
        const db = await this.dbPromise;
        const items = await db.getAll('libraryItems');
        // Sort by created_at descending (assuming items have created_at)
        return items.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    async setLibraryItems(items) {
        const db = await this.dbPromise;
        const tx = db.transaction('libraryItems', 'readwrite');
        await tx.store.clear();
        await Promise.all(items.map(item => tx.store.put(item)));
        await tx.done;
    }

    // --- Clear ---
    async clearAll() {
        const db = await this.dbPromise;
        const stores = db.objectStoreNames;
        const tx = db.transaction(stores, 'readwrite');
        await Promise.all(Array.from(stores).map(store => tx.objectStore(store).clear()));
        await tx.done;
    }
}

export const cacheManager = new CacheManager();
