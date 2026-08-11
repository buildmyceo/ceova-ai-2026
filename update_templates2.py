import re

with open('src/lib/invoiceTemplates.js', 'r') as f:
    content = f.read()

# Update the list
new_list = """export const invoiceTemplatesList = [
  { id: 'minimal_line', name: 'Minimal Line' },
  { id: 'geo_blue', name: 'Geometric Blue' },
  { id: 'blocky_orange', name: 'Blocky Orange' },
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

minimal_line_case = """
    case 'minimal_line':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Space Grotesk', sans-serif; color: #4b5563; padding: 60px; box-sizing: border-box; }
              .header { display: flex; align-items: center; margin-bottom: 80px; margin-top: 40px; }
              .title { font-size: 54px; font-weight: 500; letter-spacing: 6px; text-transform: uppercase; margin: 0; color: #374151; margin-right: 20px; }
              .header-line { flex-grow: 1; height: 1px; background: #9ca3af; margin-top: 5px; }
              
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 60px; }
              .info-col { width: 45%; }
              .section-title { font-size: 13px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
              .info-text { font-size: 14px; color: #6b7280; line-height: 1.6; }
              .info-text strong { color: #374151; font-weight: 500; display: block; margin-bottom: 4px; }
              
              .meta-table { font-size: 13px; color: #6b7280; width: 100%; text-align: right; }
              .meta-table td { padding: 4px 0; border: none; }
              .meta-label { font-weight: 700; color: #374151; letter-spacing: 1px; width: 60%; }
              .meta-value { font-weight: 500; }
              
              th { text-align: left; padding: 15px 10px; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
              td { padding: 15px 10px; font-size: 14px; color: #6b7280; border-bottom: none; font-weight: 500; }
              
              .totals-box { width: 250px; margin-left: auto; border-top: 1px solid #9ca3af; margin-top: 20px; padding-top: 20px; }
              .tot-row { display: flex; justify-content: space-between; padding: 5px 10px; font-size: 14px; color: #6b7280; }
              .grand-tot { display: flex; justify-content: space-between; padding: 10px; font-size: 15px; font-weight: 700; color: #111827; }
              
              .signature-area { display: flex; justify-content: flex-end; margin-top: 60px; }
              .signature { text-align: center; border-bottom: 1px solid #9ca3af; padding-bottom: 10px; width: 200px; color: #111827; font-family: 'Playfair Display', serif; font-style: italic; font-size: 24px; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div style="margin-bottom: 20px;">${logoHtml}</div>
            <div class="header">
              <h1 class="title">INVOICE</h1>
              <div class="header-line"></div>
            </div>
            
            <div class="info-grid">
              <div class="info-col">
                <div class="section-title">ISSUED TO:</div>
                <div class="info-text">
                  <strong>${data.customerName}</strong>
                  ${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}
                </div>
                
                <div class="section-title" style="margin-top: 30px;">PAY TO:</div>
                <div class="info-text">
                  Bank Name: Global Bank<br/>
                  Account Name: ${data.companyName}<br/>
                  Account No.: 0123 4567 8901
                </div>
              </div>
              <div class="info-col">
                <table class="meta-table">
                  <tr><td class="meta-label">INVOICE NO:</td><td class="meta-value">${data.invoiceNumber}</td></tr>
                  <tr><td class="meta-label">DATE:</td><td class="meta-value">${data.invoiceDate}</td></tr>
                  <tr><td class="meta-label">DUE DATE:</td><td class="meta-value">${data.dueDate}</td></tr>
                </table>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">Description</th>
                  <th style="width: 20%; text-align: center;">Unit Price</th>
                  <th style="width: 15%; text-align: center;">Qty</th>
                  <th style="width: 15%; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${data.currency}${Number(item.price).toFixed(2)}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${data.currency}${Number(item.total).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals-box">
              <div class="tot-row"><span>SUBTOTAL</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
              ${data.discount > 0 ? `<div class="tot-row"><span>Discount</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
              ${data.taxAmount > 0 ? `<div class="tot-row"><span>Tax (${data.taxRate}%)</span><span>${data.currency}${Number(data.taxAmount).toFixed(2)}</span></div>` : ''}
              <div class="grand-tot"><span>TOTAL</span><span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span></div>
            </div>
            
            <div class="signature-area">
              <div class="signature">${data.companyName}</div>
            </div>
          </body>
        </html>
      `;
"""

geo_blue_case = """
    case 'geo_blue':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Inter', sans-serif; display: flex; min-height: 1123px; color: #111827; }
              .sidebar { width: 120px; background-color: #f0f9ff; background-image: radial-gradient(#0369a1 20%, transparent 20%), radial-gradient(#0ea5e9 20%, transparent 20%); background-position: 0 0, 40px 40px; background-size: 80px 80px; position: relative; }
              .sidebar::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, rgba(240,249,255,0.9) 0%, rgba(240,249,255,0.5) 100%); }
              .content { flex: 1; padding: 60px 50px; box-sizing: border-box; }
              
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 80px; }
              .logo-area { display: flex; align-items: center; gap: 10px; color: #0369a1; font-weight: 700; font-size: 24px; }
              .title-area { text-align: right; border-bottom: 6px solid #0ea5e9; padding-bottom: 5px; }
              .title { font-size: 56px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0; color: #0369a1; }
              
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 50px; }
              .section-title { font-size: 14px; font-weight: 700; color: #0369a1; text-transform: uppercase; margin-bottom: 10px; }
              .info-text { font-size: 14px; color: #4b5563; line-height: 1.6; }
              .info-text strong { color: #111827; font-weight: 600; display: block; margin-bottom: 4px; }
              
              .meta-table { font-size: 14px; color: #4b5563; font-weight: 500; }
              .meta-table td { padding: 4px 10px 4px 0; border: none; }
              .meta-label { font-weight: 700; color: #0369a1; text-transform: uppercase; }
              
              th { text-align: left; padding: 12px 15px; background: #e0f2fe; color: #0369a1; font-size: 13px; font-weight: 700; text-transform: uppercase; border: none; }
              td { padding: 15px; font-size: 14px; color: #4b5563; border-bottom: 1px solid #f3f4f6; }
              
              .totals-box { width: 100%; border-top: 2px solid #0369a1; margin-top: 20px; }
              .tot-row { display: flex; justify-content: space-between; padding: 10px 15px; font-size: 14px; color: #0369a1; font-weight: 700; }
              .grand-tot { display: flex; justify-content: flex-end; gap: 20px; padding: 15px; font-size: 16px; font-weight: 800; color: #111827; background: #e0f2fe; }
              
              .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 80px; }
              .bank-details { width: 50%; }
              .signature { text-align: center; }
              .signature img { display: block; height: 50px; margin: 10px auto; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="sidebar"></div>
            <div class="content">
              <div class="header">
                <div class="logo-area">${logoHtml}</div>
                <div class="title-area">
                  <h1 class="title">INVOICE</h1>
                </div>
              </div>
              
              <div class="info-grid">
                <div>
                  <div class="section-title">ISSUED TO:</div>
                  <div class="info-text">
                    <strong>${data.customerName}</strong>
                    ${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}
                  </div>
                </div>
                <div>
                  <table class="meta-table">
                    <tr><td class="meta-label">INVOICE NO</td><td>: ${data.invoiceNumber}</td></tr>
                    <tr><td class="meta-label">DATE</td><td>: ${data.invoiceDate}</td></tr>
                    <tr><td class="meta-label">DUE DATE</td><td>: ${data.dueDate}</td></tr>
                  </table>
                </div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th style="width: 50%;">Description</th>
                    <th style="width: 20%; text-align: center;">Price</th>
                    <th style="width: 15%; text-align: center;">Qty</th>
                    <th style="width: 15%; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map(item => `
                    <tr>
                      <td>${item.name}</td>
                      <td style="text-align: center;">${data.currency}${Number(item.price).toFixed(2)}</td>
                      <td style="text-align: center;">${item.quantity}</td>
                      <td style="text-align: right;">${data.currency}${Number(item.total).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="totals-box">
                <div class="tot-row"><span>SUBTOTAL</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
                ${data.discount > 0 ? `<div class="tot-row" style="color: #64748b; font-weight: 500;"><span>Discount</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
                ${data.taxAmount > 0 ? `<div class="tot-row" style="color: #64748b; font-weight: 500;"><span>Tax</span><span>${data.taxRate}%</span></div>` : ''}
                <div class="grand-tot"><span>TOTAL</span><span>${data.currency}${Number(data.grandTotal).toFixed(2)}</span></div>
              </div>
              
              <div class="footer">
                <div class="bank-details">
                  <div class="section-title">BANK DETAILS</div>
                  <div class="info-text">
                    Global Bank<br/>
                    Account Name: ${data.companyName}<br/>
                    Account No.: 0123 4567 8901
                  </div>
                  <div class="info-text" style="margin-top: 30px; font-size: 13px;">
                    ${data.companyAddress ? data.companyAddress.replace(/\\n/g, '<br/>') : ''}<br/>
                  </div>
                </div>
                <div class="signature">
                  <div class="section-title" style="color: #111827; letter-spacing: 2px;">THANK YOU</div>
                  <div style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 24px; margin-top: 20px; border-bottom: 1px solid #9ca3af; padding: 0 20px;">${data.companyName}</div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
"""

blocky_orange_case = """
    case 'blocky_orange':
      return `
        <html>
          <head>
            <style>
              ${commonStyles}
              body { font-family: 'Space Grotesk', sans-serif; color: #374151; padding: 0; box-sizing: border-box; background: #fdfdfd; }
              .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 60px; padding-top: 40px; }
              .logo-container { padding-left: 50px; }
              .title-box { background: #262626; color: #fff; padding: 30px 60px 30px 40px; border-radius: 40px 0 0 0; clip-path: polygon(20px 0%, 100% 0, 100% 100%, 0% 100%); width: 350px; text-align: right; }
              .title { font-size: 42px; font-weight: 700; letter-spacing: 3px; margin: 0; color: #fff; }
              
              .info-grid { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 0 50px; }
              .section-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 10px; text-transform: uppercase; }
              .info-text { font-size: 14px; color: #4b5563; line-height: 1.6; }
              .info-text strong { color: #111827; font-weight: 700; font-size: 16px; display: block; margin-bottom: 4px; }
              
              .meta-table { font-size: 13px; color: #4b5563; text-align: right; margin-left: auto; }
              .meta-table td { padding: 4px 0 4px 15px; border: none; }
              .meta-label { color: #6b7280; }
              
              .table-wrap { padding: 0 50px; }
              th { text-align: left; padding: 15px; font-size: 13px; font-weight: 700; text-transform: uppercase; color: #fff; }
              th:nth-child(1) { background: #111827; }
              th:nth-child(2) { background: #4b5563; text-align: center; }
              th:nth-child(3) { background: #6b7280; text-align: center; }
              th:nth-child(4) { background: #9ca3af; text-align: right; }
              
              td { padding: 15px; font-size: 14px; color: #4b5563; border: none; }
              td:nth-child(2), td:nth-child(3) { text-align: center; }
              td:nth-child(4) { text-align: right; }
              tbody tr:nth-child(odd) { background: #e5e7eb; }
              tbody tr:nth-child(even) { background: #f3f4f6; }
              
              .bottom-section { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 50px; }
              .payment-info { width: 50%; }
              .payment-table { font-size: 13px; color: #4b5563; }
              .payment-table td { border: none; padding: 3px 15px 3px 0; }
              
              .totals-box { width: 350px; }
              .tot-row { display: flex; justify-content: space-between; padding: 5px 15px; font-size: 15px; color: #111827; font-weight: 600; }
              .tax-row { display: flex; justify-content: space-between; padding: 5px 15px; font-size: 15px; color: #f97316; }
              
              .grand-tot-box { display: flex; background: #9ca3af; margin-top: 15px; color: #fff; font-weight: 700; font-size: 18px; }
              .gt-label { background: #9ca3af; padding: 15px; flex: 1; }
              .gt-value { background: #6b7280; padding: 15px; flex: 1; text-align: right; }
              .gt-extra { background: #4b5563; width: 40px; }
              .gt-extra2 { background: #111827; width: 40px; }
              
              .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; padding: 0 50px 40px 50px; }
              .terms { width: 50%; }
              .terms h4 { margin: 0 0 5px 0; font-size: 15px; color: #111827; text-transform: uppercase; }
              .terms p { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
              .signature { text-align: center; font-family: 'Playfair Display', serif; font-size: 24px; border-bottom: 1px solid #111827; padding: 0 20px 5px 20px; color: #111827; }
              .signature-title { font-family: 'Inter', sans-serif; font-size: 13px; color: #111827; font-weight: 600; margin-top: 5px; text-align: center; }
              
              .contact-bar { display: flex; justify-content: space-between; padding: 0 50px; margin-top: 20px; font-size: 13px; color: #4b5563; }
              .contact-bar strong { color: #111827; display: block; margin-bottom: 4px; font-size: 14px; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            <div class="header">
              <div class="logo-container">${logoHtml}</div>
              <div class="title-box">
                <h1 class="title">INVOICE</h1>
              </div>
            </div>
            
            <div class="info-grid">
              <div>
                <div class="section-title">TO</div>
                <div class="info-text">
                  <strong>${data.customerName}</strong>
                  ${data.customerAddress ? data.customerAddress.replace(/\\n/g, '<br/>') : ''}
                </div>
              </div>
              <div>
                <div class="section-title" style="text-align: right;">DETAIL</div>
                <table class="meta-table">
                  <tr><td class="meta-label">Invoice</td><td>${data.invoiceNumber}</td></tr>
                  <tr><td class="meta-label">Date</td><td>${data.invoiceDate}</td></tr>
                  <tr><td class="meta-label">Due Date</td><td>${data.dueDate}</td></tr>
                </table>
              </div>
            </div>
            
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width: 45%;">Description</th>
                    <th style="width: 20%;">Price</th>
                    <th style="width: 15%;">Qty</th>
                    <th style="width: 20%;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map(item => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${data.currency}${Number(item.price).toFixed(2)}</td>
                      <td>${item.quantity}</td>
                      <td>${data.currency}${Number(item.total).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="bottom-section">
              <div class="payment-info">
                <div class="section-title">PAYMENT METHOD</div>
                <table class="payment-table">
                  <tr><td>Bank Name</td><td>: Global Bank</td></tr>
                  <tr><td>Account Number</td><td>: 01234567890</td></tr>
                </table>
              </div>
              <div class="totals-box">
                <div class="tot-row"><span>Sub Total</span><span>${data.currency}${Number(data.subtotal).toFixed(2)}</span></div>
                ${data.discount > 0 ? `<div class="tot-row"><span>Discount</span><span>-${data.currency}${Number(data.discount).toFixed(2)}</span></div>` : ''}
                ${data.taxAmount > 0 ? `<div class="tax-row"><span>Tax ${data.taxRate}%</span><span>${data.currency}${Number(data.taxAmount).toFixed(2)}</span></div>` : ''}
                
                <div class="grand-tot-box">
                  <div class="gt-label">TOTAL</div>
                  <div class="gt-value">${data.currency}${Number(data.grandTotal).toFixed(2)}</div>
                  <div class="gt-extra"></div>
                  <div class="gt-extra2"></div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="terms">
                <h4>TERMS & CONDITION</h4>
                <p>Please send payment within 30 days of receiving this invoice. There will be a 10% interest charge per month on late invoices.</p>
              </div>
              <div>
                <div class="signature">${data.companyName}</div>
                <div class="signature-title">Administrator</div>
              </div>
            </div>
            
            <div class="contact-bar">
              <div><strong>Physical Address</strong><br/>${data.companyAddress ? data.companyAddress.replace(/\\n/g, '<br/>') : '123 Anywhere St., Any City'}</div>
              <div><strong>Phone</strong><br/>+123-456-7890</div>
              <div><strong>Email</strong><br/>contact@example.com</div>
            </div>
          </body>
        </html>
      `;
"""

all_new_cases = minimal_line_case + geo_blue_case + blocky_orange_case

content = re.sub(r'(switch\s*\(id\)\s*\{)', r'\1' + all_new_cases, content)

with open('src/lib/invoiceTemplates.js', 'w') as f:
    f.write(content)
