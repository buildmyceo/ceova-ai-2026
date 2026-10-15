const raw = `
Here is your code!
[FILE: index.html]
<!DOCTYPE html>
<html>
<body>Hello</body>
</html>
[/FILE]

[FILE: styles.css]
body {
  color: red;
`;

const files = [];
const blocks = raw.split(/\[FILE:\s*/i);

for (const block of blocks) {
  if (!block.trim()) continue;
  
  const closeBracketIdx = block.indexOf(']');
  if (closeBracketIdx === -1) continue;
  
  const path = block.substring(0, closeBracketIdx).trim();
  let content = block.substring(closeBracketIdx + 1);
  
  const endTagIdx = content.indexOf('[/FILE]');
  if (endTagIdx !== -1) {
    content = content.substring(0, endTagIdx);
  }
  
  content = content.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
  
  if (path && content) {
    files.push({ path, content });
  }
}

console.log(files);
