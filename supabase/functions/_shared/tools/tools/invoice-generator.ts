import { Tool, ToolContext, ToolResult, ToolMetadata } from '../types.ts';

export class InvoiceGeneratorTool implements Tool {
  metadata: ToolMetadata = {
    id: 'invoice_generator',
    name: 'Invoice Generator',
    description: 'ONLY CALL THIS TOOL if you have gathered all necessary invoice details. When a user asks to generate an invoice, DO NOT call this tool immediately. INSTEAD, first ask the user for: 1. Invoice number (or auto-generate), 2. Billing information (name/address), 3. Client information, 4. Total amount due/items, 5. Tax information, 6. Logo, 7. Payment instructions, 8. Discount information, 9. Late payment fees, and 10. Contact information. Once they provide this, THEN call this tool to generate the invoice.',
    category: 'Business Utilities',
    icon: 'file-text',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        company_name: { type: 'string', description: 'Your company name or your name.' },
        company_address: { type: 'string', description: 'Your company address.' },
        customer_name: { type: 'string', description: 'Client or customer name.' },
        customer_address: { type: 'string', description: 'Client address.' },
        invoice_date: { type: 'string', description: 'Date of invoice.' },
        due_date: { type: 'string', description: 'Due date.' },
        currency: { type: 'string', description: 'Currency symbol (e.g. $, ₹, €). Default is ₹.' },
        tax_rate: { type: 'number', description: 'Tax percentage (e.g. 18 for 18%).' },
        discount: { type: 'number', description: 'Fixed discount amount.' },
        paid_amount: { type: 'number', description: 'Amount already paid by the client.' },
        mode_of_payment: { type: 'string', description: 'Payment method used (e.g. Cash, Credit Card, Bank Transfer).' },
        all_details_provided_by_user: { type: 'boolean', description: 'CRITICAL: Set to true ONLY if the user has explicitly provided the customer name, items, and other details. If they only asked for an invoice or used a slash command, set this to false.' },
        items: {
          type: 'array',
          description: 'List of items to invoice.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'number' }
            },
            required: ['name', 'quantity', 'price']
          }
        }
      },
      required: ['all_details_provided_by_user']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const params = context.args || {};
    const updateStatus = context.onStatusUpdate || (() => {});
    
    try {
      if (params.all_details_provided_by_user === false || !params.customer_name || params.customer_name.toLowerCase() === 'john doe' || params.customer_name === 'Client or customer name.') {
        updateStatus('Waiting for invoice details...');
        return {
            success: true,
            data: {
                text: "I need more details before generating the invoice.",
                urls: [],
                processingTimeMs: Date.now() - startTime
            },
            ui: {
                type: 'message',
                props: {
                    text: "Please provide the following details so I can generate your invoice:\n\n1. Invoice Number (or say 'auto')\n2. Billing Information (Your name/address)\n3. Client Information (Their name/address)\n4. Items & Total Amount Due\n5. Tax Information\n6. Do you want to use a Logo? (Attach if yes)\n7. Amount Paid & Mode of Payment\n8. Discount Information (if any)\n9. Late Payment Fees (if any)\n10. Contact Information\n\nYou can provide all of this at once, or I can guide you through it!"
                }
            }
        };
      }

      updateStatus(`Calculating invoice totals...`);

      const items = params.items || [];
      const currency = params.currency || '₹';
      const taxRate = params.tax_rate || 0;
      const discount = params.discount || 0;

      let subtotal = 0;
      const calculatedItems = items.map((item: any) => {
          const qty = item.quantity || 1;
          const price = item.price || 0;
          const total = qty * price;
          subtotal += total;
          return { ...item, quantity: qty, price, total };
      });

      const discountedSubtotal = subtotal - discount;
      const taxAmount = (discountedSubtotal * taxRate) / 100;
      const grandTotal = discountedSubtotal + taxAmount;

      // Generate Invoice ID
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${dateStr}-${randomId}`;

      // Check for custom logo in attachments
      let logoUrl = null;
      if (context.attachments && context.attachments.length > 0) {
          const imageAttachments = context.attachments.filter(a => a.type.startsWith('image/'));
          if (imageAttachments.length > 0) {
              logoUrl = imageAttachments[0].url;
          }
      }

      const actionMeta = {
          type: 'client_invoice_generator',
          invoiceData: {
              invoiceNumber,
              invoiceDate: params.invoice_date || today.toLocaleDateString(),
              dueDate: params.due_date || new Date(today.getTime() + 15*24*60*60*1000).toLocaleDateString(), // 15 days
              companyName: params.company_name || 'My Company',
              companyAddress: params.company_address || '',
              customerName: params.customer_name,
              customerAddress: params.customer_address || '',
              currency,
              taxRate,
              taxAmount,
              discount,
              subtotal,
              grandTotal,
              paidAmount: params.paid_amount || 0,
              modeOfPayment: params.mode_of_payment || 'Not Specified',
              items: calculatedItems,
              logoUrl
          }
      };

      updateStatus('Rendering professional invoice widget...');

      return {
          success: true,
          data: {
              text: `I've prepared the invoice for **${params.customer_name}**. You can review, print, or download it as a PDF below:\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
              processingTimeMs: Date.now() - startTime
          }
      };

    } catch (e: any) {
      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: e.message || 'An unknown error occurred during invoice generation' },
        data: {
            text: `Failed to generate invoice: ${e.message}`,
            processingTimeMs: Date.now() - startTime
        }
      };
    }
  }
}
