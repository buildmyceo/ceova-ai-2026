import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExternalLink, Download, X, FileText, Image, Film, Music, FileSpreadsheet, Presentation, HardDrive, Loader2, Maximize2, Minimize2 } from 'lucide-react';

export function getDriveFileMeta(mimeType = '', name = '') {
  const m = (mimeType || '').toLowerCase();
  const ext = (name || '').split('.').pop().toLowerCase();

  if (m.includes('document') || ext === 'doc' || ext === 'docx') {
    return { type: 'doc', label: 'Google Doc', color: '#4285F4', icon: FileText };
  }
  if (m.includes('spreadsheet') || ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
    return { type: 'sheet', label: 'Google Sheet', color: '#0F9D58', icon: FileSpreadsheet };
  }
  if (m.includes('presentation') || ext === 'ppt' || ext === 'pptx') {
    return { type: 'slide', label: 'Google Slide', color: '#F4B400', icon: Presentation };
  }
  if (m.includes('pdf') || ext === 'pdf') {
    return { type: 'pdf', label: 'PDF Document', color: '#EA4335', icon: FileText };
  }
  if (m.includes('image') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return { type: 'image', label: 'Image', color: '#00ACC1', icon: Image };
  }
  if (m.includes('video') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
    return { type: 'video', label: 'Video', color: '#AB47BC', icon: Film };
  }
  if (m.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return { type: 'audio', label: 'Audio', color: '#FF7043', icon: Music };
  }
  if (m.includes('folder')) {
    return { type: 'folder', label: 'Folder', color: '#5F6368', icon: HardDrive };
  }
  return { type: 'file', label: 'File', color: '#9AA0A6', icon: FileText };
}

export default function DriveFilePreviewModal({ file, isOpen, onClose }) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    setIframeLoading(true);
  }, [file?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const fileId = file.id || file.drive_id;
  const webViewLink = file.webViewLink || file.web_view_link || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '#');
  const previewIframeUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
  const meta = getDriveFileMeta(file.mimeType || file.mime_type, file.name);
  const Icon = meta.icon;

  return (
    <AnimatePresence>
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: isFullScreen ? '0' : '20px',
          zIndex: 3500
        }}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: isFullScreen ? '100vw' : '94%',
            maxWidth: isFullScreen ? '100vw' : '1080px',
            height: isFullScreen ? '100vh' : '88vh',
            background: 'rgba(18, 18, 22, 0.96)',
            border: isFullScreen ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: isFullScreen ? '0' : '20px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            overflow: 'hidden'
          }}
        >
          {/* Modal Header */}
          <div style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: `${meta.color}1c`,
                border: `1px solid ${meta.color}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={18} color={meta.color} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '550px'
                }} title={file.name}>
                  {file.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  <span style={{
                    color: meta.color,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    letterSpacing: '0.04em'
                  }}>
                    {meta.label}
                  </span>
                  {file.size && <span>· {formatBytes(file.size)}</span>}
                  {file.modifiedTime && <span>· {new Date(file.modifiedTime).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {webViewLink && (
                <a
                  href={webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(66, 133, 244, 0.15)',
                    border: '1px solid rgba(66, 133, 244, 0.3)',
                    color: '#60a5fa',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(66, 133, 244, 0.25)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(66, 133, 244, 0.15)'}
                >
                  <ExternalLink size={14} />
                  <span>Open in Drive</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '7px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  padding: '7px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Modal Preview Body */}
          <div style={{
            flex: 1,
            position: 'relative',
            background: '#0d0d11',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {iframeLoading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'rgba(255, 255, 255, 0.6)',
                zIndex: 2,
                background: '#0d0d11'
              }}>
                <Loader2 size={32} className="lib-spinner-anim" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '13px' }}>Loading Google Drive preview…</span>
              </div>
            )}

            {previewIframeUrl ? (
              <iframe
                src={previewIframeUrl}
                title={file.name}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#121214'
                }}
                allow="autoplay; fullscreen"
                onLoad={() => setIframeLoading(false)}
              />
            ) : (
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', padding: '32px' }}>
                <p>Preview not available for this file.</p>
                {webViewLink && (
                  <a href={webViewLink} target="_blank" rel="noopener noreferrer" style={{ color: '#4285F4' }}>
                    Open file in Google Drive
                  </a>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  const b = Number(bytes);
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
