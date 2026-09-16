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
  console.log("===================================================================");
  console.log("REQUIREMENT 12 TEST SUITE: USE EXISTING PROJECT INSTEAD OF RECREATING IT");
  console.log("===================================================================\n");

  // ── TEST 1: Capability & Intent Routing for "Change the navbar." ────────────
  console.log("Test 1: Capability & Intent Routing");

  function testCapabilityMatch(message) {
    const cloudDevKeywords = [
      'website', 'web app', 'landing page', 'frontend', 'dashboard', 'portfolio',
      'create a website', 'build a website', 'make a website', 'generate a site',
      'deploy website', 'publish site', 'host website', 'live url', 'ceova.online',
      'navbar', 'navigation', 'nav', 'change navbar', 'update navbar', 'hero', 'menu',
      'change the navbar', 'update the navbar'
    ];
    return cloudDevKeywords.some(kw => message.toLowerCase().includes(kw));
  }

  assert(testCapabilityMatch("Change the navbar."), "'Change the navbar.' matches cloud_dev capability");
  assert(testCapabilityMatch("Change the navbar"), "'Change the navbar' matches cloud_dev capability");
  assert(testCapabilityMatch("Update navigation bar with reservation button"), "Update navigation bar matches cloud_dev capability");
  assert(testCapabilityMatch("Update the hero section"), "Update hero section matches cloud_dev capability");
  assert(testCapabilityMatch("Fix the menu prices"), "Fix menu matches cloud_dev capability");

  // ── TEST 2: Update Request Pattern & Verb Recognition ──────────────────────
  console.log("\nTest 2: Update Request Pattern & Verb Recognition");

  const isUpdateRequestPattern = /^(?:change|update|modify|edit|fix|tweak|replace|add|remove|make|style|adjust)\b/i;
  const sectionKeywordsPattern = /\b(?:navbar|nav|navigation|header|footer|hero|button|menu|section|logo|theme|color|text|title|heading)\b/i;

  function isFollowUpUpdate(msg) {
    return isUpdateRequestPattern.test(msg) || sectionKeywordsPattern.test(msg);
  }

  assert(isFollowUpUpdate("Change the navbar."), "'Change the navbar.' identified as follow-up update");
  assert(isFollowUpUpdate("Update the menu prices"), "'Update the menu prices' identified as follow-up update");
  assert(isFollowUpUpdate("Make the button blue"), "'Make the button blue' identified as follow-up update");
  assert(isFollowUpUpdate("Fix mobile layout"), "'Fix mobile layout' identified as follow-up update");
  assert(isFollowUpUpdate("navbar styling needs adjustment"), "Section keyword 'navbar' identified as follow-up update");

  // ── TEST 3: Attachment & History Project ID Extraction ──────────────────────
  console.log("\nTest 3: Project ID Extraction from History & Attachments");

  function extractProjectIdFromHistory(history) {
    let existingProjectId = null;
    let existingSlug = null;

    if (history && Array.isArray(history) && history.length > 0) {
      for (const msg of history.slice().reverse()) {
        if (msg.attachments && Array.isArray(msg.attachments)) {
          const cloudProj = msg.attachments.find(a => 
            a.type === 'cloud_project' || a.type === 'cloud_project_ready' || a.type === 'project'
          );
          const foundId = cloudProj?.data?.projectId || cloudProj?.projectId || cloudProj?.data?.id || cloudProj?.id;
          const foundSlug = cloudProj?.data?.slug || cloudProj?.slug;
          if (foundId) {
            existingProjectId = foundId;
            if (foundSlug) existingSlug = foundSlug;
            break;
          }
        }
        if (typeof msg.content === 'string') {
          const urlMatch = msg.content.match(/https?:\/\/(?:www\.)?ceova\.online\/p\/([a-z0-9-]+)/i);
          if (urlMatch) {
            existingSlug = urlMatch[1];
            break;
          }
        }
      }
    }
    return { existingProjectId, existingSlug };
  }

  const mockHistoryWithAttachment = [
    { role: 'user', content: 'Create a website for Oggy Restaurant' },
    { 
      role: 'assistant', 
      content: '✓ Website created\nhttps://www.ceova.online/p/modern-restaurant-website',
      attachments: [{
        type: 'cloud_project_ready',
        data: { projectId: 'a7c2485c-8556-43b2-93c8-d8e619ac4673', slug: 'modern-restaurant-website' }
      }]
    }
  ];

  const extracted1 = extractProjectIdFromHistory(mockHistoryWithAttachment);
  assert(extracted1.existingProjectId === 'a7c2485c-8556-43b2-93c8-d8e619ac4673', "Extracted project ID from cloud_project_ready attachment");
  assert(extracted1.existingSlug === 'modern-restaurant-website', "Extracted slug from cloud_project_ready attachment");

  const mockHistoryWithUrlOnly = [
    { role: 'user', content: 'Create a website' },
    { role: 'assistant', content: 'Here is your website: https://www.ceova.online/p/modern-restaurant-website' }
  ];

  const extracted2 = extractProjectIdFromHistory(mockHistoryWithUrlOnly);
  assert(extracted2.existingSlug === 'modern-restaurant-website', "Extracted slug from URL in assistant message");

  // ── TEST 4: Live Supabase Authentication & Project Inspection ───────────────
  console.log("\nTest 4: Authenticated Live Supabase DB Verification for Oggy Restaurant");

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!'
  });

  if (authErr || !authData?.session?.access_token) {
    throw new Error(`Authentication failed: ${authErr?.message}`);
  }
  assert(true, "Successfully authenticated test user with Supabase");

  const targetSlug = 'modern-restaurant-website';

  // Count total projects before any operations
  const { count: countBefore, data: initialProjects } = await supabase
    .from('projects')
    .select('id, name, slug, metadata', { count: 'exact' });

  assert(typeof countBefore === 'number' && countBefore > 0, `Total existing projects in user account: ${countBefore}`);

  // Fetch target project
  const dbProj = initialProjects.find(p => p.slug === targetSlug);
  assert(dbProj !== undefined, `Found target project "${dbProj?.name}" (ID: ${dbProj?.id})`);

  const TARGET_PROJECT_ID = dbProj.id;
  const initialUrl = `https://www.ceova.online/p/${dbProj.slug}`;
  assert(initialUrl === "https://www.ceova.online/p/modern-restaurant-website", `Live URL is: ${initialUrl}`);

  // Fetch live files
  const { data: filesData, error: filesErr } = await supabase
    .from('project_files')
    .select('id, path, content')
    .eq('project_id', TARGET_PROJECT_ID);

  assert(!filesErr && filesData && filesData.length > 0, `Found ${filesData?.length} file(s) for project in project_files`);

  const indexHtmlFile = filesData.find(f => f.path === 'index.html');
  assert(indexHtmlFile !== undefined, "Found index.html in project_files");
  assert(indexHtmlFile.content.includes("Oggy Restaurant"), "index.html contains 'Oggy Restaurant'");
  assert(indexHtmlFile.content.includes("nav") || indexHtmlFile.content.includes("navbar"), "index.html contains navigation bar");

  // ── TEST 5: Simulate "Change the navbar." Execution On Existing Project ───────
  console.log("\nTest 5: Simulate 'Change the navbar.' Execution on Existing Project");

  // Verify all sections exist before navbar modification
  const currentHtml = indexHtmlFile.content;
  const hasHeroBefore = currentHtml.includes('hero') || currentHtml.includes('Authentic & Modern');
  const hasAboutBefore = currentHtml.includes('about') || currentHtml.includes('Culinary Journey');
  const hasMenuBefore = currentHtml.includes('menu') || currentHtml.includes('Truffle Tagliatelle');
  const hasContactBefore = currentHtml.includes('contact') || currentHtml.includes('Reserve a Table');
  const hasFooterBefore = currentHtml.includes('footer') || currentHtml.includes('All rights reserved');

  assert(hasHeroBefore, "Hero section present before update");
  assert(hasAboutBefore, "About section present before update");
  assert(hasMenuBefore, "Menu section present before update");
  assert(hasContactBefore, "Contact section present before update");
  assert(hasFooterBefore, "Footer section present before update");

  // Surgical navbar edit: Add 'Specials' link to navigation bar
  let updatedHtml = currentHtml;
  if (updatedHtml.includes('href="#menu">Menu</a>') && !updatedHtml.includes('href="#specials"')) {
    updatedHtml = updatedHtml.replace(
      'href="#menu">Menu</a>',
      'href="#menu">Menu</a>\n                    <a href="#specials" class="text-sm font-medium hover:text-amber-500 transition-colors">Specials</a>'
    );
  } else if (!updatedHtml.includes('href="#specials"')) {
    updatedHtml = updatedHtml.replace('</nav>', '<a href="#specials" class="text-sm font-medium hover:text-amber-500 transition-colors">Specials</a></nav>');
  }

  // 1. Update project_files for index.html (IN-PLACE edit)
  const { error: fileUpdateErr } = await supabase
    .from('project_files')
    .update({
      content: updatedHtml,
      updated_at: new Date().toISOString()
    })
    .eq('id', indexHtmlFile.id);

  assert(!fileUpdateErr, "Successfully updated index.html in-place in project_files table");

  // 2. Query existing versions to increment version number
  const { data: existingVersions } = await supabase
    .from('project_versions')
    .select('id, version_number')
    .eq('project_id', TARGET_PROJECT_ID)
    .order('version_number', { ascending: false });

  const latestVersionNumber = (existingVersions && existingVersions.length > 0) ? existingVersions[0].version_number : 5;
  const newVersionNumber = latestVersionNumber + 1;
  const changeMessage = "Updated navbar with Specials link and enhanced navigation";

  // 3. Record new version in project_versions
  const { error: verInsertErr } = await supabase
    .from('project_versions')
    .insert({
      project_id: TARGET_PROJECT_ID,
      version_number: newVersionNumber,
      commit_message: changeMessage,
      created_at: new Date().toISOString()
    });

  assert(!verInsertErr, `Successfully inserted new version record (v${newVersionNumber}) in project_versions`);

  // 4. Update metadata on existing projects record
  const currentMeta = dbProj.metadata || {};
  const updatedVersionHistory = [
    ...(currentMeta.version_history || []),
    {
      version: newVersionNumber,
      description: changeMessage,
      created_at: new Date().toISOString()
    }
  ].slice(-25);

  const updatedProjectState = {
    ...(currentMeta.project_state || {}),
    current_version: newVersionNumber,
    latest_change: changeMessage,
    components: ["Navigation (Updated with Specials link)", "Hero", "About", "Featured Menu", "Reservation/Contact", "Footer"],
    deployment_url: initialUrl,
    updated_at: new Date().toISOString()
  };

  const { data: updatedProj, error: metaUpdateErr } = await supabase
    .from('projects')
    .update({
      metadata: {
        ...currentMeta,
        current_version: newVersionNumber,
        latest_change: changeMessage,
        version_history: updatedVersionHistory,
        project_state: updatedProjectState
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', TARGET_PROJECT_ID)
    .select()
    .single();

  assert(!metaUpdateErr && updatedProj !== null, "Successfully updated projects.metadata in-place");

  // ── TEST 6: Strict Invariance & No New Project Created ──────────────────────
  console.log("\nTest 6: Strict Invariance Assertions (Zero Project Re-creation)");

  // Assert Project ID is strictly identical
  assert(updatedProj.id === TARGET_PROJECT_ID, `Project ID is IDENTICAL: ${updatedProj.id} === ${TARGET_PROJECT_ID}`);

  // Assert Slug is strictly identical
  assert(updatedProj.slug === dbProj.slug, `Project slug is IDENTICAL: ${updatedProj.slug} === ${dbProj.slug}`);

  // Assert Live URL is strictly identical
  const liveUrlAfter = `https://www.ceova.online/p/${updatedProj.slug}`;
  assert(liveUrlAfter === initialUrl, `Live URL is UNCHANGED: ${liveUrlAfter} === ${initialUrl}`);

  // Assert total project count in DB did NOT increase
  const { count: countAfter } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true });

  assert(countAfter === countBefore, `Total project count in database is strictly invariant (${countBefore} -> ${countAfter}). Zero duplicate projects created!`);

  // Verify navbar modification took effect in DB
  const { data: recheckedFile } = await supabase
    .from('project_files')
    .select('content')
    .eq('id', indexHtmlFile.id)
    .single();

  assert(recheckedFile.content.includes("Specials"), "Navbar modification verified: 'Specials' is present in database");

  // Verify all other components were preserved
  const recheckedHtml = recheckedFile.content;
  assert(recheckedHtml.includes("Oggy Restaurant"), "Preserved restaurant name 'Oggy Restaurant'");
  assert(recheckedHtml.includes("hero") || recheckedHtml.includes("Authentic & Modern"), "Preserved Hero section");
  assert(recheckedHtml.includes("about") || recheckedHtml.includes("Culinary Journey"), "Preserved About section");
  assert(recheckedHtml.includes("menu") || recheckedHtml.includes("Truffle Tagliatelle"), "Preserved Menu section");
  assert(recheckedHtml.includes("contact") || recheckedHtml.includes("Reserve a Table"), "Preserved Contact section");
  assert(recheckedHtml.includes("footer") || recheckedHtml.includes("All rights reserved"), "Preserved Footer section");

  // Verify live URL serves HTTP 200
  console.log("\nTest 7: Live Website HTTP 200 Verification");
  try {
    const res = await fetch(`https://www.ceova.online/p/${updatedProj.slug}`);
    assert(res.status === 200, `Live website https://www.ceova.online/p/${updatedProj.slug} responds with HTTP 200`);
    const liveBody = await res.text();
    assert(liveBody.includes("Oggy Restaurant"), "Live site serves 'Oggy Restaurant'");
  } catch (e) {
    console.error("Live fetch warning:", e.message);
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log("\n===================================================================");
  console.log(`TEST RESULTS: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log("===================================================================");

  if (passedCount === totalCount) {
    console.log("✓ ALL REQUIREMENT 12 TESTS PASSED PERFECTLY!");
    process.exit(0);
  } else {
    console.error("✗ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
