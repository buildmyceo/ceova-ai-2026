import re

file_path = "src/lib/invoiceTemplates.js"
with open(file_path, "r") as f:
    content = f.read()

replacements = [
    # Variation 1
    (r"Bank Name: Global Bank<br/>\s*Account Name: \$\{data\.companyName\}<br/>\s*Account No\.: 0123 4567 8901",
     r"Mode of Payment: ${data.modeOfPayment}<br/>Paid Amount: ${data.currency}${Number(data.paidAmount).toFixed(2)}<br/>Pending Fees: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}"),
    
    # Variation 2
    (r"<div class=\"section-title\">BANK DETAILS</div>\s*<div class=\"info-text\">\s*Global Bank<br/>\s*Account Name: \$\{data\.companyName\}<br/>\s*Account No\.: 0123 4567 8901\s*</div>",
     r"<div class=\"section-title\">PAYMENT DETAILS</div>\n                  <div class=\"info-text\">\n                    Mode of Payment: ${data.modeOfPayment}<br/>\n                    Paid Amount: ${data.currency}${Number(data.paidAmount).toFixed(2)}<br/>\n                    Pending Fees: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}\n                  </div>"),

    # Variation 3
    (r"<tr><td>Bank Name</td><td>: Global Bank</td></tr>\s*<tr><td>Account Number</td><td>: 01234567890</td></tr>",
     r"<tr><td>Mode of Payment</td><td>: ${data.modeOfPayment}</td></tr>\n                  <tr><td>Paid Amount</td><td>: ${data.currency}${Number(data.paidAmount).toFixed(2)}</td></tr>\n                  <tr><td>Pending Fees</td><td>: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}</td></tr>"),

    # Variation 4
    (r"<h4>Payment Method</h4>\s*<p>Bank Name : Bank<br/>Account No : 1234567890</p>",
     r"<h4>Payment Details</h4>\n                  <p>Mode: ${data.modeOfPayment}<br/>Paid: ${data.currency}${Number(data.paidAmount).toFixed(2)}<br/>Pending: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}</p>"),

    # Variation 5
    (r"<tr><td style=\"color: #9ca3af;\">Name</td><td style=\"color: #fff;\">\$\{data\.companyName\}</td></tr>\s*<tr><td style=\"color: #9ca3af;\">Bank</td><td style=\"color: #fff;\">Global Bank</td></tr>",
     r"<tr><td style=\"color: #9ca3af;\">Payment Mode</td><td style=\"color: #fff;\">${data.modeOfPayment}</td></tr>\n                    <tr><td style=\"color: #9ca3af;\">Paid Amount</td><td style=\"color: #fff;\">${data.currency}${Number(data.paidAmount).toFixed(2)}</td></tr>\n                    <tr><td style=\"color: #9ca3af;\">Pending Fees</td><td style=\"color: #fff;\">${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}</td></tr>"),

    # Variation 6 (without company name)
    (r"bank :<br/>\s*<strong>Global Bank</strong>\s*Account: 0123 456 789(?!<br/>)",
     r"Payment Mode :<br/>\n                  <strong>${data.modeOfPayment}</strong><br/><br/>\n                  Paid: ${data.currency}${Number(data.paidAmount).toFixed(2)}<br/>\n                  Pending: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}"),

    # Variation 7 (with company name)
    (r"bank :<br/>\s*<strong>Global Bank</strong>\s*Account: 0123 456 789<br/>\s*\$\{data\.companyName\}",
     r"Payment Mode :<br/>\n                  <strong>${data.modeOfPayment}</strong><br/><br/>\n                  Paid: ${data.currency}${Number(data.paidAmount).toFixed(2)}<br/>\n                  Pending: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}"),

    # Variation 8
    (r"<tr><td style=\"width: 120px;\">Bank</td><td>: Global Bank</td></tr>\s*<tr><td>Account Name</td><td>: \$\{data\.companyName\}</td></tr>\s*<tr><td>Account Number</td><td>: 0123 4567 8901</td></tr>",
     r"<tr><td style=\"width: 120px;\">Payment Mode</td><td>: ${data.modeOfPayment}</td></tr>\n                    <tr><td>Paid Amount</td><td>: ${data.currency}${Number(data.paidAmount).toFixed(2)}</td></tr>\n                    <tr><td>Pending Fees</td><td>: ${data.currency}${Number(data.grandTotal - data.paidAmount).toFixed(2)}</td></tr>")
]

for pat, rep in replacements:
    content, count = re.subn(pat, rep, content, flags=re.MULTILINE)
    print(f"Replaced {count} occurrences for pattern")

with open(file_path, "w") as f:
    f.write(content)
