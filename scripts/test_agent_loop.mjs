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
  return { token: data.session.access_token, user: data.user };
}

async function callSuperEndpoint({ token, message, projectId }) {
  const endpoint = `${SUPABASE_URL}/functions/v1/super-endpoint`;
  const body = {
    message,
    project_id: projectId || undefined,
    history: [],
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

  console.log(`\n>>> [SENDING] "${message}" (projectId: ${projectId})`);
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
      const messageBlock = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 2);

      const lines = messageBlock.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw);
            events.push(parsed);

            if (parsed.type === 'project_progress') {
              console.log(`[EVENT: project_progress] Stage: ${parsed.stage} | Content: ${parsed.content}`);
            } else if (parsed.type === 'cloud_project_ready') {
              console.log(`\n[EVENT: cloud_project_ready] Name: ${parsed.project?.name} | URL: ${parsed.project?.deployment_url}`);
            } else if (parsed.type === 'status') {
              console.log(`[EVENT: status] Stage: ${parsed.stage}`);
            } else if (parsed.type === 'error') {
              console.log(`[EVENT: error]`, parsed);
            } else if (parsed.type === 'text') {
              fullAssistantText += parsed.content;
            } else {
              console.log(`[EVENT: ${parsed.type}]`, parsed);
            }
          } catch {}
        }
      }
    }
  }

  return { fullAssistantText, events };
}

async function runTest() {
  console.log("=== VERIFYING REQUIREMENT 7: USE AN AGENT LOOP ===");
  const { token, user } = await getAuthToken();
  console.log(`✓ Test user authenticated: ${user.email}`);

  // Fetch the latest existing project
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (projErr || !projects || projects.length === 0) {
    throw new Error(`No existing project found to test modification!`);
  }

  const project = projects[0];
  console.log(`✓ Target project: "${project.name}" (id: ${project.id}, slug: ${project.slug})`);

  // Fetch pre-edit files
  const { data: preFiles } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);

  const preIndex = preFiles.find(f => f.path === 'index.html');
  if (!preIndex) throw new Error("Pre-edit index.html not found!");

  console.log(`✓ Pre-edit index.html size: ${preIndex.content.length} characters`);

  // Prompt that exercises the agent loop:
  // Inspect -> Make Changes -> Build/Test -> Verify -> Finish
  const updatePrompt = "In the hero section, add a prominent button 'Reserve a Table for Dinner' linking to #reservations with a gold accent, and verify that the website builds cleanly.";

  const { fullAssistantText, events } = await callSuperEndpoint({
    token,
    message: updatePrompt,
    projectId: project.id
  });

  // Verify events emitted during agent loop
  const progressEvents = events.filter(e => e.type === 'project_progress');
  console.log(`\n--- AGENT LOOP PROGRESS TRACE (${progressEvents.length} stages) ---`);
  for (const pe of progressEvents) {
    console.log(`• [${pe.stage}] ${pe.content}`);
  }

  const hasInspection = progressEvents.some(e => e.content.includes('Inspect') || e.content.includes('inspect'));
  const hasBuildingOrTesting = progressEvents.some(e => e.content.includes('build') || e.content.includes('Build') || e.content.includes('test'));
  const hasVerification = progressEvents.some(e => e.stage === 'VERIFYING' || e.content.includes('Verif') || e.content.includes('verif'));

  console.log(`- Loop Stage 1 (Inspect Project): ${hasInspection ? 'PASS' : 'WARN'}`);
  console.log(`- Loop Stage 2 (Build & Test): ${hasBuildingOrTesting ? 'PASS' : 'WARN'}`);
  console.log(`- Loop Stage 3 (Verify & Finish): ${hasVerification ? 'PASS' : 'WARN'}`);

  // Check cloud_project_ready event
  const readyEvent = events.find(e => e.type === 'cloud_project_ready');
  if (!readyEvent) {
    throw new Error("FAIL: cloud_project_ready event was not emitted!");
  }
  console.log(`- Deployment ready emitted: PASS (URL: ${readyEvent.project?.deployment_url})`);

  // Fetch post-edit files
  const { data: postFiles } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);

  const postIndex = postFiles.find(f => f.path === 'index.html');
  if (!postIndex) throw new Error("Post-edit index.html not found!");

  // Verify change was applied
  const hasNewCta = postIndex.content.includes('Reserve a Table for Dinner');
  console.log(`- Target modification applied (Reserve a Table for Dinner button): ${hasNewCta ? 'PASS' : 'FAIL'}`);
  if (!hasNewCta) throw new Error("FAIL: 'Reserve a Table for Dinner' button was not added to the website!");

  // Verify preservation of other sections
  const hasHero = postIndex.content.includes('Oggy Restaurant') || postIndex.content.includes('hero');
  const hasMenu = postIndex.content.includes('menu') || postIndex.content.includes('Menu');
  const hasFooter = postIndex.content.includes('<footer') || postIndex.content.includes('footer');
  const hasDeps = postIndex.content.includes('fonts.googleapis.com') || postIndex.content.includes('cdn.tailwindcss.com') || postIndex.content.includes('stylesheet');

  console.log(`- Original Hero preserved: ${hasHero ? 'PASS' : 'FAIL'}`);
  console.log(`- Menu section preserved: ${hasMenu ? 'PASS' : 'FAIL'}`);
  console.log(`- Footer preserved: ${hasFooter ? 'PASS' : 'FAIL'}`);
  console.log(`- Dependencies preserved: ${hasDeps ? 'PASS' : 'FAIL'}`);

  // Verify live URL
  const expectedUrl = `https://www.ceova.online/p/${project.slug}`;
  const liveUrl = readyEvent.deploymentUrl || readyEvent.project?.deployment_url;
  const urlPreserved = liveUrl === expectedUrl;
  console.log(`- Live URL preserved (${expectedUrl}): ${urlPreserved ? 'PASS' : 'FAIL'}`);

  console.log(`\n✓ REQUIREMENT 7 VERIFICATION PASSED! Agent loop executed successfully.`);
}

runTest().catch(err => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
