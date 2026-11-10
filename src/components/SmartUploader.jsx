import React, { useState } from 'react';
import { processFileSmartly } from '../utils/smartUpload';

export default function SmartUploader() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedFile, setProcessedFile] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    // 🧠 The magic happens here silently!
    const result = await processFileSmartly(file);
    
    setProcessedFile(result);
    setIsProcessing(false);
  };

  const handleUploadToSupabase = async () => {
    if (!processedFile) return;
    // Here you would upload `processedFile.file` to Supabase Storage!
    alert(`Ready to upload: ${processedFile.file.name}\nSize: ${(processedFile.file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log("Uploading optimized file:", processedFile.file.name, processedFile.file.size);
  };

  return (
    <div style={{ padding: '24px', border: '2px dashed #ccc', borderRadius: '12px', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: '400px', margin: '40px auto' }}>
      
      {!processedFile && !isProcessing && (
        <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>Click to upload Image, Video, or Document</span>
          <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
        </label>
      )}

      {isProcessing && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#3b82f6' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <span style={{ fontSize: '14px', fontWeight: '500' }}>Optimizing file securely...</span>
        </div>
      )}

      {processedFile && !isProcessing && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '100%', height: '192px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* Show Image Preview */}
            {processedFile.type === 'image' && processedFile.previewUrl && (
              <img src={processedFile.previewUrl} alt="Preview" style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
            )}
            
            {/* Show Video Preview */}
            {processedFile.type === 'video' && processedFile.previewUrl && (
              <video src={processedFile.previewUrl} controls style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
            )}
            
            {/* Show Document Icon */}
            {processedFile.type === 'document' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                <span style={{ fontWeight: '600', fontSize: '14px', color: '#4ade80' }}>Zipped for storage!</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
            <p style={{ margin: 0 }}>Ready to upload: <strong>{processedFile.file.name}</strong></p>
            <p style={{ margin: 0 }}>Size: {(processedFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button onClick={() => setProcessedFile(null)} style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
              Clear
            </button>
            <button onClick={handleUploadToSupabase} style={{ flex: 1, padding: '8px', backgroundColor: '#000', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
              Upload to Cloud
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
