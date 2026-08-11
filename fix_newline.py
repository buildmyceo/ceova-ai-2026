with open('src/lib/invoiceTemplates.js', 'r') as f:
    content = f.read()

content = content.replace("replace(/\n/g, '<br/>')", r"replace(/\n/g, '<br/>')")

with open('src/lib/invoiceTemplates.js', 'w') as f:
    f.write(content)
