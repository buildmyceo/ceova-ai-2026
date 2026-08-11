import re

with open('src/pages/Home.jsx', 'r') as f:
    code = f.read()

# Remove imports
imports_to_remove = [
    r"import ConnectorModal.*",
    r"import SettingsModal.*",
    r"import TaskModal.*",
    r"import ActionConfirmModal.*",
    r"import \{ useCapabilities \}.*",
    r"import usePlanner.*",
    r"import IntegratedIDE.*",
    r"import \{ FileText \}.*",
]
for p in imports_to_remove:
    code = re.sub(p, "", code)

# We can do this manually by replacing blocks.
# Let's save a backup first.
