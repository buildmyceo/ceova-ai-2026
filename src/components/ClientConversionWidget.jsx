import React, { useState, useEffect } from 'react';
import { Loader, Download, FileText, CheckCircle, AlertTriangle, Eye, X, Lock } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';

// Dynamic import for WASM to avoid breaking SSR or build if needed
let docxToPdfConvert = null;

export default function ClientConversionWidget({ meta }) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [resultFiles, setResultFiles] = useState([]);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [passwordState, setPasswordState] = useState(null); // 'prompt_protect' | 'prompt_unlock' | 'prompt_change_step1' | 'prompt_change_step2'
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [verifiedPdfBytes, setVerifiedPdfBytes] = useState(null);

  const runPasswordAction = async (actionType = null) => {
      // For change password flow
      if (passwordState === 'prompt_change_step1') {
          if (!passwordInput) {
              setError("Old Password cannot be empty.");
              return;
          }
          setError(null);
          setIsProcessing(true);
          try {
              const { files } = meta;
              const res = await fetch(files[0].url, { mode: 'cors' });
              const blob = await res.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const pdf = await PDFDocument.load(arrayBuffer, { password: passwordInput });
              const savedBytes = await pdf.save();
              setVerifiedPdfBytes(savedBytes);
              setOldPassword(passwordInput);
              setPasswordInput('');
              setPasswordState('prompt_change_step2');
              setIsProcessing(false);
          } catch (err) {
              console.error(err);
              setError("Incorrect password or failed to read PDF.");
              setIsProcessing(false);
          }
          return;
      }

      if ((passwordState === 'prompt_protect' || passwordState === 'prompt_change_step2') && actionType !== 'keep_unlocked') {
          if (passwordInput !== passwordConfirm) {
              setError("Passwords do not match.");
              return;
          }
      }
      if (!passwordInput && actionType !== 'keep_unlocked' && passwordState !== 'prompt_unlock') {
          setError("Password cannot be empty.");
          return;
      }
      
      setError(null);
      const currentState = passwordState;
      setPasswordState(null);
      setIsProcessing(true);
      
      try {
          const { operation, files } = meta;
          const fetchedBlobs = await Promise.all(
              files.map(async (f) => {
                  const res = await fetch(f.url, { mode: 'cors' });
                  return { name: f.name, type: f.type, blob: await res.blob() };
              })
          );
          
          let output = [];
          if (currentState === 'prompt_protect' || (currentState === 'prompt_change_step2' && actionType === 'protect')) {
              const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
              for (let i = 0; i < fetchedBlobs.length; i++) {
                  const f = fetchedBlobs[i];
                  const sourceBytes = verifiedPdfBytes ? new Uint8Array(verifiedPdfBytes) : new Uint8Array(await f.blob.arrayBuffer());
                  const encryptedPdfBytes = await encryptPDF(sourceBytes, passwordInput, passwordInput);
                  output.push({ name: `protected_${f.name}`, blob: new Blob([encryptedPdfBytes], { type: 'application/pdf' }) });
              }
          } else if (currentState === 'prompt_unlock' || (currentState === 'prompt_change_step2' && actionType === 'keep_unlocked')) {
              for (let i = 0; i < fetchedBlobs.length; i++) {
                  const f = fetchedBlobs[i];
                  const sourceBytes = verifiedPdfBytes || await f.blob.arrayBuffer();
                  if (!verifiedPdfBytes) {
                      const pdf = await PDFDocument.load(sourceBytes, { password: passwordInput });
                      const savedBytes = await pdf.save();
                      output.push({ name: `unlocked_${f.name}`, blob: new Blob([savedBytes], { type: 'application/pdf' }) });
                  } else {
                      output.push({ name: `unlocked_${f.name}`, blob: new Blob([verifiedPdfBytes], { type: 'application/pdf' }) });
                  }
              }
          }
          
          setResultFiles(output.map(o => ({
              name: o.name,
              url: URL.createObjectURL(o.blob),
              size: o.blob.size
          })));
          if (files && files[0] && files[0].url) {
              localStorage.setItem(`conversion_completed_${files[0].url}`, 'true');
          }
          setIsProcessing(false);
      } catch (err) {
          console.error("Password action error:", err);
          setError(err.message || "Failed to process PDF with password.");
          setIsProcessing(false);
          setPasswordState(currentState); // Restore state on error
      }
  };

  useEffect(() => {
    let active = true;
    
    async function processFiles() {
      try {
        const { operation, targetFormat, files } = meta;
        if (!files || files.length === 0) throw new Error("No files provided.");

        if (operation === 'protect') {
            if (active) {
                if (localStorage.getItem(`conversion_completed_${files[0].url}`)) {
                    setPasswordState('completed');
                } else {
                    setPasswordState('prompt_protect');
                }
                setIsProcessing(false);
            }
            return;
        }

        if (operation === 'unlock') {
            if (active) {
                if (localStorage.getItem(`conversion_completed_${files[0].url}`)) {
                    setPasswordState('completed');
                } else {
                    setPasswordState('prompt_unlock');
                }
                setIsProcessing(false);
            }
            return;
        }

        if (operation === 'change_password') {
            if (active) {
                if (localStorage.getItem(`conversion_completed_${files[0].url}`)) {
                    setPasswordState('completed');
                } else {
                    setPasswordState('prompt_change_step1');
                }
                setIsProcessing(false);
            }
            return;
        }

        if (operation === 'display_only') {
            if (active) {
                setResultFiles(files);
                setIsProcessing(false);
            }
            return;
        }
        
        const fetchedBlobs = await Promise.all(
            files.map(async (f) => {
                const res = await fetch(f.url, { mode: 'cors' });
                return { name: f.name, type: f.type, blob: await res.blob() };
            })
        );
        
        let output = [];

        if (operation === 'convert_to_pdf' || operation === 'merge_pdfs') {
            const mergedPdf = await PDFDocument.create();
            for (const f of fetchedBlobs) {
                if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
                    const pdf = await PDFDocument.load(await f.blob.arrayBuffer());
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                } else if (f.type.startsWith('image/')) {
                    const imgBitmap = await createImageBitmap(f.blob);
                    const page = mergedPdf.addPage([imgBitmap.width, imgBitmap.height]);
                    
                    let pdfImage;
                    if (f.type === 'image/jpeg' || f.type === 'image/jpg') {
                        pdfImage = await mergedPdf.embedJpg(await f.blob.arrayBuffer());
                    } else {
                        pdfImage = await mergedPdf.embedPng(await f.blob.arrayBuffer());
                    }
                    
                    page.drawImage(pdfImage, { x: 0, y: 0, width: imgBitmap.width, height: imgBitmap.height });
                } else if (f.name.endsWith('.docx')) {
                    if (!docxToPdfConvert) {
                        const module = await import('docx-to-pdf-wasm');
                        docxToPdfConvert = module.convert;
                    }
                    if (docxToPdfConvert) {
                        try {
                            const pdfBytes = await docxToPdfConvert(await f.blob.arrayBuffer());
                            const tempPdf = await PDFDocument.load(pdfBytes);
                            const copiedPages = await mergedPdf.copyPages(tempPdf, tempPdf.getPageIndices());
                            copiedPages.forEach((page) => mergedPdf.addPage(page));
                        } catch(e) {
                            throw new Error(`DOCX conversion failed for ${f.name}`);
                        }
                    } else {
                        throw new Error("DOCX converter not loaded.");
                    }
                } else if (f.name.endsWith('.csv') || f.name.endsWith('.txt')) {
                    const text = await f.blob.text();
                    const page = mergedPdf.addPage();
                    page.drawText(text.substring(0, 5000), { x: 50, y: 750, size: 10, color: rgb(0,0,0) });
                } else {
                    throw new Error(`Unsupported format for PDF conversion: ${f.name}`);
                }
            }
            const pdfBytes = await mergedPdf.save();
            const finalName = fetchedBlobs.length === 1 ? fetchedBlobs[0].name.replace(/\.[^/.]+$/, "") + ".pdf" : "merged_document.pdf";
            output.push({ name: finalName, blob: new Blob([pdfBytes], { type: 'application/pdf' }) });
        } else if (operation === 'convert_to_image') {
            for (const f of fetchedBlobs) {
                if (f.type === 'application/pdf') {
                    throw new Error("Client-side PDF to Image requires full PDF.js viewer. Falling back.");
                }
            }
        } else if (operation === 'convert_image_format') {
             for (const f of fetchedBlobs) {
                const imgBitmap = await createImageBitmap(f.blob);
                const canvas = document.createElement('canvas');
                canvas.width = imgBitmap.width;
                canvas.height = imgBitmap.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgBitmap, 0, 0);
                
                let mime = 'image/jpeg';
                let ext = 'jpg';
                if (targetFormat === 'png') { mime = 'image/png'; ext = 'png'; }
                if (targetFormat === 'webp') { mime = 'image/webp'; ext = 'webp'; }
                
                const outBlob = await new Promise(resolve => canvas.toBlob(resolve, mime, 0.9));
                output.push({ name: f.name.replace(/\.[^/.]+$/, "") + `.${ext}`, blob: outBlob });
             }
        } else if (operation === 'split_pdf') {
             for (const f of fetchedBlobs) {
                 const pdf = await PDFDocument.load(await f.blob.arrayBuffer());
                 for (let i = 0; i < pdf.getPageCount(); i++) {
                     const newPdf = await PDFDocument.create();
                     const [page] = await newPdf.copyPages(pdf, [i]);
                     newPdf.addPage(page);
                     const pdfBytes = await newPdf.save();
                     output.push({ name: `${f.name.replace(/\.[^/.]+$/, "")}_page_${i+1}.pdf`, blob: new Blob([pdfBytes], { type: 'application/pdf' }) });
                 }
             }
        } else if (operation === 'zip') {
             const zip = new JSZip();
             for (const f of fetchedBlobs) {
                 zip.file(f.name, f.blob);
             }
             const zipBlob = await zip.generateAsync({ type: 'blob' });
             output.push({ name: "archive.zip", blob: zipBlob });
        } else if (operation === 'unzip') {
             for (const f of fetchedBlobs) {
                 const zip = await JSZip.loadAsync(f.blob);
                 for (const relativePath of Object.keys(zip.files)) {
                     const zipEntry = zip.files[relativePath];
                     if (!zipEntry.dir) {
                         const fileData = await zipEntry.async("blob");
                         output.push({ name: relativePath.split('/').pop(), blob: fileData });
                     }
                 }
             }
        }

        if (!active) return;
        
        const finalResults = output.map(o => ({
            name: o.name,
            url: URL.createObjectURL(o.blob),
            size: o.blob.size
        }));
        
        setResultFiles(finalResults);
        setIsProcessing(false);
      } catch (err) {
        if (!active) return;
        console.error("Conversion error:", err);
        setError(err.message || "Failed to process files locally.");
        setIsProcessing(false);
      }
    }

    processFiles();
    return () => { active = false; };
  }, [JSON.stringify(meta)]);

  if (isProcessing) {
    return (
      <div className="compression-card" style={{ justifyContent: 'center', opacity: 0.8 }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af', fontSize: '0.9rem' }}>
            <Loader size={16} className="animate-spin" /> Processing {meta.operation}...
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

  if (passwordState === 'completed') {
      return (
          <div className="compression-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
                  <CheckCircle size={16} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      Operation already completed
                  </span>
              </div>
          </div>
      );
  }

  if (passwordState) {
      const isProtect = passwordState === 'prompt_protect' || passwordState === 'prompt_change_step2';
      const isStep1 = passwordState === 'prompt_change_step1';
      return (
          <div className="compression-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#4ade80' }}>
                  <Lock size={16} />
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      {passwordState === 'prompt_protect' ? 'Set Password for PDF' : 
                       passwordState === 'prompt_unlock' ? 'Enter Password to Unlock PDF' :
                       passwordState === 'prompt_change_step1' ? 'Verify Old Password' :
                       'Set New Password'}
                  </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                      type="password"
                      placeholder={isStep1 || passwordState === 'prompt_unlock' ? "Password" : "New Password"}
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      autoComplete="new-password"
                      autoCorrect="off"
                      spellCheck="false"
                      onCopy={e => e.preventDefault()}
                      onCut={e => e.preventDefault()}
                      onPaste={e => e.preventDefault()}
                      style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', WebkitTextSecurity: 'disc', userSelect: 'none', WebkitUserSelect: 'none' }}
                  />
                  {isProtect && (
                      <input
                          type="password"
                          placeholder="Confirm New Password"
                          value={passwordConfirm}
                          onChange={e => setPasswordConfirm(e.target.value)}
                          autoComplete="new-password"
                          autoCorrect="off"
                          spellCheck="false"
                          onCopy={e => e.preventDefault()}
                          onCut={e => e.preventDefault()}
                          onPaste={e => e.preventDefault()}
                          style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px', WebkitTextSecurity: 'disc', userSelect: 'none', WebkitUserSelect: 'none' }}
                      />
                  )}
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button 
                          onClick={() => runPasswordAction('protect')}
                          style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                      >
                          {passwordState === 'prompt_protect' ? 'Protect PDF' : 
                           passwordState === 'prompt_unlock' ? 'Unlock PDF' :
                           passwordState === 'prompt_change_step1' ? 'Verify' :
                           'Update Password'}
                      </button>
                      
                      {passwordState === 'prompt_change_step2' && (
                          <button 
                              onClick={() => runPasswordAction('keep_unlocked')}
                              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
                          >
                              Keep Unlocked
                          </button>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  if (resultFiles.length === 0) return null;

  return (
      <div className="compression-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
              <CheckCircle size={16} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Successfully Processed Files</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {resultFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <FileText size={16} color="#9ca3af" />
                          <span style={{ fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{f.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{f.size ? (f.size / 1024).toFixed(1) + ' KB' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                              onClick={() => setPreviewUrl(f.url)}
                              style={{ background: '#4b5563', color: 'white', padding: '6px', borderRadius: '6px', display: 'flex', cursor: 'pointer', border: 'none' }}
                              title="Preview File"
                          >
                              <Eye size={14} />
                          </button>
                          <a href={f.url} download={f.name} style={{ background: '#3b82f6', color: 'white', padding: '6px', borderRadius: '6px', display: 'flex' }}>
                              <Download size={14} />
                          </a>
                      </div>
                  </div>
              ))}
          </div>

          {previewUrl && (
              <div style={{
                  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                  background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column'
              }}>
                  <div style={{ padding: '15px', display: 'flex', justifyContent: 'flex-end', background: '#111' }}>
                      <button 
                          onClick={() => setPreviewUrl(null)}
                          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                      >
                          <X size={24} />
                      </button>
                  </div>
                  <iframe 
                      src={previewUrl} 
                      style={{ flex: 1, border: 'none', width: '100%', backgroundColor: 'white' }}
                      title="File Preview"
                  />
              </div>
          )}
      </div>
  );
}
