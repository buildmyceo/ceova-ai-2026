import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── PART 1: UNIT TEST OF TERMINAL OUTPUT SUMMARIZER ──────────────────────────
function summarizeTerminalOutput(command, rawOutput, success, includeFullLogs = false) {
  if (includeFullLogs) {
    const lines = rawOutput.split('\n');
    if (lines.length > 100) {
      return `${lines.slice(0, 50).join('\n')}\n... [${lines.length - 100} lines omitted for buffer limits] ...\n${lines.slice(-50).join('\n')}`;
    }
    return rawOutput.slice(0, 4000);
  }

  const lines = (rawOutput || '').trim().split('\n').filter(Boolean);
  const totalLines = lines.length;

  const isBuildCmd = /\b(build|vite build|compile)\b/i.test(command);
  if (isBuildCmd) {
    if (success) {
      return `BUILD SUCCESS`;
    } else {
      const errorLines = lines.filter(l => /(?:error|failed|exception|syntaxerror|typeerror|ts\d+)/i.test(l));
      const relevantError = errorLines.slice(0, 3).join('\n') || lines.slice(-3).join('\n');
      return `BUILD FAILED\n\nRelevant error:\n${relevantError}\n\n(Full logs omitted for efficiency. Pass include_full_logs: true if needed.)`;
    }
  }

  const isTestCmd = /\b(test|jest|vitest|sanity)\b/i.test(command);
  if (isTestCmd) {
    if (success) {
      return `TESTS PASSED\nAll automated tests passed successfully (${totalLines} log lines processed).`;
    } else {
      const errorLines = lines.filter(l => /(?:fail|error|mismatch|unclosed|unbalanced)/i.test(l));
      const relevantError = errorLines.slice(0, 3).join('\n') || lines.slice(-3).join('\n');
      return `TESTS FAILED\n\nRelevant error:\n${relevantError}\n\n(Full logs omitted for efficiency. Pass include_full_logs: true if needed.)`;
    }
  }

  if (totalLines <= 15 && rawOutput.length <= 800) {
    return rawOutput.trim();
  }

  const errorOrWarnLines = lines.filter(l => /(?:error|failed|warning|exception|critical)/i.test(l));
  const summaryLines = [
    `Command completed (${success ? 'SUCCESS' : 'FAILED'}, ${totalLines} lines produced).`,
  ];

  if (errorOrWarnLines.length > 0) {
    summaryLines.push(`Relevant diagnostics (${errorOrWarnLines.length} alert line(s)):`);
    summaryLines.push(...errorOrWarnLines.slice(0, 5).map(l => `  ${l.trim()}`));
  }

  summaryLines.push(`Recent output:\n${lines.slice(-3).map(l => `  ${l.trim()}`).join('\n')}`);
  summaryLines.push(`(Full output omitted for token efficiency. Pass include_full_logs: true if needed.)`);

  return summaryLines.join('\n\n');
}

function runUnitTests() {
  console.log('=== PART 1: TESTING TERMINAL OUTPUT SUMMARIZATION ===\n');

  // Generate 3,000 lines of terminal output
  const lines3000 = [];
  for (let i = 1; i <= 3000; i++) {
    if (i === 150) {
      lines3000.push(`[WARN] Low memory warning at step ${i}`);
    } else if (i === 2450) {
      lines3000.push(`[ERROR] src/components/Hero.jsx:42 - TypeError: Cannot read property 'map' of undefined`);
    } else {
      lines3000.push(`[INFO] Step ${i}: Processing asset chunk ${i}...`);
    }
  }
  const hugeOutput = lines3000.join('\n');
  console.log(`✓ Generated simulated 3,000 lines of terminal output (${hugeOutput.length} chars)`);

  // Test 1: General command produces 3,000 lines
  const summarized = summarizeTerminalOutput('npm run generate-assets', hugeOutput, false, false);
  console.log('\n--- Summarized Output ---');
  console.log(summarized);
  console.log('-------------------------\n');

  const summarizedLineCount = summarized.split('\n').length;
  console.log(`- Original lines: 3,000 | Summarized lines: ${summarizedLineCount}`);
  console.log(`- Contains "3000 lines produced": ${summarized.includes('3000 lines produced')}`);
  console.log(`- Contains relevant error alert: ${summarized.includes('TypeError')}`);
  console.log(`- Contains "Full output omitted": ${summarized.includes('Full output omitted')}`);

  if (summarizedLineCount > 25 || !summarized.includes('TypeError') || !summarized.includes('3000 lines produced')) {
    throw new Error('Test 1 failed: 3,000-line output was not condensed properly!');
  }
  console.log('✓ Test 1 passed (3,000 lines condensed to relevant info)!\n');

  // Test 2: Build command success produces "BUILD SUCCESS"
  const buildSuccess = summarizeTerminalOutput('npm run build', hugeOutput, true, false);
  console.log(`- Build success output: "${buildSuccess}"`);
  if (buildSuccess !== 'BUILD SUCCESS') {
    throw new Error('Test 2 failed: Build success must return "BUILD SUCCESS"');
  }
  console.log('✓ Test 2 passed (Build success returns "BUILD SUCCESS")!\n');

  // Test 3: Build command failure produces "BUILD FAILED" + relevant error
  const buildFailure = summarizeTerminalOutput('npm run build', hugeOutput, false, false);
  console.log(`- Build failure output:\n${buildFailure}\n`);
  if (!buildFailure.startsWith('BUILD FAILED') || !buildFailure.includes('Relevant error:') || !buildFailure.includes('TypeError')) {
    throw new Error('Test 3 failed: Build failure must start with BUILD FAILED and contain relevant error!');
  }
  console.log('✓ Test 3 passed (Build failure returns BUILD FAILED + relevant error)!\n');

  // Test 4: When includeFullLogs: true, full logs are delivered
  const fullLogRes = summarizeTerminalOutput('npm run build', hugeOutput, false, true);
  console.log(`- Full logs requested length: ${fullLogRes.length} chars (capped safely)`);
  if (!fullLogRes.includes('[INFO] Step 1') || !fullLogRes.includes('[INFO] Step 3000')) {
    throw new Error('Test 4 failed: Full logs were not included when explicitly requested!');
  }
  console.log('✓ Test 4 passed (Full logs returned when requested)!\n');

  console.log('🎉 ALL PART 1 UNIT TESTS PASSED SUCCESSFULLY!\n');
}

// ── PART 2: LIVE END-TO-END VALIDATION ────────────────────────────────────────
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
                const logLines = parsed.logs.trim().split('\n').slice(-2);
                for (const l of logLines) console.log(`   [LOG] ${l}`);
              }
            } else if (parsed.type === 'cloud_project_ready') {
              console.log(`\n[EVENT: cloud_project_ready] Name: ${parsed.project?.name} | URL: ${parsed.project?.deployment_url}`);
            } else if (parsed.type === 'status') {
              console.log(`[EVENT: status] Stage: ${parsed.stage}`);
            } else if (parsed.type === 'text') {
              fullAssistantText += parsed.content;
            }
          } catch {}
        }
      }
    }
  }

  return { fullAssistantText, events };
}

async function runLiveTest() {
  console.log('=== PART 2: LIVE VALIDATION OF REQUIREMENT 9 ===\n');

  const { token, user } = await getAuthToken();
  console.log(`✓ Authenticated test user: ${user.email}`);

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

  // Submit modification request
  const prompt = "In the hero section, update the reservation button text to 'Reserve a Table Online' with sleek styling, and verify build succeeds.";
  console.log(`\nSubmitting user prompt: "${prompt}"...`);

  const { events } = await callSuperEndpoint({
    token,
    message: prompt,
    projectId: targetProject.id
  });

  const readyEvent = events.find(e => e.type === 'cloud_project_ready');
  if (!readyEvent) {
    throw new Error('Agent failed to complete task and return cloud_project_ready!');
  }
  console.log(`✓ Agent completed task and published updated project!`);

  // Verify file update
  const { data: files } = await supabase
    .from('project_files')
    .select('path, content')
    .eq('project_id', targetProject.id);

  const indexHtml = files?.find(f => f.path === 'index.html')?.content || '';
  const hasButton = indexHtml.includes('Reserve a Table Online');
  console.log(`- Button updated in index.html: ${hasButton ? 'PASS' : 'FAIL'}`);

  if (!hasButton) {
    throw new Error('Live test failed: Requested change was not present in index.html!');
  }

  console.log('\n🎉 ALL REQUIREMENT 9 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

async function main() {
  runUnitTests();
  await runLiveTest();
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
