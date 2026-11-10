import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_IMAGE_STAGES = [
  'Sketching it out',
  'Making the first draft',
  'Adding the details',
  'Polishing the image'
];

const INPAINT_STAGES = [
  'Locating object...',
  'Sketching background...',
  'Blending edges...',
  'Polishing the image'
];

const EDIT_STAGES = [
  'Inspecting image...',
  'Making the changes...',
  'Adding the details...',
  'Polishing the image'
];

const POSTER_STAGES = [
  'Drafting layout...',
  'Adding typography...',
  'Applying visual styling...',
  'Final touches...'
];

const QR_STAGES = [
  'Encoding data...',
  'Drafting QR matrix...',
  'Generating pattern...',
  'Polishing the QR code...'
];

const BARCODE_STAGES = [
  'Scanning image...',
  'Detecting barcode format...',
  'Decoding matrix data...',
  'Extracting payload...'
];

/**
 * GenerativePreviewCard
 * 
 * Recreates the OpenAI / ChatGPT DALL-E style generative dot-matrix preview canvas
 * with an animated diagonal lighting wave and cycling status stages.
 * 
 * @param {string} type - 'image' | 'qr' | 'barcode'
 * @param {string} statusText - Optional initial or live status text from backend
 * @param {boolean} isFinishing - True when output is received and browser is loading bytes
 * @param {object} style - Custom inline styles
 * @param {string} className - Additional CSS class name
 */
export default function GenerativePreviewCard({
  type = 'image',
  statusText = '',
  isFinishing = false,
  style = {},
  className = ''
}) {
  const canvasRef = useRef(null);

  // Determine stage set based on type and statusText
  const stages = useMemo(() => {
    if (type === 'barcode' || /scan|barcode/i.test(statusText)) {
      return BARCODE_STAGES;
    }
    if (type === 'qr' || /qr/i.test(statusText)) {
      return QR_STAGES;
    }
    const lc = (statusText || '').toLowerCase();
    if (lc.includes('remove') || lc.includes('inpaint')) {
      return INPAINT_STAGES;
    }
    if (lc.includes('edit')) {
      return EDIT_STAGES;
    }
    if (lc.includes('poster') || lc.includes('flyer') || lc.includes('banner')) {
      return POSTER_STAGES;
    }
    return DEFAULT_IMAGE_STAGES;
  }, [type, statusText]);

  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Auto-advance stages if statusText doesn't change
  useEffect(() => {
    if (isFinishing) {
      setCurrentStageIdx(stages.length - 1);
      return;
    }

    startTimeRef.current = Date.now();
    setCurrentStageIdx(0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      // 0-3.2s: Stage 0, 3.2-6.8s: Stage 1, 6.8-11s: Stage 2, 11s+: Stage 3
      let nextIdx = 0;
      if (elapsed >= 11000) nextIdx = 3;
      else if (elapsed >= 6800) nextIdx = 2;
      else if (elapsed >= 3200) nextIdx = 1;

      setCurrentStageIdx(Math.min(nextIdx, stages.length - 1));
    }, 400);

    return () => clearInterval(interval);
  }, [stages, isFinishing]);

  // If statusText matches one of our known friendly names or is custom, display it
  const displayText = useMemo(() => {
    if (isFinishing) {
      return stages[stages.length - 1];
    }
    // Clean trailing punctuation or ellipses if backend sent them
    const cleanStatus = (statusText || '').replace(/[….]+$/, '').trim();
    if (cleanStatus && cleanStatus.length > 3 && !/generating image|processing|thinking/i.test(cleanStatus)) {
      return cleanStatus;
    }
    return stages[currentStageIdx] || stages[0];
  }, [isFinishing, statusText, stages, currentStageIdx]);

  // Dot Matrix Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      ctx.scale(dpr, dpr);
    };

    updateSize();

    // Responsive matrix grid configuration
    const numCols = 13;
    const numRows = 16;
    const startTime = performance.now();

    const render = (now) => {
      if (width === 0 || height === 0) {
        updateSize();
      }

      ctx.clearRect(0, 0, width, height);

      // Inner padding
      const padX = 14;
      const padY = 12;
      const availWidth = width - padX * 2;
      const availHeight = height - padY * 2;

      const colSpacing = availWidth / (numCols - 1);
      const rowSpacing = availHeight / (numRows - 1);

      const elapsed = (now - startTime) / 1000;
      // Wave takes ~3.6s to cycle across diagonally
      const waveCycle = isFinishing ? 2.4 : 3.6;
      const waveProgress = (elapsed % waveCycle) / waveCycle;
      // Sweeps wave center diagonally from -0.35 to 1.55
      const waveCenter = waveProgress * 1.9 - 0.35;
      const waveWidth = 0.32;

      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          const x = padX + c * colSpacing;
          const y = padY + r * rowSpacing;

          const u = c / (numCols - 1);
          const v = r / (numRows - 1);
          // Diagonal wave slope matches the uploaded screenshots
          const diag = u * 0.65 + v * 0.75;

          const diff = Math.abs(diag - waveCenter);
          let glow = 0;
          if (diff < waveWidth) {
            glow = Math.cos((diff / waveWidth) * (Math.PI / 2));
            glow = Math.pow(Math.max(0, glow), 1.8);
          }

          // Subtle organic background breathing
          const ambient = 0.02 * Math.sin(u * 3 + v * 3 + elapsed * 1.8);

          // Dot radius: base 1.5px, expanding up to 3.0px during wave peak
          const radius = Math.max(1.2, 1.5 + glow * 1.5);
          // Dot alpha: base ~0.14, lit up to 0.96
          const alpha = Math.min(1.0, Math.max(0.08, 0.14 + glow * 0.82 + ambient));

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [isFinishing]);

  return (
    <div
      className={`generative-preview-card ${className}`}
      style={{
        ...style
      }}
    >
      <div className="generative-preview-header">
        <AnimatePresence mode="wait">
          <motion.span
            key={displayText}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="generative-preview-title"
          >
            {displayText}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="generative-preview-canvas-wrapper">
        <canvas ref={canvasRef} className="generative-preview-canvas" />
      </div>
    </div>
  );
}

