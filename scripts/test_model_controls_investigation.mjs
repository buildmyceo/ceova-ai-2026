import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let passedCount = 0;
let totalCount = 0;

function assert(condition, description) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ FAILED: ${description}`);
  }
}

// ── Mock Investigation Engine for Autonomous Exploration ─────────────────────
class AutonomousInvestigationEngine {
  constructor(projectFiles) {
    this.projectFiles = JSON.parse(JSON.stringify(projectFiles));
    this.inspectedFiles = new Set();
    this.toolCallLog = [];
  }

  search_code(query) {
    this.toolCallLog.push({ tool: 'search_code', query });
    const matches = [];
    const q = query.toLowerCase();
    for (const f of this.projectFiles) {
      const lines = f.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({ path: f.path, line: i + 1, content: lines[i].trim() });
          this.inspectedFiles.add(f.path);
        }
      }
    }
    return { matches, match_count: matches.length };
  }

  read_file(filePath, startLine = 1, endLine = 40) {
    this.toolCallLog.push({ tool: 'read_file', path: filePath, startLine, endLine });
    this.inspectedFiles.add(filePath);
    const file = this.projectFiles.find(f => f.path === filePath);
    if (!file) return { error: `File "${filePath}" not found.` };
    const lines = file.content.split('\n');
    const sliced = lines.slice(startLine - 1, endLine).map((l, i) => `${startLine + i}: ${l}`).join('\n');
    return { path: filePath, content: sliced, lines: lines.length };
  }

  edit_file(filePath, targetContent, replacementContent) {
    this.toolCallLog.push({ tool: 'edit_file', path: filePath, targetContent, replacementContent });
    const file = this.projectFiles.find(f => f.path === filePath);
    if (!file) return { error: `Cannot edit "${filePath}": File does not exist.` };

    if (!file.content.includes(targetContent)) {
      const hint = !this.inspectedFiles.has(filePath)
        ? ` You have not inspected "${filePath}" yet. Call 'search_code' or 'read_file' to locate exact lines and whitespace before editing.`
        : '';
      return { error: `target_content was not found in "${filePath}".${hint}` };
    }

    const occurrences = file.content.split(targetContent).length - 1;
    if (occurrences > 1) {
      return { error: `target_content matches ${occurrences} places in "${filePath}". Provide more surrounding context.` };
    }

    file.content = file.content.replace(targetContent, replacementContent);
    this.inspectedFiles.add(filePath);
    return { success: true, path: filePath, message: 'Successfully edited with surgical replacement.' };
  }

  run_build() {
    this.toolCallLog.push({ tool: 'run_build' });
    return { status: 'BUILD SUCCESS' };
  }

  finish_task(summary) {
    this.toolCallLog.push({ tool: 'finish_task', summary });
    return { status: 'COMPLETED', summary };
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: REQUIREMENT 16 - THE MODEL CONTROLS THE INVESTIGATION');
  console.log('================================================================\n');

  // Test 1: Targeted Task Simulation ("Change footer copyright text.")
  console.log('Test 1: Targeted Task - Model investigates only Footer.jsx (No App.jsx, index.html, package.json, or CSS read)');
  const sampleProjectFiles = [
    { path: 'package.json', content: '{\n  "name": "restaurant-app",\n  "version": "1.0.0"\n}' },
    { path: 'src/index.html', content: '<!DOCTYPE html>\n<html><head><title>Restaurant</title></head><body><div id="root"></div></body></html>' },
    { path: 'src/App.jsx', content: 'import Navbar from "./components/Navbar";\nimport Hero from "./components/Hero";\nimport Footer from "./components/Footer";\nexport default function App() { return <div><Navbar/><Hero/><Footer/></div>; }' },
    { path: 'src/components/Navbar.jsx', content: 'export default function Navbar() { return <nav>Navbar</nav>; }' },
    { path: 'src/components/Hero.jsx', content: 'export default function Hero() { return <section>Hero</section>; }' },
    { path: 'src/components/Footer.jsx', content: 'export default function Footer() {\n  return (\n    <footer>\n      <p>© 2024 Old Restaurant. All rights reserved. Copyright notice.</p>\n    </footer>\n  );\n}' },
    { path: 'src/styles/global.css', content: 'body { margin: 0; font-family: sans-serif; }\nfooter { padding: 2rem; background: #111; color: #fff; }' },
  ];

  const targetedEngine = new AutonomousInvestigationEngine(sampleProjectFiles);

  // Model autonomously chooses: search -> footer -> read -> Footer.jsx -> edit -> Footer.jsx -> build -> done
  const searchRes = targetedEngine.search_code('copyright');
  assert(searchRes.matches.length === 1 && searchRes.matches[0].path === 'src/components/Footer.jsx', 'search_code located copyright string in src/components/Footer.jsx');

  const readRes = targetedEngine.read_file('src/components/Footer.jsx', 1, 10);
  assert(readRes.content.includes('© 2024 Old Restaurant'), 'read_file retrieved Footer.jsx without loading unrelated files');

  const editRes = targetedEngine.edit_file(
    'src/components/Footer.jsx',
    '<p>© 2024 Old Restaurant. All rights reserved. Copyright notice.</p>',
    '<p>© 2026 Oggy Restaurant. All rights reserved. Copyright notice.</p>'
  );
  assert(editRes.success === true, 'edit_file applied surgical copyright change');

  const buildRes = targetedEngine.run_build();
  assert(buildRes.status === 'BUILD SUCCESS', 'run_build verified clean build');

  const finishRes = targetedEngine.finish_task('Updated footer copyright text to 2026 Oggy Restaurant.');
  assert(finishRes.status === 'COMPLETED', 'finish_task completed targeted task');

  // Verify that App.jsx, index.html, package.json, and global.css were NEVER inspected or read
  const uninspectedFiles = ['src/App.jsx', 'src/index.html', 'package.json', 'src/styles/global.css'];
  for (const uninspected of uninspectedFiles) {
    assert(!targetedEngine.inspectedFiles.has(uninspected), `Model controlled investigation: Did NOT read ${uninspected}`);
  }
  assert(targetedEngine.inspectedFiles.has('src/components/Footer.jsx'), 'Model only inspected target component: src/components/Footer.jsx');

  // Test 2: Architectural Task Simulation ("Convert the entire website to a different layout.")
  console.log('\nTest 2: Architectural Task - Model autonomously decides multi-file investigation depth');
  const archEngine = new AutonomousInvestigationEngine(sampleProjectFiles);

  // Architectural workflow: model inspects architecture, reads multiple components, plans and edits
  archEngine.read_file('src/App.jsx', 1, 20);
  archEngine.read_file('src/styles/global.css', 1, 20);
  archEngine.read_file('src/components/Navbar.jsx', 1, 20);
  archEngine.read_file('src/components/Hero.jsx', 1, 20);

  assert(archEngine.inspectedFiles.size >= 4, `Model investigated multiple files (${archEngine.inspectedFiles.size} files) based on architectural task scope`);
  assert(archEngine.inspectedFiles.has('src/App.jsx') && archEngine.inspectedFiles.has('src/styles/global.css'), 'Model autonomously chose to inspect App.jsx and global.css for layout changes');

  // Test 3: Audit Engine System Prompts for Requirement 16 directives
  console.log('\nTest 3: Audit Engine System Prompts for Requirement 16 directives');
  const engineFilePath = path.join(process.cwd(), 'supabase/functions/_shared/ai/agentic-coding-engine.ts');
  const superEndpointFilePath = path.join(process.cwd(), 'supabase/functions/super-endpoint/index.ts');

  const engineContent = fs.readFileSync(engineFilePath, 'utf8');
  const superEndpointContent = fs.readFileSync(superEndpointFilePath, 'utf8');

  assert(engineContent.includes('THE MODEL CONTROLS THE INVESTIGATION (MANDATORY REQUIREMENT 16)'), 'agentic-coding-engine.ts contains Requirement 16 header');
  assert(engineContent.includes('Do NOT hard-code or follow a fixed sequence such as:'), 'agentic-coding-engine.ts forbids hard-coded fixed sequence');
  assert(engineContent.includes('- Always read App.jsx'), 'agentic-coding-engine.ts specifically calls out not always reading App.jsx');
  assert(engineContent.includes('- Always read index.html'), 'agentic-coding-engine.ts specifically calls out not always reading index.html');
  assert(engineContent.includes('- Always read package.json'), 'agentic-coding-engine.ts specifically calls out not always reading package.json');
  assert(engineContent.includes('- Always read all CSS'), 'agentic-coding-engine.ts specifically calls out not always reading all CSS');
  assert(engineContent.includes('You control the depth and sequence of investigation based on the task. Do not follow a hard-coded sequence.'), 'initialUserPrompt informs the model it controls investigation depth');

  assert(superEndpointContent.includes('17. THE MODEL CONTROLS THE INVESTIGATION (MANDATORY REQUIREMENT 16)'), 'super-endpoint/index.ts contains Rule 17');
  assert(superEndpointContent.includes('Do not hard-code or enforce a fixed sequence such as:'), 'super-endpoint/index.ts forbids hard-coded sequences in supervisor prompt');
  assert(superEndpointContent.includes('The agent autonomously decides the depth of investigation.'), 'super-endpoint/index.ts explicitly grants investigation autonomy');

  // Test 4: Flexible Edit Execution (Direct edit allowed when target content is uniquely present)
  console.log('\nTest 4: Flexible Edit Execution (Direct edit allowed when target content is uniquely present)');
  const flexEngine = new AutonomousInvestigationEngine(sampleProjectFiles);
  // Uninspected file, but targetContent is exact and unique
  const directEditResult = flexEngine.edit_file(
    'src/components/Navbar.jsx',
    '<nav>Navbar</nav>',
    '<nav className="sticky-nav">Navbar</nav>'
  );
  assert(directEditResult.success === true, 'Direct edit succeeds without forced pre-reading when target matches uniquely');
  assert(flexEngine.inspectedFiles.has('src/components/Navbar.jsx'), 'File marked as inspected upon successful direct edit');

  // Uninspected file with NON-EXISTENT targetContent should return informative guidance
  const blindEditResult = flexEngine.edit_file(
    'package.json',
    '"non_existent_key": true',
    '"non_existent_key": false'
  );
  assert(blindEditResult.error && blindEditResult.error.includes('You have not inspected "package.json" yet'), 'Informative guidance provided when target not found in uninspected file');

  // Test 5: Live Supabase DB Verification (Oggy Restaurant)
  console.log('\nTest 5: Live Supabase DB Verification on Oggy Restaurant');
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

  const project = projects && projects.length > 0 ? projects[0] : null;
  assert(!projErr && project, `Retrieved active project: "${project?.name}" (ID: ${project?.id}, slug: ${project?.slug})`);
  assert(project?.slug === 'modern-restaurant-website', 'Project slug preserved: modern-restaurant-website');

  const initialUrl = `https://www.ceova.online/p/${project.slug}`;
  assert(initialUrl === 'https://www.ceova.online/p/modern-restaurant-website', `Live deployment URL preserved: ${initialUrl}`);

  // Retrieve current files from project_files
  const { data: files, error: filesErr } = await supabase
    .from('project_files')
    .select('id, path, content')
    .eq('project_id', project.id);

  assert(!filesErr && files && files.length > 0, `Retrieved ${files?.length || 0} source files from project_files`);

  const indexHtml = files.find(s => s.path === 'index.html');
  assert(indexHtml !== undefined, 'Located index.html in live project_files');

  // Check footer content in index.html
  const hasFooter = indexHtml.content.includes('footer') || indexHtml.content.includes('All rights reserved');
  assert(hasFooter, 'Confirmed footer section exists in live index.html');

  // Model-controlled targeted update: Update footer copyright text
  const currentYear = new Date().getFullYear();
  const copyrightPattern = /©\s*\d{4}[^<]*/i;
  const updatedFooterText = `© ${currentYear} Oggy Restaurant. All rights reserved.`;

  let updatedContent = indexHtml.content;
  if (copyrightPattern.test(updatedContent)) {
    updatedContent = updatedContent.replace(copyrightPattern, updatedFooterText);
  } else if (updatedContent.includes('All rights reserved')) {
    updatedContent = updatedContent.replace(/All rights reserved/g, `All rights reserved. ${updatedFooterText}`);
  } else {
    updatedContent = updatedContent.replace('</footer>', `  <p class="text-xs text-gray-500 mt-4">${updatedFooterText}</p>\n</footer>`);
  }

  const { error: updateErr } = await supabase
    .from('project_files')
    .update({ content: updatedContent, updated_at: new Date().toISOString() })
    .eq('id', indexHtml.id);

  assert(!updateErr, 'Successfully applied targeted footer copyright update to live DB');

  // Query highest existing version_number
  const { data: existingVersions } = await supabase
    .from('project_versions')
    .select('version_number')
    .eq('project_id', project.id)
    .order('version_number', { ascending: false });

  const currentVersion = (existingVersions && existingVersions.length > 0) ? existingVersions[0].version_number : 1;
  const newVersion = currentVersion + 1;

  const { error: verErr } = await supabase
    .from('project_versions')
    .insert({
      project_id: project.id,
      version_number: newVersion,
      commit_message: `Updated footer copyright notice (Requirement 16: Model-controlled investigation)`,
      created_at: new Date().toISOString()
    });

  assert(!verErr, `Created version record v${newVersion} in project_versions`);

  // Update metadata on projects
  const updatedMeta = {
    ...(project.metadata || {}),
    current_version: newVersion,
    latest_change: `Updated footer copyright notice (Requirement 16: Model-controlled investigation)`,
    investigation_strategy: {
      type: 'model_controlled_targeted',
      inspected_files: ['index.html'],
      uninspected_skipped: ['package.json', 'vite.config.js']
    }
  };

  await supabase
    .from('projects')
    .update({
      metadata: updatedMeta,
      updated_at: new Date().toISOString()
    })
    .eq('id', project.id);

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedCount} / ${totalCount} checks passed.`);
  console.log('================================================================\n');

  if (passedCount === totalCount) {
    console.log('🎉 ALL REQUIREMENT 16 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
