import React, { useState, useEffect, useRef } from 'react';
import { Palette, Copy, CheckCircle, Image as ImageIcon, Zap, AlertCircle } from 'lucide-react';

export default function ClientColorWidget({ meta }) {
  const [extractedColors, setExtractedColors] = useState(null);
  const [isProcessing, setIsProcessing] = useState(meta.action === 'extract_image_colors');
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (meta.action === 'extract_image_colors' && meta.image) {
      extractColorsFromImage(meta.image);
    }
  }, [meta]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const extractColorsFromImage = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        // Scale down for faster processing
        const scale = Math.min(100 / img.width, 100 / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height).data;
        const colorCounts = {};

        // Simple quantization and counting
        for (let i = 0; i < imageData.length; i += 16) { // step by 4 pixels to be fast
          const r = Math.round(imageData[i] / 16) * 16;
          const g = Math.round(imageData[i + 1] / 16) * 16;
          const b = Math.round(imageData[i + 2] / 16) * 16;
          const rgb = `${r},${g},${b}`;
          colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;
        }

        const sortedColors = Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5) // Get top 5 dominant colors
          .map(entry => {
             const [r, g, b] = entry[0].split(',');
             return rgbToHex(Number(r), Number(g), Number(b));
          });

        setExtractedColors(sortedColors);
        setIsProcessing(false);
      } catch (err) {
        console.error("Color extraction error:", err);
        setError("Failed to extract colors. Could not read image data.");
        setIsProcessing(false);
      }
    };
    img.onerror = () => {
      setError("Failed to load image for color extraction.");
      setIsProcessing(false);
    };
    img.src = imageUrl;
  };

  const rgbToHex = (r, g, b) => {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
  };

  const renderSwatch = (hex, label) => (
    <div key={hex} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
      <div 
        style={{ 
          width: '50px', height: '50px', borderRadius: '8px', 
          backgroundColor: hex,
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}
        onClick={() => handleCopy(hex, hex)}
        title="Click to copy HEX"
      >
        {copiedId === hex && <CheckCircle size={16} color={getContrastYIQ(hex) === 'dark' ? '#000' : '#fff'} />}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{label || hex}</div>
    </div>
  );

  const getContrastYIQ = (hexcolor) => {
    let hex = hexcolor.replace("#", "");
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'dark' : 'light';
  };

  if (isProcessing) {
    return (
      <div className="compression-card" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <Palette size={16} className="spin" /> <span>Extracting colors...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="compression-card" style={{ color: '#ef4444', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <AlertCircle size={16} /> <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="compression-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#3b82f6' }}>
        <Palette size={18} />
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
          Color Toolkit Result
        </span>
      </div>

      {meta.action === 'extract_image_colors' && extractedColors && (
        <div>
          <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Dominant Colors from Image</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {extractedColors.map((hex, i) => renderSwatch(hex, hex))}
          </div>
        </div>
      )}

      {meta.action === 'convert' && meta.color && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
             <div style={{ 
                width: '60px', height: '60px', borderRadius: '50%', backgroundColor: meta.color.hex,
                border: '2px solid rgba(255,255,255,0.2)'
             }} />
             <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '0.85rem' }}>
                <span style={{ color: '#a1a1aa' }}>HEX:</span> 
                <span style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => handleCopy(meta.color.hex, 'hex')}>
                  {meta.color.hex} {copiedId === 'hex' && <CheckCircle size={12} color="#4ade80" style={{ display: 'inline' }} />}
                </span>
                <span style={{ color: '#a1a1aa' }}>RGB:</span> 
                <span style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => handleCopy(meta.color.rgb, 'rgb')}>
                  {meta.color.rgb} {copiedId === 'rgb' && <CheckCircle size={12} color="#4ade80" style={{ display: 'inline' }} />}
                </span>
                <span style={{ color: '#a1a1aa' }}>HSL:</span> 
                <span style={{ cursor: 'pointer', fontFamily: 'monospace' }} onClick={() => handleCopy(meta.color.hsl, 'hsl')}>
                  {meta.color.hsl} {copiedId === 'hsl' && <CheckCircle size={12} color="#4ade80" style={{ display: 'inline' }} />}
                </span>
             </div>
          </div>
          
          <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginTop: '4px' }}>Color Schemes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span style={{ fontSize: '0.75rem', width: '90px' }}>Complementary</span>
               {meta.schemes.complementary.map((hex, i) => renderSwatch(hex, ''))}
             </div>
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span style={{ fontSize: '0.75rem', width: '90px' }}>Analogous</span>
               {meta.schemes.analogous.map((hex, i) => renderSwatch(hex, ''))}
             </div>
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <span style={{ fontSize: '0.75rem', width: '90px' }}>Triadic</span>
               {meta.schemes.triadic.map((hex, i) => renderSwatch(hex, ''))}
             </div>
          </div>
        </div>
      )}

      {meta.action === 'generate_palette' && meta.palette && (
        <div>
          <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Generated Palette (Base: {meta.baseColor})</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {meta.palette.map((hex, i) => renderSwatch(hex, hex))}
          </div>
        </div>
      )}

      {meta.action === 'generate_gradient' && meta.gradient && (
        <div>
          <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '8px' }}>Gradient Preview</div>
          <div style={{ 
            height: '40px', 
            borderRadius: '8px', 
            background: `linear-gradient(to right, ${meta.gradient.join(', ')})`,
            marginBottom: '12px',
            border: '1px solid rgba(255,255,255,0.1)'
          }} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {meta.gradient.map((hex, i) => renderSwatch(hex, ''))}
          </div>
        </div>
      )}

      {meta.action === 'contrast' && meta.contrast && (
        <div>
          <div style={{ fontSize: '0.85rem', color: '#a1a1aa', marginBottom: '12px' }}>WCAG Contrast Check</div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
               <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: meta.contrast.color1, border: '1px solid rgba(255,255,255,0.2)' }} />
               <span style={{ fontSize: '0.75rem' }}>{meta.contrast.color1}</span>
            </div>
            <span style={{ color: '#a1a1aa', fontWeight: 'bold' }}>VS</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
               <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: meta.contrast.color2, border: '1px solid rgba(255,255,255,0.2)' }} />
               <span style={{ fontSize: '0.75rem' }}>{meta.contrast.color2}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Contrast Ratio</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: meta.contrast.ratio >= 4.5 ? '#4ade80' : '#ef4444' }}>{meta.contrast.ratio}:1</span>
             </div>
             <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                   <span style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>Normal Text</span>
                   <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: meta.contrast.wcag_aa_normal ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)', color: meta.contrast.wcag_aa_normal ? '#4ade80' : '#ef4444' }}>
                     {meta.contrast.wcag_aa_normal ? 'PASS' : 'FAIL'}
                   </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                   <span style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>Large Text</span>
                   <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: meta.contrast.wcag_aa_large ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)', color: meta.contrast.wcag_aa_large ? '#4ade80' : '#ef4444' }}>
                     {meta.contrast.wcag_aa_large ? 'PASS' : 'FAIL'}
                   </span>
                </div>
             </div>
          </div>
          
          <div style={{ 
            marginTop: '12px', 
            padding: '16px', 
            borderRadius: '8px', 
            backgroundColor: meta.contrast.color2, 
            color: meta.contrast.color1,
            textAlign: 'center',
            fontSize: '1rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            Sample Text (Preview)
          </div>
        </div>
      )}

    </div>
  );
}
