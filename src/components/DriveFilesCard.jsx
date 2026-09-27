import React, { useState } from 'react';
import { ExternalLink, Eye, Download, FileText, Image as ImageIcon, Film, Music, FileSpreadsheet, Presentation, HardDrive, Check, Copy } from 'lucide-react';
import { getDriveFileMeta } from './DriveFilePreviewModal';

function formatFileSize(bytes) {
  if (!bytes || bytes === '0' || isNaN(bytes)) return null;
  const num = parseInt(bytes, 10);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function DriveFileCardItem({ file, onPreview }) {
  const [thumbError, setThumbError] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileId = file.id || file.drive_id;
  const meta = getDriveFileMeta(file.mimeType || file.mime_type, file.name);
  const Icon = meta.icon;

  const webViewLink = file.webViewLink || file.web_view_link || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '#');
  const webContentLink = file.webContentLink || file.web_content_link || (fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null);
  
  // Use high-resolution Google Drive thumbnail endpoint
  const thumbnailSrc = file.thumbnailLink || (fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w600` : null);

  const handleCopyId = (e) => {
    e.stopPropagation();
    if (!fileId) return;
    navigator.clipboard.writeText(fileId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      onClick={() => onPreview && onPreview(file)}
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 26px rgba(0, 0, 0, 0.45)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.25)';
      }}
    >
      {/* Thumbnail / Visual Preview Box */}
      <div
        style={{
          width: '100%',
          height: '135px',
          background: 'radial-gradient(ellipse at center, rgba(35, 38, 48, 0.9) 0%, rgba(18, 19, 24, 0.95) 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        {thumbnailSrc && !thumbError ? (
          <img
            src={thumbnailSrc}
            alt={file.name || 'File Preview'}
            referrerPolicy="no-referrer"
            onError={() => setThumbError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: meta.type === 'image' ? 'cover' : 'contain',
              padding: meta.type === 'image' ? 0 : '10px',
              transition: 'transform 0.3s ease'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: `${meta.color}1A`,
                border: `1px solid ${meta.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: meta.color
              }}
            >
              <Icon size={24} />
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
              {meta.label}
            </span>
          </div>
        )}

        {/* Hover quick preview pill */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#0b0c10',
              fontWeight: 600,
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }}
          >
            <Eye size={14} />
            <span>Interactive Preview</span>
          </div>
        </div>

        {/* Top-Right Badge: Google Drive / Type */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(10, 10, 14, 0.75)',
            backdropFilter: 'blur(6px)',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '10px',
            fontWeight: 600,
            color: meta.color
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color }} />
          {meta.label}
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div
            style={{
              marginTop: '2px',
              color: meta.color,
              flexShrink: 0
            }}
          >
            <Icon size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4
              title={file.name || 'Untitled'}
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {file.name || 'Untitled'}
            </h4>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '3px',
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.45)'
              }}
            >
              {formatFileSize(file.size) && (
                <span>{formatFileSize(file.size)}</span>
              )}
              {file.modifiedTime && (
                <span>• {new Date(file.modifiedTime).toLocaleDateString()}</span>
              )}
              {fileId && (
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Copy File ID"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: copied ? '#10b981' : 'rgba(255, 255, 255, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '10px'
                  }}
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  <span>{copied ? 'Copied' : `ID: ${fileId.slice(0, 6)}...`}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: 'auto',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onPreview && onPreview(file)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>

          {webViewLink && webViewLink !== '#' && (
            <a
              href={webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Drive"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'rgba(66, 133, 244, 0.15)',
                border: '1px solid rgba(66, 133, 244, 0.3)',
                color: '#8ab4f8',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(66, 133, 244, 0.28)';
                e.currentTarget.style.borderColor = '#8ab4f8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(66, 133, 244, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(66, 133, 244, 0.3)';
              }}
            >
              <ExternalLink size={13} />
            </a>
          )}

          {webContentLink && (
            <a
              href={webContentLink}
              target="_blank"
              rel="noopener noreferrer"
              download
              title="Download File"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
            >
              <Download size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DriveFilesCard({ files = [], title = 'Google Drive Files', onPreview }) {
  if (!files || files.length === 0) return null;

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '16px',
        background: 'rgba(15, 17, 23, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(66, 133, 244, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8ab4f8'
            }}
          >
            <HardDrive size={16} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>
            {title}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 500
            }}
          >
            {files.length} {files.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* Grid of Files */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px'
        }}
      >
        {files.map((file, idx) => (
          <DriveFileCardItem
            key={file.id || file.drive_id || idx}
            file={file}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
}
