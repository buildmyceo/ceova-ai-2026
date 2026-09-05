import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, RotateCcw, Monitor, Tablet, Smartphone, ExternalLink, ShieldCheck, ChevronDown, Check } from 'lucide-react';
import { supabase } from '../services/supabase';

/**
 * WebsitePreviewModal
 * 
 * Secure, in-app sandbox preview for cloud websites created by CEOVA.
 * Renders on-demand in-memory inside an isolated iframe, eliminating 24/7
 * server hosting and bandwidth costs while offering responsive device testing.
 */
export default function WebsitePreviewModal({ project, onClose }) {
  const [deviceMode, setDeviceMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePage, setActivePage] = useState('index.html');
  const [reloadKey, setReloadKey] = useState(0);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const iframeRef = useRef(null);

  const initialProjectId = project?.id || project?.project_id || project?.projectId;
  const projectSlug = project?.slug;
  const projectName = project?.name || project?.metadata?.name || 'Website Preview';

  // Load project files from Supabase
  useEffect(() => {
    let isMounted = true;

    async function fetchFiles() {
      let targetId = initialProjectId;

      if (!targetId && projectSlug) {
        try {
          const { data: projData } = await supabase
            .from('projects')
            .select('id, name')
            .eq('slug', projectSlug)
            .maybeSingle();
          if (projData?.id) {
            targetId = projData.id;
          }
        } catch (slugErr) {
          console.error('[WebsitePreviewModal] Error resolving slug:', slugErr);
        }
      }

      if (!targetId) {
        setLoading(false);
        setError('Project ID or slug not found.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchErr } = await supabase
          .from('project_files')
          .select('path, content')
          .eq('project_id', targetId);

        if (fetchErr) throw fetchErr;

        if (isMounted) {
          const fileList = data || [];
          setFiles(fileList);

          // Find initial entry page
          const hasIndex = fileList.some((f) => f.path === 'index.html');
          if (hasIndex) {
            setActivePage('index.html');
          } else if (fileList.length > 0) {
            const firstHtml = fileList.find((f) => f.path.endsWith('.html'));
            setActivePage(firstHtml ? firstHtml.path : fileList[0].path);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('[WebsitePreviewModal] Failed to load project files:', err);
          setError(err.message || 'Failed to load project preview.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchFiles();

    return () => {
      isMounted = false;
    };
  }, [initialProjectId, projectSlug]);

  // Extract all HTML pages for navigation switcher
  const htmlPages = useMemo(() => {
    return files
      .filter((f) => f.path.endsWith('.html'))
      .map((f) => {
        const cleanName = f.path
          .replace('.html', '')
          .replace(/[-_]/g, ' ')
          .replace(/^\w/, (c) => c.toUpperCase());
        return {
          path: f.path,
          label: f.path === 'index.html' ? 'Home' : cleanName,
        };
      });
  }, [files]);

  // Construct complete in-memory HTML document with styles and navigation interceptor
  const assembledHtml = useMemo(() => {
    const currentFile = files.find((f) => f.path === activePage) || files.find((f) => f.path === 'index.html');
    if (!currentFile) return '';

    let content = currentFile.content;

    // Collect all CSS files
    const cssFiles = files.filter((f) => f.path.endsWith('.css'));
    let inlineStyles = '';
    cssFiles.forEach((css) => {
      inlineStyles += `\n/* ${css.path} */\n${css.content}\n`;
    });

    // Collect all SVG or images if stored as data or files
    // Inject styles before </head> if present
    if (inlineStyles && content.includes('</head>')) {
      content = content.replace('</head>', `<style>${inlineStyles}</style>\n</head>`);
    } else if (inlineStyles) {
      content = `<style>${inlineStyles}</style>\n` + content;
    }

    // Client-side link interceptor to seamlessly navigate pages inside this modal
    const interceptorScript = `
<script>
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a');
    if (!target) return;
    var href = target.getAttribute('href');
    if (!href) return;
    
    // Check if it links to an internal html page
    var cleanHref = href.split('?')[0].split('#')[0];
    if (cleanHref.endsWith('.html') || (!cleanHref.startsWith('http') && !cleanHref.startsWith('mailto:') && !cleanHref.startsWith('tel:') && !cleanHref.startsWith('#'))) {
      var targetPage = cleanHref.endsWith('.html') ? cleanHref : (cleanHref + '.html');
      if (cleanHref === '/' || cleanHref === '') targetPage = 'index.html';
      e.preventDefault();
      window.parent.postMessage({ type: 'CEOVA_PREVIEW_NAVIGATE', page: targetPage }, '*');
    }
  });
</script>
`;

    if (content.includes('</body>')) {
      content = content.replace('</body>', `${interceptorScript}\n</body>`);
    } else {
      content += interceptorScript;
    }

    return content;
  }, [files, activePage]);

  // Listen to navigation events from inside iframe
  useEffect(() => {
    function handleMessage(event) {
      if (event.data && event.data.type === 'CEOVA_PREVIEW_NAVIGATE') {
        const targetPage = event.data.page;
        const exists = files.some((f) => f.path === targetPage || f.path === targetPage.replace(/^\//, ''));
        if (exists) {
          setActivePage(targetPage.replace(/^\//, ''));
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Dimensions based on deviceMode
  const viewportWidth = useMemo(() => {
    if (deviceMode === 'mobile') return '380px';
    if (deviceMode === 'tablet') return '768px';
    return '100%';
  }, [deviceMode]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(5, 5, 10, 0.85)',
        backdropFilter: 'blur(16px)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ─── Top Control Bar ─── */}
      <header
        style={{
          height: '60px',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'rgba(18, 18, 24, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          color: '#fafafa',
          zIndex: 10,
        }}
      >
        {/* Left: Project Branding & In-App Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c5cfc 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            {projectName.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fafafa', lineHeight: 1.2 }}>
              {projectName}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                color: '#10b981',
                fontWeight: 500,
              }}
            >
              <ShieldCheck size={12} /> In-App Sandbox Preview • Private
            </span>
          </div>

          {/* Page Switcher Dropdown (if multi-page) */}
          {htmlPages.length > 1 && (
            <div style={{ position: 'relative', marginLeft: '12px' }}>
              <button
                type="button"
                onClick={() => setShowPageDropdown((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e4e4e7',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Page: {htmlPages.find((p) => p.path === activePage)?.label || activePage}</span>
                <ChevronDown size={14} />
              </button>

              {showPageDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    width: '180px',
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '6px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    zIndex: 100,
                  }}
                >
                  {htmlPages.map((page) => (
                    <button
                      key={page.path}
                      type="button"
                      onClick={() => {
                        setActivePage(page.path);
                        setShowPageDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: activePage === page.path ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: activePage === page.path ? '#a5b4fc' : '#d4d4d8',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>{page.label}</span>
                      {activePage === page.path && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center: Device Viewport Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '3px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            title="Desktop View (100%)"
            onClick={() => setDeviceMode('desktop')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '7px',
              border: 'none',
              background: deviceMode === 'desktop' ? '#27272a' : 'transparent',
              color: deviceMode === 'desktop' ? '#fafafa' : '#a1a1aa',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Monitor size={15} />
            <span>Desktop</span>
          </button>

          <button
            type="button"
            title="Tablet View (768px)"
            onClick={() => setDeviceMode('tablet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '7px',
              border: 'none',
              background: deviceMode === 'tablet' ? '#27272a' : 'transparent',
              color: deviceMode === 'tablet' ? '#fafafa' : '#a1a1aa',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Tablet size={15} />
            <span>Tablet</span>
          </button>

          <button
            type="button"
            title="Mobile View (380px)"
            onClick={() => setDeviceMode('mobile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '7px',
              border: 'none',
              background: deviceMode === 'mobile' ? '#27272a' : 'transparent',
              color: deviceMode === 'mobile' ? '#fafafa' : '#a1a1aa',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Smartphone size={15} />
            <span>Mobile</span>
          </button>
        </div>

        {/* Right: Refresh & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            title="Reload Preview"
            onClick={() => setReloadKey((k) => k + 1)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#d4d4d8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#d4d4d8';
            }}
          >
            <RotateCcw size={16} />
          </button>

          <button
            type="button"
            title="Close Preview (Esc)"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: '#d4d4d8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = '#d4d4d8';
            }}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ─── Preview Stage Area ─── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: deviceMode === 'desktop' ? '0' : '24px',
          overflow: 'hidden',
          position: 'relative',
          background: '#09090b',
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              color: '#a1a1aa',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '3px solid rgba(124, 92, 252, 0.2)',
                borderTopColor: '#7c5cfc',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: '0.9rem' }}>Loading website preview in sandbox…</span>
          </div>
        ) : error ? (
          <div
            style={{
              maxWidth: '420px',
              textAlign: 'center',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '14px',
              padding: '24px',
              color: '#f87171',
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: '6px' }}>Unable to load preview</p>
            <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>{error}</p>
          </div>
        ) : (
          <div
            style={{
              width: viewportWidth,
              height: deviceMode === 'desktop' ? '100%' : '94%',
              maxHeight: deviceMode === 'desktop' ? '100%' : '840px',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: deviceMode === 'desktop' ? '0' : '20px',
              boxShadow: deviceMode === 'desktop' ? 'none' : '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            {/* Simulated Device Top Bar for Tablet & Mobile */}
            {deviceMode !== 'desktop' && (
              <div
                style={{
                  height: '28px',
                  background: '#18181b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottom: '1px solid #27272a',
                }}
              >
                <div
                  style={{
                    width: deviceMode === 'mobile' ? '50px' : '80px',
                    height: '4px',
                    borderRadius: '2px',
                    background: '#3f3f46',
                  }}
                />
              </div>
            )}

            <iframe
              key={`${activePage}-${reloadKey}`}
              ref={iframeRef}
              srcDoc={assembledHtml}
              title={projectName}
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#ffffff',
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
