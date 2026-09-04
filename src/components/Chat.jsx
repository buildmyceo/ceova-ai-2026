import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Edit2, RotateCcw, ThumbsUp, ThumbsDown, Copy, Check, X, FileText, Download, Image as ImageIcon, ArrowRight, Loader, Sparkles, HardDrive, Folder, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';
import { compress as compressPdf } from '@quicktoolsone/pdf-compress';

import ClientConversionWidget from './ClientConversionWidget';
import ClientQRBarcodeWidget from './ClientQRBarcodeWidget';
import ClientSecureGeneratorWidget from './ClientSecureGeneratorWidget';
import ClientColorWidget from './ClientColorWidget';
import ClientInvoiceWidget from './ClientInvoiceWidget';
import ClientMediaConverterWidget from './ClientMediaConverterWidget';
import CloudProjectCard from './CloudProjectCard';
async function forceDownloadImage(url, filename = 'ceova-image.png') {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    // CORS fallback
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}

// ── Skeleton + fade-in image component ──────────────────────────────────────
function ChatImage({ src, alt, onZoom }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="chat-markdown-image">
      {/* Square skeleton shown while image loads */}
      {!loaded && !failed && (
        <div className="chat-img-skeleton">
          <div className="skeleton-shimmer" />
        </div>
      )}

      {/* Actual image, hidden until loaded, fades in */}
      {!failed && (
        <img
          src={src}
          alt={alt || 'Image'}
          className={`chat-md-img ${loaded ? 'chat-md-img--loaded' : 'chat-md-img--loading'}`}
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(true); setFailed(true); }}
          onClick={() => onZoom && onZoom(src)}
          style={{ cursor: 'zoom-in' }}
        />
      )}

      {failed && (
        <div className="chat-img-error">⚠ Image could not be loaded</div>
      )}

      {/* Download button appears when image is ready */}
      {loaded && !failed && (
        <button
          className="chat-img-download-btn"
          title="Download image"
          onClick={(e) => { e.stopPropagation(); forceDownloadImage(src, 'ceova-image.png'); }}
        >
          <Download size={14} />
        </button>
      )}
    </div>
  );
}

// ── Markdown renderer with React-based image components ─────────────────────
function MarkdownRenderer({ text, onZoom }) {
  if (!text) return null;

  // Strip old baked-in status lines from history
  text = text.replace(/⏳ \*Status:[^\n]*\*  \n/g, '').trim();

  // Split text on image tokens  ![alt](url)
  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = IMG_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'html', content: text.slice(lastIdx, match.index) });
    }
    parts.push({ type: 'image', alt: match[1], src: match[2] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ type: 'html', content: text.slice(lastIdx) });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'image'
          ? <ChatImage key={i} src={part.src} alt={part.alt} onZoom={onZoom} />
          : <div key={i} className="ai-markdown" dangerouslySetInnerHTML={{ __html: renderHtml(part.content) }} />
      )}
    </>
  );
}

const RESERVED_SLUGS = new Set(['dashboard', 'legal', 'privacy', 'terms', 'subscription', 'auth', 'login', 'signup', 'api', 'p', 'sites', 'assets', 'settings', 'admin']);

function normalizeProjectUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/(https?:\/\/(?:www\.)?ceova\.online\/)([a-zA-Z0-9_-]+)(#.*|\?.*)?/gi, (match, prefix, slug, suffix = '') => {
    if (RESERVED_SLUGS.has(slug.toLowerCase())) return match;
    return `https://www.ceova.online/p/${slug}${suffix}`;
  });
}

// ── URL sanitizer — blocks javascript:, data:, vbscript: XSS vectors ─────────
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim().toLowerCase().replace(/\s/g, '');
  // Block dangerous URI schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:')
  ) {
    return '#';
  }
  return normalizeProjectUrl(url.trim());
}

// ── HTML renderer for non-image markdown ─────────────────────────────────────
function renderHtml(text) {
  if (!text) return '';

  const codeBlocks = [];
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
    const blockId = `cb_${codeBlocks.length}`;
    codeBlocks.push(
      `<div class="code-block-wrapper">
        <div class="code-block-header">${langLabel}<button class="code-copy-btn" onclick="(function(btn){const code=btn.closest('.code-block-wrapper').querySelector('code');navigator.clipboard.writeText(code.innerText);btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',2000);})(this)">Copy</button></div>
        <pre><code>${escaped}</code></pre>
      </div>`
    );
    return `%%CODE_BLOCK_${blockId}%%`;
  });

  processed = processed
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  processed = processed
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:0.9em;font-family:monospace;">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:16px 0 6px;color:var(--text-main);">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.1rem;font-weight:600;margin:18px 0 8px;color:var(--text-main);">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.2rem;font-weight:600;margin:20px 0 8px;color:var(--text-main);">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^[\*\-] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="padding-left:20px;margin:8px 0;">${match}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;">$1</li>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-color);margin:12px 0;">')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
    .replace(/\n/g, '<br />')
    // Sanitize link URLs to prevent javascript: and data: XSS, and normalize project URLs
    .replace(/(?!!)\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, rawUrl) => {
      const safeUrl = sanitizeUrl(rawUrl);
      const display = normalizeProjectUrl(linkText);
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline;">${display}</a>`;
    })
    // Autolink plain ceova.online URLs that aren't already part of an anchor tag
    .replace(/(?<!href=")(https?:\/\/(?:www\.)?ceova\.online\/(?:p\/)?[a-zA-Z0-9_-]+(?:[#?][^\s<"]*)?)/gi, (match) => {
      const fixedUrl = normalizeProjectUrl(match);
      return `<a href="${fixedUrl}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline;">${fixedUrl}</a>`;
    });

  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`%%CODE_BLOCK_cb_${i}%%`, block);
  });

  return `<div style="margin:0;">${processed}</div>`;
}

function TypewriterRenderer({ text, isTyping, onZoom }) {
  const [displayed, setDisplayed] = useState(isTyping ? '' : text);
  const rafRef = React.useRef(null);
  const lastUpdateRef = React.useRef(0);
  
  useEffect(() => {
    if (!isTyping) {
      setDisplayed(text);
      return;
    }
    if (displayed.length >= text.length) return;

    // Use requestAnimationFrame instead of setTimeout for smoother rendering
    // and to respect the browser's rendering budget (60fps)
    const FRAME_INTERVAL_MS = 32; // ~30fps max — fast enough to feel live, cheap enough for mobile

    const animate = (timestamp) => {
      if (timestamp - lastUpdateRef.current >= FRAME_INTERVAL_MS) {
        lastUpdateRef.current = timestamp;
        setDisplayed(prev => {
          if (prev.length >= text.length) return prev;
          const diff = text.length - prev.length;
          const step = Math.max(1, Math.floor(diff / 4));
          return text.slice(0, prev.length + step);
        });
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, isTyping, displayed]);

  return <MarkdownRenderer text={displayed + (isTyping ? ' ▋' : '')} onZoom={onZoom} />;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function CompressionResultCard({ meta }) {
  return (
    <div className="compression-card">
      <div className="compression-card-left">
        <div className="compression-icon">
          {(meta.fileType && meta.fileType.startsWith('image/')) || (meta.fileName && meta.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? <ImageIcon size={24} /> : <FileText size={24} />}
        </div>
        <div className="compression-details">
          <div className="compression-filename" title={meta.fileName}>{meta.fileName || 'Compressed File'}</div>
          <div className="compression-stats">
            {meta.originalSize > 0 && (
              <>
                <span className="stat-old">{formatBytes(meta.originalSize)}</span>
                <ArrowRight size={12} className="stat-arrow" />
              </>
            )}
            <span className="stat-new">{formatBytes(meta.compressedSize)}</span>
          </div>
        </div>
      </div>
      <button 
        className="compression-download-btn"
        onClick={() => forceDownloadImage(meta.url, meta.fileName || 'compressed-file')}
        title="Download"
      >
        <Download size={18} />
      </button>
    </div>
  );
}

function ClientCompressionWidget({ meta }) {
  const [resultMeta, setResultMeta] = useState(null);
  const [isCompressing, setIsCompressing] = useState(true);
  const [error, setError] = useState(null);

  const metaStr = JSON.stringify(meta);
  
  useEffect(() => {
    let active = true;
    async function compressFile() {
      try {
        const response = await fetch(meta.url, { mode: 'cors' });
        const blob = await response.blob();
        
        let compressedBlob;

        if (meta.fileType && meta.fileType.startsWith('image/')) {
          let targetSizeMB = 0.5; // default 500KB
          if (meta.targetSizeKB) {
             targetSizeMB = meta.targetSizeKB / 1024;
          }

          const options = {
            maxSizeMB: targetSizeMB,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.8
          };
          compressedBlob = await imageCompression(blob, options);
        } else if (meta.fileType === 'application/pdf' || (meta.fileName && meta.fileName.toLowerCase().endsWith('.pdf'))) {
          const pdfBytes = await blob.arrayBuffer();
          
          let options = { preset: 'balanced' };
          
          if (meta.targetSizeKB) {
              if (meta.targetSizeKB <= 200) {
                  options = {
                      preset: 'max',
                      jpegQuality: 0.1,
                      targetDPI: 72,
                      enableRasterization: true
                  };
              } else if (meta.targetSizeKB <= 500) {
                  options = {
                      preset: 'max',
                      jpegQuality: 0.3,
                      targetDPI: 100
                  };
              }
          }
          
          const result = await compressPdf(pdfBytes, options);
          
          compressedBlob = new Blob([result.pdf], { type: 'application/pdf' });
        } else {
          throw new Error("Unsupported file type for local compression.");
        }
        
        if (!active) return;
        
        const compressedUrl = URL.createObjectURL(compressedBlob);

        setResultMeta({
          ...meta,
          url: compressedUrl,
          compressedSize: compressedBlob.size,
          fileName: meta.fileName || 'compressed-file'
        });
        setIsCompressing(false);
      } catch (err) {
        if (!active) return;
        console.error("Compression error:", err);
        setError("Failed to compress file locally.");
        setIsCompressing(false);
      }
    }

    compressFile();
    return () => { active = false; };
  }, [metaStr]);

  if (isCompressing) {
    return (
      <div className="compression-card" style={{ justifyContent: 'center', opacity: 0.8 }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '0.9rem' }}>
            <Loader size={16} /> Compressing Locally...
         </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="compression-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</span>
      </div>
    );
  }

  return <CompressionResultCard meta={resultMeta} />;
}

// ── MessageItem component ────────────────────────────────────────────────────
function MessageItem({ msg, idx, isUser, messages, onSuggestionClick, editingMsg, editText, setEditText, handleSaveEdit, handleEditInit, handleCopy, copiedId, onRegenerate, onFeedback, localDirectoryHandle, setLocalDirectoryHandle, onFolderConnected }) {
  const [showActions, setShowActions] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hasProceeded, setHasProceeded] = useState(false);
  const hideTimerRef = useRef(null);

  let rawText = msg.text || '';
  let actionMeta = null;
  const metaMatch = rawText.match(/<!--\s*ACTION_META:(.*?)\s*-->/s);
  if (metaMatch) {
    try {
      actionMeta = JSON.parse(metaMatch[1]);
      rawText = rawText.replace(metaMatch[0], '').trim();
    } catch(e) {}
  }

  const resolvedCloudProject = useMemo(() => {
    if (msg.cloudProject) return msg.cloudProject;
    if (!isUser && rawText && typeof rawText === 'string') {
      const match = rawText.match(/https:\/\/([a-z0-9-]+)\.ceova\.online/i) || rawText.match(/https:\/\/ceova\.online\/([a-z0-9-]+)/i);
      if (match) {
        return {
          stage: 'READY',
          slug: match[1],
          deploymentUrl: match[0],
          content: rawText
        };
      }
    }
    return null;
  }, [msg.cloudProject, isUser, rawText]);

  const displayText = useMemo(() => {
    if (!rawText) return '';
    let text = rawText
      .replace(/The tool completed successfully\./gi, '')
      .replace(/GPT-5\.6\s*Luna/gi, 'Ceova')
      .replace(/-\s*\*\*Tech Stack\*\*:[^\n]+/gi, '')
      .replace(/Tech Stack:[^\n]+/gi, '')
      .trim();

    if (resolvedCloudProject && (text.includes('https://ceova.online/') || text.includes('.ceova.online'))) {
      if (text.startsWith('🎉') || text.startsWith('✨') || text.includes('**Your website is live') || text.includes('Edge Network') || text.includes('Deploying')) {
        return '';
      }
    }

    if (!text && rawText && !resolvedCloudProject) {
      return 'Action completed.';
    }

    return text;
  }, [rawText, resolvedCloudProject]);

  const isPlanMessage = useMemo(() => {
    if (isUser || !rawText || resolvedCloudProject) return false;
    return (
      rawText.includes('Website Implementation Plan') ||
      rawText.includes('### Website Implementation Plan') ||
      (rawText.includes('#### Website Goal') && rawText.includes('#### Pages / Sections'))
    );
  }, [isUser, rawText, resolvedCloudProject]);

  const hasLaterResponse = useMemo(() => {
    if (!messages || idx >= messages.length - 1) return false;
    return messages.slice(idx + 1).some(m => 
      m.sender === 'user' || 
      m.cloudProject || 
      (m.text && (m.text.includes('ceova.online') || m.text.includes('Website Implementation Plan')))
    );
  }, [messages, idx]);

  const handleProceed = () => {
    if (hasProceeded) return;
    setHasProceeded(true);
    if (onSuggestionClick) {
      onSuggestionClick("Proceed");
    }
  };

  const handleInteraction = () => {
    setShowActions(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowActions(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`message-row ${isUser ? 'user-row' : 'ai-row'}`}
      onMouseEnter={handleInteraction}
      onClick={handleInteraction}
    >
      {/* Full-screen lightbox with force-download */}
      {previewUrl && (
        <div className="full-image-overlay" onClick={() => setPreviewUrl(null)} style={{ zIndex: 10000 }}>
          <div className="full-image-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="Full Preview" />
            <button className="close-preview-btn" onClick={() => setPreviewUrl(null)}>
              <X size={24} />
            </button>
            <button
              className="download-preview-btn"
              title="Download image"
              onClick={() => forceDownloadImage(previewUrl, 'ceova-image.png')}
            >
              <Download size={20} />
            </button>
          </div>
        </div>
      )}

      {isUser ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '80%' }}>
          {/* User uploaded image attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="message-attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', justifyContent: 'flex-end' }}>
              {msg.attachments.map((file, fIdx) => (
                <div key={fIdx} className="msg-attachment-item">
                  {file.type && file.type.startsWith('image/') ? (
                    <div className="chat-img-thumb" style={{ position: 'relative' }}>
                      <img
                        src={file.url}
                        alt={file.name || 'attachment'}
                        style={{ cursor: 'zoom-in' }}
                        onClick={() => setPreviewUrl(file.url)}
                      />
                      <button
                        className="chat-img-download-btn"
                        title="Download"
                        style={{ opacity: 1 }}
                        onClick={(e) => { e.stopPropagation(); forceDownloadImage(file.url, file.name || 'ceova-attachment.png'); }}
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="msg-attachment-pill" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '6px' }} onClick={() => window.open(file.url, '_blank')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <FileText size={14} style={{ flexShrink: 0 }} />
                        <span className="file-name-trim">{file.name}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); forceDownloadImage(file.url, file.name || 'document.pdf'); }}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', flexShrink: 0, marginLeft: '8px' }}
                        title="Download"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="user-pill">{msg.text}</div>
          <div className={`message-actions ${showActions ? 'visible' : ''}`}>
            <button onClick={(e) => { e.stopPropagation(); handleCopy(rawText, msg.id || msg.tempId); }} title="Copy message">
              {copiedId === (msg.id || msg.tempId) ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ai-brand-avatar">
            <img src="/ceova logo dark.png" alt="Ceova" className="ai-avatar-img" />
          </div>
          <div className="ai-content">
            {msg.toolStatus ? (
              <CyclingStatus defaultStatus={msg.toolStatus} />
            ) : (msg.isTyping && !msg.text) ? (
              <CyclingStatus defaultStatus={null} />
            ) : actionMeta && (msg.isTyping || msg.isLive) ? (
              <CyclingStatus defaultStatus={displayText || "Processing..."} />
            ) : null}

            {(displayText || !msg.isTyping) && (
              <TypewriterRenderer text={displayText.replace('[CONNECT_FOLDER_BUTTON]', '')} isTyping={msg.isTyping || msg.isLive} onZoom={setPreviewUrl} />
            )}

            {resolvedCloudProject && (
              <CloudProjectCard project={resolvedCloudProject} />
            )}

            {isPlanMessage && !resolvedCloudProject && (
              hasProceeded ? (
                <div style={{
                  marginTop: '16px',
                  padding: '10px 16px',
                  background: 'rgba(16, 163, 127, 0.1)',
                  border: '1px solid rgba(16, 163, 127, 0.25)',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#10a37f',
                  fontSize: '0.88rem',
                  fontWeight: 600
                }}>
                  <Check size={16} />
                  <span>Plan approved. Starting website generation...</span>
                </div>
              ) : !hasLaterResponse ? (
                <div className="plan-approval-container" style={{
                  marginTop: '18px',
                  padding: '14px 18px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.22)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                      Ready to build this website?
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.65))' }}>
                      Review the plan above. Click <strong>Proceed</strong> to start building, or reply with edits to update the plan.
                    </div>
                  </div>
                  <button
                    id="plan-proceed-action-btn"
                    onClick={handleProceed}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      background: 'linear-gradient(135deg, #7c5cfc 0%, #6366f1 100%)',
                      color: '#ffffff',
                      borderRadius: '9px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.92rem',
                      boxShadow: '0 4px 14px rgba(124, 92, 252, 0.35)',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 92, 252, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 92, 252, 0.35)';
                    }}
                  >
                    <span>Proceed</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div style={{
                  marginTop: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.82rem',
                  color: 'rgba(255, 255, 255, 0.45)'
                }}>
                  <Check size={14} color="#10a37f" />
                  <span>Plan reviewed</span>
                </div>
              )
            )}



            {(!isUser && (rawText.includes('Connect Local Folder') || rawText.includes('[CONNECT_FOLDER_BUTTON]'))) && (
              <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                <button
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      padding: '10px 20px', 
                      background: localDirectoryHandle ? 'var(--success-color, #10a37f)' : 'var(--brand-color, #6c63ff)', 
                      color: 'white', 
                      borderRadius: '10px', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontWeight: 600, 
                      fontSize: '0.95rem',
                      boxShadow: '0 4px 14px rgba(108,99,255,0.35)',
                      transition: 'all 0.2s'
                    }}
                    onClick={async () => {
                        try {
                            const isTauri = typeof window !== 'undefined' && (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);
                            let selectedHandle = null;
                            if (isTauri) {
                                const { open } = await import('@tauri-apps/plugin-dialog');
                                const dirPath = await open({
                                    directory: true,
                                    multiple: false,
                                    title: 'Select Project Folder'
                                });
                                if (dirPath) {
                                    selectedHandle = dirPath;
                                    setLocalDirectoryHandle(dirPath);
                                }
                            } else {
                                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                                selectedHandle = dirHandle;
                                setLocalDirectoryHandle(dirHandle);
                            }
                            if (selectedHandle && onFolderConnected) {
                                onFolderConnected(selectedHandle);
                            }
                        } catch (err) {
                            console.error('User cancelled directory picker', err);
                        }
                    }}
                >
                    <Folder size={18} /> 
                    {localDirectoryHandle 
                        ? `✅ Connected to ${typeof localDirectoryHandle === 'string' ? localDirectoryHandle.split(/[/\\]/).pop() : localDirectoryHandle.name}` 
                        : '📂 Select Project Folder'}
                </button>
              </div>
            )}
                
                {actionMeta && actionMeta.type === 'file_compression_result' && (
                  <CompressionResultCard meta={actionMeta} />
                )}
                {actionMeta && (actionMeta.type === 'client_image_compression' || actionMeta.type === 'client_file_compression') && (
                  <ClientCompressionWidget meta={actionMeta} />
                )}
                {actionMeta && actionMeta.type === 'client_file_conversion' && (
                  <ClientConversionWidget meta={actionMeta} />
                )}
                {actionMeta && actionMeta.type === 'client_qr_barcode_action' && (
                  <ClientQRBarcodeWidget meta={actionMeta} />
                )}
                {actionMeta && actionMeta.type === 'client_secure_generator' && (
                  <ClientSecureGeneratorWidget meta={actionMeta} />
                )}
                {actionMeta && actionMeta.type === 'client_color_toolkit' && (
                  <ClientColorWidget meta={actionMeta} />
                )}
                {actionMeta && actionMeta.type === 'client_invoice_generator' && (
                  <ClientInvoiceWidget meta={actionMeta} />
                )}
                {actionMeta && actionMeta.type === 'client_media_converter' && (
                  <ClientMediaConverterWidget meta={actionMeta} />
                )}
                <div className={`message-actions ${showActions ? 'visible' : ''}`}>
                  <button onClick={(e) => { e.stopPropagation(); handleCopy(rawText, msg.id || msg.tempId); }} title="Copy message">
                    {copiedId === (msg.id || msg.tempId) ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

const CyclingStatus = ({ defaultStatus }) => {
  const [statusIdx, setStatusIdx] = useState(0);
  const [displayText, setDisplayText] = useState('');
  
  const statuses = ["Thinking...", "Writing...", "Searching..."];
  const currentText = defaultStatus || statuses[statusIdx];
  
  // Smooth typewriter that types forward, pauses, then deletes backward
  useEffect(() => {
    let i = displayText.length;
    let isDeleting = false;
    let timer;

    const tick = () => {
      if (!isDeleting && i < currentText.length) {
        // Typing forward
        i++;
        setDisplayText(currentText.slice(0, i));
        timer = setTimeout(tick, 40);
      } else if (!isDeleting && i === currentText.length) {
        // Pause at the end before next cycle (handled by outer interval, but we wait here)
        // We only delete if it's a cycling status and we're about to change. 
        // Actually, since currentText changes from the outer interval, when currentText changes, 
        // this useEffect re-runs. 
        // So we need a better approach to delete backward.
      }
    };
    
    // Instead of deleting, just type it out smoothly. If currentText changes, 
    // we'll smoothly delete the old text then type the new one.
  }, [currentText]);

  // Let's rewrite the typewriter to handle transitions smoothly
  const [isDeleting, setIsDeleting] = useState(false);
  const [textToType, setTextToType] = useState(currentText);

  useEffect(() => {
    if (textToType !== currentText) {
      setIsDeleting(true);
    }
  }, [currentText, textToType]);

  useEffect(() => {
    let timer;
    if (isDeleting) {
      if (displayText.length > 0) {
        timer = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 20);
      } else {
        setIsDeleting(false);
        setTextToType(currentText);
      }
    } else {
      if (displayText.length < textToType.length) {
        timer = setTimeout(() => {
          setDisplayText(textToType.slice(0, displayText.length + 1));
        }, 40);
      }
    }
    return () => clearTimeout(timer);
  }, [displayText, isDeleting, textToType, currentText]);

  useEffect(() => {
    if (defaultStatus) return;
    const interval = setInterval(() => {
      setStatusIdx(prev => (prev + 1) % statuses.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [defaultStatus]);

  const lcText = textToType.toLowerCase();
  let iconSrc = null;
  if (lcText.includes('gmail')) iconSrc = '/gmail.png';
  else if (lcText.includes('drive')) iconSrc = '/drive.png';
  else if (lcText.includes('calendar')) iconSrc = '/google_calendar.png';
  
  return (
    <div className="premium-typing-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8, minHeight: '24px' }}>
      {iconSrc && <img src={iconSrc} alt="service icon" style={{ width: 14, height: 14, objectFit: 'contain' }} />}
      <span className="typing-status-text" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
        {displayText}
      </span>
    </div>
  );
};

export default function Chat({ messages, onSuggestionClick, userEmail, onRegenerate, onEditRequest, onFeedback, isTemporary, actionCard, progressMessages, localDirectoryHandle, setLocalDirectoryHandle, onFolderConnected }) {
  const messagesEndRef = useRef(null);
  const [copiedId, setCopiedId] = React.useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actionCard]);

  const handleEditInit = (msg) => {
    if (onEditRequest) {
      onEditRequest(msg);
    }
  };

  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <div className="chat-messages-area">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            if (msg.text && msg.text.startsWith('<ceova_hidden_tool_output>')) return null;
            const isUser = msg.sender === 'user';
            return (
              <MessageItem
                key={msg.id || msg.tempId || idx}
                msg={msg}
                idx={idx}
                isUser={isUser}
                messages={messages}
                onSuggestionClick={onSuggestionClick}
                handleEditInit={handleEditInit}
                handleCopy={handleCopy}
                copiedId={copiedId}
                onRegenerate={onRegenerate}
                onFeedback={onFeedback}
                localDirectoryHandle={localDirectoryHandle}
                setLocalDirectoryHandle={setLocalDirectoryHandle}
                onFolderConnected={onFolderConnected}
              />
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} style={{ height: '24px', flexShrink: 0 }} />
      </div>
    </div>
  );
}
