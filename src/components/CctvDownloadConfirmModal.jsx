import React from 'react';
import { Video, Download, X, ShieldCheck, HardDrive, Globe, Sparkles } from 'lucide-react';

export default function CctvDownloadConfirmModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 4200,
      background: 'rgba(3, 7, 18, 0.75)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(10, 14, 23, 0.98))',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        padding: '28px',
        position: 'relative',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        animation: 'cctvModalFadeIn 0.22s ease-out'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <X size={16} />
        </button>

        {/* Header with Icon and Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
            flexShrink: 0
          }}>
            <Video size={26} color="#ffffff" />
          </div>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '20px',
              padding: '2px 10px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#38bdf8',
              marginBottom: '6px'
            }}>
              <Sparkles size={11} /> Extension // Autonomous Vision
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              Download CEOVA CCTV?
            </h2>
          </div>
        </div>

        {/* Description */}
        <p style={{
          margin: 0,
          fontSize: '0.88rem',
          color: '#94a3b8',
          lineHeight: 1.55
        }}>
          CEOVA CCTV integrates real-time camera discovery, YOLOv8 vision analytics, and live RTSP streams.
          To use it, the vision engine needs to be downloaded inside CEOVA.
        </p>

        {/* Feature Highlights Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '10px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <HardDrive size={18} color="#38bdf8" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                Stored Internally Inside App
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Saved locally to application data (no separate /Applications clutter).
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Globe size={18} color="#a855f7" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                Source: cctv-app-desktop.vercel.app
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Verified official release package with SHA-256 integrity verification.
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <ShieldCheck size={18} color="#22c55e" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                One-Click Disconnect & Uninstall
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                You can disconnect and completely remove the files at any time.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          marginTop: '6px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.84rem',
              fontWeight: 500,
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              padding: '10px 22px',
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.4)'; }}
          >
            <Download size={15} />
            <span>Download & Install Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
