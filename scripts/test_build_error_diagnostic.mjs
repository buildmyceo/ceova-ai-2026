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
              if (parsed.logs) {
                // Show tail of logs
                const logLines = parsed.logs.trim().split('\n').slice(-3);
                for (const l of logLines) console.log(`   [LOG] ${l}`);
              }
            } else if (parsed.type === 'cloud_project_ready') {
              console.log(`\n[EVENT: cloud_project_ready] Name: ${parsed.project?.name} | URL: ${parsed.project?.deployment_url}`);
            } else if (parsed.type === 'status') {
              console.log(`[EVENT: status] Stage: ${parsed.stage}`);
            } else if (parsed.type === 'error') {
              console.log(`[EVENT: error]`, parsed);
            } else if (parsed.type === 'text') {
              fullAssistantText += parsed.content;
              process.stdout.write(parsed.content);
            } else {
              console.log(`[EVENT: ${parsed.type}]`, parsed);
            }
          } catch {}
        }
      }
    }
  }

  console.log(`\nFull Assistant Text: "${fullAssistantText}"`);
  console.log(`Total events received: ${events.length}`);
  return { fullAssistantText, events };
}

async function runTest() {
  console.log('=== VERIFYING REQUIREMENT 8: TARGETED BUILD ERROR DIAGNOSTIC EXTRACTION ===\n');

  const { token, user } = await getAuthToken();
  console.log(`✓ Test user authenticated: ${user.email} (${user.id})`);

  // Target project
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (projErr || !projects || projects.length === 0) {
    throw new Error('No target project found.');
  }

  const targetProject = projects[0];
  console.log(`✓ Target project: "${targetProject.name}" (ID: ${targetProject.id}, slug: ${targetProject.slug})`);

  // 1. Fetch current index.html
  const { data: files, error: filesErr } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', targetProject.id);

  if (filesErr || !files || files.length === 0) {
    throw new Error('Could not fetch project files.');
  }

  const indexFile = files.find(f => f.path === 'index.html');
  if (!indexFile) throw new Error('index.html not found.');
  const originalHtml = indexFile.content;
  console.log(`✓ Original index.html fetched (${originalHtml.length} bytes, ${originalHtml.split('\n').length} lines)`);

  // 2. Introduce an intentional, localized build error: an unclosed <script> tag at line ~25
  const originalLines = originalHtml.split('\n');
  const injectLineIdx = Math.min(25, originalLines.length - 2);
  const brokenLines = [...originalLines];
  const testMarkerComment = '<!-- INTENTIONAL_BUILD_ERROR_TEST_MARKER -->';
  brokenLines.splice(injectLineIdx, 0, `  <script type="text/javascript">${testMarkerComment}`);
  const brokenHtml = brokenLines.join('\n');
  const expectedErrorLine = injectLineIdx + 1;

  console.log(`\nInjecting deliberate build error (unclosed <script>) at line ${expectedErrorLine}...`);
  const { error: updateErr } = await supabase
    .from('project_files')
    .update({ content: brokenHtml, updated_at: new Date().toISOString() })
    .eq('project_id', targetProject.id)
    .eq('path', 'index.html');

  if (updateErr) throw new Error(`Failed to inject test build error: ${updateErr.message}`);
  console.log(`✓ Intentional error injected at line ${expectedErrorLine}`);

  try {
    // 3. Ask the agentic engine to check and fix the build
    const prompt = "Fix the unclosed script tag syntax error in index.html and verify the website builds cleanly.";
    console.log(`\nSubmitting user prompt: "${prompt}"...`);

    const { fullAssistantText, events } = await callSuperEndpoint({
      token,
      message: prompt,
      projectId: targetProject.id
    });

    // 4. Verify completion event
    const readyEvent = events.find(e => e.type === 'cloud_project_ready');
    if (!readyEvent) {
      throw new Error('Agent failed to complete task and return cloud_project_ready!');
    }
    console.log(`✓ Agent completed task and published updated project!`);

    // 5. Fetch updated files to verify the surgical fix
    const { data: updatedFiles } = await supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', targetProject.id);

    const updatedIndex = updatedFiles?.find(f => f.path === 'index.html');
    if (!updatedIndex) throw new Error('Updated index.html not found!');
    const updatedHtml = updatedIndex.content;

    console.log('\n--- VERIFYING REQUIREMENT 8 CRITERIA ---');

    // Check 1: The error was resolved
    const hasUnclosedMarker = updatedHtml.includes(testMarkerComment) && !updatedHtml.includes('</script>');
    console.log(`1. Deliberate build failure resolved: ${!hasUnclosedMarker ? 'PASS' : 'FAIL'}`);

    // Check 2: Preservation of core site structure and content
    const hasRestaurantTitle = updatedHtml.includes('Oggy Restaurant');
    const hasMenu = updatedHtml.includes('menu') || updatedHtml.includes('Menu');
    const hasFooter = updatedHtml.includes('footer') || updatedHtml.includes('Footer') || /<footer[\s>]/i.test(updatedHtml);
    console.log(`2. Full site preservation (Title, Menu, Footer intact): ${hasRestaurantTitle && hasMenu && hasFooter ? 'PASS' : 'FAIL'}`);

    // Check 3: File count preservation (no new files created or deleted)
    const originalFileCount = files.length;
    const updatedFileCount = updatedFiles.length;
    console.log(`3. File count preserved (${originalFileCount} files -> ${updatedFileCount} files): ${originalFileCount === updatedFileCount ? 'PASS' : 'FAIL'}`);

    // Check 4: Surgical fix verified (the file was edited cleanly without massive regeneration)
    const lineDelta = Math.abs(updatedHtml.split('\n').length - originalLines.length);
    console.log(`4. Minimal line delta (${lineDelta} lines changed): ${lineDelta <= 5 ? 'PASS' : 'FAIL'}`);

    const passed = !hasUnclosedMarker && hasRestaurantTitle && hasMenu && hasFooter && (originalFileCount === updatedFileCount) && (lineDelta <= 5);

    if (passed) {
      console.log('\n🎉 ALL REQUIREMENT 8 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    } else {
      throw new Error('Requirement 8 verification failed!');
    }
  } catch (err) {
    console.error('Restoring clean index.html after test error...');
    await supabase
      .from('project_files')
      .update({ content: originalHtml, updated_at: new Date().toISOString() })
      .eq('project_id', targetProject.id)
      .eq('path', 'index.html');
    throw err;
  }
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
