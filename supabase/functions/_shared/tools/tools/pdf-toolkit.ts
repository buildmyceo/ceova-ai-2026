import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
import { PDFDocument, rgb, degrees, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

export class PdfToolkitTool implements Tool {
  metadata: ToolMetadata = {
    id: 'pdf_toolkit',
    name: 'PDF Toolkit',
    description: 'Perform operations on PDFs like merge, split, extract, delete, rearrange, rotate, watermark, page_numbers, protect, unlock, and change_password. Requires a PDF attachment.',
    category: 'Document Utilities',
    icon: 'file-text',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The operation to perform: merge, split, extract, delete, rearrange, rotate, watermark, page_numbers, protect, unlock, change_password, read_text',
          enum: ['merge', 'split', 'extract', 'delete', 'rearrange', 'rotate', 'watermark', 'page_numbers', 'protect', 'unlock', 'change_password', 'read_text']
        },
        pages: {
          type: 'string',
          description: 'Comma-separated page numbers or ranges (e.g., "1,3,5-7"). 1-indexed.'
        },
        degrees: {
          type: 'number',
          description: 'Degrees to rotate (90, 180, 270) for the rotate action.'
        },
        text: {
          type: 'string',
          description: 'Text to use for watermark action.'
        },
        password: {
          type: 'string',
          description: 'Optional password if the PDF is encrypted.'
        }
      },
      required: ['action']
    }
  };

  private async fetchPdfBytes(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch PDF.');
    return await res.arrayBuffer();
  }

  private parsePages(pagesStr: string, totalPages: number): number[] {
    const pages = new Set<number>();
    const parts = pagesStr.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) pages.add(i - 1);
        }
      } else {
        const n = parseInt(part.trim(), 10);
        if (n >= 1 && n <= totalPages) pages.add(n - 1);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  }

  // Parses without sorting/deduplicating to allow rearranging
  private parsePagesExact(pagesStr: string, totalPages: number): number[] {
    const pages: number[] = [];
    const parts = pagesStr.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
        const step = start <= end ? 1 : -1;
        for (let i = start; i !== end + step; i += step) {
          if (i >= 1 && i <= totalPages) pages.push(i - 1);
        }
      } else {
        const n = parseInt(part.trim(), 10);
        if (n >= 1 && n <= totalPages) pages.push(n - 1);
      }
    }
    return pages;
  }

  private async uploadProcessedPdf(buffer: Uint8Array, context: ToolContext, suffix: string): Promise<{ url: string, fileId: string }> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const fileId = `${context.userId || 'anon'}/${Date.now()}-${suffix}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('processed_documents')
      .upload(fileId, buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      // Try to create bucket if it doesn't exist
      await supabase.storage.createBucket('processed_documents', { public: true });
      const { error: retryError } = await supabase.storage
        .from('processed_documents')
        .upload(fileId, buffer, {
          contentType: 'application/pdf',
          upsert: false
        });
      if (retryError) throw new Error(`Failed to upload processed PDF: ${retryError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('processed_documents')
      .getPublicUrl(fileId);

    return { url: publicUrl, fileId };
  }

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const updateStatus = context.onStatusUpdate || (() => {});
    const args = context.args || {};
    const action = args.action;

    if (!action) {
      return { success: false, error: { code: 'MISSING_ACTION', message: 'Action is required.' } };
    }

    const pdfAttachments = (context.attachments || []).filter(a => a.type === 'application/pdf' || a.name.endsWith('.pdf'));
    if (pdfAttachments.length === 0) {
      return { success: false, error: { code: 'MISSING_FILE', message: 'At least one PDF attachment is required.' } };
    }

    try {
      updateStatus(`Executing ${action} operation`);
      let resultUrls: string[] = [];

      if (action === 'protect' || action === 'unlock' || action === 'change_password') {
          updateStatus('Finished');
          const actionMeta = {
              type: 'client_file_conversion',
              operation: action,
              files: pdfAttachments.map(f => ({ name: f.name || 'document.pdf', url: f.url }))
          };
          return {
              success: true,
              data: {
                  text: `Redirected to client for password operation.\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
                  urls: [],
                  processingTimeMs: Date.now() - startTime
              },
              ui: { type: 'message', props: { text: `Please enter the password securely below:` } }
          };
      }

      if (action === 'read_text') {
        const targetPdf = pdfAttachments[0];
        if (!targetPdf.url) throw new Error("No URL found for the PDF.");
        updateStatus('Reading PDF text...');
        const bytes = await this.fetchPdfBytes(targetPdf.url);
        try {
          // Extract raw text from PDF content streams using pdf-lib
          const pdfDoc = await PDFDocument.load(bytes);
          const pageCount = pdfDoc.getPageCount();
          
          // Use a basic approach: extract any readable ASCII text from the raw bytes
          const rawBytes = new Uint8Array(bytes);
          const rawText = new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
          
          // Extract text between BT and ET markers (PDF text objects)
          const textChunks: string[] = [];
          const btEtRegex = /BT([\s\S]*?)ET/g;
          let btMatch;
          while ((btMatch = btEtRegex.exec(rawText)) !== null) {
            const block = btMatch[1];
            // Extract strings from parentheses (Tj, TJ operators)
            const strRegex = /\(([^)]*)\)/g;
            let strMatch;
            while ((strMatch = strRegex.exec(block)) !== null) {
              const str = strMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\\(/g, '(')
                .replace(/\\\)/g, ')')
                .replace(/\\\\/g, '\\');
              if (str.trim().length > 0) textChunks.push(str);
            }
          }
          
          const extractedText = textChunks.join(' ').trim();
          const resultText = extractedText.length > 0
            ? `PDF Text (${pageCount} pages):\n\n${extractedText}`
            : `PDF has ${pageCount} pages but no extractable text (may be scanned/image-only). Use image analysis for scanned PDFs.`;
          
          updateStatus('Finished');
          return {
            success: true,
            data: {
              text: resultText,
              processingTimeMs: Date.now() - startTime
            },
            ui: { type: 'message', props: { text: 'Extracted text from PDF successfully.' } }
          };
        } catch (err: any) {
           throw new Error(`Failed to extract text from PDF: ${err.message}`);
        }
      }

      if (action === 'merge') {
        const mergedPdf = await PDFDocument.create();
        for (const attachment of pdfAttachments) {
          if (!attachment.url) continue;
          const bytes = await this.fetchPdfBytes(attachment.url);
          const pdf = await PDFDocument.load(bytes, { password: args.password });
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const mergedBytes = await mergedPdf.save();
        const { url } = await this.uploadProcessedPdf(mergedBytes, context, 'merged');
        resultUrls.push(url);

      } else {
        const targetPdf = pdfAttachments[0];
        if (!targetPdf.url) throw new Error("No URL found for the PDF.");
        const bytes = await this.fetchPdfBytes(targetPdf.url);
        const pdfDoc = await PDFDocument.load(bytes, { password: args.password });
        const totalPages = pdfDoc.getPageCount();

        if (action === 'extract') {
          if (!args.pages) throw new Error("pages parameter is required for extract.");
          const pageIndices = this.parsePages(args.pages, totalPages);
          if (pageIndices.length === 0) throw new Error("Invalid pages specified.");
          
          const newPdf = await PDFDocument.create();
          const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((page) => newPdf.addPage(page));
          const outBytes = await newPdf.save();
          const { url } = await this.uploadProcessedPdf(outBytes, context, 'extracted');
          resultUrls.push(url);

        } else if (action === 'delete') {
          if (!args.pages) throw new Error("pages parameter is required for delete.");
          const pageIndices = this.parsePages(args.pages, totalPages).sort((a, b) => b - a);
          pageIndices.forEach(idx => pdfDoc.removePage(idx));
          const outBytes = await pdfDoc.save();
          const { url } = await this.uploadProcessedPdf(outBytes, context, 'deleted');
          resultUrls.push(url);

        } else if (action === 'rearrange') {
          if (!args.pages) throw new Error("pages parameter is required for rearrange.");
          const pageIndices = this.parsePagesExact(args.pages, totalPages);
          if (pageIndices.length === 0) throw new Error("Invalid pages specified.");
          
          const newPdf = await PDFDocument.create();
          const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((page) => newPdf.addPage(page));
          const outBytes = await newPdf.save();
          const { url } = await this.uploadProcessedPdf(outBytes, context, 'rearranged');
          resultUrls.push(url);

        } else if (action === 'rotate') {
          const rotation = args.degrees || 90;
          const pageIndices = args.pages ? this.parsePages(args.pages, totalPages) : pdfDoc.getPageIndices();
          const pages = pdfDoc.getPages();
          pageIndices.forEach(idx => {
            const currentRotation = pages[idx].getRotation().angle;
            pages[idx].setRotation(degrees(currentRotation + rotation));
          });
          const outBytes = await pdfDoc.save();
          const { url } = await this.uploadProcessedPdf(outBytes, context, 'rotated');
          resultUrls.push(url);

        } else if (action === 'split') {
          let ranges: number[][] = [];
          if (args.pages) {
            const parts = args.pages.split(',');
            for (const part of parts) {
              ranges.push(this.parsePagesExact(part, totalPages));
            }
          } else {
            for (let i = 0; i < totalPages; i++) {
              ranges.push([i]);
            }
          }

          for (let i = 0; i < ranges.length; i++) {
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, ranges[i]);
            copiedPages.forEach((page) => newPdf.addPage(page));
            const outBytes = await newPdf.save();
            const { url } = await this.uploadProcessedPdf(outBytes, context, `split-${i+1}`);
            resultUrls.push(url);
          }

        } else if (action === 'watermark') {
          const text = args.text || 'CONFIDENTIAL';
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const pageIndices = args.pages ? this.parsePages(args.pages, totalPages) : pdfDoc.getPageIndices();
          const pages = pdfDoc.getPages();
          
          pageIndices.forEach(idx => {
            const page = pages[idx];
            const { width, height } = page.getSize();
            const fontSize = Math.min(width, height) / 10;
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textHeight = font.heightAtSize(fontSize);
            
            page.drawText(text, {
              x: width / 2 - textWidth / 2,
              y: height / 2 - textHeight / 2,
              size: fontSize,
              font: font,
              color: rgb(0.7, 0.7, 0.7),
              opacity: 0.3,
              rotate: degrees(45)
            });
          });
          const outBytes = await pdfDoc.save();
          const { url } = await this.uploadProcessedPdf(outBytes, context, 'watermarked');
          resultUrls.push(url);

        } else if (action === 'page_numbers') {
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const pages = pdfDoc.getPages();
          
          pages.forEach((page, idx) => {
            const { width } = page.getSize();
            const text = `${idx + 1}`;
            const fontSize = 12;
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            
            page.drawText(text, {
              x: width / 2 - textWidth / 2,
              y: 20,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
          });
          const outBytes = await pdfDoc.save();
          const { url } = await this.uploadProcessedPdf(outBytes, context, 'numbered');
          resultUrls.push(url);

        } else {
          throw new Error(`Unsupported action: ${action}`);
        }
      }

      updateStatus('Finished');

      const actionMeta = {
          type: 'client_file_conversion',
          operation: 'display_only',
          files: resultUrls.map((url, i) => {
              // Extract original name to make output name nice if possible
              const originalName = pdfAttachments[0]?.name || 'document.pdf';
              const nameBase = originalName.replace(/\.[^/.]+$/, "");
              return { name: `${nameBase}_${action}_${i+1}.pdf`, url: url, size: 0 };
          })
      };

      return {
        success: true,
        data: {
          text: `Processed PDF using ${action} operation.\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
          urls: resultUrls,
          processingTimeMs: Date.now() - startTime
        },
        ui: {
            type: 'message',
            props: { text: `Processed PDF successfully.` }
        }
      };

    } catch (e: any) {
      updateStatus('Failed');
      return {
        success: false,
        error: { code: 'PDF_PROCESSING_ERROR', message: e.message || 'Failed to process PDF.' }
      };
    }
  }
}
