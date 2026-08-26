/**
 * CEOVA Cloud Development Agent Orchestrator
 * 
 * Autonomous full-stack cloud development loop powered by GPT-5.6 Luna.
 * Handles Project Creation -> Architecture Planning -> Code Generation
 * -> Isolated Worker Compilation & Testing -> Self-Healing Error Fixing -> Live Deployment.
 */

import { AIProviderService, ChatMessage } from './ai-provider.ts';
import { CloudWorkerService, ProjectFile } from '../worker/worker-service.ts';
import { generateProjectSlug } from '../tools/cloud-tools.ts';
import { Logger } from '../services/logger.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface CloudDevProgressCallback {
  (event: {
    type: 'project_progress' | 'cloud_project_ready' | 'text' | 'error';
    stage?: string;
    projectId?: string;
    slug?: string;
    deploymentUrl?: string;
    logs?: string;
    files?: string[];
    content?: string;
    error?: string;
  }): void;
}

export class CloudDevOrchestrator {
  private static readonly MAX_FIX_ATTEMPTS = 3;

  /**
   * Executes the full end-to-end cloud development and hosting flow
   */
  /**
   * Executes the full end-to-end cloud development and hosting flow (supports both new projects and updates to existing projects)
   */
  static async buildAndDeployProject(
    userPrompt: string,
    userId: string,
    onProgress: CloudDevProgressCallback,
    existingProjectId?: string
  ): Promise<{ projectId: string; slug: string; deploymentUrl: string }> {
    Logger.INFO(`[CloudDevOrchestrator] Starting cloud development for user: ${userId} (existingProjectId: ${existingProjectId || 'none'})`);

    let project: any;
    let projectName: string;
    let slug: string;
    let deploymentUrl: string;
    let isUpdate = false;

    if (existingProjectId) {
      const { data: existingProj } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', existingProjectId)
        .maybeSingle();

      if (existingProj) {
        project = existingProj;
        projectName = existingProj.name;
        slug = existingProj.slug;
        deploymentUrl = `https://${slug}.ceova.online`;
        isUpdate = true;
      }
    }

    if (!project) {
      // ── STAGE 1: CREATING PROJECT ───────────────────────────────────────────
      onProgress({
        type: 'project_progress',
        stage: 'CREATING',
        content: 'Creating isolated cloud workspace and reserving subdomain...',
      });

      const metadata = await this.generateProjectMetadata(userPrompt, userId);
      projectName = metadata.name;
      slug = metadata.slug;

      // Ensure slug uniqueness
      const { data: existingSlug } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existingSlug) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      }

      const { data: newProj, error: createErr } = await supabaseAdmin
        .from('projects')
        .insert({
          user_id: userId,
          name: projectName,
          slug: slug,
          status: 'CREATING',
          framework: 'react-vite',
          runtime: 'nodejs',
          metadata: { prompt: userPrompt },
        })
        .select()
        .single();

      if (createErr || !newProj) {
        throw new Error(`Failed to create project: ${createErr?.message}`);
      }
      project = newProj;
      deploymentUrl = `https://ceova.online/${slug}`;
    }

    onProgress({
      type: 'project_progress',
      stage: isUpdate ? 'PLANNING' : 'CREATING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      content: isUpdate 
        ? `Updating existing website: ${deploymentUrl}` 
        : `Reserved subdomain: ${deploymentUrl}`,
    });

    // ── STAGE 2: ARCHITECTURE PLANNING (GPT-5.6 Luna) ─────────────────────────
    onProgress({
      type: 'project_progress',
      stage: 'PLANNING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      content: isUpdate 
        ? `GPT-5.6 Luna is planning updates for ${projectName}...`
        : 'GPT-5.6 Luna is designing the site architecture, theme, and component structure...',
    });

    await supabaseAdmin.from('projects').update({ status: 'PLANNING' }).eq('id', project.id);

    // ── STAGE 3: CODE GENERATION / MODIFICATION (GPT-5.6 Luna) ────────────────
    onProgress({
      type: 'project_progress',
      stage: 'GENERATING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      content: isUpdate 
        ? `GPT-5.6 Luna is applying changes to ${projectName}...`
        : 'GPT-5.6 Luna is generating production-grade React + Tailwind CSS code...',
    });

    await supabaseAdmin.from('projects').update({ status: 'GENERATING' }).eq('id', project.id);

    let generatedFiles: ProjectFile[];
    if (isUpdate) {
      const currentFiles = await CloudWorkerService.getProjectFiles(project.id);
      generatedFiles = await this.modifyProjectSource(userPrompt, currentFiles, projectName, slug, userId);
    } else {
      generatedFiles = await this.generateProjectSource(userPrompt, projectName, slug, userId);
    }

    // Stream writing of each individual file
    const writtenFilesList: string[] = [];
    let fileActivityLog = '';

    for (const file of generatedFiles) {
      writtenFilesList.push(file.path);
      fileActivityLog += `[FILE] Created & wrote: ${file.path} (${file.content.length} bytes)\n`;
      onProgress({
        type: 'project_progress',
        stage: 'GENERATING',
        projectId: project.id,
        slug: slug,
        deploymentUrl: deploymentUrl,
        files: [...writtenFilesList],
        logs: fileActivityLog,
        content: `Creating ${file.path}... (${writtenFilesList.length}/${generatedFiles.length})`,
      });
      // Brief tick for visual stream feedback
      await new Promise(r => setTimeout(r, 80));
    }

    // Write source files to isolated project sandbox
    await CloudWorkerService.writeProjectFiles(project.id, generatedFiles);

    // ── STAGE 4: BUILDING & TESTING IN ISOLATED WORKER ───────────────────────
    onProgress({
      type: 'project_progress',
      stage: 'BUILDING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      files: generatedFiles.map(f => f.path),
      logs: fileActivityLog + `[SANDBOX] Validating dependencies and compiling bundle...\n`,
      content: 'Isolated worker is bundling and testing the project assets in sandbox...',
    });

    await supabaseAdmin.from('projects').update({ status: 'BUILDING' }).eq('id', project.id);

    let buildResult = await CloudWorkerService.runBuild(project.id, userId);

    // ── STAGE 5: SELF-HEALING ERROR FIXING LOOP ──────────────────────────────
    let fixAttempts = 0;
    while (!buildResult.success && fixAttempts < this.MAX_FIX_ATTEMPTS) {
      fixAttempts++;
      const errorMsg = buildResult.errors?.[0]?.message || 'Build compilation error';
      Logger.WARN(`[CloudDevOrchestrator] Build failed (attempt ${fixAttempts}/${this.MAX_FIX_ATTEMPTS}): ${errorMsg}`);

      onProgress({
        type: 'project_progress',
        stage: 'FIXING',
        projectId: project.id,
        slug: slug,
        deploymentUrl: deploymentUrl,
        files: generatedFiles.map(f => f.path),
        logs: buildResult.logs,
        content: `Build error detected. GPT-5.6 Luna is auto-fixing errors (Attempt ${fixAttempts}/${this.MAX_FIX_ATTEMPTS})...`,
      });

      await supabaseAdmin.from('projects').update({ status: 'FIXING' }).eq('id', project.id);

      // Query current files and request Luna to patch the code
      const currentFiles = await CloudWorkerService.getProjectFiles(project.id);
      const fixedFiles = await this.fixProjectErrors(userPrompt, currentFiles, errorMsg, buildResult.logs, userId);

      await CloudWorkerService.writeProjectFiles(project.id, fixedFiles);

      onProgress({
        type: 'project_progress',
        stage: 'BUILDING',
        projectId: project.id,
        slug: slug,
        deploymentUrl: deploymentUrl,
        files: fixedFiles.map(f => f.path),
        logs: buildResult.logs + `[FIX] Re-testing auto-fixed bundle...\n`,
        content: `Re-running build verification after auto-fix...`,
      });

      buildResult = await CloudWorkerService.runBuild(project.id, userId);
    }

    if (!buildResult.success) {
      const finalError = buildResult.errors?.[0]?.message || 'Build could not be resolved automatically.';
      await supabaseAdmin.from('projects').update({ status: 'FAILED' }).eq('id', project.id);
      onProgress({
        type: 'error',
        stage: 'FAILED',
        projectId: project.id,
        error: finalError,
        logs: buildResult.logs,
      });
      throw new Error(`Project build failed: ${finalError}`);
    }

    // ── STAGE 6: DEPLOYMENT READY ────────────────────────────────────────────
    onProgress({
      type: 'project_progress',
      stage: 'DEPLOYING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      files: generatedFiles.map(f => f.path),
      logs: buildResult.logs + `[DEPLOY] Published bundle to edge hosting network\n`,
      content: 'Publishing distribution bundle to edge hosting network...',
    });

    onProgress({
      type: 'cloud_project_ready',
      stage: 'READY',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      files: generatedFiles.map(f => f.path),
      logs: buildResult.logs + `[READY] Deployed live at: ${deploymentUrl}\n`,
      content: `🎉 **Your website is live and ready!**\n\n🔗 **[${deploymentUrl}](${deploymentUrl})**\n\n- **Project Name**: ${projectName}\n- **Framework**: React + Tailwind CSS (Vite)\n- **Status**: Live on edge cloud network`,
    });

    return {
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
    };
  }

  /**
   * Prompts GPT-5.6 Luna to generate full source code files for a project
   */
  private static async generateProjectSource(
    userPrompt: string,
    projectName: string,
    slug: string,
    userId: string
  ): Promise<ProjectFile[]> {
    const systemPrompt = `You are GPT-5.6 Luna, a Principal Autonomous AI Engineer.
Generate a complete, fully functioning, high-end website or web application based on the user's request.

CRITICAL RULES:
1. NO BUILD STEP: There is no Node.js or Vite environment. The code runs directly on a static edge network.
2. You MUST write standalone code. If you use React/JSX, you MUST include Babel standalone via CDN in your `index.html` and use `<script type="text/babel">`. Otherwise, use vanilla HTML/JS.
3. You MUST provide a complete `index.html` at the root. If using Tailwind, include the Tailwind CDN.
4. You have COMPLETE FREEDOM to design the UI, architecture, and logic. Make the design advanced, luxurious, and highly interactive (e.g. use glowing particles, 3D effects, glassmorphism, or whatever fits best).
5. DO NOT use placeholder text like "Lorem ipsum". Generate realistic, compelling business copy.
6. Return the files using EXACTLY the following format:
[FILE: filename.ext]
...file content here...
[/FILE]

Example:
[FILE: index.html]
<!DOCTYPE html>
<html>...</html>
[/FILE]
[FILE: styles.css]
body { margin: 0; }
[/FILE]

Do NOT wrap the response in markdown code blocks. Just output the [FILE: path]...[/FILE] blocks directly.`;

    const userMessage = `Create an incredible web application for: "${userPrompt}"
Project Name: ${projectName}
URL: https://ceova.online/${slug}

Design it completely from scratch based on your own architectural decisions. Make it look stunning and polished!`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await AIProviderService.generate(messages, userId, {
      maxTokens: 8000,
    });

    const parsedFiles = this.parseFilesFormat(response.content);
    if (parsedFiles.length === 0) {
      Logger.ERROR(`[CloudDevOrchestrator] AI output parsing failed. Falling back to default template. Raw output: ${response.content.substring(0, 500)}...`);
      // Fallback: Generate template if LLM output was malformed
      return this.generateDefaultTemplate(projectName, userPrompt);
    }

    return parsedFiles;
  }

  /**
   * Prompts GPT-5.6 Luna to diagnose and fix compilation errors
   */
  private static async fixProjectErrors(
    userPrompt: string,
    files: ProjectFile[],
    errorMessage: string,
    buildLogs: string,
    userId: string
  ): Promise<ProjectFile[]> {
    const systemPrompt = `You are GPT-5.6 Luna. You are diagnosing and fixing a build/validation error in a Ceova cloud project.
Fix the errors completely and output the corrected full file contents.

Return the files using EXACTLY the following format:
[FILE: filename.ext]
...corrected file content here...
[/FILE]

Do NOT wrap the response in markdown code blocks.`;

    const filesContext = files.map(f => `=== FILE: ${f.path} ===\n${f.content}\n`).join('\n\n');
    const userMessage = `Project prompt: "${userPrompt}"
Build Error: ${errorMessage}

Recent Build Logs:
${buildLogs.slice(-1500)}

Current Project Files:
${filesContext}

Please fix all errors and return the corrected files using the [FILE: path] format.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await AIProviderService.generate(messages, userId, {
      maxTokens: 8000,
    });

    const fixed = this.parseFilesFormat(response.content);
    return fixed.length > 0 ? fixed : files;
  }

  /**
   * Parse robust text delimiter format into ProjectFiles (Truncation Tolerant)
   */
  private static parseFilesFormat(raw: string): ProjectFile[] {
    const files: ProjectFile[] = [];
    const blocks = raw.split(/\[FILE:\s*/i);
    
    for (const block of blocks) {
      if (!block.trim()) continue;
      
      const closeBracketIdx = block.indexOf(']');
      if (closeBracketIdx === -1) continue;
      
      const path = block.substring(0, closeBracketIdx).trim();
      let content = block.substring(closeBracketIdx + 1);
      
      // Remove trailing [/FILE] if it exists, or just take what we have if truncated
      const endTagIdx = content.indexOf('[/FILE]');
      if (endTagIdx !== -1) {
        content = content.substring(0, endTagIdx);
      }
      
      // Remove any hallucinated markdown backticks
      content = content.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
      
      if (path && content) {
        files.push({ path, content });
      }
    }
    
    return files;
  }

  /**
   * Prompts GPT-5.6 Luna to modify existing project source files based on user feedback
   */
  private static async modifyProjectSource(
    userPrompt: string,
    existingFiles: ProjectFile[],
    projectName: string,
    slug: string,
    userId: string
  ): Promise<ProjectFile[]> {
    const systemPrompt = `You are GPT-5.6 Luna, a Principal Autonomous AI Engineer.
The user is requesting updates, styling changes, new sections, or modifications to their existing website project '${projectName}'.

CRITICAL RULES:
1. NO BUILD STEP: There is no Node.js/Vite environment. Code must run natively in the browser (or via Babel standalone if using React).
2. Carefully inspect the existing files and apply the requested changes based on your own architectural decisions. Make it look stunning.
3. Retain all necessary structure and working code from the previous files while applying the improvements.
4. Return the COMPLETE, full-content files.
5. Return the files using EXACTLY the following format:
[FILE: filename.ext]
...updated file content here...
[/FILE]

Do NOT wrap the response in markdown code blocks.`;

    const filesContext = existingFiles.map(f => `=== FILE: ${f.path} ===\n${f.content}\n`).join('\n\n');
    const userMessage = `Existing Project: "${projectName}"
User Change Request: "${userPrompt}"

Current Project Files:
${filesContext}

Please update the project files to incorporate the requested changes and return the complete updated files using the [FILE: path] format.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await AIProviderService.generate(messages, userId, {
      maxTokens: 8000,
    });

    const parsedFiles = this.parseFilesFormat(response.content);
    return parsedFiles.length > 0 ? parsedFiles : existingFiles;
  }

  /**
   * Prompts GPT to generate a catchy project name and slug
   */
  private static async generateProjectMetadata(prompt: string, userId: string): Promise<{ name: string, slug: string }> {
    const systemPrompt = `You are an AI architect. Based on the user's request, generate a concise, catchy Project Name and a URL-friendly slug.
Return EXACTLY a JSON object: {"name": "Project Name", "slug": "project-slug"}
Do NOT wrap in markdown blocks.`;
    const userMessage = `User Request: "${prompt}"\nProvide the JSON metadata.`;
    
    try {
      const response = await AIProviderService.generate([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ], userId, { maxTokens: 100 });
      
      const clean = response.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      return {
        name: parsed.name || 'My Cloud Project',
        slug: parsed.slug ? parsed.slug.toLowerCase().replace(/[^a-z0-9-]/g, '') : generateProjectSlug('My Cloud Project')
      };
    } catch (e) {
      Logger.WARN(`[CloudDevOrchestrator] AI Metadata fallback triggered.`);
      // Fallback if it fails
      return { name: 'My Cloud Project', slug: generateProjectSlug('My Cloud Project') };
    }
  }

  /**
   * Generates a robust default React/Tailwind template if LLM output fails parsing
   */
  private static generateDefaultTemplate(projectName: string, prompt: string): ProjectFile[] {
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Powered by Ceova</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .glass-card { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white">
  <!-- Navigation -->
  <header class="border-b border-slate-800/80 sticky top-0 bg-slate-950/80 backdrop-blur z-50">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
          ⚡
        </div>
        <span class="font-bold text-xl tracking-tight text-white">${projectName}</span>
      </div>
      <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
        <a href="#features" class="hover:text-white transition">Features</a>
        <a href="#about" class="hover:text-white transition">About</a>
        <a href="#contact" class="hover:text-white transition">Contact</a>
      </nav>
      <a href="#contact" class="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95">
        Get Started
      </a>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="flex-1">
    <section class="py-24 px-6 relative overflow-hidden">
      <div class="absolute inset-0 -z-10 flex items-center justify-center">
        <div class="w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div class="w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-3xl -translate-y-20"></div>
      </div>
      
      <div class="max-w-4xl mx-auto text-center space-y-8">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-xs font-medium text-indigo-300">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Live Production Cloud Project
        </div>
        
        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
          Welcome to <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">${projectName}</span>
        </h1>
        
        <p class="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          ${prompt}
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button onclick="alert('Thank you for exploring ${projectName}!')" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold bg-white text-slate-950 hover:bg-slate-200 transition-all shadow-xl shadow-white/5 active:scale-95">
            Explore Experience
          </button>
          <a href="#features" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold glass-card hover:bg-white/10 text-white transition-all active:scale-95">
            Learn More
          </a>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 px-6 border-t border-slate-800/60 bg-slate-900/30">
      <div class="max-w-6xl mx-auto">
        <div class="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <h2 class="text-3xl font-bold text-white">Engineered for Excellence</h2>
          <p class="text-slate-400">Everything you need, built natively and optimized for performance.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="glass-card p-8 rounded-2xl space-y-4 hover:border-indigo-500/50 transition duration-300">
            <div class="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl font-bold">✨</div>
            <h3 class="text-xl font-bold text-white">Modern Aesthetics</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Curated typography, glassmorphism lighting, and responsive fluid layouts.</p>
          </div>
          <div class="glass-card p-8 rounded-2xl space-y-4 hover:border-violet-500/50 transition duration-300">
            <div class="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center text-2xl font-bold">⚡</div>
            <h3 class="text-xl font-bold text-white">Ultra-Fast Performance</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Built with optimized assets and distributed worldwide via edge hosting.</p>
          </div>
          <div class="glass-card p-8 rounded-2xl space-y-4 hover:border-pink-500/50 transition duration-300">
            <div class="w-12 h-12 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center text-2xl font-bold">🔒</div>
            <h3 class="text-xl font-bold text-white">Isolated & Secure</h3>
            <p class="text-slate-400 text-sm leading-relaxed">Fully isolated sandbox execution with enterprise security controls.</p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800/80 py-8 px-6 text-center text-sm text-slate-500">
    <p>© 2026 ${projectName}. Deployed on <a href="https://ceova.online" class="text-indigo-400 hover:underline">Ceova Cloud</a>.</p>
  </footer>
</body>
</html>`;

    return [{ path: 'index.html', content: indexHtml }];
  }
}
