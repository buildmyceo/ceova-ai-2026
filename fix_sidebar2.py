import re

with open('src/components/Sidebar.jsx', 'r') as f:
    code = f.read()

# Remove the Task button specifically
code = re.sub(r'\s*<button[^>]*onClick=\{[^}]*onTaskClick[^}]*\}[^>]*>.*?Tasks.*?</button>', '', code, flags=re.DOTALL)

with open('src/components/Sidebar.jsx', 'w') as f:
    f.write(code)

