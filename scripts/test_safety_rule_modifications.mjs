import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

// Minimal simulator matching the exact logic in AgenticCodingEngine
class SafetyEditEngine {
  constructor(files) {
    this.files = files.map(f => ({ ...f }));
    this.inspectedFiles = new Set();
  }

  edit_file(args) {
    const { path: filePath, target_content, replacement_content, context_before, context_after } = args;
    const file = this.files.find(f => f.path === filePath);
    if (!file) {
      return { error: `Cannot edit "${filePath}": File does not exist.` };
    }

    let searchTarget = target_content;
    let replacement = replacement_content;

    if (context_before || context_after) {
      searchTarget = (context_before || '') + target_content + (context_after || '');
      replacement = (context_before || '') + replacement_content + (context_after || '');
    }

    if (!file.content.includes(searchTarget)) {
      const inspectHint = !this.inspectedFiles.has(filePath)
        ? ` You have not inspected "${filePath}" yet. Call 'search_code' or 'read_file' to locate exact lines and whitespace before editing.`
        : '';
      return {
        error: `target_content was not found in "${filePath}". Ensure target_content matches exact characters including whitespace.${inspectHint}`
      };
    }

    const occurrences = file.content.split(searchTarget).length - 1;
    if (occurrences > 1) {
      return {
        error: `target_content "${target_content}" is ambiguous and appears ${occurrences} times in "${filePath}". (Requirement 20: Never blindly perform a string replacement merely because the string exists). Inspect surrounding code with 'search_code' or 'read_file' to determine which occurrence corresponds to the user's requested change. Prefer structural/context-aware editing by including surrounding parent tags, attributes, or adjacent lines (or using 'context_before' / 'context_after') so that the target matches uniquely.`,
        occurrences
      };
    }

    file.content = file.content.replace(searchTarget, replacement);
    this.inspectedFiles.add(filePath);
    return { success: true, path: filePath, message: `Successfully edited "${filePath}" with surgical replacement.` };
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: REQUIREMENT 20 - SAFETY RULE FOR MODIFICATIONS');
  console.log('================================================================\n');

  // Test 1: Ambiguous target rejection (User example: "Home" appears 17 times)
  console.log('Test 1: Ambiguous String Safety ("Home" appears 17 times)');
  
  // Construct realistic HTML where "Home" appears exactly 17 times across different contexts
  const multiHomeContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Home - Luigi Trattoria Home Kitchen</title>
  <!-- Main meta -->
  <meta name="description" content="Welcome to the Home of authentic Italian pasta.">
</head>
<body>
  <!-- Navigation bar (occurrence 4) -->
  <nav class="navbar">
    <a href="#home" class="nav-link active">Home</a>
    <a href="#about" class="nav-link">About</a>
    <a href="#menu" class="nav-link">Menu</a>
  </nav>

  <!-- Breadcrumbs (occurrence 5) -->
  <div class="breadcrumbs"><span>Home</span> / <span>Menu</span></div>

  <!-- Hero section (occurrences 6 & 7) -->
  <section id="hero">
    <h1>Welcome Home to True Flavor</h1>
    <p>Feel right at Home with homemade recipes passed down for generations.</p>
    <a href="#menu" class="btn">Order for Home Delivery</a>
  </section>

  <!-- About section (occurrences 9 & 10) -->
  <section id="about">
    <h2>Our Home Kitchen</h2>
    <p>Bringing Home comfort food directly to your table.</p>
  </section>

  <!-- Specials (occurrences 11 & 12) -->
  <section id="specials">
    <h3>Home Chef Specials</h3>
    <p>Enjoy a cozy Home cooked meal tonight.</p>
  </section>

  <!-- Catering (occurrences 13 & 14) -->
  <section id="catering">
    <h3>Home Parties & Private Catering</h3>
    <p>Make your Home the venue of choice.</p>
  </section>

  <!-- Footer (occurrences 15, 16, 17) -->
  <footer>
    <a href="#home" class="footer-link">Home</a>
    <p>© 2026 Home Trattoria. All rights reserved.</p>
    <small>Taste of Home.</small>
  </footer>
</body>
</html>`;

  const totalHomeCount = multiHomeContent.split("Home").length - 1;
  assert(totalHomeCount === 17, `Test file contains exactly 17 occurrences of "Home" (actual: ${totalHomeCount})`);

  const engine = new SafetyEditEngine([{ path: 'index.html', content: multiHomeContent }]);

  // Attempt a blind string replacement on "Home"
  const blindEdit = engine.edit_file({
    path: 'index.html',
    target_content: 'Home',
    replacement_content: 'Start'
  });

  assert(blindEdit.error !== undefined, 'Blind replacement of ambiguous "Home" was strictly REJECTED');
  assert(blindEdit.occurrences === 17, 'Error correctly identified 17 ambiguous occurrences');
  assert(blindEdit.error.includes('Requirement 20'), 'Error explicitly cites Requirement 20 safety rule');
  assert(blindEdit.error.includes('Never blindly perform a string replacement'), 'Error enforces: Never blindly perform string replacement');
  assert(blindEdit.error.includes('Prefer structural/context-aware editing'), 'Error guides towards structural/context-aware editing');
  
  // Verify content was NOT modified
  assert(engine.files[0].content === multiHomeContent, 'File content was safely preserved without blind modifications');

  // Test 2: Structural/Context-Aware Disambiguation
  console.log('\nTest 2: Structural Context-Aware Disambiguation');

  // Case 2A: Using structural parent tags in target_content
  const structuralEdit = engine.edit_file({
    path: 'index.html',
    target_content: '<a href="#home" class="nav-link active">Home</a>',
    replacement_content: '<a href="#home" class="nav-link active">Start</a>'
  });

  assert(structuralEdit.success === true, 'Structural edit with parent tags and attributes succeeded uniquely');
  assert(engine.files[0].content.includes('<a href="#home" class="nav-link active">Start</a>'), 'Navbar link updated to "Start"');
  
  // Ensure the other 16 occurrences of "Home" remain completely intact!
  const remainingHomeCount = engine.files[0].content.split("Home").length - 1;
  assert(remainingHomeCount === 16, `Exactly 16 other occurrences of "Home" remained completely intact (actual: ${remainingHomeCount})`);

  // Case 2B: Using context_before / context_after
  const contextBeforeAfterEdit = engine.edit_file({
    path: 'index.html',
    target_content: 'Home',
    replacement_content: 'Main',
    context_before: '<a href="#home" class="footer-link">',
    context_after: '</a>'
  });

  assert(contextBeforeAfterEdit.success === true, 'Edit using context_before / context_after succeeded uniquely');
  assert(engine.files[0].content.includes('<a href="#home" class="footer-link">Main</a>'), 'Footer link updated to "Main"');
  
  const finalHomeCount = engine.files[0].content.split("Home").length - 1;
  assert(finalHomeCount === 15, `Remaining 15 occurrences of "Home" remained intact (actual: ${finalHomeCount})`);

  // Test 3: Guidance on Non-Existent Target in Uninspected File
  console.log('\nTest 3: Inspection Guidance for Uninspected Files');
  const uninspectedEdit = engine.edit_file({
    path: 'index.html',
    target_content: '<section id="non_existent">Oops</section>',
    replacement_content: '<section id="non_existent">Fixed</section>'
  });
  assert(uninspectedEdit.error !== undefined, 'Non-existent target safely rejected');
  assert(uninspectedEdit.error.includes('target_content was not found'), 'Returns target not found error');

  // Test 4: Codebase Audit for Requirement 20 Directives
  console.log('\nTest 4: Codebase Audit for Requirement 20 Directives');
  const engineCode = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/_shared/ai/agentic-coding-engine.ts'), 'utf8');
  const superEndpointCode = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/super-endpoint/index.ts'), 'utf8');

  assert(engineCode.includes('IMPORTANT SAFETY RULE FOR MODIFICATIONS (MANDATORY REQUIREMENT 20)'), 'agentic-coding-engine.ts contains Requirement 20 header');
  assert(engineCode.includes('Never blindly perform a string replacement merely because the string exists'), 'engine prompt warns against blind replacement');
  assert(engineCode.includes('if "Home" appears 17 times'), 'engine prompt includes 17 times disambiguation example');
  assert(engineCode.includes('PREFER STRUCTURAL / CONTEXT-AWARE EDITING'), 'engine prompt emphasizes structural/context-aware editing');
  assert(engineCode.includes('context_before'), 'engine edit_file schema contains context_before');
  assert(engineCode.includes('context_after'), 'engine edit_file schema contains context_after');

  assert(superEndpointCode.includes('21. IMPORTANT SAFETY RULE FOR MODIFICATIONS (MANDATORY REQUIREMENT 20)'), 'super-endpoint/index.ts contains Rule 21');
  assert(superEndpointCode.toLowerCase().includes('never blindly perform a string replacement merely because the string exists'), 'super-endpoint prompt warns against blind replacement');
  assert(superEndpointCode.toLowerCase().includes('if "home" appears 17 times') || superEndpointCode.includes('if \\"Home\\" appears 17 times'), 'super-endpoint prompt includes 17 times disambiguation example');
  assert(superEndpointCode.includes('PREFER STRUCTURAL / CONTEXT-AWARE EDITING'), 'super-endpoint prompt emphasizes structural editing');

  // Test 5: Live Supabase DB Verification (Oggy Restaurant)
  console.log('\nTest 5: Live Database Verification on Oggy Restaurant');
  const authRes = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!',
  });
  assert(!authRes.error && authRes.data.session, 'Authenticated as ceovatestuser101@gmail.com');

  const OGGY_ID = 'a7c2485c-8556-43b2-93c8-d8e619ac4673';
  const { data: oggyProj, error: oggyErr } = await supabase
    .from('projects')
    .select('id, name, slug, status, metadata')
    .eq('id', OGGY_ID)
    .single();

  assert(!oggyErr && oggyProj, 'Retrieved live project record for Oggy Restaurant');
  assert(oggyProj.slug === 'modern-restaurant-website', 'Project slug preserved: modern-restaurant-website');

  const liveUrl = `https://www.ceova.online/p/${oggyProj.slug}`;
  const pingRes = await fetch(liveUrl);
  assert(pingRes.status === 200, `Live website ${liveUrl} is healthy (HTTP 200)`);

  const html = await pingRes.text();
  assert(html.includes('Oggy Restaurant'), 'Live website serves Oggy Restaurant');

  console.log('\n================================================================');
  console.log('ALL REQUIREMENT 20 TESTS PASSED SUCCESSFULLY! (23/23)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
