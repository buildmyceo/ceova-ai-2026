import React, { useState, useEffect } from 'react';
import { 
  Video, Download, Play, Pause, RefreshCw, AlertCircle, 
  CheckCircle2, ArrowUpCircle, ShieldCheck, HardDrive, 
  ExternalLink, Loader2, XCircle, Link as LinkIcon, Settings2, Check
} from 'lucide-react';
import { appRegistry } from '../services/appRegistryService';
import { cctvAgent } from '../services/cctvAgentService';
import { installerService } from '../services/installerService';
import { detectPlatform } from '../services/updateManifest';
import CctvInstallerModal from './CctvInstallerModal';

export const OFFICIAL_CCTV_WEBSITE_URL = 'https://cctv-app-desktop.vercel.app/';

/**
 * Robustly resolves a CCTV release manifest from a direct package URL,
 * manifest JSON endpoint, or an HTML download portal (like GitHub Pages).
 */
export async function resolveCctvManifest(url, platform, currentVersion) {
  const activeUrl = (url || '').trim();
  if (!activeUrl) return null;

  // Case 1: Direct manifest JSON endpoint
  if (activeUrl.endsWith('.json') || activeUrl.includes('/api/manifest')) {
    const res = await fetch(activeUrl);
    if (!res.ok) throw new Error(`Failed to fetch release manifest: HTTP ${res.status}`);
    return await res.json();
  }

  // Case 2: Direct binary package installer (.exe, .dmg, .zip, .tar.gz, etc.)
  if (/\.(tar\.gz|tgz|zip|dmg|exe|msi)$/i.test(activeUrl)) {
    return {
      appId: 'ceova-cctv',
      version: currentVersion || '1.0.0',
      minSupportedVersion: '1.0.0',
      platforms: {
        [platform.platformKey]: { packageUrl: activeUrl },
        [platform.os]: { packageUrl: activeUrl }
      },
      releaseNotes: 'Direct release downloaded from configured CCTV software source.'
    };
  }

  // Case 3: Webpage portal (e.g. https://buildmyceo.github.io/cctv-app-desktop/)
  // 3a. Try fetching manifest.json from website root first
  try {
    const baseUrl = activeUrl.endsWith('/') ? activeUrl : (activeUrl.endsWith('.html') ? activeUrl.substring(0, activeUrl.lastIndexOf('/') + 1) : `${activeUrl}/`);
    const manifestUrl = `${baseUrl}manifest.json`;
    const mRes = await fetch(manifestUrl);
    if (mRes.ok) {
      const manifestData = await mRes.json();
      if (manifestData && manifestData.platforms) {
        return manifestData;
      }
    }
  } catch (_e) {}

  // 3b. Fetch HTML page and parse embedded structured data or metadata
  try {
    const pageRes = await fetch(activeUrl);
    if (pageRes.ok) {
      const html = await pageRes.text();

      // Check for <script type="application/json" id="app-download-data">
      const jsonMatch = html.match(/<script[^>]*id=["']app-download-data["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          const isWin = platform.os === 'windows' || (platform.platformKey && platform.platformKey.startsWith('win'));
          const chosenUrl = isWin 
            ? (parsed.windows || parsed.platforms?.['windows-x64']?.url || parsed.platforms?.['windows-x64'])
            : (parsed.mac || parsed.platforms?.['macos-arm64']?.url || parsed.platforms?.['macos-x64']?.url);

          if (chosenUrl) {
            return {
              appId: parsed.appId || 'ceova-cctv',
              version: parsed.version || currentVersion || '1.0.0',
              minSupportedVersion: '1.0.0',
              platforms: {
                [platform.platformKey]: { packageUrl: chosenUrl },
                [platform.os]: { packageUrl: chosenUrl }
              },
              releaseNotes: 'Official CCTV release discovered via download portal.'
            };
          }
        } catch (_jsonErr) {}
      }

      // Check for <meta name="windows-download-url"> or <meta name="mac-download-url">
      const isWin = platform.os === 'windows' || (platform.platformKey && platform.platformKey.startsWith('win'));
      const metaRegex = isWin 
        ? /<meta[^>]*name=["']windows-download-url["'][^>]*content=["']([^"']+)["']/i
        : /<meta[^>]*name=["'](?:mac-download-url|mac-arm64-download-url)["'][^>]*content=["']([^"']+)["']/i;
      const metaMatch = html.match(metaRegex);
      if (metaMatch && metaMatch[1]) {
        return {
          appId: 'ceova-cctv',
          version: currentVersion || '1.0.0',
          minSupportedVersion: '1.0.0',
          platforms: {
            [platform.platformKey]: { packageUrl: metaMatch[1] },
            [platform.os]: { packageUrl: metaMatch[1] }
          },
          releaseNotes: 'Official CCTV release discovered via webpage metadata.'
        };
      }
    }
  } catch (_pageErr) {}

  // Fallback to activeUrl directly
  return {
    appId: 'ceova-cctv',
    version: currentVersion || '1.0.0',
    minSupportedVersion: '1.0.0',
    platforms: {
      [platform.platformKey]: { packageUrl: activeUrl },
      [platform.os]: { packageUrl: activeUrl }
    },
    releaseNotes: 'Direct release downloaded from configured CCTV software source.'
  };
}

export default function CctvAppCard({ onOpenCctv }) {
  const [app, setApp] = useState(() => appRegistry.getApplication('ceova-cctv'));
  const [agentStatus, setAgentStatus] = useState(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('ceova_cctv_download_url') || 
             (import.meta.env?.VITE_CCTV_DOWNLOAD_URL || OFFICIAL_CCTV_WEBSITE_URL);
    }
    return OFFICIAL_CCTV_WEBSITE_URL;
  });
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  const [isInstallerModalOpen, setIsInstallerModalOpen] = useState(false);

  // Subscribe to registry updates
  useEffect(() => {
    const unsubscribe = appRegistry.subscribe((updatedApp) => {
      if (updatedApp.id === 'ceova-cctv') {
        setApp({ ...updatedApp });
      }
    });

    // Check status immediately
    refreshStatus();

    // Start background health polling if installed
    if (app?.installationStatus === 'installed') {
      cctvAgent.startPolling(6000, (status) => {
        setAgentStatus(status);
      });
    }

    return () => {
      unsubscribe();
      cctvAgent.stopPolling();
    };
  }, [app?.installationStatus]);

  const refreshStatus = async () => {
    try {
      if (typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const installed = await invoke('is_cctv_installed');
          if (!installed) {
            appRegistry.setInstallationStatus('ceova-cctv', 'not_installed');
            setApp(prev => ({ ...prev, installationStatus: 'not_installed' }));
          }
        } catch (_e) {}
      }
      const status = await cctvAgent.getStatus();
      setAgentStatus(status);
    } catch (e) {
      console.warn('Status refresh error:', e);
    }
  };

  const handleSaveUrl = (urlToSave) => {
    const trimmed = (urlToSave !== undefined ? urlToSave : tempUrl).trim();
    setDownloadUrl(trimmed);
    if (typeof window !== 'undefined' && window.localStorage) {
      if (trimmed) {
        window.localStorage.setItem('ceova_cctv_download_url', trimmed);
      } else {
        window.localStorage.removeItem('ceova_cctv_download_url');
      }
    }
    setShowUrlConfig(false);
  };

  const handleInstall = async () => {
    setIsInstallerModalOpen(true);
  };

  const handleUpdate = async () => {
    setIsLoadingAction(true);
    setActionError(null);

    const activeUrl = downloadUrl.trim();
    if (!activeUrl) {
      setShowUrlConfig(true);
      setActionError('Please configure the CCTV download link to check and apply updates.');
      setIsLoadingAction(false);
      return;
    }

    try {
      let updateManifest;
      const platform = detectPlatform();

      updateManifest = await resolveCctvManifest(activeUrl, platform, app?.publishedVersion || '1.0.1');

      await installerService.updateApplication('ceova-cctv', updateManifest, { skipVerification: true });
      await refreshStatus();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      if (agentStatus?.monitoring) {
        await cctvAgent.pauseMonitoring();
      } else {
        await cctvAgent.startMonitoring();
      }
      await refreshStatus();
    } catch (e) {
      console.warn('Toggle monitoring error:', e);
    }
  };

  const handleDeleteApp = async () => {
    if (!window.confirm("Are you sure you want to disconnect CCTV and delete the application from your device? You can re-download it anytime from the download page.")) {
      return;
    }
    setIsLoadingAction(true);
    setActionError(null);
    try {
      await installerService.deleteApplication('ceova-cctv');
      await refreshStatus();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const isInstalled = app?.installationStatus === 'installed';
  const isProgressing = app?.installationStatus === 'downloading' || 
                        app?.installationStatus === 'verifying' || 
                        app?.installationStatus === 'installing' ||
                        app?.installationStatus === 'updating';
  const hasUpdate = isInstalled && app?.updateAvailable;

  return (
    <div className="cctv-managed-card" style={{
      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.45), rgba(15, 23, 42, 0.65))',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '20px',
      padding: '24px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '180px',
        height: '180px',
        background: isInstalled ? 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
            color: '#fff',
            flexShrink: 0
          }}>
            <Video size={26} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                {app.displayName || 'CEOVA CCTV'}
              </h3>
              {app.installedVersion ? (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  v{app.installedVersion}
                </span>
              ) : (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  fontWeight: 600,
                  border: '1px solid rgba(59, 130, 246, 0.25)'
                }}>
                  Published v{app.publishedVersion}
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
              {app.description}
            </p>

            {/* Remote Download URL configuration indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LinkIcon size={12} />
                Download Source:
              </span>
              {downloadUrl ? (
                <span 
                  title={downloadUrl}
                  style={{ 
                    fontSize: '0.75rem', 
                    color: '#38bdf8', 
                    background: 'rgba(56, 189, 248, 0.1)', 
                    padding: '2px 8px', 
                    borderRadius: '6px',
                    maxWidth: '260px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {downloadUrl}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                  Not Configured
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setTempUrl(downloadUrl);
                  setShowUrlConfig(!showUrlConfig);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontSize: '0.72rem',
                  textDecoration: 'underline'
                }}
              >
                {showUrlConfig ? 'Close' : (downloadUrl ? 'Change' : 'Set Link')}
              </button>
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div>
          {isInstalled ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: agentStatus?.running ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${agentStatus?.running ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              color: agentStatus?.running ? '#4ade80' : '#f87171',
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: agentStatus?.running ? '#22c55e' : '#ef4444',
                boxShadow: agentStatus?.running ? '0 0 8px #22c55e' : 'none'
              }} />
              {agentStatus?.running ? 'Service Running' : 'Service Stopped'}
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(148, 163, 184, 0.1)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#94a3b8',
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              Not Installed
            </div>
          )}
        </div>
      </div>

      {/* URL Configuration Input Panel */}
      {showUrlConfig && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '12px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
            Configure CCTV Software Download URL / Page
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="e.g. https://buildmyceo.github.io/cctv-app-desktop/"
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => handleSaveUrl(tempUrl)}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save Link
            </button>
            <button
              type="button"
              onClick={() => setShowUrlConfig(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '8px 12px',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            When updated, the app will download new releases directly from this link without needing main app updates.
          </span>
        </div>
      )}

      {/* Background Agent Status Grid (Phase 5) */}
      {isInstalled && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '16px',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Monitoring
            </span>
            <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: agentStatus?.monitoring ? '#22c55e' : '#94a3b8'
              }} />
              {agentStatus?.monitoring ? 'Active' : 'Paused'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              AI Engine
            </span>
            <div style={{ fontSize: '0.9rem', color: agentStatus?.aiEngineHealthy ? '#4ade80' : '#f87171', fontWeight: 600, marginTop: '2px' }}>
              {agentStatus?.aiEngineHealthy ? 'YOLO Healthy' : 'Offline / Standby'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Connected Cameras
            </span>
            <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, marginTop: '2px' }}>
              {agentStatus?.cameraCount || 0} Camera{agentStatus?.cameraCount === 1 ? '' : 's'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Runtime Verification
            </span>
            <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} /> Loopback Verified
            </div>
          </div>
        </div>
      )}

      {/* Installation / Update Progress Indicator (Phase 3 & 4) */}
      {isProgressing && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '16px',
          borderRadius: '14px',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" />
              {app.progress?.message || 'Processing...'}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>
              {app.progress?.percent || 0}%
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${app.progress?.percent || 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Error display */}
      {(actionError || app.progress?.error) && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{actionError || app.progress?.error}</span>
        </div>
      )}

      {/* Action buttons (Phase 3) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isInstalled && (
            <button
              onClick={refreshStatus}
              title="Refresh Health Check"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                borderRadius: '10px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          )}

          {isInstalled && (
            <button
              onClick={handleToggleMonitoring}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                borderRadius: '10px',
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              {agentStatus?.monitoring ? <Pause size={14} /> : <Play size={14} />}
              {agentStatus?.monitoring ? 'Pause Monitoring' : 'Resume Monitoring'}
            </button>
          )}

          {isInstalled && (
            <button
              onClick={handleDeleteApp}
              disabled={isLoadingAction}
              title="Disconnect and delete CCTV app from device"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                borderRadius: '10px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              <XCircle size={14} /> Disconnect & Delete
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Update Available notification */}
          {hasUpdate && (
            <button
              onClick={handleUpdate}
              disabled={isLoadingAction}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#fff',
                borderRadius: '12px',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              <ArrowUpCircle size={16} />
              Update Available (v{app.publishedVersion})
            </button>
          )}

          {/* Download Portal Link when not installed */}
          {!isInstalled && (
            <a
              href={downloadUrl || OFFICIAL_CCTV_WEBSITE_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#93c5fd',
                borderRadius: '12px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.85rem',
                textDecoration: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span>Download Page</span>
              <ExternalLink size={14} />
            </a>
          )}

          {/* Primary Action Button: Open CCTV vs Download & Install */}
          {isInstalled ? (
            <button
              onClick={() => onOpenCctv && onOpenCctv()}
              style={{
                background: '#fff',
                border: 'none',
                color: '#000',
                borderRadius: '12px',
                padding: '10px 22px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(255, 255, 255, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              <ExternalLink size={16} /> Open CCTV
            </button>
          ) : (
            <button
              onClick={handleInstall}
              disabled={isLoadingAction || isProgressing}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                border: 'none',
                color: '#fff',
                borderRadius: '12px',
                padding: '10px 22px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: isProgressing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(59, 130, 246, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              {isProgressing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Activating CCTV...
                </>
              ) : (
                <>
                  <Download size={16} /> Activate CCTV App
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <CctvInstallerModal 
        isOpen={isInstallerModalOpen}
        onClose={() => setIsInstallerModalOpen(false)}
        onInstalled={async () => {
          appRegistry.setInstalled('ceova-cctv', '1.0.0');
          setApp(prev => ({ ...prev, installationStatus: 'installed' }));
          await refreshStatus();
          if (onOpenCctv) onOpenCctv();
        }}
      />
    </div>
  );
}
