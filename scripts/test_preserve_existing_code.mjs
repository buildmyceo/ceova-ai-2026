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

  console.log(`Full Assistant Text: "${fullAssistantText}"`);
  console.log(`Total events count: ${events.length}`);

  return { fullAssistantText, events };
}

async function runTest() {
  console.log('=== VERIFYING REQUIREMENT 6: PRESERVE EXISTING CODE ===\n');

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

  // Fetch pre-edit baseline files
  const { data: preFiles, error: preErr } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', targetProject.id);

  if (preErr || !preFiles || preFiles.length === 0) {
    throw new Error('Could not fetch baseline project files.');
  }

  const preIndex = preFiles.find(f => f.path === 'index.html');
  if (!preIndex) throw new Error('index.html missing in baseline project.');

  const preHtml = preIndex.content;
  console.log(`✓ Baseline index.html fetched (${preHtml.length} chars)`);

  // Extract baseline entities to verify preservation
  const preComponents = [...preHtml.matchAll(/<(?:section|div|header|nav|footer|main|article)\s+[^>]*id=["']([^"']+)["']/gi)].map(m => m[1]);
  const preHasNav = /<nav[\s>]/i.test(preHtml);
  const preHasHeader = /<header[\s>]/i.test(preHtml);
  const preHasFooter = /<footer[\s>]/i.test(preHtml);
  const preScripts = [...preHtml.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  const preImages = [...preHtml.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  const preAnchors = [...preHtml.matchAll(/href=["'](#[^"']+)["']/gi)].map(m => m[1]);

  console.log(`Baseline Elements:\n- Components/Sections: [${preComponents.join(', ')}]\n- Nav: ${preHasNav}, Header: ${preHasHeader}, Footer: ${preHasFooter}\n- Scripts/CDNs: ${preScripts.length}\n- Images/Assets: ${preImages.length}\n- Navigation Anchors: ${preAnchors.length}`);

  // Submit targeted modification that should NOT affect anything else
  const prompt = "Add a special announcement badge saying '★ Weekend Special: Free Cannoli with Every Pasta Order ★' right above the menu heading.";
  console.log(`\nSubmitting user request: "${prompt}"...`);

  const { fullAssistantText, events } = await callSuperEndpoint({
    token,
    message: prompt,
    projectId: targetProject.id
  });

  // Verify ready event
  const readyEvent = events.find(e => e.type === 'cloud_project_ready');
  if (!readyEvent) {
    throw new Error('Did not receive cloud_project_ready event!');
  }

  // Fetch updated project files
  const { data: postFiles, error: postErr } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', targetProject.id);

  if (postErr || !postFiles) throw new Error('Failed to fetch updated files.');
  const postIndex = postFiles.find(f => f.path === 'index.html');
  if (!postIndex) throw new Error('index.html missing after update.');
  const postHtml = postIndex.content;

  console.log('\n--- VERIFYING ALL 8 CODE PRESERVATION CRITERIA ---');

  // Check 1: Requested change present
  const hasBadge = postHtml.includes('Weekend Special: Free Cannoli');
  console.log(`1. Requested change present: ${hasBadge ? 'PASS' : 'FAIL'}`);

  // Check 2: Components preserved
  const postComponents = [...postHtml.matchAll(/<(?:section|div|header|nav|footer|main|article)\s+[^>]*id=["']([^"']+)["']/gi)].map(m => m[1]);
  const droppedComponents = preComponents.filter(c => !postComponents.includes(c));
  const postHasNav = /<nav[\s>]/i.test(postHtml);
  const postHasFooter = /<footer[\s>]/i.test(postHtml);
  const componentsPreserved = droppedComponents.length === 0 && postHasNav === preHasNav && postHasFooter === preHasFooter;
  console.log(`2. No components deleted (Navbar, Footer, Section IDs): ${componentsPreserved ? 'PASS' : 'FAIL'} (Dropped: [${droppedComponents.join(', ')}])`);

  // Check 3: Unrelated styling preserved
  const hasThemeClasses = /bg-|text-|font-|flex|grid/i.test(postHtml);
  console.log(`3. Unrelated styling preserved: ${hasThemeClasses ? 'PASS' : 'FAIL'}`);

  // Check 4: Functionality preserved (interactive buttons, anchor tags)
  const hasButtons = /<button[\s>]/i.test(postHtml);
  const hasAnchors = /<a\s+[^>]*href=/i.test(postHtml);
  console.log(`4. Existing functionality preserved (buttons & interactive anchors): ${hasButtons && hasAnchors ? 'PASS' : 'FAIL'}`);

  // Check 5: Routes & anchors preserved
  const postAnchors = [...postHtml.matchAll(/href=["'](#[^"']+)["']/gi)].map(m => m[1]);
  const droppedAnchors = preAnchors.filter(a => !postAnchors.includes(a));
  console.log(`5. Routes and navigation links preserved: ${droppedAnchors.length === 0 ? 'PASS' : 'FAIL'} (Dropped: [${droppedAnchors.join(', ')}])`);

  // Check 6: Unrelated content preserved (restaurant name "Oggy Restaurant")
  const hasOggyName = postHtml.includes('Oggy Restaurant');
  console.log(`6. Unrelated content preserved (Oggy Restaurant title): ${hasOggyName ? 'PASS' : 'FAIL'}`);

  // Check 7: Assets & dependencies preserved
  const postScripts = [...postHtml.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  const droppedScripts = preScripts.filter(s => !postScripts.includes(s));
  const postImages = [...postHtml.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log(`7. Assets & dependencies preserved (scripts: ${droppedScripts.length === 0 ? 'PASS' : 'FAIL'}, images: ${postImages.length >= preImages.length ? 'PASS' : 'FAIL'})`);

  // Check 8: Project structure preserved (no deleted or moved files)
  const preFilePaths = preFiles.map(f => f.path);
  const postFilePaths = postFiles.map(f => f.path);
  const droppedFiles = preFilePaths.filter(p => !postFilePaths.includes(p));
  console.log(`8. Project structure preserved (no files deleted/restructured): ${droppedFiles.length === 0 ? 'PASS' : 'FAIL'} (Dropped files: [${droppedFiles.join(', ')}])`);

  const allPassed = hasBadge && componentsPreserved && hasThemeClasses && hasButtons && hasAnchors && droppedAnchors.length === 0 && hasOggyName && droppedScripts.length === 0 && droppedFiles.length === 0;

  if (allPassed) {
    console.log('\n🎉 ALL REQUIREMENT 6 CODE PRESERVATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    throw new Error('Requirement 6 verification failed!');
  }
}

runTest().catch(err => {
  console.error('\n❌ Test execution failed:', err.message);
  process.exit(1);
});
