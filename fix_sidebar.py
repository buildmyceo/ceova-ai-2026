import re

with open('src/components/Sidebar.jsx', 'r') as f:
    code = f.read()

# Remove Developer Mode / Tasks buttons from sidebar
code = re.sub(r'<button className="sidebar-action-item".*?onTaskClick.*?/button>', '', code, flags=re.DOTALL)
code = re.sub(r'<button className="sidebar-action-item".*?Glasses.*?/button>', '', code, flags=re.DOTALL)

with open('src/components/Sidebar.jsx', 'w') as f:
    f.write(code)

