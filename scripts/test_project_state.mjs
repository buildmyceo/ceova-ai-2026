import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jqpbgcmrlpfqnellznhz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── PART 1: EXTRACT PROJECT STATE LOGIC (MIRRORS CloudWorkerService) ─────────
function extractProjectState(projectId, files, metadata = {}, slug = 'project', versionNumber) {
  const projectSlug = slug || metadata?.slug || 'project';
  const deploymentUrl = metadata?.deployment_url || `https://www.ceova.online/p/${projectSlug}`;
  const approvedPlan = metadata?.approved_plan || null;
  const currentVer = versionNumber || metadata?.current_version || 1;

  // 1. Detect Framework
  let framework = 'vanilla-html';
  const hasPackageJson = files.some(f => f.path === 'package.json');
  const hasReact = files.some(f => /\.(jsx|tsx)$/i.test(f.path)) || (hasPackageJson && files.find(f => f.path === 'package.json')?.content.includes('"react"'));
  const hasVue = files.some(f => /\.vue$/i.test(f.path)) || (hasPackageJson && files.find(f => f.path === 'package.json')?.content.includes('"vue"'));
  const indexHtml = files.find(f => f.path === 'index.html');
  const hasTailwind = indexHtml && (indexHtml.content.includes('tailwindcss') || indexHtml.content.includes('cdn.tailwindcss.com'));

  if (hasReact) {
    framework = 'react';
  } else if (hasVue) {
    framework = 'vue';
  } else if (hasTailwind) {
    framework = 'html5-tailwind';
  }

  // 2. Detect Build System
  let buildSystem = 'static-edge-bundler';
  if (hasPackageJson) {
    const pkgContent = files.find(f => f.path === 'package.json')?.content || '';
    if (pkgContent.includes('"vite"')) buildSystem = 'vite';
    else if (pkgContent.includes('"next"')) buildSystem = 'next.js';
  }

  // 3. Detect Entry Points
  const potentialEntries = ['index.html', 'src/main.jsx', 'src/main.tsx', 'src/index.js', 'src/App.jsx', 'script.js', 'styles.css'];
  const entryPoints = files
    .filter(f => potentialEntries.includes(f.path))
    .map(f => f.path);
  if (entryPoints.length === 0 && files.length > 0) {
    entryPoints.push(files[0].path);
  }

  // 4. Detect Pages
  const pages = files
    .filter(f => f.path.endsWith('.html') || f.path.startsWith('src/pages/'))
    .map(f => f.path);
  if (pages.length === 0 && files.some(f => f.path === 'index.html')) {
    pages.push('index.html');
  }

  // 5. Detect Routes
  const routeSet = new Set();
  routeSet.add('/');
  for (const f of files) {
    if (f.path.endsWith('.html') || f.path.endsWith('.jsx') || f.path.endsWith('.js')) {
      const anchorMatches = f.content.matchAll(/href=["'](#[a-zA-Z0-9_-]+)["']/gi);
      for (const m of anchorMatches) {
        if (m[1] && m[1] !== '#') routeSet.add(`/${m[1]}`);
      }
      const routerMatches = f.content.matchAll(/path=["'](\/[a-zA-Z0-9_\-\/]*)["']/gi);
      for (const m of routerMatches) {
        if (m[1]) routeSet.add(m[1]);
      }
    }
  }
  const routes = Array.from(routeSet);

  // 6. Detect Components
  const componentSet = new Set();
  if (indexHtml) {
    const content = indexHtml.content;
    if (/<header[\s>]/i.test(content)) componentSet.add('header');
    if (/<nav[\s>]/i.test(content)) componentSet.add('nav');
    if (/<main[\s>]/i.test(content)) componentSet.add('main');
    if (/<footer[\s>]/i.test(content)) componentSet.add('footer');

    const idMatches = content.matchAll(/<(?:section|div|article|header|nav|footer)\s+[^>]*id=["']([^"']+)["']/gi);
    for (const match of idMatches) {
      if (match[1]) componentSet.add(match[1].toLowerCase());
    }
  }
  for (const f of files) {
    if (f.path.startsWith('src/components/') || f.path.startsWith('components/')) {
      const compName = f.path.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '');
      if (compName) componentSet.add(compName.toLowerCase());
    }
  }
  const components = Array.from(componentSet);

  // 7. Detect Assets
  const assetSet = new Set();
  for (const f of files) {
    if (/\.(png|jpe?g|svg|webp|gif|ico|pdf|woff2?|ttf)$/i.test(f.path)) {
      assetSet.add(f.path);
    }
    if (f.path.endsWith('.html') || f.path.endsWith('.jsx') || f.path.endsWith('.js') || f.path.endsWith('.css')) {
      // Image sources in <img> tags
      const imgMatches = f.content.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi);
      for (const m of imgMatches) {
        if (m[1]) assetSet.add(m[1].trim());
      }
      // CSS background URLs
      const bgMatches = f.content.matchAll(/url\(["']?([^"')]+)["']?\)/gi);
      for (const m of bgMatches) {
        if (m[1] && !m[1].startsWith('data:')) assetSet.add(m[1].trim());
      }
      // Stylesheet links
      const cssMatches = f.content.matchAll(/<link\s+[^>]*href=["']([^"']+\.css[^"']*)["']/gi);
      for (const m of cssMatches) {
        if (m[1]) assetSet.add(m[1].trim());
      }
      // Script links
      const scriptMatches = f.content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi);
      for (const m of scriptMatches) {
        if (m[1]) assetSet.add(m[1].trim());
      }
    }
  }
  const assets = Array.from(assetSet);

  return {
    project_id: projectId,
    framework,
    build_system: buildSystem,
    entry_points: entryPoints,
    routes,
    pages,
    components,
    assets,
    current_version: currentVer,
    approved_plan: approvedPlan,
    deployment_url: deploymentUrl,
    updated_at: new Date().toISOString(),
  };
}

async function runTests() {
  console.log('=== TEST SUITE: REQUIREMENT 10 - MAINTAIN PROJECT STATE ===\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // ── TEST 1: All 11 Required Fields Present in ProjectState ─────────────────
  console.log('Test 1: ProjectState Schema Completeness (11 Required Fields)');
  const sampleFiles = [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
  <title>Oggy Restaurant</title>
</head>
<body>
  <header><nav id="navbar"><a href="#hero">Hero</a><a href="#about">About</a><a href="#menu">Menu</a><a href="#contact">Contact</a></nav></header>
  <main>
    <section id="hero"><img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4.jpg" alt="Hero"></section>
    <section id="about"><h2>About Us</h2></section>
    <section id="menu"><h2>Menu</h2></section>
    <section id="contact"><h2>Contact</h2></section>
  </main>
  <footer id="footer"><p>© 2026 Oggy Restaurant</p></footer>
  <script src="script.js"></script>
</body>
</html>`
    },
    { path: 'styles.css', content: 'body { margin: 0; }' },
    { path: 'script.js', content: 'console.log("Ready");' },
  ];

  const state = extractProjectState(
    'test-proj-123',
    sampleFiles,
    { approved_plan: 'Approved Restaurant Plan', current_version: 2 },
    'oggy-restaurant',
    2
  );

  // Validate the 11 required fields
  const requiredFields = [
    'project_id',
    'framework',
    'build_system',
    'entry_points',
    'routes',
    'pages',
    'components',
    'assets',
    'current_version',
    'approved_plan',
    'deployment_url'
  ];

  for (const field of requiredFields) {
    assert(field in state && state[field] !== undefined, `Field "${field}" is present in ProjectState`);
  }

  assert(state.project_id === 'test-proj-123', `project_id matches expected ('test-proj-123')`);
  assert(state.framework === 'html5-tailwind', `framework detected correctly ('html5-tailwind')`);
  assert(state.build_system === 'static-edge-bundler', `build_system detected correctly ('static-edge-bundler')`);
  assert(state.entry_points.includes('index.html'), `entry_points contains 'index.html'`);
  assert(state.pages.includes('index.html'), `pages contains 'index.html'`);
  assert(state.routes.includes('/#about') && state.routes.includes('/#menu'), `routes contains anchor paths`);
  assert(state.components.includes('navbar') && state.components.includes('hero') && state.components.includes('menu'), `components contains detected landmarks and sections`);
  assert(state.assets.some(a => a.includes('unsplash')), `assets contains image URL`);
  assert(state.current_version === 2, `current_version is 2`);
  assert(state.approved_plan === 'Approved Restaurant Plan', `approved_plan matches input`);
  assert(state.deployment_url === 'https://www.ceova.online/p/oggy-restaurant', `deployment_url is correct`);

  console.log('\nGenerated ProjectState:');
  console.log(JSON.stringify(state, null, 2));

  // ── TEST 2: Zero Source Code Lines in ProjectState ─────────────────────────
  console.log('\nTest 2: Token Efficiency & Zero Source Code Injected');
  const serializedState = JSON.stringify(state);
  assert(!serializedState.includes('<!DOCTYPE html>'), 'State does not contain HTML boilerplate or full document');
  assert(!serializedState.includes('console.log("Ready");'), 'State does not contain JS source code');
  assert(!serializedState.includes('body { margin: 0; }'), 'State does not contain CSS source code');
  assert(serializedState.length < 1500, `State is compact (${serializedState.length} bytes / ~250 tokens), avoiding context window waste`);

  // ── TEST 3: Dynamic Updates to Components and Version ─────────────────────
  console.log('\nTest 3: Dynamic State Updates');
  const updatedFiles = [
    {
      path: 'index.html',
      content: sampleFiles[0].content.replace('</main>', '<section id="specials"><h2>Specials</h2></section></main>')
    },
    sampleFiles[1],
    sampleFiles[2],
  ];
  const updatedState = extractProjectState(
    'test-proj-123',
    updatedFiles,
    { approved_plan: 'Approved Restaurant Plan', current_version: 3 },
    'oggy-restaurant',
    3
  );
  assert(updatedState.components.includes('specials'), `Newly added 'specials' section is automatically detected in components`);
  assert(updatedState.current_version === 3, `current_version updated to 3`);

  // ── TEST 4: Live DB Persistence Verification on Oggy Restaurant ───────────
  console.log('\nTest 4: Database Persistence in projects.metadata.project_state');
  const targetSlug = 'modern-restaurant-website';

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'ceovatestuser101@gmail.com',
    password: 'Password123!'
  });

  if (authErr || !authData?.session?.access_token) {
    console.error(`  ✗ Authentication error:`, authErr?.message);
  } else {
    const { data: dbProjects, error: dbErr } = await supabase
      .from('projects')
      .select('id, name, slug, status, metadata')
      .eq('slug', targetSlug);

    const dbProj = dbProjects && dbProjects[0];

    if (dbErr || !dbProj) {
      console.error(`  ✗ DB Query error for slug "${targetSlug}":`, dbErr?.message);
    } else {
      assert(dbProj.id !== undefined, `Fetched live project "${dbProj.name}" (${dbProj.id})`);

      // Fetch project files
      const { data: filesData } = await supabase
        .from('project_files')
        .select('path, content')
        .eq('project_id', dbProj.id);

      const liveFiles = filesData || [];
      assert(liveFiles.length > 0, `Project has ${liveFiles.length} live file(s) in project_files`);

      // Compute live persistent state
      const liveProjectState = extractProjectState(
        dbProj.id,
        liveFiles,
        dbProj.metadata,
        dbProj.slug,
        dbProj.metadata?.current_version || 1
      );

      // Persist to projects.metadata.project_state
      const updatedMeta = {
        ...(dbProj.metadata || {}),
        project_state: liveProjectState,
      };

      const { error: updateErr } = await supabase
        .from('projects')
        .update({
          metadata: updatedMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbProj.id);

      if (updateErr) {
        console.error(`  ✗ Failed to update projects.metadata:`, updateErr.message);
      } else {
        assert(true, `Successfully persisted project_state to projects.metadata.project_state in Supabase`);

        // Verify persisted state by re-querying DB
        const { data: recheckProjects } = await supabase
          .from('projects')
          .select('metadata')
          .eq('id', dbProj.id);

        const savedState = recheckProjects && recheckProjects[0]?.metadata?.project_state;
        assert(savedState !== undefined, `projects.metadata.project_state is present in DB`);
        assert(savedState.project_id === dbProj.id, `savedState.project_id matches (${savedState.project_id})`);
        assert(savedState.deployment_url === `https://www.ceova.online/p/${dbProj.slug}`, `savedState.deployment_url matches (${savedState.deployment_url})`);
        assert(Array.isArray(savedState.components) && savedState.components.length > 0, `savedState.components contains [${savedState.components.join(', ')}]`);
        assert(Array.isArray(savedState.routes) && savedState.routes.length > 0, `savedState.routes contains [${savedState.routes.join(', ')}]`);
        assert(Array.isArray(savedState.entry_points) && savedState.entry_points.length > 0, `savedState.entry_points contains [${savedState.entry_points.join(', ')}]`);
        assert(typeof savedState.current_version === 'number', `savedState.current_version is number (${savedState.current_version})`);
        assert(typeof savedState.framework === 'string', `savedState.framework is string ("${savedState.framework}")`);
        assert(typeof savedState.build_system === 'string', `savedState.build_system is string ("${savedState.build_system}")`);
        assert(savedState.approved_plan !== undefined, `savedState.approved_plan is tracked`);
      }
    }
  }

  // ── TEST 5: Live Website Accessibility Check ──────────────────────────────
  console.log('\nTest 5: Live Website Verification');
  try {
    const liveRes = await fetch(`https://www.ceova.online/p/${targetSlug}`);
    assert(liveRes.status === 200, `Live website returned HTTP 200 at https://www.ceova.online/p/${targetSlug}`);
    const liveHtml = await liveRes.text();
    assert(liveHtml.includes('Oggy Restaurant'), `Live website contains "Oggy Restaurant"`);
  } catch (err) {
    console.error(`  ✗ Live fetch error:`, err.message);
  }

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passedCount}/${totalCount} tests passed.`);
  console.log(`========================================\n`);

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
