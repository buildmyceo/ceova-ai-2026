/**
 * CEOVA Application Registry Service
 * 
 * Manages installed and available separate applications (such as CEOVA CCTV)
 * accessible via Connectors → Apps. Keeps application metadata strictly separate
 * from operational data, credentials, and local databases.
 */

const STORAGE_KEY = 'ceova_apps_registry_v1';

// Initial / default catalog of supported applications
export const DEFAULT_APPLICATIONS = [
  {
    id: 'ceova-cctv',
    name: 'CEOVA CCTV',
    displayName: 'CEOVA CCTV',
    description: 'Autonomous AI CCTV monitoring system with local object detection, multi-camera live streaming, and intelligent security alerts.',
    publishedVersion: '1.0.0',
    supportedPlatforms: ['windows', 'macos'],
    installationStatus: 'not_installed', // 'not_installed' | 'downloading' | 'verifying' | 'installing' | 'installed' | 'failed' | 'updating'
    installedVersion: null,
    updateAvailable: false,
    lastHealthCheck: null,
    icon: 'cctv',
    // Agent status metadata (separate from CCTV operational DB)
    agentStatus: {
      running: false,
      monitoring: false,
      aiEngineHealthy: false,
      cameraCount: 0,
      port: 8085,
      loopbackUrl: 'http://127.0.0.1:8085',
      lastError: null
    },
    // Installation / update progress tracking
    progress: {
      phase: null, // 'downloading' | 'verifying' | 'installing' | 'verifying_runtime' | null
      percent: 0,
      message: null,
      error: null
    }
  }
];

const inMemoryStore = new Map();

function getStorageItem(key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  return inMemoryStore.get(key) || null;
}

function setStorageItem(key, value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
    return;
  }
  inMemoryStore.set(key, value);
}

class AppRegistryService {
  constructor() {
    this.listeners = new Set();
    this.apps = this.loadRegistry();
  }

  loadRegistry() {
    try {
      const saved = getStorageItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved with defaults in case new fields were added
        return DEFAULT_APPLICATIONS.map(defaultApp => {
          const savedApp = parsed.find(a => a.id === defaultApp.id);
          if (savedApp) {
            return {
              ...defaultApp,
              ...savedApp,
              // Ensure transient progress is reset on fresh start
              progress: { phase: null, percent: 0, message: null, error: null }
            };
          }
          return { ...defaultApp };
        });
      }
    } catch (e) {
      console.warn('[AppRegistry] Failed to load registry from storage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_APPLICATIONS));
  }

  saveRegistry() {
    try {
      // Strip sensitive or transient states before storing
      const toSave = this.apps.map(app => ({
        id: app.id,
        name: app.name,
        displayName: app.displayName,
        description: app.description,
        publishedVersion: app.publishedVersion,
        supportedPlatforms: app.supportedPlatforms,
        installationStatus: app.installationStatus === 'installing' || app.installationStatus === 'downloading'
          ? 'not_installed'
          : app.installationStatus,
        installedVersion: app.installedVersion,
        updateAvailable: app.updateAvailable,
        lastHealthCheck: app.lastHealthCheck,
        agentStatus: {
          ...app.agentStatus,
          // Don't persist running=true across restarts without health check confirmation
          running: false,
          monitoring: false
        }
      }));
      setStorageItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[AppRegistry] Failed to save registry to storage:', e);
    }
  }

  getApplications() {
    return [...this.apps];
  }

  getApplication(appId) {
    return this.apps.find(a => a.id === appId) || null;
  }

  updateApplication(appId, updates) {
    const index = this.apps.findIndex(a => a.id === appId);
    if (index === -1) return null;

    const current = this.apps[index];
    const updated = {
      ...current,
      ...updates,
      agentStatus: updates.agentStatus 
        ? { ...current.agentStatus, ...updates.agentStatus }
        : current.agentStatus,
      progress: updates.progress
        ? { ...current.progress, ...updates.progress }
        : current.progress
    };

    this.apps[index] = updated;
    this.saveRegistry();
    this.notifyListeners(updated);
    return updated;
  }

  setInstallationStatus(appId, status, error = null) {
    return this.updateApplication(appId, {
      installationStatus: status,
      progress: {
        phase: status === 'installed' || status === 'not_installed' ? null : status,
        percent: status === 'installed' ? 100 : 0,
        message: status === 'installed' ? 'Installation verified' : null,
        error: error
      }
    });
  }

  setProgress(appId, { phase, percent, message, error = null }) {
    return this.updateApplication(appId, {
      progress: { phase, percent, message, error }
    });
  }

  setInstalled(appId, version) {
    return this.updateApplication(appId, {
      installationStatus: 'installed',
      installedVersion: version,
      updateAvailable: false,
      progress: { phase: null, percent: 100, message: 'Installed and verified', error: null }
    });
  }

  setUpdateAvailable(appId, available, newVersion = null) {
    const updates = { updateAvailable: available };
    if (newVersion) updates.publishedVersion = newVersion;
    return this.updateApplication(appId, updates);
  }

  updateAgentHealth(appId, { running, monitoring, aiEngineHealthy, cameraCount, error = null }) {
    return this.updateApplication(appId, {
      lastHealthCheck: new Date().toISOString(),
      agentStatus: {
        running: !!running,
        monitoring: !!monitoring,
        aiEngineHealthy: !!aiEngineHealthy,
        cameraCount: typeof cameraCount === 'number' ? cameraCount : 0,
        lastError: error
      }
    });
  }

  resetApplication(appId) {
    const defaultApp = DEFAULT_APPLICATIONS.find(a => a.id === appId);
    if (!defaultApp) return null;
    return this.updateApplication(appId, JSON.parse(JSON.stringify(defaultApp)));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(app) {
    for (const listener of this.listeners) {
      try {
        listener(app, this.apps);
      } catch (e) {
        console.error('[AppRegistry] Listener error:', e);
      }
    }
  }
}

export const appRegistry = new AppRegistryService();
export default appRegistry;
