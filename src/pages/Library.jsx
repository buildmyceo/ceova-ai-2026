import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './Library.css';
import {
  X, Search, Image, FileText, File, Code2, Music, Video,
  Download, ExternalLink, Calendar as CalendarIcon, MessageSquare, Filter,
  Grid3X3, List, ChevronLeft, Sparkles, User, Loader2,
  ZoomIn, Copy, Check, Brain, Paperclip, SortDesc, Zap, MoreVertical,
  HardDrive, Cloud, RefreshCw, Eye, AlertCircle, Mail, Inbox, Send, Bookmark, MapPin, Users, Video as VideoCam
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { syncGoogleDrive, connectGoogleDrive } from '../services/gdriveSyncEngine';
import { fetchGoogleEmails } from '../services/gmailSyncEngine';
import { fetchGoogleCalendarEvents } from '../services/gcalendarSyncEngine';
import { summarizeDocument, performOCR } from '../services/libraryAIService';
import { cacheManager } from '../services/CacheManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MIME_ICON = (type = '', name = '') => {
  if (type === 'text/calendar') return { icon: CalendarIcon, color: '#38bdf8', label: 'Event' };
  if (type === 'message/rfc822') return { icon: Mail, color: '#c084fc', label: 'Email' };
  if (type.startsWith('image/'))  return { icon: Image,    color: '#a78bfa', label: 'Image' };
  if (type.startsWith('video/'))  return { icon: Video,    color: '#f472b6', label: 'Video' };
  if (type.startsWith('audio/'))  return { icon: Music,    color: '#34d399', label: 'Audio' };
  if (type === 'application/pdf') return { icon: FileText, color: '#fb923c', label: 'PDF' };
  if (type.includes('word') || type.includes('document')) return { icon: FileText, color: '#60a5fa', label: 'Doc' };
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))   return { icon: FileText, color: '#4ade80', label: 'Sheet' };
  if (type.includes('presentation') || type.includes('powerpoint')) return { icon: FileText, color: '#f59e0b', label: 'Slide' };
  if (type.includes('javascript') || type.includes('json') || type.includes('html') || type.includes('css') || type.includes('python'))
    return { icon: Code2, color: '#c084fc', label: 'Code' };
  return { icon: File, color: '#94a3b8', label: 'File' };
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const fmtSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const truncate = (str, n) => (str && str.length > n ? str.slice(0, n) + '…' : str);

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function Lightbox({ src, caption, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="lib-lightbox" onClick={onClose}>
      <button className="lib-lightbox-close" onClick={onClose}><X size={22} /></button>
      <div className="lib-lightbox-body" onClick={e => e.stopPropagation()}>
        <img src={src} alt={caption} className="lib-lightbox-img" />
        {caption && <p className="lib-lightbox-caption">{caption}</p>}
      </div>
    </div>
  );
}

// ─── Countdown Badge ──────────────────────────────────────────────────────────
function CountdownBadge({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m}m ${s}s`);
      }
    };
    update();
    const int = setInterval(update, 1000);
    return () => clearInterval(int);
  }, [expiresAt]);

  if (!timeLeft) return null;
  const isExpired = timeLeft === 'Expired';

  return (
    <div className="lib-card-badge" style={{ background: isExpired ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`, color: isExpired ? '#fca5a5' : '#fcd34d' }}>
      ⏱ {timeLeft}
    </div>
  );
}

// ─── Event Card (Google Calendar) ─────────────────────────────────────────────
export function CalendarCard({ item, onClick, onPreview, onVisit, onSummarize, onDelete }) {
  return (
    <div className="lib-card lib-card-file" onClick={() => onClick ? onClick(item) : (onPreview && onPreview(item))} style={{ cursor: 'pointer' }}>
      <div className="lib-file-icon" style={{ background: '#38bdf818', borderColor: '#38bdf830' }}>
        <CalendarIcon size={26} color="#38bdf8" />
      </div>
      <div className="lib-file-body">
        <span className="lib-file-name" style={{ fontWeight: 600 }}>{truncate(item.name, 36)}</span>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{fmtDate(item.start_time)}</span>
          {item.start_time && <span>• {fmtTime(item.start_time)}</span>}
        </div>
        {item.location && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <MapPin size={11} /> {truncate(item.location, 30)}
          </div>
        )}
        <div className="lib-file-meta" style={{ marginTop: '4px' }}>
          <span className="lib-badge-label" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#7dd3fc' }}>Calendar</span>
          {item.is_today && <span className="lib-badge-label" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fde047' }}>Today</span>}
          {item.attendees?.length > 0 && <span className="lib-badge-label" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#e9d5ff' }}>{item.attendees.length} Guests</span>}
        </div>
      </div>
      {item.web_view_link && (
        <a
          href={item.web_view_link}
          target="_blank"
          rel="noreferrer"
          className="lib-file-dl"
          title="Open in Google Calendar"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={15} />
        </a>
      )}
      <ItemMenu
        item={item}
        onPreview={onPreview}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onDelete={onDelete}
      />
    </div>
  );
}

// ─── Email Card ───────────────────────────────────────────────────────────────
export function MailCard({ item, onClick, onPreview, onVisit, onSummarize, onDelete }) {
  return (
    <div className="lib-card lib-card-file" onClick={() => onClick ? onClick(item) : (onPreview && onPreview(item))} style={{ cursor: 'pointer' }}>
      <div className="lib-file-icon" style={{ background: '#c084fc18', borderColor: '#c084fc30' }}>
        <Mail size={26} color="#c084fc" />
      </div>
      <div className="lib-file-body">
        <span className="lib-file-name" style={{ fontWeight: 600 }}>{truncate(item.name, 36)}</span>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From: {item.from_sender}</div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.snippet}
        </p>
        <div className="lib-file-meta" style={{ marginTop: '4px' }}>
          <span className="lib-badge-label" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#e9d5ff' }}>Gmail</span>
          <span>{fmtDate(item.created_at)}</span>
        </div>
      </div>
      {item.web_view_link && (
        <a
          href={item.web_view_link}
          target="_blank"
          rel="noreferrer"
          className="lib-file-dl"
          title="Open in Gmail"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={15} />
        </a>
      )}
      <ItemMenu
        item={item}
        onPreview={onPreview}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onDelete={onDelete}
      />
    </div>
  );
}

// ─── Item Menu (3-dot dropdown) ────────────────────────────────────────────────
function ItemMenu({ item, onPreview, onDownload, onVisit, onSummarize, onOCR, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="lib-menu-wrap" ref={ref} onClick={e => e.stopPropagation()}>
      <button className="lib-menu-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="lib-menu-popover">
          {onPreview && <button onClick={() => { setOpen(false); onPreview(item); }}>Preview</button>}
          {onDownload && (item.url || item.web_download_link) && (
            <button onClick={() => { setOpen(false); onDownload(item); }}>Download</button>
          )}
          {onVisit && item.chat_id && (
            <button onClick={() => { setOpen(false); onVisit(item); }}>Visit Chat</button>
          )}
          {item.web_view_link && (
            <button onClick={() => { setOpen(false); window.open(item.web_view_link, '_blank'); }}>
              {item.source === 'gmail' ? 'Open in Gmail' : item.source === 'gcalendar' ? 'Open in Calendar' : 'Open in Drive'}
            </button>
          )}
          {onSummarize && (
            <button onClick={() => { setOpen(false); onSummarize(item); }}>Summarize with AI</button>
          )}
          {onOCR && (
            <button onClick={() => { setOpen(false); onOCR(item); }}>OCR / Extract Text</button>
          )}
          {onDelete && (
            <button onClick={() => { setOpen(false); onDelete(item); }} style={{ color: '#ef4444' }}>Delete</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single card (image) ──────────────────────────────────────────────────────
export function ImageCard({ item, onClick, onPreview, onDownload, onVisit, onDelete }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const driveId = item.drive_id || (item.id && !String(item.id).includes('-') ? item.id : null);
  const baseSrc = driveId 
    ? (item.thumbnail_url || `https://lh3.googleusercontent.com/d/${driveId}=s400`)
    : (item.thumbnail_url || item.url);

  let primarySrc = baseSrc;
  if (!useFallback && primarySrc) {
    if (primarySrc.includes('/storage/v1/object/public/')) {
      primarySrc = primarySrc.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + (primarySrc.includes('?') ? '&' : '?') + 'width=400&resize=contain';
    } else if (primarySrc.includes('/storage/v1/object/sign/')) {
      primarySrc = primarySrc.replace('/storage/v1/object/sign/', '/storage/v1/render/image/sign/') + (primarySrc.includes('?') ? '&' : '?') + 'width=400&resize=contain';
    }
  }

  return (
    <div className="lib-card lib-card-image" onClick={() => onClick(item)}>
      <div className="lib-card-img-wrap">
        {!loaded && !err && <div className="lib-img-skeleton"><div className="lib-skeleton-shimmer" /></div>}
        {!err && (
          <img
            src={primarySrc}
            alt={item.name}
            loading="lazy"
            className={`lib-card-img ${loaded ? 'loaded' : ''}`}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              if (!useFallback && baseSrc && (baseSrc.includes('/storage/v1/object/public/') || baseSrc.includes('/storage/v1/object/sign/'))) {
                setUseFallback(true);
                return;
              }
              if (driveId && !e.target.dataset.fallback1) {
                e.target.dataset.fallback1 = 'true';
                e.target.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
                return;
              }
              if (driveId && !e.target.dataset.fallback2) {
                e.target.dataset.fallback2 = 'true';
                e.target.src = `https://drive.google.com/uc?export=view&id=${driveId}`;
                return;
              }
              setLoaded(true);
              setErr(true);
            }}
            referrerPolicy="no-referrer"
          />
        )}
        {err && <div className="lib-img-err"><Image size={28} /><span>Preview unavailable</span></div>}
        <div className="lib-card-overlay">
          <ZoomIn size={18} />
        </div>
        <ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} onDelete={onDelete} />
      </div>
      <div className="lib-card-meta">
        <span className="lib-card-name">{truncate(item.name, 24)}</span>
        <span className="lib-card-sub">{fmtDate(item.created_at)}</span>
      </div>
      {item.source === 'ai' && (
        <div className="lib-card-badge lib-badge-ai"><Sparkles size={10} />AI</div>
      )}
      {item.source === 'user' && (
        <div className="lib-card-badge lib-badge-user"><User size={10} />You</div>
      )}
      {item.source === 'gdrive' && (
        <div className="lib-card-badge" style={{ background: 'rgba(52, 211, 153, 0.2)', border: '1px solid rgba(52, 211, 153, 0.35)', color: '#6ee7b7' }}>
          <Cloud size={10} /> Drive
        </div>
      )}

    </div>
  );
}

// ─── File/doc/media card ──────────────────────────────────────────────────────
export function FileCard({ item, onClick, onPreview, onDownload, onVisit, onSummarize, onOCR, onDelete }) {
  const { icon: Icon, color, label } = MIME_ICON(item.mime_type || '', item.name);

  return (
    <div className="lib-card lib-card-file" onClick={(e) => {
      if (onClick) {
        // Only trigger onClick if it's the picker doing it. 
        // We prevent default so buttons inside don't fire this.
        onClick(item);
      }
    }} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="lib-file-icon" style={{ background: `${color}18`, borderColor: `${color}30` }}>
        <Icon size={28} color={color} />
      </div>
      <div className="lib-file-body">
        <span className="lib-file-name">{truncate(item.name, 32)}</span>
        <div className="lib-file-meta">
          <span className="lib-badge-label">{label}</span>
          {item.size && <span>{fmtSize(item.size)}</span>}
          <span>{fmtDate(item.created_at)}</span>
        </div>
        {item.chat_title && (
          <div className="lib-file-chat">
            <MessageSquare size={11} />
            <span>{truncate(item.chat_title, 30)}</span>
          </div>
        )}
      </div>
      {(item.url || item.web_view_link || item.web_download_link) && (
        <a
          href={item.url || item.web_view_link || item.web_download_link}
          target="_blank"
          rel="noreferrer"
          className="lib-file-dl"
          title="Open / View"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={15} />
        </a>
      )}
      <ItemMenu
        item={item}
        onPreview={onPreview}
        onDownload={onDownload}
        onVisit={onVisit}
        onSummarize={onSummarize}
        onOCR={onOCR}
        onDelete={onDelete}
      />
      {item.source === 'ai' && (
        <div className="lib-card-badge lib-badge-ai"><Sparkles size={10} />AI</div>
      )}
      {item.source === 'gdrive' && (
        <div className="lib-card-badge" style={{ background: 'rgba(52, 211, 153, 0.2)', border: '1px solid rgba(52, 211, 153, 0.35)', color: '#6ee7b7' }}>
          <Cloud size={10} /> Drive
        </div>
      )}
      {item.is_temporary && (
        <CountdownBadge expiresAt={item.expires_at} />
      )}
    </div>
  );
}

// ─── AI App Action card ─────────────────────────────────────────────────────
function ActionCard({ item, onPreview, onDownload, onVisit, onDelete }) {
  const meta = item.meta || {};
  let title = "AI Action";
  let desc = "";

  if (meta.type === 'client_file_compression') {
    title = "File Compression";
    desc = `Compressed file: ${meta.fileName || 'document'}`;
  } else if (meta.type === 'client_color_toolkit') {
    title = "Color Tools";
    desc = `Processed color data`;
  } else if (meta.type === 'client_invoice_generator') {
    title = "Invoice Generation";
    desc = `Generated invoice ${meta.invoiceData?.invoiceNumber || ''}`;
  } else if (meta.type === 'client_qr_barcode') {
    title = "QR / Barcode";
    desc = `Generated ${meta.format || 'code'}`;
  } else if (meta.type === 'client_secure_generator') {
    title = "Password Generation";
    desc = "Generated secure password";
  } else if (meta.type === 'client_media_converter') {
    title = "Media Converter";
    desc = `Converted media format`;
  } else {
    title = (meta.type || "AI Action").replace(/_/g, ' ');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    desc = "Used an app integration in this chat.";
  }

  return (
    <div className="lib-card lib-card-snippet">
      <div className="lib-snippet-header">
        <div className="lib-snippet-icon">
          <Zap size={14} />
        </div>
        <span className="lib-snippet-title">{title}</span>
        <div style={{ marginLeft: 'auto' }}>
          <ItemMenu item={item} onPreview={onPreview} onDownload={onDownload} onVisit={onVisit} onDelete={onDelete} />
        </div>
      </div>
      <p className="lib-snippet-body">{desc}</p>
      <div className="lib-snippet-footer">
        <MessageSquare size={11} /> <span>{truncate(item.chat_title, 22)}</span>
        <span style={{ marginLeft: 'auto' }}>{fmtDate(item.created_at)}</span>
      </div>
    </div>
  );
}

// ─── Main Library Page Component ──────────────────────────────────────────────
export default function Library({ session, onBack, switchChat }) {
  const { resolvedTheme } = useTheme();
  const location = useLocation();

  // Top Drive Tabs: 'ceova' | 'gdrive' | 'gmail' | 'gcalendar' | 'ai'
  const [topTab, setTopTab] = useState('ceova');
  // Sub Category Filter: 'all' | 'images' | 'documents' | 'videos' | 'audio' | 'inbox' | 'sent' | 'important' | 'upcoming' | 'today' | 'meetings'
  const [subFilter, setSubFilter] = useState('all');

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsDriveAuth, setNeedsDriveAuth] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [aiModal, setAiModal] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [eventPreview, setEventPreview] = useState(null);

  // Raw items
  const [allItems, setAllItems] = useState([]);

  // ── Trigger Storage Services Sync (Google Drive) ─────────────────
  const handleSyncDrive = async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    setIsSyncing(true);
    setSyncNotice('Scanning Cloud Services...');
    try {
      let needsAuth = false;

      const res = await syncGoogleDrive(userId);
      console.log('[Library] Drive sync result:', res);
      if (res.needsAuth) {
        needsAuth = true;
      }

      // 2. Sync Google Mail and Calendar
      try {
        const mailRes = await fetchGoogleEmails(userId);
        const calRes = await fetchGoogleCalendarEvents(userId);
        if (mailRes?.needsAuth || calRes?.needsAuth) {
          needsAuth = true;
        }
      } catch (e) {
        console.warn('Google Mail/Calendar sync error:', e);
      }

      if (needsAuth) {
        // Token is expired or missing — redirect to Google OAuth
        setSyncNotice('Google authentication needed. Redirecting...');
        setTimeout(() => connectGoogleDrive(), 1000);
        return;
      }

      setNeedsDriveAuth(false);
      setSyncNotice('Cloud services synced.');
      await fetchLibraryData();
    } catch (e) {
      console.warn('Cloud sync error:', e);
      setSyncNotice('Cloud sync error.');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Fetch Content (Chat messages + Google Drive + Google Mail + Google Calendar) ──
  const fetchLibraryData = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    
    // Quick load from cache for instant UI
    let loadedFromCache = false;
    try {
      const cachedItems = await cacheManager.getLibraryItems();
      if (cachedItems && cachedItems.length > 0) {
        setAllItems(cachedItems);
        const hasGoogleItems = cachedItems.some(i => i.source === 'gdrive' || i.source === 'gmail' || i.source === 'gcalendar');
        if (hasGoogleItems) setNeedsDriveAuth(false);
        loadedFromCache = true;
        setLoading(false);
      }
    } catch (cacheErr) {
      console.warn('[Library] Cache load error:', cacheErr);
    }
    
    if (!loadedFromCache) {
      setLoading(true);
    }

    try {
      const items = [];

      // 1. Pull CEOVA Chat messages + attachments + actions
      try {
        const { data: chats } = await supabase
          .from('chats')
          .select('id, title')
          .eq('user_id', userId);

        const chatMap = new Map((chats || []).map(c => [c.id, c.title]));
        const chatIds = Array.from(chatMap.keys());

        if (chatIds.length > 0) {
          const { data: messages } = await supabase
            .from('messages')
            .select('id, role, content, attachments, created_at, chat_id')
            .in('chat_id', chatIds)
            .order('created_at', { ascending: false })
            .limit(2000);

          (messages || []).forEach(msg => {
            const chatTitle = chatMap.get(msg.chat_id) || 'Untitled Chat';
            const isAI = msg.role === 'assistant' || msg.role === 'ai';
            const isUser = msg.role === 'user';

            // Attachments
            const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
            attachments.forEach(att => {
              const isImg = att.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.name || att.url || '');
              const isVid = att.type?.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(att.name || att.url || '');
              const isAud = att.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(att.name || att.url || '');

              let kind = 'file';
              let category = 'documents';
              if (isImg) { kind = 'image'; category = 'images'; }
              else if (isVid) { kind = 'file'; category = 'videos'; }
              else if (isAud) { kind = 'file'; category = 'audio'; }

              items.push({
                id: `att-${msg.id}-${att.name || Math.random()}`,
                kind,
                category,
                name: att.name || 'Untitled',
                url: att.url || att.preview || att.dataUrl,
                mime_type: att.type || '',
                size: att.size,
                created_at: msg.created_at,
                chat_id: msg.chat_id,
                chat_title: chatTitle,
                source: isUser ? 'user' : 'ai',
                content: null,
              });
            });

            // AI Markdown Images
            if (isAI && msg.content) {
              const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
              let m;
              while ((m = imgRegex.exec(msg.content)) !== null) {
                items.push({
                  id: `img-${msg.id}-${m.index}`,
                  kind: 'image',
                  category: 'images',
                  name: m[1] || 'AI Generated Image',
                  url: m[2],
                  mime_type: 'image/png',
                  size: null,
                  created_at: msg.created_at,
                  chat_id: msg.chat_id,
                  chat_title: chatTitle,
                  source: 'ai',
                  content: null,
                });
              }

              // AI Actions
              const actionMatch = /<!--\s*ACTION_META:\s*({.*?})\s*-->/.exec(msg.content);
              if (actionMatch && actionMatch[1]) {
                try {
                  const meta = JSON.parse(actionMatch[1]);
                  items.push({
                    id: `act-${msg.id}`,
                    kind: 'action',
                    category: 'action',
                    name: meta.type || 'AI Action',
                    url: null,
                    mime_type: 'application/json',
                    size: null,
                    created_at: msg.created_at,
                    chat_id: msg.chat_id,
                    chat_title: chatTitle,
                    source: 'ai',
                    content: actionMatch[1],
                    meta: meta
                  });
                } catch (e) {}
              }
            }
          });
        }
      } catch (chatErr) {
        console.warn('[Library] Error fetching chat messages:', chatErr);
      }

      // 3. Pull AI Generated Files table
      try {
        const { data: aiFiles } = await supabase
          .from('ai_generated_files')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        (aiFiles || []).forEach(af => {
          items.push({
            id: `aig-${af.id}`,
            kind: 'file',
            category: af.category || 'ai_generated',
            name: af.file_name || af.name || 'AI Generated File',
            url: af.file_url || af.url,
            mime_type: af.mime_type || 'text/plain',
            size: af.size,
            created_at: af.created_at,
            source: 'ai',
            summary: af.prompt_used || af.summary
          });
        });
      } catch (aigErr) {}

      // 4. Pull Google Drive / Local synced metadata from public.files table
      const { data: driveFiles, error: driveErr } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .not('is_trashed', 'eq', true)  // handles both false AND null
        .order('created_at', { ascending: false });

      if (driveErr) console.error('[Library] Drive files fetch error:', driveErr);

      const pathsToSign = [];
      (driveFiles || []).forEach(df => {
         if (df.web_view_link && !df.web_view_link.startsWith('http')) {
             const cleanLink = df.web_view_link.startsWith('/') ? df.web_view_link.substring(1) : df.web_view_link;
             pathsToSign.push(cleanLink);
         }
      });
      let signedUrlsMap = {};
      if (pathsToSign.length > 0) {
         for (let i = 0; i < pathsToSign.length; i += 50) {
             const chunk = pathsToSign.slice(i, i + 50);
             const { data: signedData } = await supabase.storage.from('user_files').createSignedUrls(chunk, 3600);
             if (signedData) {
                 signedData.forEach(item => {
                     if (!item.error) signedUrlsMap[item.path] = item.signedUrl;
                 });
             }
         }
      }

      (driveFiles || []).forEach(df => {
        const isImg = df.category === 'images' || df.mime_type?.startsWith('image/');
        const driveId = df.drive_id || (df.id && !String(df.id).includes('-') ? df.id : null);
        const directThumb = df.thumbnail_url || (driveId ? `https://lh3.googleusercontent.com/d/${driveId}=s400` : null);
        const isAiSource = df.storage_source === 'ai_generated' || df.category === 'ai_generated';

        const getFullUrl = (link) => {
           if (!link) return null;
           if (link.startsWith('http')) return link;
           const cleanLink = link.startsWith('/') ? link.substring(1) : link;
           
           if (signedUrlsMap[cleanLink]) {
              return signedUrlsMap[cleanLink];
           }
           
           return `${supabase.supabaseUrl}/storage/v1/object/public/user_files/${cleanLink}`;
        };

        const resolvedWebView = getFullUrl(df.web_view_link);
        const resolvedWebDownload = getFullUrl(df.web_download_link);

        items.push({
          id: df.id,
          drive_id: driveId,
          kind: isImg ? 'image' : 'file',
          category: df.category || 'documents',
          name: df.name,
          url: directThumb || resolvedWebView,
          thumbnail_url: directThumb,
          web_view_link: resolvedWebView || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : null),
          web_download_link: resolvedWebDownload || (driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : null),
          mime_type: df.mime_type || '',
          size: df.size,
          created_at: df.created_at,
          chat_id: null,
          chat_title: null,
          source: isAiSource ? 'ai' : (df.storage_source || 'gdrive'),
          summary: df.summary,
          ocr_text: df.ocr_text,
          is_temporary: df.is_temporary,
          expires_at: df.expires_at,
        });
      });

      // 5. Pull Google Mail from Database with Live Fallback
      let mailList = [];
      const { data: dbEmails, error: mailErr } = await supabase
        .from('gmail_emails')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!mailErr && dbEmails && dbEmails.length > 0) {
        mailList = dbEmails.map(e => ({
          id: `db-gmail-${e.id}`,
          gmail_id: e.gmail_id,
          thread_id: e.thread_id,
          kind: 'file',
          category: 'mail',
          name: e.name,
          from_sender: e.from_sender,
          snippet: e.snippet,
          created_at: e.created_at,
          label_ids: e.label_ids || [],
          source: 'gmail',
          web_view_link: e.web_view_link,
          mime_type: 'message/rfc822'
        }));
      } else {
        // Fallback to live Gmail API call if DB table is empty or missing
        try {
          const liveMailRes = await fetchGoogleEmails(userId);
          if (liveMailRes?.success && liveMailRes?.emails) {
            mailList = liveMailRes.emails;
          }
        } catch (mErr) {
          console.warn('[Library] Live mail fallback error:', mErr);
        }
      }
      mailList.forEach(e => items.push(e));

      // 6. Pull Google Calendar from Database with Live Fallback
      let calList = [];
      const { data: dbEvents, error: calErr } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: true });

      if (!calErr && dbEvents && dbEvents.length > 0) {
        calList = dbEvents.map(evt => {
          const evtStart = new Date(evt.start_time);
          const now = new Date();
          const isUpcoming = evtStart >= now;
          const isToday = evtStart.toDateString() === now.toDateString();
          const isMeeting = (evt.attendees || []).length > 0 || evt.html_link?.includes('meet');

          return {
            id: `db-gcal-${evt.id}`,
            gcal_id: evt.gcal_id,
            kind: 'file',
            category: 'calendar',
            name: evt.name,
            description: evt.description,
            location: evt.location,
            start_time: evt.start_time,
            end_time: evt.end_time,
            created_at: evt.created_at,
            source: 'gcalendar',
            web_view_link: evt.html_link,
            attendees: evt.attendees || [],
            is_upcoming: isUpcoming,
            is_today: isToday,
            is_meeting: isMeeting,
            mime_type: 'text/calendar'
          };
        });
      } else {
        // Fallback to live Calendar API call if DB table is empty or missing
        try {
          const liveCalRes = await fetchGoogleCalendarEvents(userId);
          if (liveCalRes?.success && liveCalRes?.events) {
            calList = liveCalRes.events;
          }
        } catch (cErr) {
          console.warn('[Library] Live calendar fallback error:', cErr);
        }
      }
      calList.forEach(evt => items.push(evt));

      // Deduplicate items
      const seen = new Set();
      const deduped = items.filter(it => {
        // Use a composite key including name and size to deduplicate multiple uploads of the same file
        const key = it.gcal_id || it.gmail_id || it.drive_id || (it.name ? `${it.name}-${it.size || ''}` : null) || it.url || it.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setAllItems(deduped);
      const hasGoogleItems = deduped.some(i => i.source === 'gdrive' || i.source === 'gmail' || i.source === 'gcalendar');
      if (hasGoogleItems) {
        setNeedsDriveAuth(false);
      }
      
      // Update local device cache in background
      cacheManager.setLibraryItems(deduped).catch(err => console.warn('[Library] Cache save error:', err));
    } catch (e) {
      console.error('[Library] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { fetchLibraryData(); }, [fetchLibraryData]);

  // Auto-sync on load, and also when returning from Google OAuth
  useEffect(() => {
    if (session?.user?.id) {
      handleSyncDrive();
    }
  }, [session?.user?.id]);

  // Extra sync trigger when returning from OAuth (AuthCallback sets triggerSync: true)
  useEffect(() => {
    if (location?.state?.triggerSync && session?.user?.id) {
      // Small delay to ensure token is saved before syncing
      setTimeout(() => handleSyncDrive(), 1500);
    }
  }, [location?.state?.triggerSync]);

  // Filter Items by Top Drive Tab (ceova, gdrive, dropbox, gmail, gcalendar, ai)
  const driveItems = allItems.filter(it => {
    const isAiItem = it.source === 'ai' || it.source === 'ai_generated' || it.category === 'ai_generated' || it.category === 'action';
    if (topTab === 'ceova') return it.source !== 'gdrive' && it.source !== 'dropbox' && it.source !== 'gmail' && it.source !== 'gcalendar' && !isAiItem;
    if (topTab === 'gdrive') return it.source === 'gdrive';

    if (topTab === 'gmail') return it.source === 'gmail';
    if (topTab === 'gcalendar') return it.source === 'gcalendar';
    if (topTab === 'ai') return isAiItem;
    return true;
  });

  // Category classification helpers
  const isImage = (i) => i.kind === 'image' || i.category === 'images' || i.mime_type?.startsWith('image/');
  const isVideo = (i) => i.category === 'videos' || i.mime_type?.startsWith('video/');
  const isAudio = (i) => i.category === 'audio' || i.mime_type?.startsWith('audio/');
  const isDoc   = (i) => (i.kind === 'file' || i.category === 'documents' || i.category === 'pdfs' || i.category === 'spreadsheets' || i.category === 'presentations') && !isVideo(i) && !isAudio(i) && i.source !== 'gmail' && i.source !== 'gcalendar';

  // Sub Category filter options depending on active Drive
  let candidateFilters = [];
  if (topTab === 'gmail') {
    const countAllMail = driveItems.length;
    const countInbox   = driveItems.filter(i => i.label_ids?.includes('INBOX')).length;
    const countSent    = driveItems.filter(i => i.label_ids?.includes('SENT')).length;
    const countImportant = driveItems.filter(i => i.label_ids?.includes('IMPORTANT')).length;

    candidateFilters = [
      { id: 'all',       label: 'All',       count: countAllMail },
      { id: 'inbox',     label: 'Inbox',     count: countInbox },
      { id: 'sent',      label: 'Sent',      count: countSent },
      { id: 'important', label: 'Important', count: countImportant },
    ];
  } else if (topTab === 'gcalendar') {
    const countAllEvt   = driveItems.length;
    const countUpcoming = driveItems.filter(i => i.is_upcoming).length;
    const countToday    = driveItems.filter(i => i.is_today).length;
    const countMeetings = driveItems.filter(i => i.is_meeting).length;

    candidateFilters = [
      { id: 'all',      label: 'All',      count: countAllEvt },
      { id: 'upcoming', label: 'Upcoming', count: countUpcoming },
      { id: 'today',    label: 'Today',    count: countToday },
      { id: 'meetings', label: 'Meetings', count: countMeetings },
    ];
  } else {
    const countAll = driveItems.length;
    const countImages = driveItems.filter(isImage).length;
    const countDocuments = driveItems.filter(isDoc).length;
    const countVideos = driveItems.filter(isVideo).length;
    const countAudio = driveItems.filter(isAudio).length;

    candidateFilters = [
      { id: 'all',       label: 'All',       count: countAll },
      { id: 'images',    label: 'Images',    count: countImages },
      { id: 'documents', label: 'Documents', count: countDocuments },
      { id: 'videos',    label: 'Video',     count: countVideos },
      { id: 'audio',     label: 'Audio',     count: countAudio },
    ];
  }

  // Only keep sub-filters with available data (count > 0)
  const availableSubFilters = candidateFilters.filter(s => s.count > 0);

  // Filter Items by Sub Category & Search
  const filtered = driveItems.filter(it => {
    if (topTab === 'gmail') {
      if (subFilter === 'inbox' && !it.label_ids?.includes('INBOX')) return false;
      if (subFilter === 'sent' && !it.label_ids?.includes('SENT')) return false;
      if (subFilter === 'important' && !it.label_ids?.includes('IMPORTANT')) return false;
    } else if (topTab === 'gcalendar') {
      if (subFilter === 'upcoming' && !it.is_upcoming) return false;
      if (subFilter === 'today' && !it.is_today) return false;
      if (subFilter === 'meetings' && !it.is_meeting) return false;
    } else {
      if (subFilter === 'images'    && !isImage(it)) return false;
      if (subFilter === 'documents' && !isDoc(it))   return false;
      if (subFilter === 'videos'    && !isVideo(it)) return false;
      if (subFilter === 'audio'     && !isAudio(it)) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (it.name?.toLowerCase().includes(q)) ||
        (it.location?.toLowerCase().includes(q)) ||
        (it.from_sender?.toLowerCase().includes(q)) ||
        (it.snippet?.toLowerCase().includes(q)) ||
        (it.chat_title?.toLowerCase().includes(q)) ||
        (it.summary?.toLowerCase().includes(q)) ||
        (it.ocr_text?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const images  = filtered.filter(isImage);
  const files   = filtered.filter(isDoc);
  const videos  = filtered.filter(isVideo);
  const audios  = filtered.filter(isAudio);
  const mails   = filtered.filter(i => i.source === 'gmail');
  const events  = filtered.filter(i => i.source === 'gcalendar');
  const actions = filtered.filter(i => i.kind === 'action');

  // Top Tab Counts
  const countCEOVA   = allItems.filter(i => {
    const isAiItem = i.source === 'ai' || i.source === 'ai_generated' || i.category === 'ai_generated' || i.category === 'action';
    return i.source !== 'gdrive' && i.source !== 'gmail' && i.source !== 'gcalendar' && !isAiItem;
  }).length;
  const countGDrive  = allItems.filter(i => i.source === 'gdrive').length;
  const countGmail   = allItems.filter(i => i.source === 'gmail').length;
  const countGCal    = allItems.filter(i => i.source === 'gcalendar').length;
  const countAI      = allItems.filter(i => i.source === 'ai' || i.source === 'ai_generated' || i.category === 'ai_generated' || i.category === 'action').length;

  const TOP_TABS = [
    { id: 'ceova',     label: 'CEOVA Drive',     count: countCEOVA },
    { id: 'gdrive',    label: 'Google Drive',    count: countGDrive },

    { id: 'gmail',     label: 'Google Mail',     count: countGmail },
    { id: 'gcalendar', label: 'Google Calendar', count: countGCal },
    { id: 'ai',        label: 'AI Generated',    count: countAI },
  ];

  const handleSummarize = async (item) => {
    setLoading(true);
    const res = await summarizeDocument(session?.user?.id, item);
    setLoading(false);
    if (res.success) setAiModal({ title: `Summary: ${item.name}`, text: res.summary });
  };

  
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    setLoading(true);
    try {
      if (item.source === 'gmail') {
        await supabase.from('gmail_emails').delete().eq('id', item.id.replace('db-gmail-', ''));
      } else if (item.source === 'gcalendar') {
        await supabase.from('calendar_events').delete().eq('id', item.id.replace('db-gcal-', ''));
      } else if (item.source === 'gdrive') {
        await supabase.from('files').delete().eq('id', item.id);
      } else if (item.id.startsWith('aig-')) {
        await supabase.from('ai_generated_files').delete().eq('id', item.id.replace('aig-', ''));
      } else if (item.id.startsWith('att-')) {
        const msgId = item.id.split('-')[1];
        const { data: msg } = await supabase.from('messages').select('attachments').eq('id', msgId).single();
        if (msg && msg.attachments) {
           const newAtt = msg.attachments.filter(a => a.name !== item.name && a.url !== item.url);
           await supabase.from('messages').update({ attachments: newAtt }).eq('id', msgId);
        }
      } else {
        await supabase.from('files').delete().eq('id', item.id);
      }
      
      const newItems = allItems.filter(i => i.id !== item.id);
      setAllItems(newItems);
      cacheManager.setLibraryItems(newItems);
    } catch (e) {
      console.error('Delete error', e);
      alert('Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCeovaDrive = async () => {
    if (!window.confirm('Are you sure you want to clear all CEOVA Drive files? This will remove all attachments from your chats in the library.')) return;

    setLoading(true);
    try {
      const ceovaItems = allItems.filter(i => {
        const isAiItem = i.source === 'ai' || i.source === 'ai_generated' || i.category === 'ai_generated' || i.category === 'action';
        return i.source !== 'gdrive' && i.source !== 'gmail' && i.source !== 'gcalendar' && !isAiItem;
      });

      for (const item of ceovaItems) {
        if (item.id.startsWith('att-')) {
          const msgId = item.id.split('-')[1];
          const { data: msg } = await supabase.from('messages').select('attachments').eq('id', msgId).single();
          if (msg && msg.attachments) {
             const newAtt = msg.attachments.filter(a => a.name !== item.name && a.url !== item.url);
             await supabase.from('messages').update({ attachments: newAtt }).eq('id', msgId);
          }
        } else if (!item.id.startsWith('aig-') && !item.id.startsWith('db-')) {
          await supabase.from('files').delete().eq('id', item.id);
        }
      }

      const newItems = allItems.filter(i => !ceovaItems.includes(i));
      setAllItems(newItems);
      cacheManager.setLibraryItems(newItems);
    } catch (e) {
      console.error('Clear ceova drive error', e);
      alert('Failed to clear CEOVA Drive');
    } finally {
      setLoading(false);
    }
  };

  const handleOCR = async (item) => {
    setLoading(true);
    const res = await performOCR(session?.user?.id, item);
    setLoading(false);
    if (res.success) setAiModal({ title: `OCR Text: ${item.name}`, text: res.text });
  };

  return (
    <div className={`lib-root theme-${resolvedTheme}`}>
      {/* ── Header ── */}
      <div className="lib-header">
        <div className="lib-header-left">
          <button className="lib-back-btn" onClick={onBack} title="Back to Chat">
            <ChevronLeft size={20} />
          </button>
          <h1 className="lib-title">Library</h1>
        </div>

        <div className="lib-header-right">
          {topTab === 'ceova' && (
             <button onClick={handleClearCeovaDrive} style={{ background: 'var(--glass)', color: '#ef4444', border: '1px solid #ef444455', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Clear CEOVA Drive</button>
          )}
          {/* Sync Google Services Button */}
          <button
            className="lib-btn"
            onClick={handleSyncDrive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--glass)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isSyncing ? 'lib-spin' : ''} />
            <span>{isSyncing ? 'Scanning Google...' : 'Sync Google Services'}</span>
          </button>

          {/* Search */}
          <div className="lib-search-wrap">
            <Search size={15} className="lib-search-icon" />
            <input
              className="lib-search"
              placeholder="Search library, emails, events, or docs…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="lib-search-clear" onClick={() => setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="lib-view-toggle">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid view">
              <Grid3X3 size={16} />
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view">
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Top Main Drives Navigation Tabs (CEOVA Drive, Google Drive, Google Mail, Google Calendar, AI Generated) ── */}
      <div className="lib-tabs" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {TOP_TABS.map(t => (
          <button
            key={t.id}
            className={`lib-tab ${topTab === t.id ? 'active' : ''}`}
            onClick={() => { setTopTab(t.id); setSubFilter('all'); }}
            style={{ fontSize: '15px', fontWeight: 600 }}
          >
            {t.label}
            <span className="lib-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Sub Filters Bar (Only showing sub-options with available data!) ── */}
      {availableSubFilters.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border-color)' }}>
          {availableSubFilters.map(s => (
            <button
              key={s.id}
              onClick={() => setSubFilter(s.id)}
              style={{
                padding: '5px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 500,
                border: subFilter === s.id ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                background: subFilter === s.id ? 'var(--glass-hover)' : 'transparent',
                color: subFilter === s.id ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {s.label}
              <span style={{ fontSize: '11px', opacity: 0.7 }}>({s.count})</span>
            </button>
          ))}
          {syncNotice && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6ee7b7' }}>{syncNotice}</span>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div className="lib-body">
        {(topTab === 'gdrive' || topTab === 'gmail' || topTab === 'gcalendar') && needsDriveAuth && driveItems.length === 0 && !loading && (
          <div style={{ padding: '28px 32px', textAlign: 'center', background: 'rgba(52, 211, 153, 0.05)', borderRadius: '16px', border: '1px solid rgba(52, 211, 153, 0.2)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
              <Cloud size={32} color="#34d399" />
              <Mail size={32} color="#c084fc" />
              <CalendarIcon size={32} color="#38bdf8" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px' }}>
              Connect & Grant Google Access
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '520px', margin: '4px auto 16px', lineHeight: '1.5' }}>
              CEOVA will securely read your Google Drive files, Gmail messages, and Calendar events directly without duplicating data.
            </p>
            <button className="lib-btn" onClick={connectGoogleDrive} style={{ background: '#34d399', color: '#000', fontWeight: 600, padding: '10px 22px', borderRadius: '10px', border: 'none', margin: '0 auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ExternalLink size={16} /> Connect Google Account & Services
            </button>
          </div>
        )}

        {loading ? (
          <div className="lib-loading">
            <Loader2 size={32} className="lib-spin" />
            <p>Loading {topTab === 'ceova' ? 'CEOVA Drive' : topTab === 'gdrive' ? 'Google Drive' : topTab === 'gmail' ? 'Google Mail' : topTab === 'gcalendar' ? 'Google Calendar' : 'AI Generated'} items…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="lib-empty">
            <div className="lib-empty-icon">
              {topTab === 'gcalendar' ? <CalendarIcon size={40} /> : topTab === 'gmail' ? <Mail size={40} /> : topTab === 'gdrive' ? <Cloud size={40} /> : <FileText size={40} />}
            </div>
            <h3>{searchQuery ? 'No results found' : `No ${subFilter !== 'all' ? subFilter : ''} items in ${topTab === 'ceova' ? 'CEOVA Drive' : topTab === 'gdrive' ? 'Google Drive' : topTab === 'gmail' ? 'Google Mail' : topTab === 'gcalendar' ? 'Google Calendar' : 'AI Generated'}`}</h3>
            <p style={{ margin: '4px 0 12px' }}>
              {searchQuery
                ? `Nothing matches "${searchQuery}"`
                : topTab === 'gcalendar'
                ? 'No calendar events found.'
                : topTab === 'gmail'
                ? 'No emails found.'
                : topTab === 'gdrive'
                ? 'No Google Drive files found.'
                : 'Upload files or chat with CEOVA to add files here.'}
            </p>
            {(topTab === 'gmail' || topTab === 'gcalendar' || topTab === 'gdrive') && (
              <button 
                className="lib-btn" 
                onClick={handleSyncDrive} 
                style={{ 
                  background: '#34d399', 
                  color: '#000', 
                  fontWeight: 600, 
                  padding: '9px 18px', 
                  borderRadius: '10px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontSize: '13px'
                }}
              >
                <ExternalLink size={14} /> Connect / Sync {topTab === 'gmail' ? 'Google Mail' : topTab === 'gcalendar' ? 'Google Calendar' : 'Google Drive'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Google Calendar section */}
            {topTab === 'gcalendar' && events.length > 0 && (
              <section className="lib-section">
                <div className="lib-grid-files">
                  {events.map(item => (
                    <CalendarCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onPreview={it => setEventPreview(it)}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                      onSummarize={handleSummarize}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Google Mail section */}
            {topTab === 'gmail' && mails.length > 0 && (
              <section className="lib-section">
                <div className="lib-grid-files">
                  {mails.map(item => (
                    <MailCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onPreview={it => setEmailPreview(it)}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                      onSummarize={handleSummarize}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Images section */}
            {topTab !== 'gmail' && topTab !== 'gcalendar' && (subFilter === 'all' || subFilter === 'images') && images.length > 0 && (
              <section className="lib-section">
                {subFilter === 'all' && (
                  <div className="lib-section-header">
                    <Image size={16} />
                    <h2>Images</h2>
                    <span className="lib-section-count">{images.length}</span>
                  </div>
                )}
                <div className={`lib-grid-images ${viewMode === 'list' ? 'lib-list' : ''}`}>
                  {images.map(item => (
                    <ImageCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onClick={it => setLightbox({ src: it.url || it.web_view_link, caption: it.name })}
                      onPreview={it => setLightbox({ src: it.url || it.web_view_link, caption: it.name })}
                      onDownload={it => window.open(it.web_download_link || it.url, '_blank')}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Documents section */}
            {topTab !== 'gmail' && topTab !== 'gcalendar' && (subFilter === 'all' || subFilter === 'documents') && files.length > 0 && (
              <section className="lib-section">
                {subFilter === 'all' && (
                  <div className="lib-section-header">
                    <FileText size={16} />
                    <h2>Documents</h2>
                    <span className="lib-section-count">{files.length}</span>
                  </div>
                )}
                <div className="lib-grid-files">
                  {files.map(item => (
                    <FileCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onPreview={it => window.open(it.web_view_link || it.url, '_blank')}
                      onDownload={it => window.open(it.web_download_link || it.url, '_blank')}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                      onSummarize={handleSummarize}
                      onOCR={handleOCR}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Videos section */}
            {topTab !== 'gmail' && topTab !== 'gcalendar' && (subFilter === 'all' || subFilter === 'videos') && videos.length > 0 && (
              <section className="lib-section">
                {subFilter === 'all' && (
                  <div className="lib-section-header">
                    <Video size={16} />
                    <h2>Videos</h2>
                    <span className="lib-section-count">{videos.length}</span>
                  </div>
                )}
                <div className="lib-grid-files">
                  {videos.map(item => (
                    <FileCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onPreview={it => window.open(it.web_view_link || it.url, '_blank')}
                      onDownload={it => window.open(it.web_download_link || it.url, '_blank')}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                      onSummarize={handleSummarize}
                      onOCR={handleOCR}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Audio section */}
            {topTab !== 'gmail' && topTab !== 'gcalendar' && (subFilter === 'all' || subFilter === 'audio') && audios.length > 0 && (
              <section className="lib-section">
                {subFilter === 'all' && (
                  <div className="lib-section-header">
                    <Music size={16} />
                    <h2>Audio</h2>
                    <span className="lib-section-count">{audios.length}</span>
                  </div>
                )}
                <div className="lib-grid-files">
                  {audios.map(item => (
                    <FileCard
                      key={item.id}
                      item={item}
                      onDelete={handleDelete}
                      onPreview={it => window.open(it.web_view_link || it.url, '_blank')}
                      onDownload={it => window.open(it.web_download_link || it.url, '_blank')}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                      onSummarize={handleSummarize}
                      onOCR={handleOCR}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* AI Actions section */}
            {topTab !== 'gmail' && topTab !== 'gcalendar' && subFilter === 'all' && actions.length > 0 && (
              <section className="lib-section">
                <div className="lib-section-header">
                  <Zap size={16} />
                  <h2>App Actions History</h2>
                  <span className="lib-section-count">{actions.length}</span>
                </div>
                <div className="lib-grid-snippets">
                  {actions.map(item => (
                    <ActionCard
                      key={item.id}
                      item={item}
                      onVisit={it => { if (it.chat_id) { switchChat(it.chat_id); onBack(); } }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <Lightbox
          src={lightbox.src}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ── Event Preview Modal ── */}
      {eventPreview && (
        <div className="lib-lightbox" onClick={() => setEventPreview(null)}>
          <button className="lib-lightbox-close" onClick={() => setEventPreview(null)}><X size={22} /></button>
          <div className="lib-lightbox-body" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '640px', width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <CalendarIcon color="#38bdf8" size={26} />
              <div>
                <h3 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 600 }}>{eventPreview.name}</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {fmtDate(eventPreview.start_time)} • {fmtTime(eventPreview.start_time)} - {fmtTime(eventPreview.end_time)}
                </div>
              </div>
            </div>
            {eventPreview.location && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <MapPin size={14} /> {eventPreview.location}
              </div>
            )}
            {eventPreview.description && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
                {eventPreview.description}
              </div>
            )}
            {eventPreview.attendees?.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>ATTENDEES ({eventPreview.attendees.length}):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {eventPreview.attendees.map(a => (
                    <span key={a} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '12px', color: 'var(--text-main)' }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
            {eventPreview.web_view_link && (
              <div style={{ marginTop: '18px', textAlign: 'right' }}>
                <a href={eventPreview.web_view_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                  Open in Google Calendar <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Email Preview Modal ── */}
      {emailPreview && (
        <div className="lib-lightbox" onClick={() => setEmailPreview(null)}>
          <button className="lib-lightbox-close" onClick={() => setEmailPreview(null)}><X size={22} /></button>
          <div className="lib-lightbox-body" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '640px', width: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Mail color="#c084fc" size={24} />
              <div>
                <h3 style={{ color: 'var(--text-main)', fontSize: '16px', fontWeight: 600 }}>{emailPreview.name}</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>From: {emailPreview.from_sender} • {fmtDate(emailPreview.created_at)}</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
              {emailPreview.snippet}
            </div>
            {emailPreview.web_view_link && (
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <a href={emailPreview.web_view_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                  Open in Gmail <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI Results Modal ── */}
      {aiModal && (
        <div className="lib-lightbox" onClick={() => setAiModal(null)}>
          <button className="lib-lightbox-close" onClick={() => setAiModal(null)}><X size={22} /></button>
          <div className="lib-lightbox-body" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '600px', width: '90%' }}>
            <h3 style={{ color: 'var(--text-main)', marginBottom: '12px' }}>{aiModal.title}</h3>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{aiModal.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
