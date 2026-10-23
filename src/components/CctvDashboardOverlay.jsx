import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ExternalLink, ShieldCheck, RefreshCw, AlertCircle, Loader2, Download, Sparkles, Video, X } from "lucide-react";
import { openCctvApp } from "../utils/cctvLauncher";
import { cctvAgent } from "../services/cctvAgentService";
import { appRegistry } from "../services/appRegistryService";
import CctvInstallerModal from "./CctvInstallerModal";

const CCTV_HTTP_URL = "http://127.0.0.1:3080";
const CCTV_WEB_INFO_URL = "http://127.0.0.1:3080/api/info";

export default function CctvDashboardOverlay({ isOpen, onClose, onSwitchToAssistant }) {
  const [isOnline, setIsOnline] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);
  const [isInstallerOpen, setIsInstallerOpen] = useState(false);
  const iframeRef = useRef(null);

  // Listen for local CCTV connection events from iframe (local only, not server)
  useEffect(() => {
    const handleMsg = (event) => {
      if (event.data?.type === 'CEOVA_CCTV_CONNECTED') {
        const payload = event.data.payload || {};
        cctvAgent.saveLocalCredentials({
          username: payload.username,
          password: payload.password,
          ip: payload.ip || payload.camera?.ip,
          port: payload.port || payload.camera?.port || 554,
          cameraId: payload.camera?.id,
          cameraName: payload.camera?.name
        });
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('ceova_cctv_connected', 'true');
        }
      } else if (event.data?.type === 'CEOVA_CCTV_CLEARED' || event.data?.type === 'CEOVA_CCTV_DISCONNECTED') {
        cctvAgent.clearLocalCredentials();
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const startCctvService = async () => {
    try {
      setIsStarting(true);
      if (typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_cctv_service");
      }
    } catch (e) {
      console.warn("[CCTV] Failed to invoke start_cctv_service:", e);
    }
  };

  const handleOpenDifferentTab = async () => {
    await openCctvApp();
    if (onClose) onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const probeService = async () => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(CCTV_WEB_INFO_URL, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok && mounted) {
          setIsOnline(true);
          setIsStarting(false);
          return true;
        }
      } catch (_e) {
        try {
          if (typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)) {
            const { invoke } = await import("@tauri-apps/api/core");
            const active = await invoke("get_cctv_service_status");
            if (active && mounted) {
              setIsOnline(true);
              setIsStarting(false);
              return true;
            }
          }
        } catch (_t) {}
      }

      if (mounted) {
        setIsOnline(false);
      }
      return false;
    };

    const init = async () => {
      const active = await probeService();
      if (!active && mounted) {
        await startCctvService();
        setTimeout(probeService, 1200);
        setTimeout(probeService, 2500);
      }
    };

    init();
    const interval = setInterval(probeService, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isOpen, iframeKey]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIframeKey(k => k + 1);
    if (!isOnline) {
      await startCctvService();
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 3000,
      background: "#090a0f",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Top Header Bar with Multi-Tab Controls */}
      <div className="ceova-main-app-tabs-bar" style={{ height: "48px" }}>
        <div className="ceova-tabs-list">
          {/* Tab 1: Assistant */}
          <button
            type="button"
            className="ceova-main-tab-btn"
            onClick={() => {
              if (onSwitchToAssistant) onSwitchToAssistant();
              else if (onClose) onClose();
            }}
            title="Switch to CEOVA Assistant"
          >
            <Sparkles size={14} style={{ color: "#38bdf8" }} />
            <span>CEOVA Assistant</span>
          </button>

          {/* Tab 2: CCTV (Active) */}
          <div
            className="ceova-main-tab-btn is-active"
            title="Active Tab: CEOVA CCTV"
          >
            <Video size={14} style={{ color: "#a855f7" }} />
            <span>CEOVA CCTV</span>
            <span className="ceova-tab-live-dot" title="Autonomous Vision Engine Active" />
            <button
              type="button"
              className="ceova-tab-close-icon"
              onClick={onClose}
              title="Close CCTV Tab"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Status & actions on the right */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isOnline ? (
            <span style={{
              fontSize: "0.72rem",
              background: "rgba(34, 197, 94, 0.15)",
              color: "#4ade80",
              padding: "3px 9px",
              borderRadius: "10px",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}>
              <ShieldCheck size={13} /> Local Port 3080 & 8085 Active
            </span>
          ) : isStarting ? (
            <span style={{
              fontSize: "0.72rem",
              background: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              padding: "3px 9px",
              borderRadius: "10px",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}>
              <Loader2 size={13} className="animate-spin" /> Starting Vision Daemon...
            </span>
          ) : (
            <span style={{
              fontSize: "0.72rem",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              padding: "3px 9px",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}>
              <AlertCircle size={13} /> Daemon Offline
            </span>
          )}

          <button
            onClick={handleRefresh}
            title="Reload CCTV Interface"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              color: "#94a3b8",
              padding: "5px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.78rem",
              fontWeight: 500,
              transition: "all 0.2s"
            }}
          >
            <RefreshCw size={13} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Main CCTV Actual App Container */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#07080c" }}>
        {isOnline ? (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={CCTV_HTTP_URL}
            title="CEOVA CCTV Autonomous Surveillance Hub"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block"
            }}
            allow="camera; microphone; autoplay; display-capture; fullscreen"
          />
        ) : (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px",
            textAlign: "center",
            color: "#f8fafc"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: isStarting ? "rgba(56, 189, 248, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: isStarting ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "18px"
            }}>
              {isStarting ? (
                <Loader2 size={32} color="#38bdf8" className="animate-spin" />
              ) : (
                <AlertCircle size={32} color="#f87171" />
              )}
            </div>

            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 8px 0" }}>
              {isStarting 
                ? "Launching CEOVA CCTV Engine..." 
                : (appRegistry.getApplication('ceova-cctv')?.installationStatus !== 'installed' 
                    ? "CCTV App Disconnected & Deleted" 
                    : "CCTV Background Service is Offline")}
            </h2>
            <p style={{
              fontSize: "0.88rem",
              color: "#94a3b8",
              maxWidth: "480px",
              lineHeight: 1.5,
              margin: "0 0 20px 0"
            }}>
              {isStarting 
                ? "Starting local autonomous surveillance supervisor and AI microservices on port 3080 & 8085..." 
                : (appRegistry.getApplication('ceova-cctv')?.installationStatus !== 'installed'
                    ? "The CCTV application was disconnected and uninstalled. To start AI camera monitoring, download the app directly from https://cctv-app-desktop.vercel.app"
                    : "The CCTV Engine will launch automatically. You can also click below to trigger immediate start.")}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              {appRegistry.getApplication('ceova-cctv')?.installationStatus !== 'installed' && (
                <button
                  onClick={() => setIsInstallerOpen(true)}
                  style={{
                    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                    color: "#ffffff",
                    fontWeight: 700,
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.85rem",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)"
                  }}
                >
                  <Download size={15} />
                  <span>Download & Install CCTV Automatically</span>
                </button>
              )}

              <button
                onClick={handleRefresh}
                style={{
                  background: "#ffffff",
                  color: "#000000",
                  fontWeight: 700,
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.85rem"
                }}
              >
                {isStarting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isStarting ? "Connecting..." : "Start & Connect CCTV"}
              </button>
            </div>
          </div>
        )}
      </div>

      <CctvInstallerModal
        isOpen={isInstallerOpen}
        onClose={() => setIsInstallerOpen(false)}
        onInstalled={async () => {
          await startCctvService();
          setIframeKey(k => k + 1);
        }}
      />
    </div>
  );
}
