import React, { useState, useEffect } from 'react';
import { Loader, Download, CheckCircle, AlertTriangle, Scan, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { BrowserMultiFormatReader } from '@zxing/library';
import { PDFDocument } from 'pdf-lib';

// Map ZXing BarcodeFormat enum values to readable names if needed, though they are usually numeric.
const formatNames = {
  0: 'Aztec', 1: 'Codabar', 2: 'Code 39', 3: 'Code 93', 4: 'Code 128', 5: 'Data Matrix',
  6: 'EAN-8', 7: 'EAN-13', 8: 'ITF', 9: 'MaxiCode', 10: 'PDF417', 11: 'QR Code',
  12: 'RSS 14', 13: 'RSS Expanded', 14: 'UPC-A', 15: 'UPC-E', 16: 'UPC/EAN Extension'
};

export default function ClientQRBarcodeWidget({ meta }) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [resultData, setResultData] = useState(null); // { type: 'image' | 'text', url?: string, text?: string, filename?: string, format?: string }
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function processRequest() {
      try {
        const { operation } = meta;

        if (operation === 'generate_qr') {
          const { data_type, content, export_format = 'png' } = meta;
          
          if (!content) throw new Error("No content provided to generate QR Code.");
          
          let finalDataUrl = '';
          let finalMime = '';
          let finalExt = export_format;

          if (export_format === 'svg') {
            const svgString = await QRCode.toString(content, { type: 'svg', margin: 2, scale: 8, color: { dark: '#000000', light: '#FFFFFF' } });
            finalDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
            finalMime = 'image/svg+xml';
          } else if (export_format === 'pdf') {
            const pngDataUrl = await QRCode.toDataURL(content, { margin: 2, scale: 8, color: { dark: '#000000', light: '#FFFFFF' } });
            
            const pdfDoc = await PDFDocument.create();
            const pngImage = await pdfDoc.embedPng(pngDataUrl);
            const pngDims = pngImage.scale(1);
            
            const page = pdfDoc.addPage([pngDims.width + 100, pngDims.height + 100]);
            page.drawImage(pngImage, {
              x: 50,
              y: 50,
              width: pngDims.width,
              height: pngDims.height,
            });
            
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            finalDataUrl = URL.createObjectURL(blob);
            finalMime = 'application/pdf';
          } else {
            // default to png
            finalDataUrl = await QRCode.toDataURL(content, { margin: 2, scale: 8, color: { dark: '#000000', light: '#FFFFFF' } });
            finalMime = 'image/png';
            finalExt = 'png';
          }

          if (!active) return;

          setResultData({
            type: 'image',
            url: finalDataUrl,
            filename: `qrcode_${data_type || 'custom'}.${finalExt}`,
            mime: finalMime
          });
          setIsProcessing(false);

        } else if (operation === 'scan_barcode') {
          const { files } = meta;
          if (!files || files.length === 0) throw new Error("No image provided for scanning.");
          
          const file = files[0];
          let imageUrl = file.url;

          if (!imageUrl && file.content) {
            imageUrl = file.content;
          }

          if (!imageUrl) {
            throw new Error("Could not load image source.");
          }

          const reader = new BrowserMultiFormatReader();
          
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error("Failed to load image for scanning."));
            img.src = imageUrl;
          });

          const result = await reader.decodeFromImageElement(img);
          
          if (!active) return;

          setResultData({
            type: 'text',
            text: result.getText(),
            format: formatNames[result.getBarcodeFormat()] || `Format ${result.getBarcodeFormat()}`
          });
          setIsProcessing(false);
        } else {
          throw new Error("Unknown operation: " + operation);
        }
      } catch (err) {
        if (!active) return;
        console.error("QR/Barcode error:", err);
        setError(err.message || "Failed to process request.");
        setIsProcessing(false);
      }
    }

    processRequest();
    return () => { active = false; };
  }, [JSON.stringify(meta)]);

  const handleCopy = () => {
    if (resultData && resultData.text) {
      navigator.clipboard.writeText(resultData.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isProcessing) {
    return (
      <div className="compression-card" style={{ justifyContent: 'center', opacity: 0.8 }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '0.9rem' }}>
            <Loader size={16} className="animate-spin" /> {meta.operation === 'scan_barcode' ? 'Scanning image...' : 'Generating code...'}
         </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="compression-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
        </div>
      </div>
    );
  }

  return (
      <div className="compression-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
              <CheckCircle size={16} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  {meta.operation === 'scan_barcode' ? 'Scan Complete' : 'QR Code Ready'}
              </span>
          </div>
          
          {resultData?.type === 'image' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '10px', display: 'inline-block' }}>
                     {resultData.mime.includes('image/') ? (
                         <img src={resultData.url} alt="QR Code" style={{ maxWidth: '200px', height: 'auto', display: 'block' }} />
                     ) : (
                         <div style={{ padding: '20px', color: 'black', fontWeight: 'bold' }}>PDF Ready</div>
                     )}
                  </div>
                  
                  <a href={resultData.url} download={resultData.filename} style={{ background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
                      <Download size={16} /> Download {resultData.filename.split('.').pop().toUpperCase()}
                  </a>
              </div>
          )}

          {resultData?.type === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Scan size={14} /> Detected Format: {resultData.format}
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.95rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {resultData.text}
                  </div>
                  <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                      {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy Result'}
                  </button>
              </div>
          )}
      </div>
  );
}
