import re

with open('src/lib/invoiceTemplates.js', 'r') as f:
    content = f.read()

# Update the list
new_list = """export const invoiceTemplatesList = [
  { id: 'thunder', name: 'Thunder' },
  { id: 'gold_dark', name: 'Dark Gold' },
  { id: 'split_navy', name: 'Split Navy' },
  { id: 'split_rose', name: 'Rose Elegance' },
  { id: 'arch_green', name: 'Green Arch' },
  { id: 'modern', name: 'Modern' },
  { id: 'classic', name: 'Classic' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'bold', name: 'Bold' },
  { id: 'corporate', name: 'Corporate' }
];"""
content = re.sub(r'export const invoiceTemplatesList = \[.*?\];', new_list, content, flags=re.DOTALL)


# Prepare new switch cases
thunder_case = """
    case 'thunder':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Inter', sans-serif; color: #111827; }
              .top-section { background: #222222; color: #fff; padding: 40px 50px; }
              .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
              .title { font-size: 56px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #fff; }
              .red-line { height: 6px; background: #ff4d6d; width: 100%; }
              .meta-section { background: #1a1a1a; color: #fff; padding: 30px 50px; display: flex; justify-content: space-between; align-items: flex-start; }
              .meta-block { display: flex; flex-direction: column; gap: 8px; }
              .meta-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a3a3a3; }
              .meta-value { font-size: 18px; font-weight: 600; color: #fff; }
              .total-value { font-size: 28px; font-weight: 800; color: #fff; }
              
              .content-section { padding: 50px; }
              th { text-align: left; padding: 15px; background: #222222; color: #fff; font-size: 14px; text-transform: uppercase; }
              td { padding: 15px; font-size: 14px; font-weight: 600; color: #111827; }
              tbody tr:nth-child(even) { background: #f1f5f9; }
              
              .bottom-section { display: flex; justify-content: space-between; margin-top: 40px; }
              .payment-info { width: 40%; }
              .payment-info h4 { margin: 0 0 10px 0; font-size: 16px; color: #4b5563; }
              .payment-info p { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; font-style: italic; font-weight: 600; }
              
              .totals-box { width: 300px; }
              .tot-row { display: flex; justify-content: space-between; padding: 8px 15px; font-size: 14px; font-weight: 700; color: #111827; }
              .grand-tot { display: flex; justify-content: space-between; padding: 15px; margin-top: 10px; font-size: 18px; font-weight: 800; color: #111827; border-top: 2px solid #ff4d6d; border-bottom: 2px solid #ff4d6d; }
              
              .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
              .terms { width: 50%; }
              .terms h4 { margin: 0 0 5px 0; font-size: 14px; color: #4b5563; }
              .terms p { margin: 0; font-size: 11px; color: #6b7280; font-weight: 700; font-style: italic; line-height: 1.4; }
              .signature { text-align: center; }
              .signature p { margin: 0; font-size: 14px; font-weight: 600; }
              .signature span { font-size: 11px; color: #6b7280; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="top-section">
              <div class="header">
                <div>${logoHtml}</div>
                <h1 class="title">INVOICE</h1>
              </div>
            </div>
            <div class="red-line"></div>
            <div class="meta-section">
              <div class="meta-block">
                <span class="meta-label">Invoice To:</span>
                <span class="meta-value" style="font-size: 22px;">${data.customerName}</span>
                <span style="font-size: 12px; color: #a3a3a3; margin-top: 4px; font-weight: 500;">${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}</span>
              </div>
              <div class="meta-block" style="text-align: center;">
                <span class="meta-label">Date : ${data.invoiceDate}</span>
                <span class="meta-label" style="margin-top: 10px;">Invoice No : ${data.invoiceNumber}</span>
                <span class="meta-label" style="margin-top: 10px;">Due : ${data.dueDate}</span>
              </div>
              <div class="meta-block" style="text-align: right;">
                <span class="meta-label">Total Due:</span>
                <span class="total-value">${data.currency}${Number(data.grandTotal).toFixed(2)}</span>
              </div>
            </div>
            
            <div class="content-section">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              
              <div class="bottom-section">
                <div class="payment-info">
                  <h4>Payment Method</h4>
                  <p>Bank Name : Bank<br/>Account No : 1234567890</p>
                </div>
                <div class="totals-box">
                  <div class="tot-row"><span>Sub-total :</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
                  ${data.discount > 0 ? `<div class="tot-row" style="color: #059669;"><span>Discount :</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
                  ${data.taxAmount > 0 ? `<div class="tot-row"><span>Tax :</span><span>${data.currency}${Number(data.taxAmount).toFixed(2)}</span></div>` : ''}
                  <div class="grand-tot"><span>Total :</span><span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span></div>
                </div>
              </div>
              
              <div class="footer">
                <div class="terms">
                  <h4>Terms and Conditions</h4>
                  <p>Please send payment within 30 days of receiving this invoice. There will be 10% interest charge per month on late invoice.</p>
                </div>
                <div class="signature">
                  <p>${data.companyName}</p>
                  <span>Administrator</span>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
"""

gold_dark_case = """
    case 'gold_dark':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Space Grotesk', sans-serif; background: #111111; color: #f3f4f6; }
              .container { padding: 60px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; }
              .title-box { text-align: right; }
              .title { font-size: 48px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; margin: 0; color: #fff; }
              .invoice-no { font-size: 14px; color: #9ca3af; margin-top: 8px; }
              
              .invoice-to { margin-bottom: 50px; display: flex; justify-content: space-between; }
              .section-title { font-size: 14px; font-weight: 700; color: #eab308; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; }
              .info-text { font-size: 14px; color: #d1d5db; line-height: 1.6; }
              .info-text strong { color: #fff; font-size: 16px; display: block; margin-bottom: 5px; }
              
              th { text-align: left; padding: 15px; background: #eab308; color: #111111; font-size: 14px; text-transform: uppercase; font-weight: 700; }
              td { padding: 15px; font-size: 14px; color: #d1d5db; border-bottom: 1px solid #333; }
              
              .bottom-section { display: flex; justify-content: space-between; margin-top: 40px; }
              .payment-info { width: 40%; }
              .payment-info table { width: auto; }
              .payment-info td { border: none; padding: 4px 15px 4px 0; font-size: 13px; }
              
              .totals-box { width: 300px; }
              .tot-row { display: flex; justify-content: space-between; padding: 10px 15px; font-size: 14px; font-weight: 700; color: #d1d5db; }
              .grand-tot { display: flex; justify-content: space-between; padding: 15px; margin-top: 10px; font-size: 18px; font-weight: 800; background: #eab308; color: #111111; }
              
              .footer { margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; }
              .contact-info { width: 50%; }
              .contact-info p { margin: 5px 0; font-size: 13px; color: #9ca3af; }
              .signature { border-top: 1px solid #fff; padding-top: 10px; text-align: center; width: 200px; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="container">
              <div class="header">
                <div style="color: #eab308;">${logoHtml}</div>
                <div class="title-box">
                  <h1 class="title">INVOICE</h1>
                  <div class="invoice-no">Invoice ID : &nbsp; #${data.invoiceNumber}</div>
                  <div class="invoice-no">Date : &nbsp; ${data.invoiceDate}</div>
                </div>
              </div>
              
              <div class="invoice-to">
                <div>
                  <div class="section-title">INVOICE TO</div>
                  <div class="info-text">
                    <strong>${data.customerName}</strong>
                    ${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div class="info-text" style="margin-top: 30px;">
                    <strong>${data.companyName}</strong>
                    ${data.companyAddress ? data.companyAddress.replace(/\\n/g, '<br/>') : ''}
                  </div>
                </div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              
              <div class="bottom-section">
                <div class="payment-info">
                  <div class="section-title">Payment Method</div>
                  <table style="border: none;">
                    <tr><td style="color: #9ca3af;">Name</td><td style="color: #fff;">${data.companyName}</td></tr>
                    <tr><td style="color: #9ca3af;">Bank</td><td style="color: #fff;">Global Bank</td></tr>
                  </table>
                </div>
                <div class="totals-box">
                  <div class="tot-row"><span>Sub-Total</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
                  ${data.discount > 0 ? `<div class="tot-row"><span>Discount</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
                  ${data.taxAmount > 0 ? `<div class="tot-row"><span>Tax</span><span>${data.currency}${Number(data.taxAmount).toFixed(2)}</span></div>` : ''}
                  <div class="grand-tot"><span>TOTAL</span><span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span></div>
                </div>
              </div>
              
              <div class="footer">
                <div class="contact-info">
                  <div class="section-title">Contact Information</div>
                  <p>${data.companyName}</p>
                </div>
                <div class="signature">
                  <div style="color: #fff; font-weight: 700;">${data.companyName}</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
"""

split_navy_case = """
    case 'split_navy':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Inter', sans-serif; display: flex; min-height: 1123px; }
              .left-sidebar { width: 35%; background: #faeddd; padding: 60px 40px; box-sizing: border-box; }
              .right-content { width: 65%; background: #111827; padding: 60px 40px; box-sizing: border-box; color: #fff; position: relative; }
              
              .section { margin-bottom: 50px; }
              .section-title { font-size: 16px; font-weight: 600; color: #4b5563; margin-bottom: 15px; }
              .info-text { font-size: 13px; color: #6b7280; line-height: 1.6; }
              .info-text strong { color: #111827; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
              
              .top-box { background: #faeddd; color: #111827; padding: 40px; border-radius: 0 0 0 40px; position: absolute; top: 0; right: 0; width: 350px; box-sizing: border-box; }
              .title { font-size: 48px; font-weight: 800; margin: 0 0 20px 0; letter-spacing: -1px; }
              .meta-table { width: 100%; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #4b5563; }
              .meta-table td { padding: 4px 0; border: none; }
              
              .table-container { margin-top: 150px; }
              th { text-align: left; padding: 15px 0; border-bottom: 1px solid #374151; color: #f3f4f6; font-size: 14px; font-weight: 600; }
              td { padding: 15px 0; font-size: 14px; color: #d1d5db; border-bottom: none; }
              
              .totals-container { margin-top: 40px; border-top: 1px solid #374151; padding-top: 20px; width: 250px; margin-left: auto; }
              .tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #d1d5db; }
              .grand-tot { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; color: #fff; font-weight: 600; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="left-sidebar">
              <div class="section">
                <div class="section-title">Invoice to</div>
                <div class="info-text">
                  <strong>${data.customerName}</strong>
                  ${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Payment details</div>
                <div class="info-text">
                  bank :<br/>
                  <strong>Global Bank</strong>
                  Account: 0123 456 789
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Contact</div>
                <div class="info-text">
                  <strong>${data.companyName}</strong>
                  ${data.companyAddress ? data.companyAddress.replace(/\\n/g, '<br/>') : ''}
                </div>
              </div>
            </div>
            
            <div class="right-content">
              <div style="color: #fff; width: 200px;">${logoHtml}</div>
              
              <div class="top-box">
                <h1 class="title">Invoice</h1>
                <table class="meta-table">
                  <tr><td>NO.</td><td style="text-align: right;">${data.invoiceNumber}</td></tr>
                  <tr><td>DATE.</td><td style="text-align: right;">${data.invoiceDate}</td></tr>
                  <tr><td>DUE.</td><td style="text-align: right;">${data.dueDate}</td></tr>
                </table>
              </div>
              
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 15%;">Qty</th>
                      <th style="width: 55%;">Description</th>
                      <th style="width: 30%; text-align: right;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.items.map(item => `
                      <tr>
                        <td>${item.quantity}</td>
                        <td>${item.name}</td>
                        <td style="text-align: right;">${data.currency}${Number(item.total).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                
                <div class="totals-container">
                  <div class="tot-row"><span>Sub-total:</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
                  ${data.discount > 0 ? `<div class="tot-row"><span>Discount:</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
                  ${data.taxAmount > 0 ? `<div class="tot-row"><span>tax (${data.taxRate}%):</span><span>${data.currency}${Number(data.taxAmount).toFixed(2)}</span></div>` : ''}
                  <div class="grand-tot"><span>Total:</span><span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
"""

split_rose_case = """
    case 'split_rose':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Playfair Display', serif; display: flex; min-height: 1123px; }
              .left-sidebar { width: 35%; background: #c19b8e; padding: 60px 40px; box-sizing: border-box; color: #fff; border-radius: 0 50px 50px 0; }
              .right-content { width: 65%; background: #fdf5f1; padding: 60px 40px; box-sizing: border-box; color: #4a4a4a; }
              
              .section { margin-bottom: 50px; }
              .section-title { font-size: 22px; font-weight: 600; color: #fdf5f1; margin-bottom: 15px; }
              .info-text { font-size: 15px; color: #fae8e1; line-height: 1.6; font-family: 'Inter', sans-serif; font-weight: 400; }
              .info-text strong { color: #fff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; font-weight: 600; }
              
              .title-area { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 60px; border-bottom: 1px solid #4a4a4a; padding-bottom: 20px; }
              .title { font-size: 64px; font-weight: 400; margin: 0; color: #2d2d2d; font-style: italic; }
              .meta-table { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #4a4a4a; font-family: 'Inter', sans-serif; }
              .meta-table td { padding: 4px 10px; border: none; }
              
              th { text-align: left; padding: 15px 0; border-bottom: 1px solid #4a4a4a; color: #4a4a4a; font-size: 16px; font-weight: 600; font-style: italic; }
              td { padding: 15px 0; font-size: 14px; color: #4a4a4a; border-bottom: none; font-family: 'Inter', sans-serif; }
              
              .totals-container { margin-top: 40px; border-top: 1px solid #4a4a4a; padding-top: 20px; width: 250px; margin-left: auto; font-family: 'Inter', sans-serif; }
              .tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #4a4a4a; }
              .grand-tot { display: flex; justify-content: space-between; padding: 15px 20px; font-size: 16px; color: #fff; font-weight: 600; background: #c19b8e; border-radius: 8px; margin-top: 10px; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="left-sidebar">
              <div style="margin-bottom: 60px;">${logoHtml}</div>
              
              <div class="section">
                <div class="section-title">Invoice to</div>
                <div class="info-text">
                  <strong>${data.customerName}</strong>
                  ${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Payment details</div>
                <div class="info-text">
                  bank :<br/>
                  <strong>Global Bank</strong>
                  Account: 0123 456 789<br/>
                  ${data.companyName}
                </div>
              </div>
              
              <div class="section">
                <div class="section-title">Contact</div>
                <div class="info-text">
                  <strong>${data.companyName}</strong>
                  ${data.companyAddress ? data.companyAddress.replace(/\\n/g, '<br/>') : ''}
                </div>
              </div>
            </div>
            
            <div class="right-content">
              <div class="title-area">
                <h1 class="title">Invoice</h1>
                <table class="meta-table">
                  <tr><td>NO.</td><td style="text-align: right;">${data.invoiceNumber}</td></tr>
                  <tr><td>DATE.</td><td style="text-align: right;">${data.invoiceDate}</td></tr>
                </table>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th style="width: 15%;">Qty</th>
                    <th style="width: 55%;">Description</th>
                    <th style="width: 30%; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map(item => `
                    <tr>
                      <td>${item.quantity}</td>
                      <td>${item.name}</td>
                      <td style="text-align: right;">${data.currency}${Number(item.total).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="totals-container">
                <div class="tot-row"><span>Sub-total:</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
                ${data.discount > 0 ? `<div class="tot-row"><span>Discount:</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
                ${data.taxAmount > 0 ? `<div class="tot-row"><span>tax (${data.taxRate}%):</span><span>${data.currency}${Number(data.taxAmount).toFixed(2)}</span></div>` : ''}
                <div class="grand-tot"><span>Total:</span><span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span></div>
              </div>
            </div>
          </body>
        </html>
      `;
"""

arch_green_case = """
    case 'arch_green':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Space Grotesk', sans-serif; background: #4d5c3f; padding: 20px; box-sizing: border-box; }
              .inner-page { background: #e2eccf; height: 100%; border-radius: 400px 400px 0 0; padding: 80px 60px; box-sizing: border-box; display: flex; flex-direction: column; border: 4px solid #8b5cf6; }
              
              .header { text-align: center; margin-bottom: 50px; }
              .logo { color: #8f7956; margin-bottom: 20px; }
              .title { font-size: 54px; font-weight: 800; color: #4d5c3f; letter-spacing: 4px; margin: 0; }
              .date { font-size: 16px; color: #4d5c3f; font-weight: 600; margin-top: 10px; }
              
              .meta-grid { display: flex; gap: 40px; margin-bottom: 40px; color: #111827; font-size: 15px; }
              .meta-col strong { display: inline-block; width: 90px; }
              
              table { margin-bottom: 40px; }
              th { text-align: left; padding: 15px; background: #c5d4b0; color: #111827; font-size: 15px; font-weight: 700; border-bottom: 2px solid #a3b885; }
              td { padding: 15px; font-size: 15px; color: #111827; border-bottom: 1px solid #c5d4b0; }
              
              .totals-row { display: flex; justify-content: space-between; background: #c5d4b0; padding: 15px; font-size: 20px; font-weight: 700; color: #111827; border-bottom: 2px solid #a3b885; }
              
              .footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 40px; border-top: 2px solid #c5d4b0; }
              .footer-section { width: 45%; }
              .footer-title { font-size: 14px; font-weight: 700; letter-spacing: 2px; margin-bottom: 15px; color: #4d5c3f; text-transform: uppercase; }
              .footer-table { font-size: 13px; color: #111827; font-weight: 500; }
              .footer-table td { border: none; padding: 4px 0; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="inner-page">
              <div class="header">
                <div class="logo">${logoHtml}</div>
                <h1 class="title">INVOICE</h1>
                <div class="date">Date : ${data.invoiceDate}</div>
              </div>
              
              <div class="meta-grid">
                <div class="meta-col" style="flex: 1;">
                  <div style="margin-bottom: 10px;"><strong>Invoice No</strong> : ${data.invoiceNumber}</div>
                  <div style="display: flex;">
                    <strong>Bill To</strong>
                    <div>: ${data.customerName}<br/>&nbsp;&nbsp;${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>&nbsp;&nbsp;') : ''}</div>
                  </div>
                </div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th style="width: 10%;">Item</th>
                    <th style="width: 50%;">Description</th>
                    <th style="width: 20%;">Price</th>
                    <th style="width: 20%;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}.</td>
                      <td>${item.name}</td>
                      <td>${data.currency}${Number(item.price).toFixed(2)}</td>
                      <td>${data.currency}${Number(item.total).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="totals-row">
                <span style="margin-left: auto; margin-right: 40px;">Total</span>
                <span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span>
              </div>
              
              <div class="footer">
                <div class="footer-section">
                  <div class="footer-title">PAY TO:</div>
                  <table class="footer-table">
                    <tr><td style="width: 120px;">Bank</td><td>: Global Bank</td></tr>
                    <tr><td>Account Name</td><td>: ${data.companyName}</td></tr>
                    <tr><td>Account Number</td><td>: 0123 4567 8901</td></tr>
                  </table>
                </div>
                <div class="footer-section">
                  <div class="footer-title">PAYMENT INFO:</div>
                  <table class="footer-table">
                    <tr><td style="width: 120px;">Phone Number</td><td>: 123-456-7890</td></tr>
                    <tr><td>Website</td><td>: www.example.com</td></tr>
                    <tr><td>Email Address</td><td>: contact@example.com</td></tr>
                  </table>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
"""

all_new_cases = thunder_case + gold_dark_case + split_navy_case + split_rose_case + arch_green_case

content = re.sub(r'(switch\s*\(id\)\s*\{)', r'\1' + all_new_cases, content)

with open('src/lib/invoiceTemplates.js', 'w') as f:
    f.write(content)

