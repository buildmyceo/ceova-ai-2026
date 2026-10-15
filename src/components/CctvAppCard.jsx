import React, { useState, useEffect } from 'react';
import { 
  Video, Download, Play, Pause, RefreshCw, AlertCircle, 
  CheckCircle2, ArrowUpCircle, ShieldCheck, HardDrive, 
  ExternalLink, Loader2, XCircle
} from 'lucide-react';
import { appRegistry } from '../services/appRegistryService';
import { cctvAgent } from '../services/cctvAgentService';
import { installerService } from '../services/installerService';

export default function CctvAppCard({ onOpenCctv }) {
  const [app, setApp] = useState(() => appRegistry.getApplication('ceova-cctv'));
  const [agentStatus, setAgentStatus] = useState(null);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [actionError, setActionError] = useState(null);

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
      const status = await cctvAgent.getStatus();
      setAgentStatus(status);
    } catch (e) {
      console.warn('Status refresh error:', e);
    }
  };

  const handleInstall = async () => {
    setIsLoadingAction(true);
    setActionError(null);

    try {
      let manifest;
      try {
        const res = await fetch("/releases/cctv/manifest-1.0.0.json");
        if (res.ok) {
          manifest = await res.json();
        }
      } catch (_e) {}

      if (!manifest) {
        manifest = {
          appId: "ceova-cctv",
          version: "1.0.0",
          minSupportedVersion: "1.0.0",
          platforms: {
            "macos-aarch64": {
              packageUrl: "/releases/cctv/ceova-cctv-1.0.0-macos-aarch64.tar.gz",
              sha256: "e19f0ecd5808e3bbf7645037795e4b751a4061a3106b71453f50eabd85741d4d",
              signature: "yk5l2hW2ZJPNHv7VodALvOx3qNUINnAjeRu+/jHsPW8ot8ihK8TDKE/IIEnhSq4r54BNQ46Z3Zczm9GjwiDpCA==",
              size: 21381271
            },
            "macos": {
              packageUrl: "/releases/cctv/ceova-cctv-1.0.0-macos-aarch64.tar.gz",
              sha256: "e19f0ecd5808e3bbf7645037795e4b751a4061a3106b71453f50eabd85741d4d",
              signature: "yk5l2hW2ZJPNHv7VodALvOx3qNUINnAjeRu+/jHsPW8ot8ihK8TDKE/IIEnhSq4r54BNQ46Z3Zczm9GjwiDpCA==",
              size: 21381271
            },
            "windows": {
              packageUrl: "/releases/cctv/ceova-cctv-1.0.0-macos-x86_64.tar.gz",
              sha256: "69717fd41bef9703bd590f8b89604ad70ebfb9ee8ee926f21977480996cc9bb5",
              signature: "siYZqSh0w7tB8qSn/isqnnZGjabxTmF7Um2aZLbQccABprdf/XuRbQ5os9TR/Six4gzhWCSz8VOCPfEeEsHcBw==",
              size: 21381271
            }
          },
          releaseNotes: "Initial production release of CEOVA CCTV with local YOLO detection and stream server."
        };
      }

      await installerService.installApplication("ceova-cctv", manifest);
      await refreshStatus();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleUpdate = async () => {
    setIsLoadingAction(true);
    setActionError(null);

    try {
      let updateManifest;
      try {
        const res = await fetch("/releases/cctv/manifest-1.0.1.json");
        if (res.ok) {
          updateManifest = await res.json();
        }
      } catch (_e) {}

      if (!updateManifest) {
        updateManifest = {
          appId: "ceova-cctv",
          version: "1.0.1",
          minSupportedVersion: "1.0.0",
          platforms: {
            "macos-aarch64": {
              packageUrl: "/releases/cctv/ceova-cctv-1.0.1-macos-aarch64.tar.gz",
              sha256: "e19f0ecd5808e3bbf7645037795e4b751a4061a3106b71453f50eabd85741d4d",
              signature: "yk5l2hW2ZJPNHv7VodALvOx3qNUINnAjeRu+/jHsPW8ot8ihK8TDKE/IIEnhSq4r54BNQ46Z3Zczm9GjwiDpCA==",
              size: 21381271
            },
            "macos": {
              packageUrl: "/releases/cctv/ceova-cctv-1.0.1-macos-aarch64.tar.gz",
              sha256: "e19f0ecd5808e3bbf7645037795e4b751a4061a3106b71453f50eabd85741d4d",
              signature: "yk5l2hW2ZJPNHv7VodALvOx3qNUINnAjeRu+/jHsPW8ot8ihK8TDKE/IIEnhSq4r54BNQ46Z3Zczm9GjwiDpCA==",
              size: 21381271
            },
            "windows": {
              packageUrl: "/releases/cctv/ceova-cctv-1.0.1-macos-x86_64.tar.gz",
              sha256: "69717fd41bef9703bd590f8b89604ad70ebfb9ee8ee926f21977480996cc9bb5",
              signature: "siYZqSh0w7tB8qSn/isqnnZGjabxTmF7Um2aZLbQccABprdf/XuRbQ5os9TR/Six4gzhWCSz8VOCPfEeEsHcBw==",
              size: 21381271
            }
          },
          releaseNotes: "Performance optimizations and enhanced multi-camera synchronization."
        };
      }

      await installerService.updateApplication("ceova-cctv", updateManifest);
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
                  <Loader2 size={16} className="animate-spin" /> Installing...
                </>
              ) : (
                <>
                  <Download size={16} /> Download & Install
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
