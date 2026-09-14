import { createClient } from '@supabase/supabase-js';

/**
 * AI File Processing Pipeline
 * Handles fetching, processing, and formatting files for AI model consumption.
 */

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

/**
 * 1. Fetch File from Storage
 * @param {string} path - Format: {user_id}/{filename}
 * @returns {Promise<Blob>}
 */
export async function getFileFromStorage(path) {
  const { data, error } = await supabase.storage
    .from('user-files')
    .download(path);

  if (error) {
    console.error(`[PIPELINE] Download failed for ${path}:`, error.message);
    throw new Error('File not found or access denied');
  }

  return data;
}

/**
 * 2. Process File based on type
 * @param {Blob} fileBlob 
 * @param {string} fileName 
 * @returns {Promise<{type: string, data: string}>}
 */
export async function processFile(fileBlob, fileName) {
  const fileType = fileBlob.type || '';
  const extension = fileName.split('.').pop().toLowerCase();

  // A. Image Processing
  if (fileType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve({ type: 'image', data: base64String, mimeType: fileType || `image/${extension}` });
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileBlob);
    });
  }

  // B. PDF Processing
  if (fileType === 'application/pdf' || extension === 'pdf') {
    try {
      // Note: In production, consider using a library like pdfjs-dist on client 
      // or a server-side parser. This is a placeholder for the extraction logic.
      const text = await extractTextFromPDF(fileBlob);
      return { type: 'text', data: text };
    } catch (err) {
      console.error('[PIPELINE] PDF parsing failure:', err);
      throw new Error('Failed to parse PDF content');
    }
  }

  // C. Text/Markdown Processing
  if (fileType.startsWith('text/') || ['txt', 'md', 'js', 'ts', 'json'].includes(extension)) {
    const text = await fileBlob.text();
    return { type: 'text', data: text };
  }

  throw new Error(`Unsupported file type: ${fileType || extension}`);
}

/**
 * 3. Build AI Input Structure
 * @param {Object} processedFile 
 * @param {string} userPrompt 
 * @returns {Object}
 */
export function buildAIInput(processedFile, userPrompt = "Analyze this file") {
  const messages = [{ role: "user", content: userPrompt }];

  if (processedFile.type === 'image') {
    messages.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:${processedFile.mimeType};base64,${processedFile.data}`
          }
        }
      ]
    });
  } else if (processedFile.type === 'text') {
    messages[0].content += `\n\n[FILE CONTENT]:\n${processedFile.data}`;
  }

  return { messages };
}

/**
 * Internal Helper for PDF text extraction (Browser compatible example)
 */
async function extractTextFromPDF(blob) {
  // Logic depends on environment. In a browser:
  // import * as pdfjs from 'pdfjs-dist';
  // const arrayBuffer = await blob.arrayBuffer();
  // const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  // ... extract text logic
  return "[Extracted PDF Content Placeholder]"; 
}

/**
 * Pipeline Runner Example
 */
export async function runFilePipeline(path, prompt) {
  try {
    const blob = await getFileFromStorage(path);
    const processed = await processFile(blob, path);
    const aiInput = buildAIInput(processed, prompt);
    
    console.log("[PIPELINE] Success:", aiInput);
    return aiInput;
  } catch (error) {
    console.error("[PIPELINE] Pipeline Error:", error.message);
    return { error: error.message };
  }
}
