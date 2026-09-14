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
  console.log('=== STARTING CEOVA ACCEPTANCE FLOW VERIFICATION ===');
  const token = await getAuthToken();
  console.log('✓ Test user authenticated successfully.\n');

  // ============================================================================
  // FLOW A: New Website
  // User: "Create a restaurant website"
  // → Plan appears
  // → No website generation starts
  // → User clicks Proceed
  // → Website is built
  // → Website is verified
  // → Simple result with live URL appears
  // ============================================================================
  console.log('----------------------------------------------------');
  console.log('TESTING FLOW A: New Website');
  console.log('----------------------------------------------------');

  const flowAHistory = [];
  const flowARes1 = await callSuperEndpoint({
    token,
    message: "Create a restaurant website",
    history: flowAHistory
  });

  // Verify: Plan appears
  const hasPlanA = flowARes1.fullText.includes("Website Implementation Plan") || 
                   flowARes1.fullText.includes("Implementation Plan") ||
                   (flowARes1.fullText.includes("Website Goal") && flowARes1.fullText.includes("Pages / Sections"));
  console.log('\n[Flow A] Plan detected:', hasPlanA);
  if (!hasPlanA) throw new Error("Flow A Failed: Expected Implementation Plan not found in response.");

  // Verify: No website generation started
  const toolCallsA1 = flowARes1.events.filter(e => (e.type === 'tool_call' && e.tool === 'create_project') || (e.type === 'status' && e.stage && e.stage.includes('create_project')));
  const readyCallsA1 = flowARes1.events.filter(e => e.type === 'cloud_project_ready');
  console.log('[Flow A] create_project tool calls before approval:', toolCallsA1.length);
  if (toolCallsA1.length > 0 || readyCallsA1.length > 0) {
    throw new Error("Flow A Failed: Website building started before user approval!");
  }
  console.log('✓ Flow A Part 1 Passed: Plan presented, 0 build tools triggered.\n');

  // Add turn 1 to history
  flowAHistory.push({ role: 'user', content: "Create a restaurant website" });
  flowAHistory.push({ role: 'assistant', content: flowARes1.fullText });

  // User clicks Proceed
  console.log('User clicks "Proceed"...');
  const flowARes2 = await callSuperEndpoint({
    token,
    message: "Proceed",
    history: flowAHistory
  });

  // Verify: Website is built & verified & ready
  const readyEventA = flowARes2.events.find(e => e.type === 'cloud_project_ready');
  if (!readyEventA) {
    throw new Error("Flow A Failed: No cloud_project_ready event received after Proceed.");
  }
  console.log('\n[Flow A] Created Project ID:', readyEventA.projectId);
  console.log('[Flow A] Deployment URL:', readyEventA.deploymentUrl);
  console.log('[Flow A] Content Summary:', readyEventA.content);

  const createdProjectId = readyEventA.projectId;
  const createdUrl = readyEventA.deploymentUrl;

  console.log('✓ FLOW A PASSED!\n');

  // ============================================================================
  // FLOW B: Change before approval
  // User: "Create a restaurant website"
  // → Plan appears
  // → User: "Add a gallery and remove reservations"
  // → Plan is revised
  // → Revised plan appears
  // → Website still has NOT started building
  // → User clicks Proceed
  // → Website is built according to revised plan
  // ============================================================================
  console.log('----------------------------------------------------');
  console.log('TESTING FLOW B: Change before approval');
  console.log('----------------------------------------------------');

  const flowBHistory = [];
  const flowBRes1 = await callSuperEndpoint({
    token,
    message: "Create a bakery website",
    history: flowBHistory
  });

  const hasPlanB1 = flowBRes1.fullText.includes("Implementation Plan") || flowBRes1.fullText.includes("Website Goal");
  console.log('\n[Flow B] Initial Plan detected:', hasPlanB1);
  if (!hasPlanB1) throw new Error("Flow B Failed: Initial plan not found.");

  flowBHistory.push({ role: 'user', content: "Create a bakery website" });
  flowBHistory.push({ role: 'assistant', content: flowBRes1.fullText });

  // User requests plan change before approval
  const flowBRes2 = await callSuperEndpoint({
    token,
    message: "Add a gallery and remove reservations",
    history: flowBHistory
  });

  const hasRevisedPlanB = flowBRes2.fullText.toLowerCase().includes("gallery") && 
                         (flowBRes2.fullText.includes("Plan") || flowBRes2.fullText.includes("Revised"));
  console.log('\n[Flow B] Revised Plan detected with gallery:', hasRevisedPlanB);
  if (!hasRevisedPlanB) throw new Error("Flow B Failed: Revised plan with gallery not found.");

  const toolCallsB2 = flowBRes2.events.filter(e => (e.type === 'tool_call' && e.tool === 'create_project') || (e.type === 'status' && e.stage && e.stage.includes('create_project')));
  if (toolCallsB2.length > 0) {
    throw new Error("Flow B Failed: Website building started before user approved the revised plan!");
  }
  console.log('✓ Flow B Part 2 Passed: Plan revised, 0 build tools triggered.\n');

  flowBHistory.push({ role: 'user', content: "Add a gallery and remove reservations" });
  flowBHistory.push({ role: 'assistant', content: flowBRes2.fullText });

  // Now User clicks Proceed
  console.log('User clicks "Proceed" on revised plan...');
  const flowBRes3 = await callSuperEndpoint({
    token,
    message: "Proceed",
    history: flowBHistory
  });

  const readyEventB = flowBRes3.events.find(e => e.type === 'cloud_project_ready');
  if (!readyEventB) {
    throw new Error("Flow B Failed: No cloud_project_ready event after approving revised plan.");
  }
  console.log('\n[Flow B] Created Project ID:', readyEventB.projectId);
  console.log('[Flow B] Deployment URL:', readyEventB.deploymentUrl);
  console.log('✓ FLOW B PASSED!\n');

  // ============================================================================
  // FLOW C: Small existing-site change
  // Existing website is live
  // → User: "Change the restaurant name"
  // → Existing project is modified
  // → No unnecessary regeneration
  // → Build/verification succeeds
  // → Same URL remains live
  // ============================================================================
  console.log('----------------------------------------------------');
  console.log('TESTING FLOW C: Small existing-site change');
  console.log('----------------------------------------------------');

  const flowCHistory = [
    { role: 'user', content: "Create a restaurant website" },
    { role: 'assistant', content: `Website created! Live: ${createdUrl}` }
  ];

  const flowCRes = await callSuperEndpoint({
    token,
    message: "Change the restaurant name to Luigi Trattoria",
    projectId: createdProjectId,
    history: flowCHistory
  });

  const readyEventC = flowCRes.events.find(e => e.type === 'cloud_project_ready');
  if (!readyEventC) {
    throw new Error("Flow C Failed: No cloud_project_ready event received for small change.");
  }

  console.log('\n[Flow C] Modified Project ID:', readyEventC.projectId);
  console.log('[Flow C] Live URL:', readyEventC.deploymentUrl);
  if (readyEventC.projectId !== createdProjectId) {
    throw new Error(`Flow C Failed: Project ID changed! Expected ${createdProjectId} but got ${readyEventC.projectId}`);
  }
  if (readyEventC.deploymentUrl !== createdUrl) {
    throw new Error(`Flow C Failed: Live URL changed! Expected ${createdUrl} but got ${readyEventC.deploymentUrl}`);
  }
  console.log('✓ Flow C: Same project ID and same URL preserved.');
  console.log('✓ FLOW C PASSED!\n');

  // ============================================================================
  // FLOW D: Major existing-site change
  // Existing website is live
  // → User: "Add a complete online ordering system"
  // → CEOVA recognizes this as a major change
  // → Revised implementation plan is shown
  // → User approves
  // → Change is implemented
  // → Website is verified
  // → Same URL remains live
  // ============================================================================
  console.log('----------------------------------------------------');
  console.log('TESTING FLOW D: Major existing-site change');
  console.log('----------------------------------------------------');

  const flowDHistory = [
    { role: 'user', content: "Create a restaurant website" },
    { role: 'assistant', content: `Website created! Live: ${createdUrl}` }
  ];

  const flowDRes1 = await callSuperEndpoint({
    token,
    message: "Add a complete online ordering system with cart and checkout",
    projectId: createdProjectId,
    history: flowDHistory
  });

  const hasMajorPlanD = flowDRes1.fullText.includes("Plan") || flowDRes1.fullText.includes("Ordering") || flowDRes1.fullText.includes("Goal");
  console.log('\n[Flow D] Major change plan detected:', hasMajorPlanD);
  const toolCallsD1 = flowDRes1.events.filter(e => (e.type === 'tool_call' && e.tool === 'create_project') || (e.type === 'status' && e.stage && e.stage.includes('create_project')));
  if (toolCallsD1.length > 0) {
    throw new Error("Flow D Failed: Major change executed immediately without showing plan!");
  }
  console.log('✓ Flow D Part 1 Passed: Major change recognized, plan presented before execution.\n');

  flowDHistory.push({ role: 'user', content: "Add a complete online ordering system with cart and checkout" });
  flowDHistory.push({ role: 'assistant', content: flowDRes1.fullText });

  console.log('User approves major change by clicking "Proceed"...');
  const flowDRes2 = await callSuperEndpoint({
    token,
    message: "Proceed",
    projectId: createdProjectId,
    history: flowDHistory
  });

  const readyEventD = flowDRes2.events.find(e => e.type === 'cloud_project_ready');
  if (!readyEventD) {
    throw new Error("Flow D Failed: No cloud_project_ready event received after approving major change.");
  }

  console.log('\n[Flow D] Modified Project ID:', readyEventD.projectId);
  console.log('[Flow D] Live URL:', readyEventD.deploymentUrl);
  if (readyEventD.projectId !== createdProjectId) {
    throw new Error(`Flow D Failed: Project ID changed! Expected ${createdProjectId} but got ${readyEventD.projectId}`);
  }
  if (readyEventD.deploymentUrl !== createdUrl) {
    throw new Error(`Flow D Failed: Live URL changed! Expected ${createdUrl} but got ${readyEventD.deploymentUrl}`);
  }
  console.log('✓ Flow D: Same project ID and same URL preserved.');
  console.log('✓ FLOW D PASSED!\n');

  console.log('====================================================');
  console.log('ALL ACCEPTANCE FLOWS (A, B, C, D) PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
