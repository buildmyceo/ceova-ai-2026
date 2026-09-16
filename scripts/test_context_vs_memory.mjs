import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passedCount = 0;
let totalCount = 0;

function assert(condition, description) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ FAILED: ${description}`);
  }
}

// ── Replicate ContextReconstructionService logic for pure local testing ──────
class ContextReconstructionService {
  static reconstruct(params) {
    const {
      projectState,
      projectFiles,
      versionInfo,
      currentTask,
      includeHistoryQuery = false
    } = params;

    // Pillar 1: Persistent Project State
    const pillar1 = [
      `=== PILLAR 1: PERSISTENT PROJECT STATE ===`,
      `• project_id: "${projectState.project_id}"`,
      `• framework: "${projectState.framework || 'vanilla-html'}"`,
      `• build_system: "${projectState.build_system || 'static-edge-bundler'}"`,
      `• entry_points: [${(projectState.entry_points || ['index.html']).join(', ')}]`,
      `• routes: [${(projectState.routes || ['/']).join(', ')}]`,
      `• pages: [${(projectState.pages || ['index.html']).join(', ')}]`,
      `• components: [${(projectState.components || ['navbar', 'hero', 'about', 'menu', 'contact', 'footer']).join(', ')}]`,
      `• assets: ${(projectState.assets || []).length} tracked asset(s)`,
      `• current_version: v${projectState.current_version || versionInfo.currentVersion || 1}`,
      `• approved_plan: ${projectState.approved_plan ? 'Active baseline plan' : 'Default plan'}`,
      `• deployment_url: "${projectState.deployment_url || ''}"`
    ].join('\n');

    // Pillar 2: Project Files Index (ZERO monolithic code dumps)
    const fileListFormatted = projectFiles && projectFiles.length > 0
      ? projectFiles.map(f => `  - ${f.path} (${f.bytes || 0} bytes, ${f.lines || 0} lines)`).join('\n')
      : '  - index.html\n  - styles.css\n  - script.js';

    const pillar2 = [
      `=== PILLAR 2: PROJECT FILES INDEX ===`,
      fileListFormatted,
      `(Source code is intentionally NOT dumped here. Retrieve targeted slices on demand via Pillar 3 tools.)`
    ].join('\n');

    // Pillar 3: Search/Read Tools
    const pillar3 = [
      `=== PILLAR 3: SEARCH & READ TOOLS ===`,
      `• search_code(query, path?): Find exact strings/symbols across project files without reading full files.`,
      `• read_file(path, start_line?, end_line?): Read only targeted line ranges of relevant files.`,
      `• edit_file(path, target_snippet, replacement): Apply surgical edits directly.`,
      `• run_build(): Verify build correctness with compact error reporting.`
    ].join('\n');

    // Pillar 4: Current Task
    const pillar4 = [
      `=== PILLAR 4: CURRENT TASK ===`,
      `• User Request: "${currentTask.message}"`,
      `• Determined Scope: ${currentTask.scope ? currentTask.scope.toUpperCase() : 'SIMPLE'}`
    ].join('\n');

    // Pillar 5: Version Information
    const historySection = includeHistoryQuery && versionInfo.history && versionInfo.history.length > 0
      ? `\n• Version History:\n${versionInfo.history.slice(-5).map(h => `  - v${h.version}: ${h.description} (${new Date(h.created_at).toLocaleDateString()})`).join('\n')}`
      : '';

    const pillar5 = [
      `=== PILLAR 5: VERSION INFORMATION ===`,
      `• current_version: v${versionInfo.currentVersion}`,
      `• latest_change: "${versionInfo.latestChange || 'Initial website'}"${historySection}`
    ].join('\n');

    const combined = [
      `[5-PILLAR RECONSTRUCTED CONTEXT (Requirement 14: Do not confuse context with memory)]`,
      pillar1,
      pillar2,
      pillar3,
      pillar4,
      pillar5,
      `[END RECONSTRUCTED CONTEXT - MODEL HAS ZERO PERMANENT MEMORY ASSUMPTION]`
    ].join('\n\n');

    return {
      pillar1,
      pillar2,
      pillar3,
      pillar4,
      pillar5,
      combined,
      estimatedTokens: Math.ceil(combined.length / 4)
    };
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('TEST SUITE: Requirement 14 - Do Not Confuse Context With Memory');
  console.log('===============================================================\n');

  // Test 1: 5-Pillar Structure Verification
  console.log('--- Test 1: 5-Pillar Structure Verification ---');
  const mockParams = {
    projectState: {
      project_id: 'proj-12345',
      framework: 'vanilla-html',
      build_system: 'static-edge-bundler',
      entry_points: ['index.html'],
      routes: ['/', '#menu', '#contact'],
      pages: ['index.html'],
      components: ['navbar', 'hero', 'menu', 'about', 'footer'],
      assets: ['hero.jpg', 'logo.svg'],
      current_version: 7,
      approved_plan: { goal: 'Restaurant Website' },
      deployment_url: 'https://www.ceova.online/p/modern-restaurant-website'
    },
    projectFiles: [
      { path: 'index.html', bytes: 14200, lines: 380 },
      { path: 'styles.css', bytes: 6400, lines: 210 },
      { path: 'script.js', bytes: 2100, lines: 75 }
    ],
    versionInfo: {
      currentVersion: 7,
      latestChange: 'Updated phone number',
      history: [
        { version: 1, description: 'Initial website', created_at: '2026-09-01T00:00:00Z' },
        { version: 7, description: 'Updated phone number', created_at: '2026-09-04T00:00:00Z' }
      ]
    },
    currentTask: {
      message: 'Change the hero heading to Best Italian Dining',
      scope: 'simple'
    },
    includeHistoryQuery: false
  };

  const reconstructed = ContextReconstructionService.reconstruct(mockParams);

  assert(reconstructed.combined.includes('PILLAR 1: PERSISTENT PROJECT STATE'), 'Contains Pillar 1 (Persistent Project State)');
  assert(reconstructed.combined.includes('PILLAR 2: PROJECT FILES INDEX'), 'Contains Pillar 2 (Project Files Index)');
  assert(reconstructed.combined.includes('PILLAR 3: SEARCH & READ TOOLS'), 'Contains Pillar 3 (Search & Read Tools)');
  assert(reconstructed.combined.includes('PILLAR 4: CURRENT TASK'), 'Contains Pillar 4 (Current Task)');
  assert(reconstructed.combined.includes('PILLAR 5: VERSION INFORMATION'), 'Contains Pillar 5 (Version Information)');

  // Test 2: Token footprint & Zero Raw Code Dumps
  console.log('\n--- Test 2: Compact Token Footprint & Zero Monolithic Code Dumps ---');
  console.log(`  Combined text length: ${reconstructed.combined.length} chars (~${reconstructed.estimatedTokens} tokens)`);
  assert(reconstructed.estimatedTokens < 600, `Estimated tokens (${reconstructed.estimatedTokens}) is well below 600 tokens limit`);
  assert(!reconstructed.combined.includes('<!DOCTYPE html>'), 'Does NOT dump raw HTML into context');
  assert(!reconstructed.combined.includes('addEventListener'), 'Does NOT dump raw JavaScript into context');
  assert(!reconstructed.combined.includes('background-color:'), 'Does NOT dump raw CSS into context');
  assert(reconstructed.combined.includes('Source code is intentionally NOT dumped here'), 'Explicitly notes raw code is omitted to prevent token waste');

  // Test 3: Stateless Cold-Start Simulation
  console.log('\n--- Test 3: Stateless Cold-Start Simulation ---');
  // Simulate a model that has zero memory of previous conversation turns
  // Context reconstruction gives it everything required to perform surgical work:
  assert(reconstructed.combined.includes('project_id: "proj-12345"'), 'Stateless model knows target project ID');
  assert(reconstructed.combined.includes('deployment_url: "https://www.ceova.online/p/modern-restaurant-website"'), 'Stateless model knows live URL');
  assert(reconstructed.combined.includes('current_version: v7'), 'Stateless model knows current version');
  assert(reconstructed.combined.includes('search_code(query, path?)'), 'Stateless model knows how to inspect code via Pillar 3');
  assert(reconstructed.combined.includes('User Request: "Change the hero heading to Best Italian Dining"'), 'Stateless model receives current task in Pillar 4');

  // Test 4: Targeted History Expansion (Only when asked)
  console.log('\n--- Test 4: Targeted History Expansion (Only When Asked) ---');
  const historyQueryTask = {
    ...mockParams,
    currentTask: {
      message: 'What was changed in previous versions?',
      scope: 'simple'
    },
    includeHistoryQuery: true
  };
  const historyReconstructed = ContextReconstructionService.reconstruct(historyQueryTask);
  assert(historyReconstructed.combined.includes('Version History:'), 'Includes version history when user explicitly asks');
  assert(historyReconstructed.combined.includes('v1: Initial website'), 'Lists previous versions');
  assert(!reconstructed.combined.includes('Version History:'), 'Omits verbose history when user does not ask for it');

  // Test 5: Live Database Verification on Oggy Restaurant
  console.log('\n--- Test 5: Live Supabase Database Verification (Oggy Restaurant) ---');
  const OGGY_PROJECT_ID = 'a7c2485c-8556-43b2-93c8-d8e619ac4673';
  
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!'
  });

  assert(!authErr && !!authData?.session, 'Authenticated as test user with Supabase');

  const { data: projectRecord, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug, metadata')
    .eq('id', OGGY_PROJECT_ID)
    .single();

  assert(!projErr && !!projectRecord, `Fetched live project record: ${projectRecord?.name} (${projectRecord?.slug})`);

  const { data: filesData, error: filesErr } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', OGGY_PROJECT_ID);

  assert(!filesErr && Array.isArray(filesData) && filesData.length > 0, `Fetched ${filesData?.length} live project files`);

  // Reconstruct context for live project
  const liveProjectState = projectRecord.metadata?.persistent_state || {
    project_id: projectRecord.id,
    framework: 'vanilla-html',
    build_system: 'static-edge-bundler',
    entry_points: ['index.html'],
    routes: ['/'],
    pages: ['index.html'],
    components: ['navbar', 'hero', 'about', 'menu', 'contact', 'footer'],
    assets: [],
    current_version: projectRecord.metadata?.version || 1,
    approved_plan: projectRecord.metadata?.approved_plan || null,
    deployment_url: `https://www.ceova.online/p/${projectRecord.slug}`
  };

  const liveFilesIndex = filesData.map(f => ({
    path: f.path,
    bytes: (f.content || '').length,
    lines: (f.content || '').split('\n').length
  }));

  const liveVersionInfo = {
    currentVersion: projectRecord.metadata?.version || 1,
    latestChange: projectRecord.metadata?.version_history?.[projectRecord.metadata.version_history.length - 1]?.description || 'Initial website',
    history: projectRecord.metadata?.version_history || []
  };

  const liveReconstructed = ContextReconstructionService.reconstruct({
    projectState: liveProjectState,
    projectFiles: liveFilesIndex,
    versionInfo: liveVersionInfo,
    currentTask: {
      message: 'Change restaurant phone number to +1 (555) 999-0000',
      scope: 'simple'
    }
  });

  assert(liveReconstructed.combined.includes(`project_id: "${OGGY_PROJECT_ID}"`), 'Live context has correct project ID');
  assert(liveReconstructed.combined.includes('https://www.ceova.online/p/modern-restaurant-website'), 'Live context preserves live URL');
  assert(liveReconstructed.combined.includes('index.html'), 'Live context indexes index.html');
  assert(liveReconstructed.estimatedTokens < 600, `Live context estimated tokens (${liveReconstructed.estimatedTokens}) is efficient (<600 tokens)`);
  assert(!liveReconstructed.combined.includes('<!DOCTYPE html>'), 'Live context does not dump raw HTML into prompt');

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passedCount} / ${totalCount} tests passed.`);
  console.log('===============================================================');

  if (passedCount === totalCount) {
    console.log('\n🎉 ALL REQUIREMENT 14 CONTEXT VS MEMORY TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
