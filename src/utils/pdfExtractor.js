/**
 * PDF Text & Visual Extractor for CEOVA
 * Uses pdfjs-dist to parse attached PDF documents and extract readable text
 * and page renders (for scanned/visual documents).
 */

let pdfjsPromise = null;

async function getPdfJs() {
    if (!pdfjsPromise) {
        pdfjsPromise = (async () => {
            const pdfjsLib = await import('pdfjs-dist');
            if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
                // Point to public pre-bundled worker
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.js/pdf.worker.min.mjs';
            }
            return pdfjsLib;
        })();
    }
    return pdfjsPromise;
}

/**
 * Extracts text and optional visual renders from a PDF File or Blob.
 * @param {Blob | File | ArrayBuffer} fileOrBuffer 
 * @param {Object} options
 * @param {number} [options.maxPages=30] Maximum pages to extract text from
 * @param {number} [options.maxChars=100000] Maximum characters of text to return
 * @param {boolean} [options.renderImagesIfScanned=true] Render pages to images if text is empty/sparse
 * @returns {Promise<{ text: string, pagesCount: number, pageImages: string[] }>}
 */
export async function extractPdfContent(fileOrBuffer, options = {}) {
    const {
        maxPages = 30,
        maxChars = 100000,
        renderImagesIfScanned = true
    } = options;

    try {
        let arrayBuffer;
        if (fileOrBuffer instanceof ArrayBuffer) {
            arrayBuffer = fileOrBuffer;
        } else if (fileOrBuffer instanceof Blob || (typeof File !== 'undefined' && fileOrBuffer instanceof File)) {
            arrayBuffer = await fileOrBuffer.arrayBuffer();
        } else {
            throw new Error('Invalid input: expected File, Blob, or ArrayBuffer');
        }

        const pdfjsLib = await getPdfJs();
        // Clone arrayBuffer if needed because pdfjs may transfer buffer ownership
        const bufferCopy = arrayBuffer.slice(0);
        
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(bufferCopy),
            useSystemFonts: true,
            isEvalSupported: false
        });

        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages || 1;
        const pagesToProcess = Math.min(totalPages, maxPages);

        let extractedText = '';
        const pageImages = [];

        for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
            if (extractedText.length >= maxChars) break;

            try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Join text tokens with whitespace
                const pageItems = textContent.items || [];
                let pageStr = '';
                let lastY = null;

                for (const item of pageItems) {
                    if (typeof item.str !== 'string') continue;
                    // Detect newline based on vertical transform coordinate if available
                    if (lastY !== null && item.transform && Math.abs(item.transform[5] - lastY) > 5) {
                        pageStr += '\n';
                    } else if (pageStr && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
                        pageStr += ' ';
                    }
                    pageStr += item.str;
                    if (item.transform) lastY = item.transform[5];
                }

                pageStr = pageStr.trim();
                if (pageStr) {
                    extractedText += `--- Page ${pageNum} of ${totalPages} ---\n${pageStr}\n\n`;
                }

                // If document is scanned (almost no text on page 1) and rendering is enabled, render up to 3 pages
                const isSparseText = pageStr.length < 40;
                if (renderImagesIfScanned && isSparseText && pageImages.length < 3 && typeof document !== 'undefined') {
                    try {
                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            await page.render({ canvasContext: ctx, viewport }).promise;
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                            pageImages.push(dataUrl);
                        }
                    } catch (renderErr) {
                        console.warn(`[pdfExtractor] Failed to render page ${pageNum} image:`, renderErr);
                    }
                }
            } catch (pageErr) {
                console.warn(`[pdfExtractor] Error reading page ${pageNum}:`, pageErr);
            }
        }

        if (extractedText.length > maxChars) {
            extractedText = extractedText.slice(0, maxChars) + '\n\n[Content truncated due to length...]';
        }

        return {
            text: extractedText.trim(),
            pagesCount: totalPages,
            pageImages
        };

    } catch (err) {
        console.error('[pdfExtractor] Failed to extract PDF content:', err);
        return {
            text: '',
            pagesCount: 0,
            pageImages: [],
            error: err.message || 'PDF extraction failed'
        };
    }
}
