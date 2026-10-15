import React, { useState } from 'react';
import { AppWindow, Link2, Sparkles, Plus, Grid, ChevronRight } from 'lucide-react';
import CctvAppCard from './CctvAppCard';

export default function ConnectorsAppsView({
  initialTab = 'apps',
  isGoogleConnected,
  isTelegramConnected,
  onOpenGoogle,
  onOpenTelegram,
  onOpenCctv
}) {
  const [subTab, setSubTab] = useState(initialTab); // 'connectors' | 'apps'

  return (
    <div className="connectors-apps-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-tab navigation: Connectors vs Apps */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 255, 255, 0.04)',
        padding: '4px',
        borderRadius: '12px',
        width: 'fit-content',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <button
          type="button"
          onClick={() => setSubTab('apps')}
          style={{
            background: subTab === 'apps' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: subTab === 'apps' ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <AppWindow size={15} />
          <span>Apps</span>
          <span style={{
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.25)',
            color: '#93c5fd'
          }}>1</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('connectors')}
          style={{
            background: subTab === 'connectors' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
            color: subTab === 'connectors' ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 16px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <Link2 size={15} />
          <span>Connected Services</span>
        </button>
      </div>

      {/* SubTab Content: Apps */}
      {subTab === 'apps' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
              Managed Desktop Applications
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Separate verified applications running locally with decoupled data stores and direct AI monitoring.
            </p>
          </div>

          <div className="apps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <CctvAppCard onOpenCctv={onOpenCctv} />
          </div>
        </div>
      )}

      {/* SubTab Content: Connectors */}
      {subTab === 'connectors' && (
        <div className="settings-section">
          <div className="settings-row clickable" onClick={onOpenGoogle}>
            <div className="row-left">
              <div style={{
                background: '#fff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img src="/google-logo.png" alt="Google" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Connect Google</span>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>Connect Gmail, Drive, and Calendar for a unified experience.</span>
              </div>
            </div>
            <div className="row-right">
              {isGoogleConnected ? (
                <span style={{ fontSize: '10px', color: '#22c55e', marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Connected
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: '#a1a1aa', marginRight: '8px' }}>Connect</span>
              )}
              <ChevronRight size={14} className="chevron" />
            </div>
          </div>

          <div className="settings-row clickable" onClick={onOpenTelegram}>
            <div className="row-left">
              <div style={{
                background: '#fff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img src="/telegram.png" alt="Telegram" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Connect Telegram</span>
                <span style={{ fontSize: '10px', opacity: 0.5 }}>Manage your Telegram messages and chats.</span>
              </div>
            </div>
            <div className="row-right">
              {isTelegramConnected ? (
                <span style={{ fontSize: '10px', color: '#22c55e', marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Connected
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: '#a1a1aa', marginRight: '8px' }}>Connect</span>
              )}
              <ChevronRight size={14} className="chevron" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
