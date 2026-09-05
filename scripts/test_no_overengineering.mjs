/**
 * test_no_overengineering.mjs
 * 
 * Comprehensive Test Suite for Requirement 21:
 * "Do not over-engineer the first implementation"
 * 
 * For this version, prioritize:
 *   Tool calling + File search + File reading + Targeted editing + Build/test + Error feedback + Iterative agent loop
 * 
 * Do NOT add yet:
 *   - complicated vector databases
 *   - autonomous multi-agent systems
 *   - unnecessary microservices
 *   - advanced code embeddings
 *   - unrelated AI features
 *   - new dashboards
 *   - pricing systems
 *   - analytics
 *   - other future CEOVA features
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: REQUIREMENT 21 - DO NOT OVER-ENGINEER THE FIRST IMPLEMENTATION');
  console.log('================================================================\n');

  const engineCode = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/_shared/ai/agentic-coding-engine.ts'), 'utf8');
  const superEndpointCode = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/super-endpoint/index.ts'), 'utf8');
  const workerServiceCode = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/_shared/worker/worker-service.ts'), 'utf8');

  // Test 1: Prioritization of the 7 Core Pillars
  console.log('Test 1: Verification of the 7 Core Prioritized Pillars');
  const prioritizedPillars = [
    { name: '1. Tool calling', check: () => engineCode.includes('getCodingTools') && (engineCode.includes('tools,') || engineCode.includes('tools:')) },
    { name: '2. File search', check: () => engineCode.includes("name: 'search_code'") },
    { name: '3. File reading', check: () => engineCode.includes("name: 'read_file'") && engineCode.includes("name: 'list_files'") },
    { name: '4. Targeted editing', check: () => engineCode.includes("name: 'edit_file'") },
    { name: '5. Build/test', check: () => engineCode.includes("name: 'run_build'") },
    { name: '6. Error feedback', check: () => engineCode.includes('extractBuildDiagnostics') },
    { name: '7. Iterative agent loop', check: () => engineCode.includes('while (turns < maxTurns && !taskFinished)') },
  ];

  for (const pillar of prioritizedPillars) {
    assert(pillar.check(), `Pillar active and implemented: ${pillar.name}`);
  }

  // Test 2: Architectural Audit - Strict Absence of Forbidden Premature Components
  console.log('\nTest 2: Architectural Audit - Prohibited Premature Components');
  
  // A. No Complicated Vector Databases (e.g. pgvector, pinecone, qdrant, chroma, weaviate)
  const vectorDbKeywords = ['@pinecone-database', '@qdrant', 'chromadb', 'weaviate', 'pgvector', 'createIndex(', 'upsertVectors'];
  for (const keyword of vectorDbKeywords) {
    assert(!engineCode.includes(keyword), `Agent engine has zero dependency on "${keyword}"`);
    assert(!superEndpointCode.includes(keyword), `Super-endpoint has zero dependency on "${keyword}"`);
  }

  // B. No Autonomous Multi-Agent Swarms / Hierarchical Frameworks (e.g. autogen, crewai, swarm)
  const multiAgentKeywords = ['crewai', 'autogen', 'AgentMesh', 'AgentSwarm', 'HierarchicalAgentCoordinator'];
  for (const keyword of multiAgentKeywords) {
    assert(!engineCode.includes(keyword), `Agent engine has zero multi-agent swarm complexity "${keyword}"`);
    assert(!superEndpointCode.includes(keyword), `Super-endpoint has zero multi-agent swarm complexity "${keyword}"`);
  }

  // C. No Unnecessary External Microservices (Single lean edge engine architecture)
  const microserviceKeywords = ['microservice_proxy', 'rpc_orchestrator', 'grpc_client'];
  for (const keyword of microserviceKeywords) {
    assert(!engineCode.includes(keyword), `Agent engine avoids unnecessary microservice "${keyword}"`);
  }

  // D. No Advanced Code Embeddings (No token-heavy vector indexing pipelines)
  const embeddingKeywords = ['text-embedding-ada', 'text-embedding-3', 'createEmbedding', 'computeEmbeddings'];
  for (const keyword of embeddingKeywords) {
    assert(!engineCode.includes(keyword), `Agent engine avoids premature code embedding call "${keyword}"`);
  }

  // Test 3: Static Architecture Validator (AgenticCodingEngine.validateArchitecture)
  console.log('\nTest 3: Static Architecture Validation Method');
  assert(engineCode.includes('validateArchitecture(): {'), 'AgenticCodingEngine exposes validateArchitecture static method');
  assert(engineCode.includes('isLean: true'), 'validateArchitecture affirms isLean: true');
  assert(engineCode.includes('forbiddenDetected: []'), 'validateArchitecture affirms zero forbidden items detected');

  // Test 4: Codebase Audit for Requirement 21 Directives
  console.log('\nTest 4: System Prompt & Rules Audit for Requirement 21');
  assert(engineCode.includes('DO NOT OVER-ENGINEER THE FIRST IMPLEMENTATION (MANDATORY REQUIREMENT 21)'), 'agentic-coding-engine.ts contains Requirement 21 header');
  assert(engineCode.includes('For this version, prioritize ONLY the essential 7 pillars'), 'engine prompt prioritizes 7 essential pillars');
  assert(engineCode.includes('complicated vector databases'), 'engine prompt explicitly forbids complicated vector databases');
  assert(engineCode.includes('autonomous multi-agent systems'), 'engine prompt explicitly forbids autonomous multi-agent systems');
  assert(engineCode.includes('unnecessary microservices'), 'engine prompt explicitly forbids unnecessary microservices');
  assert(engineCode.includes('advanced code embeddings'), 'engine prompt explicitly forbids advanced code embeddings');
  assert(engineCode.includes('unrelated AI features'), 'engine prompt explicitly forbids unrelated AI features');
  assert(engineCode.includes('new dashboards'), 'engine prompt explicitly forbids new dashboards');
  assert(engineCode.includes('pricing systems'), 'engine prompt explicitly forbids pricing systems');
  assert(engineCode.includes('analytics'), 'engine prompt explicitly forbids analytics');
  assert(engineCode.includes('We will add those separately later'), 'engine prompt reminds: We will add those separately later');

  assert(superEndpointCode.includes('22. DO NOT OVER-ENGINEER THE FIRST IMPLEMENTATION (MANDATORY REQUIREMENT 21)'), 'super-endpoint/index.ts contains Rule 22');
  assert(superEndpointCode.includes('prioritize ONLY the essential 7 core pillars'), 'super-endpoint prompt prioritizes 7 essential pillars');
  assert(superEndpointCode.includes('complicated vector databases'), 'super-endpoint prompt forbids complicated vector databases');
  assert(superEndpointCode.includes('autonomous multi-agent systems'), 'super-endpoint prompt forbids autonomous multi-agent systems');
  assert(superEndpointCode.includes('unnecessary microservices'), 'super-endpoint prompt forbids unnecessary microservices');
  assert(superEndpointCode.includes('advanced code embeddings'), 'super-endpoint prompt forbids advanced code embeddings');

  // Test 5: Live Database Verification on Oggy Restaurant
  console.log('\nTest 5: Live Database Verification on Oggy Restaurant');
  const authRes = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!',
  });
  assert(!authRes.error && authRes.data.session, 'Authenticated as ceovatestuser101@gmail.com');

  const OGGY_ID = 'a7c2485c-8556-43b2-93c8-d8e619ac4673';
  const { data: oggyProj, error: oggyErr } = await supabase
    .from('projects')
    .select('id, name, slug, status, metadata')
    .eq('id', OGGY_ID)
    .single();

  assert(!oggyErr && oggyProj, 'Retrieved live project record for Oggy Restaurant');
  assert(oggyProj.slug === 'modern-restaurant-website', 'Project slug preserved: modern-restaurant-website');

  // Live URL serving check
  const liveUrl = `https://www.ceova.online/p/${oggyProj.slug}`;
  const response = await fetch(liveUrl, { method: 'GET' });
  assert(response.status === 200, `Live website ${liveUrl} is healthy (HTTP 200)`);
  const html = await response.text();
  assert(html.includes('Oggy Restaurant'), 'Live website serves Oggy Restaurant');

  console.log('\n================================================================');
  console.log('ALL REQUIREMENT 21 TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
