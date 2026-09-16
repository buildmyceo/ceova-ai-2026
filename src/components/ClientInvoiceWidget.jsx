import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer, Download, Settings2, Image as ImageIcon, X, Check, Eye } from 'lucide-react';
import { invoiceTemplatesList, getInvoiceTemplate } from '../lib/invoiceTemplates';
import html2pdf from 'html2pdf.js';

export default function ClientInvoiceWidget({ meta }) {
  if (!meta || !meta.invoiceData) return null;
  const data = meta.invoiceData;

  const [isConfiguring, setIsConfiguring] = useState(() => {
    return localStorage.getItem(`invoice_configured_${data.invoiceNumber}`) !== 'true';
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    return localStorage.getItem(`invoice_template_${data.invoiceNumber}`) || invoiceTemplatesList[0].id;
  });
  const [customLogoUrl, setCustomLogoUrl] = useState(() => {
    return localStorage.getItem(`invoice_logo_${data.invoiceNumber}`) || data.logoUrl || null;
  });
  const [renderedInvoice, setRenderedInvoice] = useState('');
  const [previewTemplateId, setPreviewTemplateId] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!isConfiguring) {
      setRenderedInvoice(getInvoiceTemplate(selectedTemplateId, data, customLogoUrl));
    }
  }, [isConfiguring, selectedTemplateId, data, customLogoUrl]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomLogoUrl(url);
    }
  };

  const handleSkipAndAutoSelect = () => {
    const randomTemplate = invoiceTemplatesList[Math.floor(Math.random() * invoiceTemplatesList.length)].id;
    setSelectedTemplateId(randomTemplate);
    setCustomLogoUrl(null);
    setIsConfiguring(false);
    localStorage.setItem(`invoice_configured_${data.invoiceNumber}`, 'true');
    localStorage.setItem(`invoice_template_${data.invoiceNumber}`, randomTemplate);
  };

  const handleApplySettings = () => {
    setIsConfiguring(false);
    localStorage.setItem(`invoice_configured_${data.invoiceNumber}`, 'true');
    localStorage.setItem(`invoice_template_${data.invoiceNumber}`, selectedTemplateId);
    if (customLogoUrl) {
      localStorage.setItem(`invoice_logo_${data.invoiceNumber}`, customLogoUrl);
    }
  };

  const handleDownload = async () => {
    if (!iframeRef.current) return;
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      const element = iframeDoc.body;

      const opt = {
        margin:       0,
        filename:     `invoice_${data.invoiceNumber || 'download'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Failed to generate PDF. Please try the Print option instead.");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${data.invoiceNumber}</title>
        </head>
        <body>
          ${renderedInvoice}
          <script>
             window.onload = function() {
                 setTimeout(() => {
                     window.print();
                 }, 500);
             };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isConfiguring) {
    const modalContent = (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', border: '1px solid rgba(255,255,255,0.1)', background: '#121212', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', borderRadius: '16px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          
          <button 
            onClick={handleApplySettings}
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '8px', borderRadius: '50%', transition: 'all 0.2s' }}
            className="hover:bg-white/10 hover:text-white"
          >
            <X size={24} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px', color: '#fff' }}>
            <Settings2 size={28} className="text-gray-300" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Configure Your Invoice</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: '#a1a1aa' }}>Select a beautiful design and customize your branding</p>
            </div>
          </div>
          
          <div style={{ marginBottom: '40px' }}>
            <label style={{ display: 'block', marginBottom: '16px', fontSize: '1.05rem', fontWeight: 500, color: '#e2e8f0' }}>1. Select a Design Template</label>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '24px', paddingBottom: '20px' }} className="template-scroll">
              {invoiceTemplatesList.map(tpl => {
                const previewHtml = getInvoiceTemplate(tpl.id, data, customLogoUrl);
                return (
                  <div 
                    key={tpl.id} 
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    style={{
                      flex: '0 0 auto', cursor: 'pointer', borderRadius: '12px',
                      border: selectedTemplateId === tpl.id ? '3px solid #e5e5e5' : '3px solid transparent',
                      padding: '8px', transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '14px', background: selectedTemplateId === tpl.id ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255,255,255,0.02)',
                      boxShadow: selectedTemplateId === tpl.id ? '0 10px 25px -5px rgba(255, 255, 255, 0.1)' : 'none'
                    }}
                    className="hover:bg-white/5"
                  >
                    <div style={{ width: '160px', height: '226px', borderRadius: '6px', overflow: 'hidden', background: '#fff', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }} className="group">
                       <iframe 
                          srcDoc={previewHtml}
                          style={{ width: '794px', height: '1123px', transform: 'scale(0.201)', transformOrigin: 'top left', border: 'none', pointerEvents: 'none' }}
                          tabIndex="-1"
                          title={tpl.name}
                       />
                       <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, transition: 'background 0.2s' }} className="group-hover:bg-black/20"></div>
                       
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           setPreviewTemplateId(tpl.id);
                         }}
                         style={{
                           position: 'absolute', top: '10px', right: '10px', zIndex: 20,
                           background: 'rgba(20, 20, 20, 0.8)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                           padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                           backdropFilter: 'blur(4px)', transition: 'all 0.2s', opacity: 0.8
                         }}
                         className="hover:bg-gray-700 hover:opacity-100 hover:scale-105 shadow-lg"
                         title="Preview full size"
                       >
                         <Eye size={18} />
                       </button>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 500, color: selectedTemplateId === tpl.id ? '#ffffff' : '#a1a1aa' }}>{tpl.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '40px', background: 'rgba(255, 255, 255, 0.03)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '1.05rem', fontWeight: 500, color: '#e2e8f0' }}>2. Upload Custom Logo <span style={{ color: '#a1a1aa', fontSize: '0.9rem', fontWeight: 400 }}>(Optional)</span></label>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '12px 24px',
              background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px',
              cursor: 'pointer', color: '#f8fafc', fontSize: '0.95rem', transition: 'all 0.2s'
            }} className="hover:bg-white/10 hover:border-white/40">
              <ImageIcon size={20} className={customLogoUrl ? "text-green-400" : "text-gray-400"} /> 
              {customLogoUrl ? 'Change Logo Image' : 'Select Image File'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
            </label>
            {customLogoUrl && (
               <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', display: 'inline-block', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <img src={customLogoUrl} alt="Logo Preview" style={{ maxHeight: '60px', borderRadius: '4px' }} />
               </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
            <button 
              onClick={handleSkipAndAutoSelect}
              style={{ padding: '12px 24px', background: 'transparent', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s' }}
              className="hover:bg-white/10 hover:text-white"
            >
              Skip & Auto-Select
            </button>
            <button 
              onClick={handleApplySettings}
              style={{ padding: '12px 32px', background: '#e5e5e5', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px 0 rgba(255, 255, 255, 0.1)' }}
              className="hover:bg-white hover:shadow-lg transition-all hover:-translate-y-0.5"
            >
              <Check size={20} /> Apply Settings
            </button>
          </div>
        </div>
        
        {previewTemplateId && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.95)', zIndex: 1000000, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button 
                onClick={() => setPreviewTemplateId(null)}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', transition: 'all 0.2s' }}
                className="hover:bg-white/20"
              >
                <X size={20} /> Close Preview
              </button>
            </div>
            <div style={{ width: '100%', maxWidth: '850px', flex: 1, background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
               <iframe 
                 srcDoc={getInvoiceTemplate(previewTemplateId, data, customLogoUrl)}
                 style={{ width: '100%', height: '100%', border: 'none' }}
                 title="Full Size Preview"
               />
            </div>
          </div>
        )}
      </div>
    );

    return (
      <>
        <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#a1a1aa' }}>
          <Settings2 size={24} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Invoice configuration in progress...</p>
        </div>
        {createPortal(modalContent, document.body)}
      </>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '850px', borderRadius: '12px', padding: '0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#121212', margin: '10px 0' }}>
      {/* Widget Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
          <FileText size={18} />
          <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Invoice Ready</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>

          <button 
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}
            className="hover:bg-white/10"
          >
            <Printer size={14} /> Print
          </button>
          <button 
            onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e5e5e5', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            className="hover:bg-white hover:scale-105"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Preview */}
      <div style={{ width: '100%', maxHeight: '500px', overflow: 'auto', background: '#262626', padding: '20px' }} className="custom-scrollbar">
         <div style={{ width: '794px', height: '1123px', margin: '0 auto', background: '#fff', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
             <iframe 
               ref={iframeRef}
               srcDoc={renderedInvoice}
               style={{ width: '100%', height: '100%', border: 'none' }}
               title="Invoice Preview"
             />
         </div>
      </div>
    </div>
  );
}
