import re

with open('src/pages/Home.jsx.bak', 'r') as f:
    code = f.read()

# 1. Remove imports
imports_to_remove = [
    r"import ConnectorModal.*?\n",
    r"import SettingsModal.*?\n",
    r"import TaskModal.*?\n",
    r"import ActionConfirmModal.*?\n",
    r"import \{ useCapabilities \}.*?\n",
    r"import usePlanner.*?\n",
    r"import IntegratedIDE.*?\n",
    r"import WorkspaceSelector.*?\n",
    r"import TerminalPanel.*?\n",
    r"import DevChat.*?\n",
    r"import CodeEditor.*?\n",
    r"import FileTree.*?\n",
    r"import DeploymentStatus.*?\n",
]
for p in imports_to_remove:
    code = re.sub(p, "", code)

# 2. Remove states related to IDE, Planners, Connectors
states_to_remove = [
    r"const \[isConnectorsOpen.*?\n    \}\);\n",
    r"const \[isTaskModalOpen, setIsTaskModalOpen\] = useState\(false\);\n",
    r"const \{ capabilitySnapshot, refreshCapabilities \} = useCapabilities\(\);\n",
    r"const \[activeDeveloperWorkspace, setActiveDeveloperWorkspace\] = useState\(null\);\n",
    r"const \[showIDE, setShowIDE\] = useState\(false\);\n",
    r"const \[actionConfirmOpen, setActionConfirmOpen\] = useState\(false\);\n",
    r"const \[actionPreview, setActionPreview\] = useState\(null\);\n",
    r"const \[pendingPlan, setPendingPlan\] = useState\(null\);\n",
]
for p in states_to_remove:
    code = re.sub(p, "", code)

# We will just write a simpler Home.jsx because regex is too fragile for a 1000 line React component.
