import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getAuthToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "ceovatestuser101@gmail.com",
    password: "Password123!"
  });
  if (error || !data?.session?.access_token) {
    throw new Error(`Failed to authenticate test user: ${error?.message}`);
  }
  return data.session.access_token;
}

async function callSuperEndpoint({ token, message, projectId, history = [] }) {
  const endpoint = `${SUPABASE_URL}/functions/v1/super-endpoint`;
  const body = {
    message,
    project_id: projectId || undefined,
    history,
    attachments: [],
    is_temporary: false,
    has_local_folder: false,
    is_thinking: false,
    user_context: {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      timezone: "UTC",
      dayOfWeek: "Friday"
    }
  };

  console.log(`\n>>> [SENDING] "${message}" (projectId: ${projectId || 'none'}, history len: ${history.length})`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Endpoint returned HTTP ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullAssistantText = '';
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 2);
      if (chunk.startsWith('data: ')) {
        const jsonStr = chunk.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          events.push(parsed);
          if (parsed.type === 'text') {
            fullAssistantText += parsed.content || '';
            process.stdout.write(parsed.content || '');
          } else if (parsed.type === 'project_progress') {
            console.log(`\n[EVENT: project_progress] Stage: ${parsed.stage} | Content: ${parsed.content}`);
          } else if (parsed.type === 'cloud_project_ready') {
            console.log(`\n[EVENT: cloud_project_ready] Name: ${parsed.name} | URL: ${parsed.deploymentUrl}`);
          } else if (parsed.type === 'tool_call') {
            console.log(`\n[EVENT: tool_call] Tool: ${parsed.tool}`);
          } else if (parsed.type === 'status') {
            console.log(`\n[EVENT: status] Stage: ${parsed.stage}`);
          }
        } catch (e) {
          // ignore parse error on partial chunks
        }
      }
    }
  }

  return {
    fullText: fullAssistantText.trim(),
    events
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('REQUIREMENT 19 VERIFICATION: PRESERVE THE PREVIOUS PLAN SYSTEM');
  console.log('================================================================\n');

  const token = await getAuthToken();
  console.log('✓ Test user authenticated successfully.\n');

  // ============================================================================
  // TEST 1: NEW WEBSITE - Mandatory Plan First (6 standard sections)
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 1: NEW WEBSITE -> Plan First (6 Sections, No Build Before Approval)');
  console.log('----------------------------------------------------------------');

  const newSitePrompt = "Create a modern organic bakery website with an artisan menu";
  const newSiteHistory = [];
  const planRes = await callSuperEndpoint({
    token,
    message: newSitePrompt,
    history: newSiteHistory
  });

  // Verify 6 standard plan sections
  const text = planRes.fullText;
  const hasGoal = /####?\s*Website Goal/i.test(text);
  const hasSections = /####?\s*Pages\s*(?:\/|&)\s*Sections/i.test(text);
  const hasDesign = /####?\s*Design Direction/i.test(text);
  const hasFunctionality = /####?\s*Functionality/i.test(text);
  const hasTech = /####?\s*Technical Implementation/i.test(text);
  const hasDeploy = /####?\s*Deployment/i.test(text);
  const hasApprovalQuestion = /(?:proceed|adjustments|would you like)/i.test(text);

  console.log('\nPlan Sections Audit:');
  console.log('  1. Website Goal:              ', hasGoal ? '✓ PRESENT' : '✗ MISSING');
  console.log('  2. Pages / Sections:          ', hasSections ? '✓ PRESENT' : '✗ MISSING');
  console.log('  3. Design Direction:          ', hasDesign ? '✓ PRESENT' : '✗ MISSING');
  console.log('  4. Functionality:             ', hasFunctionality ? '✓ PRESENT' : '✗ MISSING');
  console.log('  5. Technical Implementation:  ', hasTech ? '✓ PRESENT' : '✗ MISSING');
  console.log('  6. Deployment:                ', hasDeploy ? '✓ PRESENT' : '✗ MISSING');
  console.log('  Approval Question:            ', hasApprovalQuestion ? '✓ PRESENT' : '✗ MISSING');

  if (!hasGoal || !hasSections || !hasDesign || !hasFunctionality || !hasTech || !hasDeploy) {
    throw new Error('Test 1 Failed: Implementation plan does not contain all 6 standard sections.');
  }

  // Verify no build was started before approval
  const buildToolCalls = planRes.events.filter(e => 
    (e.type === 'tool_call' && e.tool === 'create_project') || 
    (e.type === 'project_progress' && e.stage === 'BUILDING') ||
    e.type === 'cloud_project_ready'
  );

  console.log(`Build tool calls before approval: ${buildToolCalls.length}`);
  if (buildToolCalls.length > 0) {
    throw new Error('Test 1 Failed: Build started prematurely before user approved the plan!');
  }
  console.log('✓ Test 1 Passed: 6 standard plan sections presented with ZERO premature build tools.\n');

  // ============================================================================
  // TEST 2: NEW WEBSITE -> User Approves Plan -> Agentic Build Loop
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 2: User Approves Plan -> GPT-5.6 Luna Agent Build Loop');
  console.log('----------------------------------------------------------------');

  newSiteHistory.push({ role: 'user', content: newSitePrompt });
  newSiteHistory.push({ role: 'assistant', content: planRes.fullText });

  console.log('User submits approval: "Looks fantastic, please proceed with building it!"');
  const buildRes = await callSuperEndpoint({
    token,
    message: "Looks fantastic, please proceed with building it!",
    history: newSiteHistory
  });

  const readyEvent = buildRes.events.find(e => e.type === 'cloud_project_ready');
  if (!readyEvent) {
    throw new Error('Test 2 Failed: No cloud_project_ready event received after plan approval.');
  }

  const createdProjectId = readyEvent.projectId;
  const createdUrl = readyEvent.deploymentUrl;

  console.log('\n✓ Build Completed:');
  console.log(`  Project ID:     ${createdProjectId}`);
  console.log(`  Live URL:       ${createdUrl}`);
  console.log(`  Project Name:   ${readyEvent.name}`);

  // ============================================================================
  // TEST 3: EXISTING WEBSITE -> Small Change -> Direct Edit (Zero Planning Overhead)
  // ============================================================================
  console.log('\n----------------------------------------------------------------');
  console.log('TEST 3: EXISTING WEBSITE -> Small Change -> Direct Edit');
  console.log('----------------------------------------------------------------');

  const existingSiteHistory = [
    { role: 'user', content: newSitePrompt },
    { role: 'assistant', content: `Website created successfully! Live at: ${createdUrl}` }
  ];

  const smallChangePrompt = "Change the button text to 'Taste The Magic'";
  const smallChangeRes = await callSuperEndpoint({
    token,
    message: smallChangePrompt,
    projectId: createdProjectId,
    history: existingSiteHistory
  });

  // For a small change, it should NOT generate a full 6-section implementation plan!
  const hasUnnecessaryPlan = /####?\s*Website Goal/i.test(smallChangeRes.fullText) && 
                             /####?\s*Technical Implementation/i.test(smallChangeRes.fullText);
  console.log('\nSmall change unnecessary plan detected:', hasUnnecessaryPlan);
  if (hasUnnecessaryPlan) {
    throw new Error('Test 3 Failed: Small change incorrectly forced an implementation plan!');
  }

  const smallChangeReady = smallChangeRes.events.find(e => e.type === 'cloud_project_ready');
  if (!smallChangeReady) {
    throw new Error('Test 3 Failed: No cloud_project_ready event received for direct edit.');
  }

  if (smallChangeReady.projectId !== createdProjectId) {
    throw new Error(`Test 3 Failed: Project ID changed! Expected ${createdProjectId} but got ${smallChangeReady.projectId}`);
  }
  if (smallChangeReady.deploymentUrl !== createdUrl) {
    throw new Error(`Test 3 Failed: Live URL changed! Expected ${createdUrl} but got ${smallChangeReady.deploymentUrl}`);
  }

  console.log('✓ Test 3 Passed: Small change executed directly, same project ID and URL preserved.\n');

  // ============================================================================
  // TEST 4: EXISTING WEBSITE -> Major Change -> Revised Plan + Approval Required
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 4: EXISTING WEBSITE -> Major Change -> Revised Plan + Approval');
  console.log('----------------------------------------------------------------');

  const majorChangePrompt = "Add an entire online custom cake booking and catering inquiry system";
  const majorChangeRes1 = await callSuperEndpoint({
    token,
    message: majorChangePrompt,
    projectId: createdProjectId,
    history: existingSiteHistory
  });

  const hasRevisedPlan = /Plan/i.test(majorChangeRes1.fullText) || /Goal/i.test(majorChangeRes1.fullText);
  console.log('\nMajor Change Revised Plan detected:', hasRevisedPlan);
  if (!hasRevisedPlan) {
    throw new Error('Test 4 Failed: Major change did not present a plan before execution.');
  }

  const majorToolCalls1 = majorChangeRes1.events.filter(e => 
    (e.type === 'tool_call' && e.tool === 'create_project') || 
    (e.type === 'project_progress' && e.stage === 'BUILDING') ||
    e.type === 'cloud_project_ready'
  );

  console.log(`Build tool calls before major change approval: ${majorToolCalls1.length}`);
  if (majorToolCalls1.length > 0) {
    throw new Error('Test 4 Failed: Major change executed build before user approval!');
  }
  console.log('✓ Test 4 Part 1 Passed: Major change presented revised plan, 0 premature build tools.\n');

  // Now user approves major change
  existingSiteHistory.push({ role: 'user', content: majorChangePrompt });
  existingSiteHistory.push({ role: 'assistant', content: majorChangeRes1.fullText });

  console.log('User approves major change: "Approved, please implement the booking system"');
  const majorChangeRes2 = await callSuperEndpoint({
    token,
    message: "Approved, please implement the booking system",
    projectId: createdProjectId,
    history: existingSiteHistory
  });

  const majorChangeReady = majorChangeRes2.events.find(e => e.type === 'cloud_project_ready');
  if (!majorChangeReady) {
    throw new Error('Test 4 Failed: No cloud_project_ready event after approving major change.');
  }

  if (majorChangeReady.projectId !== createdProjectId) {
    throw new Error(`Test 4 Failed: Project ID changed! Expected ${createdProjectId} but got ${majorChangeReady.projectId}`);
  }
  if (majorChangeReady.deploymentUrl !== createdUrl) {
    throw new Error(`Test 4 Failed: Live URL changed! Expected ${createdUrl} but got ${majorChangeReady.deploymentUrl}`);
  }

  console.log('✓ Test 4 Passed: Major change built and verified after approval, same project ID & URL preserved.\n');

  // ============================================================================
  // TEST 5: LIVE DATABASE INTEGRITY ON OGGY RESTAURANT (a7c2485c-8556-43b2-93c8-d8e619ac4673)
  // ============================================================================
  console.log('----------------------------------------------------------------');
  console.log('TEST 5: Live Database Verification for Oggy Restaurant');
  console.log('----------------------------------------------------------------');

  const OGGY_ID = 'a7c2485c-8556-43b2-93c8-d8e619ac4673';
  const { data: oggyProj, error: oggyErr } = await supabase
    .from('projects')
    .select('id, name, slug, status, metadata')
    .eq('id', OGGY_ID)
    .single();

  if (oggyErr || !oggyProj) {
    throw new Error(`Test 5 Failed: Could not fetch Oggy Restaurant from DB: ${oggyErr?.message}`);
  }

  console.log('Oggy Restaurant Project Record:');
  console.log(`  ID:          ${oggyProj.id}`);
  console.log(`  Name:        ${oggyProj.name}`);
  console.log(`  Slug:        ${oggyProj.slug}`);
  console.log(`  Status:      ${oggyProj.status}`);
  console.log(`  Version:     v${oggyProj.metadata?.current_version || 1}`);
  console.log(`  Live URL:    https://www.ceova.online/p/${oggyProj.slug}`);

  if (oggyProj.slug !== 'modern-restaurant-website') {
    throw new Error(`Test 5 Failed: Oggy slug changed! Expected 'modern-restaurant-website', got '${oggyProj.slug}'`);
  }

  console.log('\n================================================================');
  console.log('ALL REQUIREMENT 19 TESTS PASSED SUCCESSFULLY! (5/5)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
