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

async function runTest() {
  console.log('=== STARTING CEOVA AGENTIC CODING WORKFLOW TEST ===\n');
  const { token, user } = await getAuthToken();
  console.log(`✓ Test user authenticated: ${user.email} (${user.id})`);

  // 1. Find user's latest project
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (projErr || !projects || projects.length === 0) {
    throw new Error(`No existing projects found for test user. Run acceptance flow test first.`);
  }

  const project = projects[0];
  console.log(`✓ Found target project: "${project.name}" (ID: ${project.id}, slug: ${project.slug})`);

  // 2. Inspect current files
  const { data: beforeFiles, error: filesErr } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);

  if (filesErr || !beforeFiles || beforeFiles.length === 0) {
    throw new Error(`No files found for project: ${filesErr?.message}`);
  }

  const indexHtml = beforeFiles.find(f => f.path === 'index.html');
  if (!indexHtml) {
    throw new Error(`index.html not found in project`);
  }

  console.log(`✓ Project has ${beforeFiles.length} file(s). index.html size: ${indexHtml.content.length} bytes.`);

  // 3. Request a surgical change via conversational prompt
  const changePrompt = "Change the restaurant name to 'Stella Cucina Italiana' and update the button text to 'Reserve Table Today'.";
  console.log(`\nSubmitting agentic coding request: "${changePrompt}"...`);

  const result = await callSuperEndpoint({
    token,
    message: changePrompt,
    projectId: project.id,
    history: [
      { role: 'user', content: 'Create a restaurant website' },
      { role: 'assistant', content: `✓ Website ready\n\n${project.name}\n\nhttps://www.ceova.online/p/${project.slug}` }
    ]
  });

  console.log('\n\n--- ASSISTANT RESPONSE ---\n');
  console.log(result.fullText);

  // 4. Assertions on the response
  const readyEvent = result.events.find(e => e.type === 'cloud_project_ready');
  const responseContent = readyEvent?.content || result.fullText;
  const mentionsUpdated = responseContent.includes('Website updated') || responseContent.includes('updated') || readyEvent?.name === 'Stella Cucina Italiana';
  const includesUrl = responseContent.includes(`ceova.online/p/${project.slug}`) || readyEvent?.deploymentUrl?.includes(project.slug);

  console.log('\n--- VERIFYING AGENTIC RESULT ---');
  console.log(`- Mentions website updated: ${mentionsUpdated ? 'PASS' : 'FAIL'}`);
  console.log(`- Preserves live URL (slug: ${project.slug}): ${includesUrl ? 'PASS' : 'FAIL'}`);

  // 5. Inspect updated files directly in the database
  const { data: afterFiles } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', project.id);

  const updatedIndex = afterFiles?.find(f => f.path === 'index.html');
  if (!updatedIndex) {
    throw new Error('index.html missing after update!');
  }

  const hasNewName = updatedIndex.content.includes('Stella Cucina Italiana');
  const hasNewButton = updatedIndex.content.includes('Reserve Table Today');
  
  // Verify structural landmark preservation (not a blank slate or lost sections)
  const hasMenu = updatedIndex.content.toLowerCase().includes('menu');
  const hasContact = updatedIndex.content.toLowerCase().includes('contact') || updatedIndex.content.toLowerCase().includes('reserv');

  console.log(`- New restaurant name present: ${hasNewName ? 'PASS' : 'FAIL'}`);
  console.log(`- New button text present: ${hasNewButton ? 'PASS' : 'FAIL'}`);
  console.log(`- Preserved menu section: ${hasMenu ? 'PASS' : 'FAIL'}`);
  console.log(`- Preserved contact/reservation: ${hasContact ? 'PASS' : 'FAIL'}`);

  // 6. Check that project ID & slug remained identical
  const { data: currentProject } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('id', project.id)
    .single();

  const sameProject = currentProject?.id === project.id && currentProject?.slug === project.slug;
  console.log(`- Project identity and URL preserved: ${sameProject ? 'PASS' : 'FAIL'}`);

  if (mentionsUpdated && includesUrl && hasNewName && hasNewButton && hasMenu && sameProject) {
    console.log('\n🎉 ALL AGENTIC CODING CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('\n❌ SOME CHECKS FAILED. Please review above output.');
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
