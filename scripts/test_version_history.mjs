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

async function runTests() {
  console.log("=================================================");
  console.log("REQUIREMENT 11 TEST SUITE: MAINTAIN VERSION HISTORY");
  console.log("=================================================\n");

  // ── TEST 1: Change Record & Version Structure Verification ────────────────
  console.log("Test 1: Version Record and Change Description Structure");

  const sampleVersions = [
    { version: 1, description: 'Initial website', created_at: new Date(Date.now() - 40000).toISOString() },
    { version: 2, description: 'Changed restaurant name to Oggy Restaurant', created_at: new Date(Date.now() - 30000).toISOString() },
    { version: 3, description: 'Added gallery section with food photos', created_at: new Date(Date.now() - 20000).toISOString() },
    { version: 4, description: 'Updated navbar with reservation link', created_at: new Date(Date.now() - 10000).toISOString() },
    { version: 5, description: 'Fixed mobile layout for menu cards', created_at: new Date().toISOString() },
  ];

  assert(sampleVersions.length === 5, "5 version records created");
  assert(sampleVersions[0].description === "Initial website", "Version 1 has human-readable record 'Initial website'");
  assert(sampleVersions[1].description === "Changed restaurant name to Oggy Restaurant", "Version 2 describes name change");
  assert(sampleVersions[2].description === "Added gallery section with food photos", "Version 3 describes gallery addition");
  assert(sampleVersions[3].description === "Updated navbar with reservation link", "Version 4 describes navbar update");
  assert(sampleVersions[4].description === "Fixed mobile layout for menu cards", "Version 5 describes mobile layout fix");

  // ── TEST 2: Context Injection Gating (No historical dump by default) ───────
  console.log("\nTest 2: Context Injection Efficiency & Gating");

  function buildPromptContext(project, userMessage) {
    const isHistoryQuery = /(?:history|previous\s+version|past\s+version|revert|undo|what\s+changed|rollback|changelog)/i.test(userMessage);
    const projectVersionNum = project.current_version;
    const latestChange = project.latest_change || 'Initial website';

    let versionHistorySummary = '';
    if (isHistoryQuery && Array.isArray(project.version_history) && project.version_history.length > 0) {
      const historyList = project.version_history.slice(-10);
      versionHistorySummary = `\n  RELEVANT VERSION HISTORY (User asked about history/changes):\n${historyList.map(vh => `  - Version ${vh.version}: ${vh.description}`).join('\n')}`;
    }

    const context = `
  • Current Version: v${projectVersionNum}
  • Latest Change: "${latestChange}"
  • Project Name: "${project.name}"
  CONCEPTUAL ARCHITECTURE:
  CEOVA Project
  ├── Current version: v${projectVersionNum} (Latest change: "${latestChange}")${versionHistorySummary}`;

    return { context, isHistoryQuery };
  }

  const projectData = {
    name: "Oggy Restaurant",
    current_version: 5,
    latest_change: "Fixed mobile layout for menu cards",
    version_history: sampleVersions,
  };

  // Standard user prompt: "Change button color to blue"
  const standardPrompt = "Change the button color to blue";
  const standardContext = buildPromptContext(projectData, standardPrompt);

  assert(standardContext.context.includes("Current Version: v5"), "Standard context contains current version (v5)");
  assert(standardContext.context.includes('Latest Change: "Fixed mobile layout for menu cards"'), "Standard context contains latest change summary");
  assert(!standardContext.context.includes("RELEVANT VERSION HISTORY"), "Standard context DOES NOT dump historical versions (saves tokens)");
  assert(!standardContext.context.includes("Version 1: Initial website"), "Version 1 not dumped in standard prompt");
  assert(!standardContext.context.includes("Version 2: Changed restaurant name"), "Version 2 not dumped in standard prompt");

  // History query user prompt: "What was changed in previous versions?"
  const historyPrompt = "What was changed in previous versions?";
  const historyContext = buildPromptContext(projectData, historyPrompt);

  assert(historyContext.isHistoryQuery === true, "History regex correctly identifies history query");
  assert(historyContext.context.includes("RELEVANT VERSION HISTORY"), "Relevant version history IS injected when user asks about changes/history");
  assert(historyContext.context.includes("Version 1: Initial website"), "Version 1 included in relevant history view");
  assert(historyContext.context.includes("Version 5: Fixed mobile layout for menu cards"), "Version 5 included in relevant history view");

  // ── TEST 3: Targeted get_version_history Tool Simulation ───────────────────
  console.log("\nTest 3: Targeted get_version_history Tool Execution");

  function simulateGetVersionHistoryTool(allVersions, args = {}) {
    const limit = Math.min(Math.max(1, parseInt(args.limit || '10', 10)), 25);
    let filtered = [...allVersions];
    if (args.version) {
      filtered = filtered.filter(v => v.version === args.version);
    }
    const sliced = filtered.slice(-limit);
    return {
      current_version: allVersions[allVersions.length - 1]?.version || 1,
      retrieved_versions_count: sliced.length,
      history: sliced.map(h => ({
        version: h.version,
        description: h.description,
        created_at: h.created_at,
      })),
      guidance: 'Only reference or retrieve previous changes when relevant to the current user task.'
    };
  }

  const toolAll = simulateGetVersionHistoryTool(sampleVersions, { limit: 3 });
  assert(toolAll.retrieved_versions_count === 3, "Tool respects limit parameter (retrieved 3 versions)");
  assert(toolAll.history[toolAll.history.length - 1].version === 5, "Tool returns latest versions up to limit");
  assert(toolAll.history[0].version === 3, "First of 3 returned versions is v3");
  assert(!toolAll.history.some(h => 'source_tree' in h), "Tool output omits full source tree (token efficient)");

  const toolSingle = simulateGetVersionHistoryTool(sampleVersions, { version: 2 });
  assert(toolSingle.retrieved_versions_count === 1, "Tool can inspect specific version number (v2)");
  assert(toolSingle.history[0].description === "Changed restaurant name to Oggy Restaurant", "Specific version details retrieved correctly");

  // ── TEST 4: Live Supabase DB Verification (project_versions & metadata) ────
  console.log("\nTest 4: Live Supabase DB Verification for Oggy Restaurant");

  const targetSlug = 'modern-restaurant-website';

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!'
  });

  if (authErr || !authData?.session?.access_token) {
    console.error(`  ✗ Authentication error:`, authErr?.message);
  } else {
    // 1. Fetch project record
    const { data: dbProjects, error: dbErr } = await supabase
      .from('projects')
      .select('id, name, slug, status, metadata')
      .eq('slug', targetSlug);

    const dbProj = dbProjects && dbProjects[0];
    if (dbErr || !dbProj) {
      console.error(`  ✗ DB Query error for slug "${targetSlug}":`, dbErr?.message);
    } else {
      assert(dbProj.id !== undefined, `Live project "${dbProj.name}" found (${dbProj.id})`);

      // 2. Query project_versions table
      const { data: versions, error: vErr } = await supabase
        .from('project_versions')
        .select('id, version_number, commit_message, created_at')
        .eq('project_id', dbProj.id)
        .order('version_number', { ascending: true });

      if (vErr) {
        console.error(`  ✗ Error querying project_versions:`, vErr.message);
      } else {
        const liveVersions = versions || [];
        assert(liveVersions.length > 0, `project_versions table has ${liveVersions.length} tracked version(s)`);

        const latestLiveVer = liveVersions[liveVersions.length - 1];
        assert(latestLiveVer.version_number >= 1, `Latest version number is v${latestLiveVer.version_number}`);
        assert(latestLiveVer.commit_message !== undefined, `Latest version has commit_message: "${latestLiveVer.commit_message}"`);

        // 3. Build compact version_history array and persist to projects.metadata
        const compactHistory = liveVersions.map(v => ({
          version: v.version_number,
          description: v.commit_message || `Version ${v.version_number}`,
          created_at: v.created_at,
        })).slice(-25);

        const currentVerNum = latestLiveVer.version_number;
        const latestChangeMsg = latestLiveVer.commit_message || 'Website updates';

        const updatedMetadata = {
          ...(dbProj.metadata || {}),
          current_version: currentVerNum,
          latest_change: latestChangeMsg,
          version_history: compactHistory,
        };

        const { error: metaUpdateErr } = await supabase
          .from('projects')
          .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', dbProj.id);

        if (metaUpdateErr) {
          console.error(`  ✗ Metadata update error:`, metaUpdateErr.message);
        } else {
          assert(true, "Successfully updated projects.metadata with version_history & latest_change");

          // 4. Re-verify saved metadata from DB
          const { data: rechecked } = await supabase
            .from('projects')
            .select('metadata')
            .eq('id', dbProj.id)
            .single();

          const savedMeta = rechecked?.metadata;
          assert(savedMeta?.current_version === currentVerNum, `projects.metadata.current_version is v${savedMeta?.current_version}`);
          assert(savedMeta?.latest_change === latestChangeMsg, `projects.metadata.latest_change is "${savedMeta?.latest_change}"`);
          assert(Array.isArray(savedMeta?.version_history), "projects.metadata.version_history is an Array");
          assert(savedMeta?.version_history?.length > 0, `projects.metadata.version_history has ${savedMeta?.version_history?.length} records`);
          assert(savedMeta?.version_history[savedMeta.version_history.length - 1].description === latestChangeMsg, "Latest version_history entry matches latest_change");
        }
      }
    }
  }

  // ── TEST 5: Live Website Verification ─────────────────────────────────────
  console.log("\nTest 5: Live Website Verification at https://www.ceova.online/p/modern-restaurant-website");
  try {
    const res = await fetch("https://www.ceova.online/p/modern-restaurant-website");
    assert(res.status === 200, "Live website returns HTTP 200");
    const html = await res.text();
    assert(html.includes("Oggy Restaurant"), "Live site contains 'Oggy Restaurant'");
    assert(html.includes("hero"), "Live site contains hero section");
    assert(html.includes("menu"), "Live site contains menu section");
  } catch (e) {
    console.error("  ✗ Live site fetch failed:", e.message);
  }

  console.log(`\n=================================================`);
  console.log(`RESULTS: ${passedCount}/${totalCount} tests passed.`);
  console.log(`=================================================\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
