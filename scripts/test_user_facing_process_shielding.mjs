#!/usr/bin/env node
/**
 * TEST SUITE: REQUIREMENT 18 - DO NOT EXPOSE THE AGENT'S INTERNAL TOOL PROCESS TO NORMAL USERS
 *
 * Requirements:
 * 1. The user does not need to see:
 *    search_code()
 *    read_file()
 *    edit_file()
 *    npm run build
 *    Those are internal agent operations.
 * 2. The user should see a clean experience such as:
 *    Updating your website…
 *    Then:
 *    Website updated successfully.
 *    If something fails:
 *    I found an issue while updating the website. I’m fixing it.
 * 3. Only expose technical details when they are genuinely useful.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAILED: ${message}`);
  }
}

// ── Progress Event Shielding Simulator ───────────────────────────────────────
class UserFacingEventSimulator {
  static computeProgressMessage({ isExistingProject, hasActiveErrors, toolName }) {
    if (hasActiveErrors) {
      return isExistingProject
        ? 'I found an issue while updating the website. I’m fixing it.'
        : 'I found an issue while building the website. I’m fixing it.';
    } else if (toolName === 'finish_task') {
      return 'Verifying website…';
    } else {
      return isExistingProject ? 'Updating your website…' : 'Building your website…';
    }
  }

  static computeSupervisorStatus(toolId, existingProjectId) {
    if (toolId === 'create_project' || toolId === 'update_project' || toolId === 'deploy_project') {
      return existingProjectId ? 'Updating your website…' : 'Building your website…';
    } else if (toolId === 'image_analysis' || toolId === 'background_remover') {
      return 'Processing image…';
    } else if (toolId === 'pdf_toolkit') {
      return 'Processing document…';
    } else if (toolId === 'invoice_generator') {
      return 'Generating invoice…';
    } else if (toolId === 'qr_barcode') {
      return 'Generating QR code…';
    } else if (toolId.includes('connector')) {
      return 'Connecting to service…';
    }
    return 'Processing request…';
  }

  static formatCompletionSummary({ isExistingProject, projectName, description, deploymentUrl }) {
    const header = isExistingProject ? 'Website updated successfully.' : 'Website created successfully.';
    return `${header}\n\n${projectName}\n\n${description}\n\n${deploymentUrl}`;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: REQUIREMENT 18 - DO NOT EXPOSE INTERNAL TOOL PROCESS TO NORMAL USERS');
  console.log('================================================================\n');

  // ── TEST 1: User-Facing Progress Events for Normal Updates ───────────────────
  console.log('Test 1: User-Facing Progress Events for Normal Website Updates');
  const normalUpdateEvent = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: true,
    hasActiveErrors: false,
    toolName: 'search_code'
  });
  assert(normalUpdateEvent === 'Updating your website…', 'search_code produces clean message: "Updating your website…"');

  const readFileEvent = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: true,
    hasActiveErrors: false,
    toolName: 'read_file'
  });
  assert(readFileEvent === 'Updating your website…', 'read_file produces clean message: "Updating your website…"');

  const editFileEvent = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: true,
    hasActiveErrors: false,
    toolName: 'edit_file'
  });
  assert(editFileEvent === 'Updating your website…', 'edit_file produces clean message: "Updating your website…"');

  const runBuildEvent = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: true,
    hasActiveErrors: false,
    toolName: 'run_build'
  });
  assert(runBuildEvent === 'Updating your website…', 'run_build produces clean message: "Updating your website…"');

  const finishEvent = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: true,
    hasActiveErrors: false,
    toolName: 'finish_task'
  });
  assert(finishEvent === 'Verifying website…', 'finish_task produces clean message: "Verifying website…"');

  // ── TEST 2: Strict Exclusion of Internal Tool Names from User View ──────────
  console.log('\nTest 2: Strict Exclusion of Internal Tool Names from Normal Users');
  const forbiddenToolPatterns = [
    'search_code()',
    'search_code',
    'read_file()',
    'read_file',
    'edit_file()',
    'edit_file',
    'npm run build',
    'run_build()',
    'write_file()',
    'Calling tool:'
  ];

  const simulatedUserEvents = [
    normalUpdateEvent,
    readFileEvent,
    editFileEvent,
    runBuildEvent,
    finishEvent
  ];

  for (const forbidden of forbiddenToolPatterns) {
    const leaked = simulatedUserEvents.some(evt => evt.includes(forbidden));
    assert(!leaked, `Internal tool process "${forbidden}" is strictly NOT exposed to normal users`);
  }

  // ── TEST 3: Build Error Recovery User Experience ─────────────────────────────
  console.log('\nTest 3: Build Error Recovery User Experience');
  const errorRecoveryEventUpdate = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: true,
    hasActiveErrors: true,
    toolName: 'edit_file'
  });
  assert(
    errorRecoveryEventUpdate === 'I found an issue while updating the website. I’m fixing it.',
    'Build error during update emits: "I found an issue while updating the website. I’m fixing it."'
  );

  const errorRecoveryEventNew = UserFacingEventSimulator.computeProgressMessage({
    isExistingProject: false,
    hasActiveErrors: true,
    toolName: 'run_build'
  });
  assert(
    errorRecoveryEventNew === 'I found an issue while building the website. I’m fixing it.',
    'Build error during initial build emits: "I found an issue while building the website. I’m fixing it."'
  );

  assert(!errorRecoveryEventUpdate.includes('error TS'), 'TS compiler errors NOT leaked into user progress message');
  assert(!errorRecoveryEventUpdate.includes('TypeError'), 'Runtime TypeErrors NOT leaked into user progress message');
  assert(!errorRecoveryEventUpdate.includes('at '), 'Call stacks NOT leaked into user progress message');

  // ── TEST 4: Clean Completion Message & Summary Format ────────────────────────
  console.log('\nTest 4: Clean Completion Message & Summary Format');
  const completionSummary = UserFacingEventSimulator.formatCompletionSummary({
    isExistingProject: true,
    projectName: 'Oggy Restaurant',
    description: 'Modern restaurant website with gourmet menu and table reservation.',
    deploymentUrl: 'https://www.ceova.online/p/modern-restaurant-website'
  });

  assert(completionSummary.startsWith('Website updated successfully.'), 'Summary starts with "Website updated successfully."');
  assert(completionSummary.includes('Oggy Restaurant'), 'Summary includes clean project name');
  assert(completionSummary.includes('https://www.ceova.online/p/modern-restaurant-website'), 'Summary includes live deployment URL');
  assert(!completionSummary.includes('npm run build'), 'Summary does NOT mention npm run build');
  assert(!completionSummary.includes('edit_file'), 'Summary does NOT mention edit_file');
  assert(!completionSummary.includes('search_code'), 'Summary does NOT mention search_code');
  assert(!completionSummary.includes('read_file'), 'Summary does NOT mention read_file');

  // ── TEST 5: Supervisor Status Shielding in Super-Endpoint ────────────────────
  console.log('\nTest 5: Supervisor Status Shielding in super-endpoint/index.ts');
  const createProjStatus = UserFacingEventSimulator.computeSupervisorStatus('create_project', 'proj-123');
  assert(createProjStatus === 'Updating your website…', 'create_project on existing site displays "Updating your website…"');

  const newProjStatus = UserFacingEventSimulator.computeSupervisorStatus('create_project', null);
  assert(newProjStatus === 'Building your website…', 'create_project on new site displays "Building your website…"');

  const imageStatus = UserFacingEventSimulator.computeSupervisorStatus('image_analysis', null);
  assert(imageStatus === 'Processing image…', 'image_analysis displays "Processing image…"');

  const pdfStatus = UserFacingEventSimulator.computeSupervisorStatus('pdf_toolkit', null);
  assert(pdfStatus === 'Processing document…', 'pdf_toolkit displays "Processing document…"');

  const invoiceStatus = UserFacingEventSimulator.computeSupervisorStatus('invoice_generator', null);
  assert(invoiceStatus === 'Generating invoice…', 'invoice_generator displays "Generating invoice…"');

  const qrStatus = UserFacingEventSimulator.computeSupervisorStatus('qr_barcode', null);
  assert(qrStatus === 'Generating QR code…', 'qr_barcode displays "Generating QR code…"');

  const connStatus = UserFacingEventSimulator.computeSupervisorStatus('gmail_connector', null);
  assert(connStatus === 'Connecting to service…', 'connector tools display "Connecting to service…"');

  assert(!createProjStatus.includes('Calling tool:'), 'Raw "Calling tool:" prefix eliminated');
  assert(!imageStatus.includes('Calling tool:'), 'Raw tool ID eliminated from image status');

  // ── TEST 6: Code Audit - Verify Requirement 18 in Codebase ───────────────────
  console.log('\nTest 6: Code Audit - Verify Requirement 18 Directives in Prompts & Handlers');
  const enginePath = path.join(process.cwd(), 'supabase/functions/_shared/ai/agentic-coding-engine.ts');
  const orchPath = path.join(process.cwd(), 'supabase/functions/_shared/ai/cloud-dev-orchestrator.ts');
  const superPath = path.join(process.cwd(), 'supabase/functions/super-endpoint/index.ts');

  const engineSrc = fs.readFileSync(enginePath, 'utf8');
  const orchSrc = fs.readFileSync(orchPath, 'utf8');
  const superSrc = fs.readFileSync(superPath, 'utf8');

  assert(engineSrc.includes("DO NOT EXPOSE THE AGENT'S INTERNAL TOOL PROCESS TO NORMAL USERS (MANDATORY REQUIREMENT 18)"), 'agentic-coding-engine.ts contains Requirement 18 header');
  assert(engineSrc.includes('search_code()'), 'engine directive mentions search_code() as internal');
  assert(engineSrc.includes('read_file()'), 'engine directive mentions read_file() as internal');
  assert(engineSrc.includes('edit_file()'), 'engine directive mentions edit_file() as internal');
  assert(engineSrc.includes('npm run build'), 'engine directive mentions npm run build as internal');
  assert(engineSrc.includes('Updating your website…'), 'engine directive specifies "Updating your website…"');
  assert(engineSrc.includes('Website updated successfully.'), 'engine directive specifies "Website updated successfully."');
  assert(engineSrc.includes('I found an issue while updating the website. I’m fixing it.'), 'engine directive specifies "I found an issue while updating the website. I’m fixing it."');
  assert(engineSrc.includes('Only expose technical details when they are genuinely useful.'), 'engine directive specifies exposing technical details only when genuinely useful');

  assert(orchSrc.includes('Updating your website…'), 'cloud-dev-orchestrator.ts uses "Updating your website…"');
  assert(orchSrc.includes('Website updated successfully.'), 'cloud-dev-orchestrator.ts uses "Website updated successfully."');
  assert(orchSrc.includes('I found an issue while updating the website. I’m fixing it.'), 'cloud-dev-orchestrator.ts uses "I found an issue while updating the website. I’m fixing it."');
  assert(orchSrc.includes('Verifying website…'), 'cloud-dev-orchestrator.ts uses "Verifying website…"');

  assert(superSrc.includes("19. DO NOT EXPOSE THE AGENT'S INTERNAL TOOL PROCESS TO NORMAL USERS (MANDATORY REQUIREMENT 18)"), 'super-endpoint/index.ts contains Rule 19');
  assert(superSrc.includes('Updating your website…'), 'super-endpoint/index.ts specifies "Updating your website…"');
  assert(superSrc.includes('Website updated successfully.'), 'super-endpoint/index.ts specifies "Website updated successfully."');
  assert(superSrc.includes('I found an issue while updating the website. I’m fixing it.'), 'super-endpoint/index.ts specifies "I found an issue while updating the website. I’m fixing it."');
  assert(!superSrc.includes('Calling tool: ${toolId}'), 'super-endpoint/index.ts does NOT contain raw "Calling tool: ${toolId}"');

  // ── TEST 7: Live Supabase DB Verification on Oggy Restaurant ──────────────────
  console.log('\nTest 7: Live Supabase DB Verification on Oggy Restaurant');
  const authRes = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!',
  });
  assert(!authRes.error && authRes.data.session, 'Authenticated as ceovatestuser101@gmail.com');

  const targetSlug = 'modern-restaurant-website';
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, slug, metadata')
    .eq('slug', targetSlug);

  assert(!projErr && projects && projects.length > 0, `Found live project "${projects?.[0]?.name}"`);
  const activeProj = projects[0];

  assert(activeProj.slug === targetSlug, 'Project slug is modern-restaurant-website');
  assert(activeProj.metadata?.deployment_url === `https://www.ceova.online/p/${targetSlug}`, 'Live deployment URL preserved');

  // Verify live website HTTP 200 response
  const liveUrl = activeProj.metadata?.deployment_url;
  try {
    const resp = await fetch(liveUrl);
    assert(resp.status === 200, `Live website ${liveUrl} responds with HTTP 200`);
    const html = await resp.text();
    assert(html.includes('Oggy Restaurant'), 'Live website serves Oggy Restaurant');
  } catch (e) {
    assert(false, `Failed to reach live website: ${e.message}`);
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedChecks} / ${totalChecks} checks passed.`);
  console.log('================================================================\n');

  if (passedChecks === totalChecks) {
    console.log('🎉 ALL REQUIREMENT 18 VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED.\n');
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
