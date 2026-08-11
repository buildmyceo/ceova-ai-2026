import re

with open('src/components/Chat.jsx', 'r') as f:
    code = f.read()

# Remove ActionConfirmModal
code = re.sub(r'\{actionMeta && \(\s*<div style=\{\{ marginTop: \'16px\' \}\}>\s*<ActionConfirmModal.*?</ActionConfirmModal>\s*</div>\s*\)\}', '', code, flags=re.DOTALL)

# Remove AI artifacts block
code = re.sub(r'\{/\* AI Generated Artifacts \*/\}.*?\{msg\.artifacts.*?</div>\s*\)\}', '', code, flags=re.DOTALL)

# Remove actionCard / actionMeta imports/destructuring if any (let's just do it manually if needed, but it should be fine)
code = re.sub(r'import ActionConfirmModal.*?\n', '', code)
code = re.sub(r'const actionMeta = msg\.action_meta;\n', '', code)

# Remove Planner progress messages rendering
code = re.sub(r'\{progressMessages && progressMessages\.length > 0 && \(.*?</div>\s*\)\}', '', code, flags=re.DOTALL)

with open('src/components/Chat.jsx', 'w') as f:
    f.write(code)

