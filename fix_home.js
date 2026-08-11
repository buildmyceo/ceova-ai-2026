const fs = require('fs');
const content = fs.readFileSync('/Users/chintukumar/AIAvatarApp/src/pages/Home.jsx', 'utf8');
const newContent = content.replace(/\/\/ 1\. Instant Cache Load([\s\S]*?)try {([\s\S]*?)const cachedChats = await cacheManager\.getChats\(\);([\s\S]*?)console\.error\("Cache load error:", cacheErr\);\n\s*}/m, '// Cache load disabled');
fs.writeFileSync('/Users/chintukumar/AIAvatarApp/src/pages/Home.jsx', newContent);
console.log("Replaced cache load");
