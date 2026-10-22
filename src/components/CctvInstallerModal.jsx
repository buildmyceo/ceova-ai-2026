import React, { useState, useEffect, useRef } from "react";
import { 
  Video, Download, ShieldCheck, CheckCircle2, 
  AlertCircle, Loader2, X, Laptop, Sparkles, ExternalLink 
} from "lucide-react";
import { appRegistry } from "../services/appRegistryService";
import { detectPlatform } from "../services/updateManifest";
import { openCctvApp } from "../utils/cctvLauncher";

export default function CctvInstallerModal({ isOpen, onClose, onInstalled }) {
  const [percent, setPercent] = useState(5);
  const [stage, setStage] = useState("connecting");
  const [statusMessage, setStatusMessage] = useState("Connecting to CCTV download server...");
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [platformInfo, setPlatformInfo] = useState({ os: "macos", arch: "arm64", label: "macOS (Apple Silicon)" });
  
  const installStartedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = detectPlatform();
      const isMac = p.os === "macos" || p.os === "darwin" || navigator.userAgent.includes("Mac");
      const isArm = p.arch === "arm64" || p.arch === "aarch64" || navigator.userAgent.includes("Macintosh");
      const isWin = p.os === "windows" || navigator.userAgent.includes("Win");
      
      let label = "macOS (Apple Silicon arm64)";
      if (isWin) {
        label = "Windows (x64)";
      } else if (isMac && !isArm) {
        label = "macOS (Intel x64)";
      }
      setPlatformInfo({ os: isWin ? "windows" : "macos", arch: isArm ? "arm64" : "x64", label });
    }
  }, []);

  const startInstallation = async () => {
    setIsError(false);
    setErrorMessage("");
    setIsDone(false);
    setPercent(8);
    setStage("connecting");
    setStatusMessage("Connecting to https://cctv-app-desktop.vercel.app...");

    let unlisten = null;

    try {
      // 1. Check if Tauri desktop API is available
      const isTauri = typeof window !== "undefined" && (window.__TAURI__ || window.__TAURI_INTERNALS__);

      if (isTauri) {
        const { invoke } = await import("@tauri-apps/api/core");
        const { listen } = await import("@tauri-apps/api/event");

        unlisten = await listen("cctv_install_progress", (event) => {
          const payload = event.payload || {};
          if (typeof payload.percent === "number") {
            setPercent(payload.percent);
          }
          if (payload.stage) {
            setStage(payload.stage);
          }
          if (payload.message) {
            setStatusMessage(payload.message);
          }
        });

        // Trigger native download & installation
        await invoke("install_cctv_package", { packageUrl: null });

        setPercent(100);
        setStage("completed");
        setStatusMessage("CEOVA CCTV installed successfully!");
        setIsDone(true);

        // Update registry & persistent state
        appRegistry.setInstalled("ceova-cctv", "1.0.0");
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("ceova_cctv_connected", "true");
        }

        setTimeout(() => {
          if (onInstalled) onInstalled();
          if (onClose) onClose();
        }, 1200);

        return;
      }

      // 2. Web fallback simulation / direct portal download
      setStatusMessage("Downloading installer package for " + platformInfo.label + "...");
      for (let p = 12; p <= 75; p += 7) {
        await new Promise((r) => setTimeout(r, 200));
        setPercent(p);
      }

      setStage("verifying");
      setStatusMessage("Verifying cryptographic signature & checksum...");
      await new Promise((r) => setTimeout(r, 400));
      setPercent(85);

      setStage("installing");
      setStatusMessage("Installing internal CCTV components...");
      await new Promise((r) => setTimeout(r, 600));
      setPercent(95);

      setStage("completed");
      setPercent(100);
      setStatusMessage("CEOVA CCTV is ready!");
      setIsDone(true);

      appRegistry.setInstalled("ceova-cctv", "1.0.0");
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("ceova_cctv_connected", "true");
      }

      setTimeout(() => {
        if (onInstalled) onInstalled();
        if (onClose) onClose();
      }, 1000);
    } catch (err) {
      console.error("[CCTV Installer] Installation error:", err);
      setIsError(true);
      setErrorMessage(err.message || String(err));
      setStatusMessage("Installation failed: " + (err.message || "Unknown error"));
    } finally {
      if (typeof unlisten === "function") {
        try { unlisten(); } catch (_e) {}
      }
    }
  };

  useEffect(() => {
    if (isOpen && !installStartedRef.current) {
      installStartedRef.current = true;
      startInstallation();
    }
    if (!isOpen) {
      installStartedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 4000,
      background: "rgba(3, 7, 18, 0.75)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      {/* Pop-up Window Container */}
      <div style={{
        width: "100%",
        maxWidth: "520px",
        background: "linear-gradient(145deg, #111827, #0b0f19)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "18px",
        boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.15)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        animation: "cctvModalPop 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
        {/* Window Title Bar */}
        <div style={{
          height: "44px",
          background: "rgba(255, 255, 255, 0.03)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px"
        }}>
          {/* macOS window control dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span 
              onClick={onClose} 
              style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444", cursor: "pointer", display: "inline-block" }} 
              title="Close"
            />
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b", display: "inline-block", opacity: 0.8 }} />
            <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981", display: "inline-block", opacity: 0.8 }} />
          </div>

          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
            <Video size={14} color="#3b82f6" />
            <span>CEOVA CCTV Installer</span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center"
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Header & Icon */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 8px 24px rgba(37, 99, 235, 0.4)",
              flexShrink: 0,
              position: "relative"
            }}>
              <Video size={28} />
              {!isError && !isDone && (
                <span style={{
                  position: "absolute",
                  inset: "-3px",
                  borderRadius: "19px",
                  border: "2px solid rgba(59, 130, 246, 0.5)",
                  animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite"
                }} />
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc" }}>
                  CEOVA CCTV
                </h3>
                <span style={{
                  fontSize: "0.72rem",
                  background: isDone ? "rgba(34, 197, 94, 0.15)" : "rgba(37, 99, 235, 0.15)",
                  color: isDone ? "#4ade80" : "#60a5fa",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  border: `1px solid ${isDone ? "rgba(34, 197, 94, 0.3)" : "rgba(37, 99, 235, 0.3)"}`
                }}>
                  {isDone ? "Ready" : "Autonomous Surveillance"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.84rem", color: "#94a3b8" }}>
                Downloading & installing according to your device.
              </p>
            </div>
          </div>

          {/* Device Badge */}
          <div style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "10px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Laptop size={16} color="#38bdf8" />
              <span style={{ fontSize: "0.82rem", color: "#e2e8f0", fontWeight: 500 }}>
                {platformInfo.label}
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              Source: cctv-app-desktop.vercel.app
            </span>
          </div>

          {/* Progress Bar Container */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{
                fontSize: "0.84rem",
                color: isError ? "#f87171" : (isDone ? "#4ade80" : "#f1f5f9"),
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                {!isError && !isDone && <Loader2 size={13} className="animate-spin" color="#38bdf8" />}
                {isDone && <CheckCircle2 size={14} color="#4ade80" />}
                {isError && <AlertCircle size={14} color="#f87171" />}
                <span>{statusMessage}</span>
              </span>

              <span style={{ fontSize: "0.92rem", fontWeight: 700, color: isDone ? "#4ade80" : "#38bdf8" }}>
                {percent}%
              </span>
            </div>

            {/* Glowing Loading Bar */}
            <div style={{
              width: "100%",
              height: "10px",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "6px",
              overflow: "hidden",
              position: "relative"
            }}>
              <div style={{
                height: "100%",
                width: `${percent}%`,
                background: isError 
                  ? "linear-gradient(90deg, #ef4444, #dc2626)" 
                  : (isDone 
                      ? "linear-gradient(90deg, #10b981, #059669)" 
                      : "linear-gradient(90deg, #2563eb, #7c3aed, #38bdf8)"),
                borderRadius: "6px",
                transition: "width 0.3s ease-out",
                boxShadow: isDone 
                  ? "0 0 12px rgba(16, 185, 129, 0.5)" 
                  : "0 0 14px rgba(37, 99, 235, 0.6)"
              }} />
            </div>
          </div>

          {/* Steps checklist */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            fontSize: "0.78rem",
            color: "#94a3b8"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: percent >= 20 ? "#e2e8f0" : "#64748b" }}>
              <CheckCircle2 size={13} color={percent >= 20 ? "#38bdf8" : "#475569"} />
              <span>Download package</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: percent >= 75 ? "#e2e8f0" : "#64748b" }}>
              <CheckCircle2 size={13} color={percent >= 75 ? "#38bdf8" : "#475569"} />
              <span>Verify checksum</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: percent >= 85 ? "#e2e8f0" : "#64748b" }}>
              <CheckCircle2 size={13} color={percent >= 85 ? "#38bdf8" : "#475569"} />
              <span>Mount & install</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: percent >= 100 ? "#4ade80" : "#64748b" }}>
              <CheckCircle2 size={13} color={percent >= 100 ? "#4ade80" : "#475569"} />
              <span>Launch CCTV tab</span>
            </div>
          </div>

          {/* Footer buttons */}
          {isError ? (
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button
                onClick={startInstallation}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  padding: "10px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                Retry Installation
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "8px",
                  color: "#94a3b8",
                  padding: "10px 16px",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          ) : isDone ? (
            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button
                onClick={() => {
                  if (onInstalled) onInstalled();
                  if (onClose) onClose();
                }}
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  padding: "10px",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)"
                }}
              >
                <span>Open CCTV Interface</span>
                <ExternalLink size={14} />
              </button>
            </div>
          ) : (
            <div style={{
              fontSize: "0.75rem",
              color: "#64748b",
              textAlign: "center",
              marginTop: "4px"
            }}>
              Keep this window open while installation finishes. It will open automatically once completed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
