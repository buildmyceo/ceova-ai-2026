import React, { useState, useEffect, useRef } from 'react';
import { Film, Play, Download, Loader2, AlertCircle } from 'lucide-react';

export default function ClientMediaConverterWidget({ meta }) {
  const { fileUrl, filename, ffmpegArgs, outputFilename, action } = meta?.mediaData || {};

  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  
  const ffmpegRef = useRef(null);
  const FFmpegUtilRef = useRef(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        // Dynamically import from esm.sh to avoid bundler issues
        const FFmpegModule = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.7');
        const FFmpegUtil = await import('https://esm.sh/@ffmpeg/util@0.12.1');
        
        FFmpegUtilRef.current = FFmpegUtil;
        const ffmpeg = new FFmpegModule.FFmpeg();
        ffmpegRef.current = ffmpeg;

        ffmpeg.on('progress', ({ progress }) => {
          // progress is a ratio from 0 to 1
          setProgress(Math.round(progress * 100));
        });

        // Load single-thread core to avoid SharedArrayBuffer issues on standard servers
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/esm';
        await ffmpeg.load({
          coreURL: await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        
        setReady(true);
      } catch (err) {
        console.error("FFmpeg load error:", err);
        setError("Failed to load processing engine. Your browser might not support WebAssembly.");
      }
    };

    if (!ready && !error) {
      loadFFmpeg();
    }
  }, [ready, error]);

  const handleProcess = async () => {
    if (!ready || !ffmpegRef.current || !FFmpegUtilRef.current) return;
    setProcessing(true);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);

    const ffmpeg = ffmpegRef.current;
    const { fetchFile } = FFmpegUtilRef.current;

    try {
      // 1. Fetch file and write to FFmpeg FS
      const fileData = await fetchFile(fileUrl);
      await ffmpeg.writeFile('input_file', fileData);

      // 2. Execute command
      await ffmpeg.exec(ffmpegArgs);

      // 3. Read output
      const data = await ffmpeg.readFile(outputFilename);
      
      // 4. Create Download URL
      // Determine mime type based on extension
      const ext = outputFilename.split('.').pop().toLowerCase();
      let mime = 'application/octet-stream';
      if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) mime = `video/${ext === 'mov' ? 'quicktime' : ext}`;
      if (['mp3', 'wav', 'aac', 'ogg'].includes(ext)) mime = `audio/${ext === 'mp3' ? 'mpeg' : ext}`;

      const blob = new Blob([data.buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err) {
      console.error("FFmpeg exec error:", err);
      setError(`Processing failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!fileUrl) return null;

  return (
    <div className="compression-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Film size={20} color="#3b82f6" />
        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6' }}>Media Converter</span>
      </div>

      <div style={{ padding: '24px' }}>
        
        {/* Status Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>
            <strong style={{ color: '#e5e7eb' }}>File:</strong> {filename}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#a1a1aa' }}>
            <strong style={{ color: '#e5e7eb' }}>Action:</strong> {action.replace('_', ' ').toUpperCase()} &rarr; {outputFilename}
          </div>
          
          <div style={{ fontSize: '0.8rem', color: '#6b7280', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
            <code style={{ fontFamily: 'monospace' }}>ffmpeg {ffmpegArgs.join(' ')}</code>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Progress Bar */}
        {processing && (
          <div style={{ marginBottom: '24px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '8px' }}>
               <span>Processing...</span>
               <span>{progress}%</span>
             </div>
             <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
               <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.2s ease' }} />
             </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          {!downloadUrl ? (
            <button
              onClick={handleProcess}
              disabled={!ready || processing}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px', borderRadius: '8px',
                background: ready && !processing ? '#3b82f6' : 'rgba(255,255,255,0.1)', 
                color: '#fff', border: 'none', fontWeight: 600, cursor: ready && !processing ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {!ready ? (
                <><Loader2 size={18} className="animate-spin" /> Loading Engine...</>
              ) : processing ? (
                <><Loader2 size={18} className="animate-spin" /> Processing Media...</>
              ) : (
                <><Play size={18} /> Start Processing</>
              )}
            </button>
          ) : (
            <a
              href={downloadUrl}
              download={outputFilename}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px', borderRadius: '8px',
                background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              <Download size={18} /> Download {outputFilename}
            </a>
          )}
        </div>
        
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', marginTop: '16px' }}>
          Processed entirely in your browser. Files are never uploaded to our servers for conversion.
        </div>
      </div>
    </div>
  );
}
