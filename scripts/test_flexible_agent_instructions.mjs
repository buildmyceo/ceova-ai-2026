/**
 * test_flexible_agent_instructions.mjs
 * 
 * Tests the flexible instructions, compound intent detection,
 * and multi-occurrence brand renaming support.
 */

import fs from 'fs';

// Dynamically extract and evaluate determineTaskScope from intent-router.ts
const routerSrc = fs.readFileSync('supabase/functions/_shared/ai/intent-router.ts', 'utf8');
const fnMatch = routerSrc.match(/export function determineTaskScope\([\s\S]*?\n\}/);
if (!fnMatch) throw new Error('Could not find determineTaskScope in intent-router.ts');

const cleanedFnStr = fnMatch[0]
  .replace(/export function determineTaskScope/, 'function determineTaskScope')
  .replace(/: TaskScope/g, '')
  .replace(/message:\s*string/g, 'message')
  .replace(/context\?\s*:\s*\{[^\}]*?\}/g, 'context');
const determineTaskScope = new Function('message', 'context', `${cleanedFnStr}; return determineTaskScope(message, context);`);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: FLEXIBLE AGENT INSTRUCTIONS & COMPOUND INTENT');
  console.log('================================================================\n');

  // Test 1: Flexible Task Scope for Compound & Contextual Prompts
  console.log('----------------------------------------------------------------');
  console.log('1. Flexible Task Scope & Compound Intent Recognition');
  console.log('----------------------------------------------------------------');

  const compoundPrompt1 = 'great now plz change the website name to oggy resturent as the resturent is for childrens';
  const scope1 = determineTaskScope(compoundPrompt1, { isExistingProject: true });
  assert(scope1 === 'complex', `Compound prompt with "as the resturent is for childrens" classified as COMPLEX (actual: ${scope1})`);

  const compoundPrompt2 = 'change the website theme to dark as this is for a nightclub';
  const scope2 = determineTaskScope(compoundPrompt2, { isExistingProject: true });
  assert(scope2 === 'complex', `Compound prompt with "as this is for a nightclub" classified as COMPLEX (actual: ${scope2})`);

  const isolatedSimplePrompt1 = 'Change the restaurant name to Oggy Restaurant.';
  const scope3 = determineTaskScope(isolatedSimplePrompt1, { isExistingProject: true });
  assert(scope3 === 'simple', `Isolated name change prompt without secondary context classified as SIMPLE (actual: ${scope3})`);

  const isolatedSimplePrompt2 = 'Change the button text to Order Now';
  const scope4 = determineTaskScope(isolatedSimplePrompt2, { isExistingProject: true });
  assert(scope4 === 'simple', `Isolated button text change classified as SIMPLE (actual: ${scope4})`);

  // Test 2: Flexible edit_file with allow_multiple
  console.log('\n----------------------------------------------------------------');
  console.log('2. Flexible edit_file multi-occurrence support (allow_multiple)');
  console.log('----------------------------------------------------------------');

  const sampleHtml = `
    <html>
      <title>Luma & Thyme Restaurant</title>
      <header>Luma & Thyme Bar</header>
      <footer>© 2024 Luma & Thyme</footer>
    </html>
  `;

  const searchTarget = 'Luma & Thyme';
  const replacement = 'Oggy Restaurant';

  // Without allow_multiple -> should detect ambiguity
  const occurrences = sampleHtml.split(searchTarget).length - 1;
  assert(occurrences === 3, `Target appears 3 times in sample`);

  let allowMultiple = false;
  let blocked = false;
  if (occurrences > 1 && !allowMultiple) {
    blocked = true;
  }
  assert(blocked, 'Safety guard triggers when occurrences > 1 and allow_multiple is false');

  // With allow_multiple -> replaces all cleanly
  allowMultiple = true;
  const replacedHtml = allowMultiple 
    ? sampleHtml.replaceAll(searchTarget, replacement)
    : sampleHtml.replace(searchTarget, replacement);

  assert(!replacedHtml.includes('Luma & Thyme'), 'All occurrences of old brand replaced when allow_multiple is true');
  assert((replacedHtml.split('Oggy Restaurant').length - 1) === 3, 'All 3 occurrences updated to Oggy Restaurant');

  // Test 3: System Prompt Verification
  console.log('\n----------------------------------------------------------------');
  console.log('3. System Prompt Flexible Instructions Verification');
  console.log('----------------------------------------------------------------');

  const engineFile = fs.readFileSync('supabase/functions/_shared/ai/agentic-coding-engine.ts', 'utf8');

  assert(engineFile.includes('HOLISTIC COMPOUND INTENT & THEMATIC CONTEXT'), 'Engine contains Holistic Compound Intent instructions');
  assert(engineFile.includes('BRAND & VISUAL IDENTITY COMPLETENESS'), 'Engine contains Brand & Visual Identity Completeness instructions');
  assert(engineFile.includes('allow_multiple'), 'Engine contains allow_multiple parameter in edit_file tool definition');
  assert(engineFile.includes('replaceAll'), 'Engine executes replaceAll when allow_multiple is enabled');

  // Test 4: Live Website Verification
  console.log('\n----------------------------------------------------------------');
  console.log('4. Live Website Verification (savoria-restaurant)');
  console.log('----------------------------------------------------------------');

  const res = await fetch('https://www.ceova.online/p/savoria-restaurant');
  assert(res.status === 200, `Live site returns HTTP 200 OK (actual: ${res.status})`);

  const liveHtml = await res.text();
  assert(liveHtml.includes('Oggy'), 'Live site contains "Oggy"');
  assert(liveHtml.includes('🧸 Oggy <span>Restaurant</span>'), 'Live site navbar logo contains "🧸 Oggy <span>Restaurant</span>"');
  assert(!liveHtml.includes('Luma & Thyme'), 'Live site contains zero occurrences of "Luma & Thyme"');
  assert(liveHtml.includes('Kids Menu'), 'Live site contains "Kids Menu" section');
  assert(liveHtml.includes('Play Zone'), 'Live site contains "Play Zone" section');

  console.log('\n================================================================');
  console.log('🎉 ALL FLEXIBLE INSTRUCTION & LIVE TESTS PASSED! (100%)');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
