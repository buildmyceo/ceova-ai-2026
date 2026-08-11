import { syncGoogleDrive, connectGoogleDrive, getGoogleAccessToken } from './gdriveSyncEngine';
import { syncDropbox, connectDropbox, getDropboxAccessToken, fetchDropboxFileContent, getDropboxTemporaryLink, categorizeDropboxMimeType } from './dropboxSyncEngine';

/**
 * CEOVA Shared Storage Manager Architecture
 * Provider-agnostic storage abstraction backing CEOVA Library.
 * -------------------------------------------------------------
 * Storage Policy Enforced:
 * 1. Storage provider is the source of truth (Google Drive, Dropbox).
 * 2. Never permanently download provider files.
 * 3. Never copy files into Supabase Storage.
 * 4. Ephemeral content access for AI operations (OCR, Summarization, Translation, RAG Chat).
 */

class StorageManager {
  constructor() {
    this.providers = {
      gdrive: {
        id: 'gdrive',
        name: 'Google Drive',
        connect: connectGoogleDrive,
        sync: syncGoogleDrive,
        getToken: getGoogleAccessToken,
      },
      dropbox: {
        id: 'dropbox',
        name: 'Dropbox',
        connect: connectDropbox,
        sync: syncDropbox,
        getToken: getDropboxAccessToken,
        fetchContent: fetchDropboxFileContent,
        getTempLink: getDropboxTemporaryLink,
        categorize: categorizeDropboxMimeType
      }
    };
  }

  /**
   * Register a new storage provider plugin
   */
  registerProvider(providerId, providerDef) {
    this.providers[providerId] = providerDef;
  }

  /**
   * Connect / Trigger OAuth for provider
   */
  async connectProvider(providerId) {
    const provider = this.providers[providerId];
    if (!provider) throw new Error(`Unknown storage provider: ${providerId}`);
    return await provider.connect();
  }

  /**
   * Trigger Sync for a specific provider
   */
  async syncProvider(providerId, userId) {
    const provider = this.providers[providerId];
    if (!provider) throw new Error(`Unknown storage provider: ${providerId}`);
    return await provider.sync(userId);
  }

  /**
   * Trigger Sync for all registered storage providers
   */
  async syncAllProviders(userId) {
    const results = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      try {
        results[key] = await provider.sync(userId);
      } catch (err) {
        results[key] = { success: false, error: err.message };
      }
    }
    return results;
  }

  /**
   * Ephemeral In-Memory File Content Streaming / Processing
   */
  async fetchFileContent(userId, file) {
    if (!file) return null;
    const source = file.storage_source || 'gdrive';

    if (source === 'dropbox') {
      const pathOrId = file.drive_id || file.id;
      return await fetchDropboxFileContent(userId, pathOrId, file.mime_type);
    }

    // Default to Google Drive
    const { fetchDriveFileContent } = await import('./libraryAIService');
    return await fetchDriveFileContent(userId, file.drive_id, file.mime_type);
  }

  /**
   * Get direct preview or temporary viewing link for file without duplicating data
   */
  async getTemporaryViewLink(userId, file) {
    if (!file) return null;
    const source = file.storage_source || 'gdrive';

    if (source === 'dropbox') {
      const tempLink = await getDropboxTemporaryLink(userId, file.drive_id || file.id);
      if (tempLink) return tempLink;
    }

    return file.web_view_link || file.url || null;
  }
}

export const storageManager = new StorageManager();
