import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';

export class QRBarcodeTool implements Tool {
  metadata: ToolMetadata = {
    id: 'qr_barcode',
    name: 'QR & Barcode',
    description: 'Generates high-resolution QR codes for text, urls, phones, wifi, etc., and scans/decodes QR codes and common barcodes (Code 128, Code 39, EAN-13, UPC) from uploaded images. Use this when the user asks to generate a QR code, scan a QR code, or read a barcode. CRITICAL: When generating a QR code for a website or URL, you MUST use the EXACT URL from the conversation context (e.g. the active cloud project deployment URL like https://www.ceova.online/p/<slug>) or the EXACT URL the user explicitly provided. NEVER fabricate, guess, or modify URLs. If the user says "this website", look for the deployment URL in the conversation history or system context.',
    category: 'AI Utilities',
    icon: 'scan',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['generate_qr', 'scan_barcode'],
          description: 'The operation to perform: generate a new QR code or scan a provided barcode image.'
        },
        data_type: {
          type: 'string',
          enum: ['text', 'url', 'phone', 'email', 'sms', 'wifi', 'vcard', 'coordinates'],
          description: 'For generate_qr, the type of data being encoded.'
        },
        content: {
          type: 'string',
          description: 'For generate_qr, the actual string or payload to encode. IMPORTANT: If you do not have the content yet, you MUST ask the user for it BEFORE calling this tool.'
        },
        export_format: {
          type: 'string',
          enum: ['png', 'svg', 'pdf'],
          description: 'For generate_qr, the format to export the code. Defaults to png.'
        }
      },
      required: ['operation']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const updateStatus = context.onStatusUpdate || (() => {});
    const params = context.args || {};

    if (params.operation === 'scan_barcode') {
      const attachments = context.attachments || [];
      if (attachments.length === 0) {
        return { success: false, error: { code: 'MISSING_FILE', message: 'No image provided for scanning.' } };
      }

      updateStatus('Preparing image for scanning...');
      
      const files = attachments.map(file => ({
        url: file.url,
        name: file.name,
        type: file.type,
        content: file.content
      }));

      const actionMeta = {
        type: 'client_qr_barcode_action',
        operation: 'scan_barcode',
        files: files
      };

      return {
        success: true,
        data: {
          text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
          message: 'Instructed frontend to scan the provided barcode/QR code image.'
        },
        ui: {
          type: 'message',
          props: { text: `Scanning image locally...` }
        }
      };
    } else if (params.operation === 'generate_qr') {
      const dataType = params.data_type || (params.content && /^https?:\/\//i.test(params.content.trim()) ? 'url' : 'text');
      updateStatus(`Preparing to generate ${dataType} QR Code...`);
      
      if (!params.content) {
        return { 
          success: false, 
          error: { 
            code: 'MISSING_CONTENT', 
            message: 'You must ask the user what text, URL, or data they want to encode into the QR code before calling generate_qr.' 
          } 
        };
      }

      const actionMeta = {
        type: 'client_qr_barcode_action',
        operation: 'generate_qr',
        data_type: dataType,
        content: params.content,
        export_format: params.export_format || 'png'
      };

      return {
        success: true,
        data: {
          text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
          message: `Instructed frontend to generate a ${params.data_type} QR code.`
        },
        ui: {
          type: 'message',
          props: { text: `Generating QR Code locally...` }
        }
      };
    }

    return { success: false, error: { code: 'INVALID_OPERATION', message: 'Unsupported operation.' } };
  }
}
