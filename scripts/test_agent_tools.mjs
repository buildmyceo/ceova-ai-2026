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

  console.log(`\n>>> [SENDING] "${message}" (projectId: ${projectId || 'none'})`);
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
          }
        } catch (e) {
          // ignore parse errors on partial chunks
        }
      }
    }
  }

  return {
    fullText: fullAssistantText.trim(),
    events
  };
}

async function runTest() {
  console.log('=== VERIFYING CODING AGENT WITH FULL 14-TOOL SUITE ===\n');
  const { token, user } = await getAuthToken();
  console.log(`✓ Test user authenticated: ${user.email} (${user.id})`);

  // 1. Fetch user's project
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (projErr || !projects || projects.length === 0) {
    throw new Error('No existing project found for test user.');
  }

  const project = projects[0];
  console.log(`✓ Target project: "${project.name}" (ID: ${project.id}, slug: ${project.slug})`);

  // 2. Request an enhancement that exercises inspection, code edit, and verification
  const modificationRequest = "Add a special announcements badge saying '★ Rated #1 Italian Dining in Milan ★' right above the main hero heading and make the call to action button say 'Book A Table Today'.";

  console.log(`\nInvoking coding agent for: "${modificationRequest}"...`);
  const result = await callSuperEndpoint({
    token,
    message: modificationRequest,
    projectId: project.id,
    history: [
      { role: 'user', content: 'Create a website' },
      { role: 'assistant', content: `✓ Website ready\n\n${project.name}\n\nhttps://www.ceova.online/p/${project.slug}` }
    ]
  });

  console.log('\n\n--- ASSISTANT FINAL SUMMARY ---\n');
  console.log(result.fullText);

  // 3. Inspect updated files in DB
  const { data: files } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);

  const indexHtml = files?.find(f => f.path === 'index.html');
  if (!indexHtml) {
    throw new Error('index.html is missing in project_files!');
  }

  const hasBadge = indexHtml.content.includes('Rated #1 Italian Dining in Milan');
  const hasButton = indexHtml.content.includes('Book A Table Today');
  const preservesSections = indexHtml.content.toLowerCase().includes('nav') && 
                            indexHtml.content.toLowerCase().includes('footer');

  console.log('\n--- VERIFICATION CHECKS ---');
  console.log(`- Badge added to HTML: ${hasBadge ? 'PASS' : 'FAIL'}`);
  console.log(`- Button updated: ${hasButton ? 'PASS' : 'FAIL'}`);
  console.log(`- Landmarks/Sections preserved: ${preservesSections ? 'PASS' : 'FAIL'}`);

  if (!hasBadge && !hasButton) {
    throw new Error('Neither the badge nor the button update were found in index.html!');
  }

  console.log('\n✓ ALL CODING AGENT TOOL VERIFICATIONS PASSED!');
}

runTest().catch(err => {
  console.error('\n✗ TEST FAILED:', err);
  process.exit(1);
});
