import re
import os

with open('supabase/config.toml', 'r') as f:
    config = f.read()

deleted_functions = [
    'router',
    'google-handler',
    'email-engine',
    'email-sender',
    'autonomous-builder',
    'code-interpreter',
    'file-analysis',
    'workspace-fs',
    'save_custom_app'
]

for func in deleted_functions:
    pattern = r'\[functions\.' + re.escape(func) + r'\].*?(?=\n\[|$)'
    config = re.sub(pattern, '', config, flags=re.DOTALL)

with open('supabase/config.toml', 'w') as f:
    f.write(config)

