const raw = `
Sure! Here is the website:

[FILE: index.html]
<!DOCTYPE html>
<html>
<body>Hello</body>
</html>
[/FILE]

[FILE: styles.css]
body { color: red; }
[/FILE]
`;

const regex = /\[FILE:\s*([a-zA-Z0-9_\-\./]+)\]([\s\S]*?)\[\/FILE\]/gi;
const files = [];
let match;
while ((match = regex.exec(raw)) !== null) {
  if (match[1] && match[2] !== undefined) {
    files.push({
      path: match[1].trim(),
      content: match[2].trim()
    });
  }
}

console.log(files);
