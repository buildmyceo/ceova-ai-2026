import React, { useState } from 'react';
import { ExternalLink, Eye, Download, FileText, HardDrive, Check, Copy } from 'lucide-react';
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
  const Icon = meta.icon || FileText;

  const webViewLink = file.webViewLink || file.web_view_link || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '#');
  const webContentLink = file.webContentLink || file.web_content_link || (fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : null);
  
  // High-resolution Google Drive thumbnail endpoint
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
        backgroundColor: '#141417',
        border: '1px solid #27272a',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, transform 0.15s ease',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3f3f46';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#27272a';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Thumbnail / Visual Preview Box */}
      <div
        style={{
          width: '100%',
          height: '135px',
          backgroundColor: '#000000',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #27272a'
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
              padding: meta.type === 'image' ? 0 : '10px'
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
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Icon size={20} color="#ffffff" />
            </div>
            <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 500 }}>
              {meta.label}
            </span>
          </div>
        )}

        {/* Hover quick preview pill */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.15s ease'
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
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              color: '#000000',
              fontWeight: 600,
              fontSize: '11px',
              border: '1px solid #ffffff'
            }}
          >
            <Eye size={13} color="#000000" />
            <span>Preview</span>
          </div>
        </div>

        {/* Top-Right Badge: Solid Monochrome Type Pill */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#0c0c0e',
            border: '1px solid #27272a',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 600,
            color: '#f4f4f5'
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
          <span>{meta.label}</span>
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ marginTop: '2px', color: '#a1a1aa', flexShrink: 0 }}>
            <Icon size={15} color="#a1a1aa" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4
              title={file.name || 'Untitled'}
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
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
                marginTop: '4px',
                fontSize: '11px',
                color: '#71717a'
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
                    color: copied ? '#ffffff' : '#71717a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!copied) e.currentTarget.style.color = '#a1a1aa';
                  }}
                  onMouseLeave={(e) => {
                    if (!copied) e.currentTarget.style.color = '#71717a';
                  }}
                >
                  {copied ? <Check size={10} color="#ffffff" /> : <Copy size={10} color="#71717a" />}
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
            paddingTop: '8px',
            borderTop: '1px solid #27272a'
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
              padding: '7px 10px',
              borderRadius: '7px',
              backgroundColor: '#ffffff',
              border: '1px solid #ffffff',
              color: '#000000',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e4e4e7';
              e.currentTarget.style.borderColor = '#e4e4e7';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#ffffff';
            }}
          >
            <Eye size={13} color="#000000" />
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
                width: '32px',
                height: '32px',
                borderRadius: '7px',
                backgroundColor: '#1f1f23',
                border: '1px solid #27272a',
                color: '#f4f4f5',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#27272a';
                e.currentTarget.style.borderColor = '#3f3f46';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1f1f23';
                e.currentTarget.style.borderColor = '#27272a';
                e.currentTarget.style.color = '#f4f4f5';
              }}
            >
              <ExternalLink size={13} color="#f4f4f5" />
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
                width: '32px',
                height: '32px',
                borderRadius: '7px',
                backgroundColor: '#1f1f23',
                border: '1px solid #27272a',
                color: '#f4f4f5',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#27272a';
                e.currentTarget.style.borderColor = '#3f3f46';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1f1f23';
                e.currentTarget.style.borderColor = '#27272a';
                e.currentTarget.style.color = '#f4f4f5';
              }}
            >
              <Download size={13} color="#f4f4f5" />
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
        backgroundColor: '#0c0c0e',
        border: '1px solid #27272a',
        borderRadius: '14px',
        overflow: 'hidden',
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
          padding: '11px 16px',
          backgroundColor: '#141417',
          borderBottom: '1px solid #27272a'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/drive.png"
            alt="Google Drive"
            style={{ width: '16px', height: '16px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5', letterSpacing: '0.2px' }}>
            {title}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 9px',
            borderRadius: '9999px',
            backgroundColor: '#1f1f23',
            border: '1px solid #3f3f46',
            fontSize: '11px',
            fontWeight: 500,
            color: '#f4f4f5'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
          <span>{files.length} {files.length === 1 ? 'item' : 'items'}</span>
        </div>
      </div>

      {/* Grid of Files */}
      <div
        style={{
          padding: '14px',
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
