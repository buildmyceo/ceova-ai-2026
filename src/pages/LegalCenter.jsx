import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { marked } from 'marked';
import { ArrowLeft, Printer, Download, Share2, Menu, X, ShieldCheck } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import '../App.css';

// Load all markdown files as raw strings
const markdownFiles = import.meta.glob('../content/legal/*.md', { query: '?raw', import: 'default', eager: true });

const documentList = [
    { id: 'privacy-policy', title: 'Privacy Policy' },
    { id: 'terms-conditions', title: 'Terms & Conditions' },
    { id: 'refund-cancellation', title: 'Refund & Cancellation' },
    { id: 'cookie-policy', title: 'Cookie Policy' },
    { id: 'acceptable-use', title: 'Acceptable Use Policy' },
    { id: 'ai-usage-disclaimer', title: 'AI Usage & Disclaimer' },
    { id: 'data-retention', title: 'Data Retention' },
    { id: 'security-policy', title: 'Security Policy' },
    { id: 'copyright-ip', title: 'Copyright & IP' },
    { id: 'third-party-services', title: 'Third-Party Services' },
    { id: 'childrens-privacy', title: "Children's Privacy" },
    { id: 'community-guidelines', title: 'Community Guidelines' },
    { id: 'contact-support', title: 'Contact & Support' }
];

export default function LegalCenter() {
    const { docId } = useParams();
    const navigate = useNavigate();
    const contentRef = useRef(null);
    
    const [content, setContent] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

    // Default to privacy policy if no docId or invalid docId
    const currentDocId = documentList.find(d => d.id === docId) ? docId : 'privacy-policy';

    useEffect(() => {
        const filePath = `../content/legal/${currentDocId}.md`;
        if (markdownFiles[filePath]) {
            const rawMarkdown = markdownFiles[filePath];
            setContent(marked(rawMarkdown));
        } else {
            setContent('<h1>Document Not Found</h1><p>The requested legal document could not be found.</p>');
        }
        
        // On mobile, close sidebar when a document is selected
        if (window.innerWidth <= 768) {
            setIsSidebarOpen(false);
        }
        // Scroll to top
        window.scrollTo(0,0);
    }, [currentDocId]);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        if (!contentRef.current) return;
        const opt = {
            margin: 15,
            filename: `CEOVA_${currentDocId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(contentRef.current).save();
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `CEOVA - ${documentList.find(d => d.id === currentDocId)?.title}`,
                    url: url
                });
            } catch (err) {
                console.error('Error sharing', err);
            }
        } else {
            navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        }
    };

    return (
        <div className="legal-center-layout">
            
            {/* Mobile Header */}
            <div className="legal-mobile-header">
                <button className="legal-icon-btn" onClick={() => setIsSidebarOpen(true)}>
                    <Menu size={24} />
                </button>
                <div className="legal-brand">
                    <ShieldCheck size={20} className="brand-icon" />
                    <span>CEOVA Legal</span>
                </div>
                <div style={{width: 24}}></div>
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && window.innerWidth <= 768 && (
                <div className="legal-sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`legal-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="legal-sidebar-header">
                    <Link to="/" className="legal-back-home">
                        <ArrowLeft size={16} /> Back to App
                    </Link>
                    {window.innerWidth <= 768 && (
                        <button className="legal-icon-btn" onClick={() => setIsSidebarOpen(false)}>
                            <X size={24} />
                        </button>
                    )}
                </div>
                
                <div className="legal-brand-container">
                    <ShieldCheck size={28} className="brand-icon" />
                    <h2>Legal Center</h2>
                    <p>Official Policies & Terms</p>
                </div>

                <nav className="legal-nav-list">
                    {documentList.map(doc => (
                        <Link 
                            key={doc.id}
                            to={`/legal/${doc.id}`}
                            className={`legal-nav-item ${currentDocId === doc.id ? 'active' : ''}`}
                        >
                            {doc.title}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Main Content Pane */}
            <main className="legal-main-content">
                <div className="legal-toolbar">
                    <div className="legal-toolbar-spacer"></div>
                    <div className="legal-actions">
                        <button className="legal-action-btn" onClick={handleShare} title="Share Link">
                            <Share2 size={16} /> <span className="action-label">Share</span>
                        </button>
                        <button className="legal-action-btn" onClick={handlePrint} title="Print Document">
                            <Printer size={16} /> <span className="action-label">Print</span>
                        </button>
                        <button className="legal-action-btn primary" onClick={handleDownloadPDF} title="Download as PDF">
                            <Download size={16} /> <span className="action-label">PDF</span>
                        </button>
                    </div>
                </div>

                <div className="legal-document-container" ref={contentRef}>
                    <div 
                        className="markdown-body ceova-legal-prose"
                        dangerouslySetInnerHTML={{ __html: content }} 
                    />
                </div>

                <footer className="legal-footer">
                    <p>&copy; {new Date().getFullYear()} CEOVA AI. All rights reserved.</p>
                    <p>Contact: contact@ceova.online and ceova.ai@gmail.com | https://ceova.online</p>
                </footer>
            </main>

            <style jsx="true">{`
                .legal-center-layout {
                    display: flex;
                    height: 100vh;
                    background: #09090b;
                    color: #e4e4e7;
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                }

                .legal-mobile-header {
                    display: none;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: #18181b;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    position: fixed;
                    top: 0; left: 0; right: 0;
                    z-index: 40;
                }

                .legal-brand {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                .brand-icon {
                    color: #3b82f6;
                }

                .legal-sidebar {
                    width: 280px;
                    background: #121214;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    flex-shrink: 0;
                    z-index: 50;
                    transition: transform 0.3s ease;
                }

                .legal-sidebar-header {
                    padding: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .legal-back-home {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #a1a1aa;
                    text-decoration: none;
                    font-size: 0.9rem;
                    transition: color 0.2s;
                }
                .legal-back-home:hover {
                    color: #fff;
                }

                .legal-brand-container {
                    padding: 0 24px 24px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    margin-bottom: 16px;
                }
                .legal-brand-container h2 {
                    margin: 12px 0 4px;
                    font-size: 1.25rem;
                    color: #fff;
                }
                .legal-brand-container p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: #71717a;
                }

                .legal-nav-list {
                    display: flex;
                    flex-direction: column;
                    padding: 0 12px 24px;
                    gap: 4px;
                }

                .legal-nav-item {
                    padding: 10px 12px;
                    border-radius: 8px;
                    color: #a1a1aa;
                    text-decoration: none;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                }
                .legal-nav-item:hover {
                    background: rgba(255,255,255,0.05);
                    color: #e4e4e7;
                }
                .legal-nav-item.active {
                    background: #3b82f6;
                    color: #fff;
                    font-weight: 500;
                }

                .legal-main-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    background: #09090b;
                    position: relative;
                }

                .legal-toolbar {
                    position: sticky;
                    top: 0;
                    display: flex;
                    justify-content: space-between;
                    padding: 16px 32px;
                    background: rgba(9, 9, 11, 0.85);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    z-index: 10;
                }

                .legal-actions {
                    display: flex;
                    gap: 12px;
                }

                .legal-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #e4e4e7;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .legal-action-btn:hover {
                    background: rgba(255,255,255,0.1);
                }
                .legal-action-btn.primary {
                    background: #3b82f6;
                    border-color: #3b82f6;
                    color: #fff;
                }
                .legal-action-btn.primary:hover {
                    background: #2563eb;
                }
                
                .legal-icon-btn {
                    background: none;
                    border: none;
                    color: #e4e4e7;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }

                .legal-document-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 48px 32px;
                    width: 100%;
                }

                .ceova-legal-prose {
                    color: #d4d4d8;
                    line-height: 1.7;
                    font-size: 1.05rem;
                }
                .ceova-legal-prose h1 {
                    font-size: 2.5rem;
                    color: #fff;
                    margin-bottom: 16px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                }
                .ceova-legal-prose h2 {
                    font-size: 1.5rem;
                    color: #fff;
                    margin: 40px 0 16px;
                    font-weight: 600;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    padding-bottom: 8px;
                }
                .ceova-legal-prose h3 {
                    font-size: 1.2rem;
                    color: #e4e4e7;
                    margin: 24px 0 12px;
                }
                .ceova-legal-prose p {
                    margin-bottom: 16px;
                }
                .ceova-legal-prose ul {
                    margin-bottom: 24px;
                    padding-left: 24px;
                }
                .ceova-legal-prose li {
                    margin-bottom: 8px;
                }
                .ceova-legal-prose strong {
                    color: #fff;
                    font-weight: 600;
                }

                .legal-footer {
                    margin-top: auto;
                    padding: 40px 32px;
                    text-align: center;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    color: #71717a;
                    font-size: 0.85rem;
                }
                .legal-footer p {
                    margin: 4px 0;
                }

                /* Mobile Responsiveness */
                @media (max-width: 768px) {
                    .legal-mobile-header {
                        display: flex;
                    }
                    .legal-center-layout {
                        flex-direction: column;
                    }
                    .legal-sidebar {
                        position: fixed;
                        top: 0; left: 0; bottom: 0;
                        transform: translateX(-100%);
                        width: 280px;
                    }
                    .legal-sidebar.open {
                        transform: translateX(0);
                    }
                    .legal-sidebar-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 40;
                    }
                    .legal-main-content {
                        margin-top: 57px; /* height of mobile header */
                    }
                    .legal-toolbar {
                        padding: 12px 16px;
                    }
                    .action-label {
                        display: none;
                    }
                    .legal-action-btn {
                        padding: 8px 12px;
                    }
                    .legal-document-container {
                        padding: 24px 16px;
                    }
                    .ceova-legal-prose h1 {
                        font-size: 2rem;
                    }
                }
                
                /* Print specific styling */
                @media print {
                    .legal-sidebar, .legal-toolbar, .legal-mobile-header, .legal-footer {
                        display: none !important;
                    }
                    .legal-main-content {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        color: black !important;
                    }
                    .ceova-legal-prose {
                        color: black !important;
                    }
                    .ceova-legal-prose h1, .ceova-legal-prose h2, .ceova-legal-prose h3, .ceova-legal-prose strong {
                        color: black !important;
                    }
                    .ceova-legal-prose h2 {
                        border-bottom: 1px solid #ddd !important;
                    }
                }
            `}</style>
        </div>
    );
}
