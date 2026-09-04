// Unit test for extractBuildDiagnostics logic matching AgenticCodingEngine

function extractBuildDiagnostics(buildResult, projectFiles) {
  let targetFile = 'index.html';
  let targetLine = 1;
  let targetColumn = undefined;
  let errorMessage = 'Build compilation or test failure';

  const firstError = buildResult.errors?.[0];
  if (firstError) {
    if (firstError.file) targetFile = firstError.file;
    if (firstError.line) targetLine = firstError.line;
    if (firstError.column) targetColumn = firstError.column;
    if (firstError.message) errorMessage = firstError.message;
  }

  const fullLogText = `${buildResult.logs || ''}\n${errorMessage}`;

  if (!firstError?.file || !firstError?.line) {
    const fileLineColMatch = fullLogText.match(
      /([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)(?:\((\d+),(\d+)\)|:(\d+)(?::(\d+))?)\s*[-:]?\s*([^\n\r]*)/i
    );
    if (fileLineColMatch) {
      targetFile = fileLineColMatch[1];
      targetLine = parseInt(fileLineColMatch[2] || fileLineColMatch[4], 10);
      if (fileLineColMatch[3] || fileLineColMatch[5]) {
        targetColumn = parseInt(fileLineColMatch[3] || fileLineColMatch[5], 10);
      }
      if (fileLineColMatch[6] && fileLineColMatch[6].trim()) {
        errorMessage = fileLineColMatch[6].trim();
      }
    } else {
      const syntaxMatch = fullLogText.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+):(\d+)\s*[-:]?\s*([^\n\r]+)/i);
      if (syntaxMatch) {
        targetFile = syntaxMatch[1];
        targetLine = parseInt(syntaxMatch[2], 10);
        if (syntaxMatch[3]) errorMessage = syntaxMatch[3].trim();
      } else {
        const rollupMatch = fullLogText.match(/\[(?:vite|rollup|esbuild)\]\s*([^\n\r]+)/i);
        if (rollupMatch) {
          errorMessage = rollupMatch[1].trim();
        }
      }
    }
  }

  targetFile = targetFile.replace(/^\.\//, '').trim();

  let relevantSlice;
  const file = projectFiles.find(f => f.path === targetFile);
  if (file) {
    const lines = file.content.split('\n');
    targetLine = Math.min(lines.length, Math.max(1, targetLine));
    const startLine = Math.max(1, targetLine - 5);
    const endLine = Math.min(lines.length, targetLine + 6);
    const sliceLines = lines.slice(startLine - 1, endLine).map((l, idx) => {
      const lineNum = startLine + idx;
      const marker = lineNum === targetLine ? ' > ' : '   ';
      return `${marker}${lineNum}: ${l}`;
    }).join('\n');

    relevantSlice = {
      path: targetFile,
      startLine,
      endLine,
      content: sliceLines,
    };
  }

  const formattedText = `Build failed\n\nFile:\n${targetFile}\n\nLine:\n${targetLine}\n\nError:\n${errorMessage}${
    relevantSlice ? `\n\nRelevant Code (Lines ${relevantSlice.startLine}-${relevantSlice.endLine}):\n${relevantSlice.content}` : ''
  }`;

  return {
    file: targetFile,
    line: targetLine,
    column: targetColumn,
    error: errorMessage,
    relevantSlice,
    formattedText,
  };
}

console.log('=== RUNNING UNIT TESTS FOR BUILD ERROR DIAGNOSTICS ===\n');

const mockFiles = [
  {
    path: 'src/components/Hero.jsx',
    content: [
      'import React from "react";',
      'export function Hero() {',
      '  const title = "Welcome";',
      '  return (',
      '    <div className="hero">',
      '      <h1>{title}</h1>',
      '      <p>Best food in town</p>',
      '      <button onClick={() => alert("test")}>Order</button>',
      '    </div>',
      '  );',
      '}'
    ].join('\n')
  },
  {
    path: 'index.html',
    content: [
      '<!DOCTYPE html>',
      '<html>',
      '<head><title>Test</title></head>',
      '<body>',
      '  <h1>Hello</h1>',
      '  <script type="text/javascript">',
      '</body>',
      '</html>'
    ].join('\n')
  }
];

// Test Case 1: TypeScript error format "src/components/Hero.jsx(6,11): error TS2304: Cannot find name 'title'"
console.log('Test 1: TypeScript error syntax "File(line,col): error"');
const result1 = extractBuildDiagnostics({
  success: false,
  errors: [{ message: "src/components/Hero.jsx(6,11): error TS2304: Cannot find name 'title'" }],
  logs: "Compiling TypeScript...\nsrc/components/Hero.jsx(6,11): error TS2304: Cannot find name 'title'"
}, mockFiles);

console.log(`- File: ${result1.file} (expected: src/components/Hero.jsx)`);
console.log(`- Line: ${result1.line} (expected: 6)`);
console.log(`- Column: ${result1.column} (expected: 11)`);
console.log(`- Has slice: ${!!result1.relevantSlice}`);
if (result1.file !== 'src/components/Hero.jsx' || result1.line !== 6 || result1.column !== 11) {
  throw new Error('Test 1 failed!');
}
console.log('✓ Test 1 passed!\n');

// Test Case 2: Standard error format "index.html:6 - HTML syntax error: mismatched <script> tags"
console.log('Test 2: Standard error syntax "file:line - message"');
const result2 = extractBuildDiagnostics({
  success: false,
  errors: [{ file: 'index.html', line: 6, message: 'HTML syntax error: mismatched <script> tags' }],
  logs: "Running automated sanity tests...\n  [FAIL] Test 4: Script tag closure check at line 6"
}, mockFiles);

console.log(`- File: ${result2.file} (expected: index.html)`);
console.log(`- Line: ${result2.line} (expected: 6)`);
console.log(`- Code slice pointer found: ${result2.relevantSlice?.content.includes(' > 6:')}`);
if (result2.file !== 'index.html' || result2.line !== 6 || !result2.relevantSlice?.content.includes(' > 6:')) {
  throw new Error('Test 2 failed!');
}
console.log('✓ Test 2 passed!\n');

// Test Case 3: Log extraction when errors array lacks line/file
console.log('Test 3: Log regex fallback when errors array has generic message');
const result3 = extractBuildDiagnostics({
  success: false,
  errors: [{ message: 'Build failed' }],
  logs: "[vite:esbuild] Transform failed with 1 error:\nsrc/components/Hero.jsx:8:6: ERROR: Expected \";\" but found \"(\""
}, mockFiles);

console.log(`- File: ${result3.file} (expected: src/components/Hero.jsx)`);
console.log(`- Line: ${result3.line} (expected: 8)`);
console.log(`- Column: ${result3.column} (expected: 6)`);
console.log(`- Formatted text contains "Build failed": ${result3.formattedText.startsWith('Build failed')}`);
if (result3.file !== 'src/components/Hero.jsx' || result3.line !== 8) {
  throw new Error('Test 3 failed!');
}
console.log('✓ Test 3 passed!\n');

console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY!');
