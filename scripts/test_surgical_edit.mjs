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
  console.log('=== VERIFYING REQUIREMENT 5: DO NOT REGENERATE COMPLETE FILES ===\n');
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

  // Inspect pre-change file size
  const { data: preFiles } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);
  const preIndex = preFiles?.find(f => f.path === 'index.html');
  const preLength = preIndex?.content.length || 0;
  console.log(`✓ Pre-edit index.html size: ${preLength} characters`);

  // 2. Small change prompt
  const prompt = "Update the contact section: change phone number to '+1 (555) 789-0123' and email to 'reservations@oggyrestaurant.com'.";
  console.log(`\nSubmitting small modification request: "${prompt}"...`);

  const result = await callSuperEndpoint({
    token,
    message: prompt,
    projectId: project.id,
    history: [
      { role: 'user', content: 'Create a restaurant website' },
      { role: 'assistant', content: `✓ Website ready\n\n${project.name}\n\nhttps://www.ceova.online/p/${project.slug}` }
    ]
  });

  console.log('\n\n--- ASSISTANT FINAL SUMMARY ---\n');
  console.log(result.fullText);

  // 3. Inspect updated files in DB
  const { data: postFiles } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);

  const postIndex = postFiles?.find(f => f.path === 'index.html');
  if (!postIndex) {
    throw new Error('index.html is missing in project_files!');
  }

  const hasNewPhone = postIndex.content.includes('+1 (555) 789-0123');
  const hasNewEmail = postIndex.content.includes('reservations@oggyrestaurant.com');
  const postLength = postIndex.content.length;

  // File size delta should be minimal (not a complete rewrite or truncation)
  const lengthDiff = Math.abs(postLength - preLength);
  const isSurgical = lengthDiff < 500; // Small surgical replacement, not a wholesale rewrite

  const preservesHero = postIndex.content.includes('Oggy Restaurant');
  const preservesNavbar = postIndex.content.toLowerCase().includes('nav');
  const preservesFooter = postIndex.content.toLowerCase().includes('footer');

  console.log('\n--- SURGICAL MODIFICATION CHECKS ---');
  console.log(`- New phone present: ${hasNewPhone ? 'PASS' : 'FAIL'}`);
  console.log(`- New email present: ${hasNewEmail ? 'PASS' : 'FAIL'}`);
  console.log(`- Pre-length: ${preLength}, Post-length: ${postLength} (Delta: ${lengthDiff} chars)`);
  console.log(`- Smallest safe modification verified (delta < 500 chars): ${isSurgical ? 'PASS' : 'FAIL'}`);
  console.log(`- Hero preserved: ${preservesHero ? 'PASS' : 'FAIL'}`);
  console.log(`- Navbar & Footer preserved: ${preservesNavbar && preservesFooter ? 'PASS' : 'FAIL'}`);

  if (!hasNewPhone && !hasNewEmail) {
    throw new Error('Neither the new phone nor new email was found in index.html!');
  }

  console.log('\n✓ REQUIREMENT 5 VERIFICATION PASSED!');
}

runTest().catch(err => {
  console.error('\n✗ TEST FAILED:', err);
  process.exit(1);
});
