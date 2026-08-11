import re

with open('src/lib/invoiceTemplates.js', 'r') as f:
    content = f.read()

# Fix literal newline inside regex replace.
content = re.sub(r'replace\(\/\n\/g,', r'replace(/\\n/g,', content)

with open('src/lib/invoiceTemplates.js', 'w') as f:
    f.write(content)
