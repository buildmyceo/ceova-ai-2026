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
            backgroundColor: '#0c0c0e',
            border: isFullScreen ? 'none' : '1px solid #27272a',
            borderRadius: isFullScreen ? '0' : '16px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
            overflow: 'hidden'
          }}
        >
          {/* Modal Header */}
          <div style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #27272a',
            backgroundColor: '#141417',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Icon size={16} color="#ffffff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '550px'
                }} title={file.name}>
                  {file.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11px', color: '#71717a' }}>
                  <span style={{
                    color: '#a1a1aa',
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
                    borderRadius: '7px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #ffffff',
                    color: '#000000',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#e4e4e7'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  <ExternalLink size={13} color="#000000" />
                  <span>Open in Drive</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                style={{
                  backgroundColor: '#1f1f23',
                  border: '1px solid #27272a',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  padding: '7px',
                  borderRadius: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = '#27272a'; }}
                onMouseOut={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.backgroundColor = '#1f1f23'; }}
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: '#1f1f23',
                  border: '1px solid #27272a',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  padding: '7px',
                  borderRadius: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.backgroundColor = '#27272a'; }}
                onMouseOut={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.backgroundColor = '#1f1f23'; }}
                title="Close (Esc)"
              >
                <X size={15} />
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
                  <a href={webViewLink} target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', textDecoration: 'underline' }}>
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
