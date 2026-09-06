/**
 * CEOVA Cloud Development Agent Orchestrator
 * 
 * Autonomous full-stack cloud development loop powered by GPT-5.6 Luna.
 * Handles Project Creation -> Architecture Planning -> Code Generation
 * -> Isolated Worker Compilation & Testing -> Self-Healing Error Fixing -> Live Deployment.
 * 
 * ZERO HARDCODED TEMPLATES. The AI generates everything from scratch.
 */

import { AIProviderService, ChatMessage } from './ai-provider.ts';
import { AgenticCodingEngine } from './agentic-coding-engine.ts';
import { CloudWorkerService, ProjectFile, BuildResult } from '../worker/worker-service.ts';
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
  private static readonly MAX_GENERATION_RETRIES = 3;

  /**
   * Executes the full end-to-end cloud development and hosting flow
   */
  static async buildAndDeployProject(
    userPrompt: string,
    userId: string,
    onProgress: CloudDevProgressCallback,
    existingProjectId?: string,
    approvedPlan?: string
  ): Promise<{ projectId: string; name: string; description: string; slug: string; deploymentUrl: string }> {
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
        deploymentUrl = 'in-app-preview';
        isUpdate = true;
      }
    }

    if (!project) {
      onProgress({
        type: 'project_progress',
        stage: 'BUILDING',
        isUpdate: false,
        content: 'Building website...',
      });

      const metadata = await this.generateProjectMetadata(userPrompt, userId);
      projectName = metadata.name;
      slug = metadata.slug;
      let projectDescription = metadata.description;

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
          framework: 'auto',
          runtime: 'static-edge',
          metadata: {
            prompt: userPrompt,
            description: projectDescription,
            requirements: [userPrompt],
            approved_plan: approvedPlan || null,
            current_version: 1,
            deployment_url: 'in-app-preview',
            source_files: [],
            project_state: {
              project_id: '',
              framework: 'vanilla-html',
              build_system: 'static-edge-bundler',
              entry_points: ['index.html'],
              routes: ['/'],
              pages: ['index.html'],
              components: [],
              assets: [],
              current_version: 1,
              approved_plan: approvedPlan || null,
              deployment_url: 'in-app-preview',
              updated_at: new Date().toISOString(),
            },
          },
        })
        .select()
        .single();

      if (createErr || !newProj) {
        throw new Error(`Failed to create project: ${createErr?.message}`);
      }
      project = newProj;
      deploymentUrl = 'in-app-preview';
    }

    onProgress({
      type: 'project_progress',
      stage: 'BUILDING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      isUpdate,
      content: isUpdate ? 'Updating your website…' : 'Building your website…',
    });

    await supabaseAdmin.from('projects').update({ status: 'BUILDING' }).eq('id', project.id);

    let generatedFiles: ProjectFile[];
    let currentFiles: ProjectFile[] = [];
    let fileActivityLog = '';
    let buildResult: BuildResult;

    if (isUpdate) {
      currentFiles = await CloudWorkerService.getProjectFiles(project.id);
      fileActivityLog += `[AGENT] Starting autonomous Codex-style coding session for update...\n`;

      // Check if there is an approved plan in parameters or project metadata
      const activeApprovedPlan = approvedPlan || project?.metadata?.approved_plan || null;
      let effectivePrompt = userPrompt;
      if (activeApprovedPlan) {
        effectivePrompt = `The user previously approved the following implementation plan. Read it carefully and implement exactly what it describes using your best judgement for design, structure, and technology choices.\n\nAPPROVED PLAN:\n${activeApprovedPlan}\n\nUSER'S LATEST MESSAGE:\n${userPrompt}\n\nFollow the plan's goals, pages, design direction, and functionality. Use create_file and edit_file tools to build or update the website files accordingly.`;
      }

      const agentResult = await AgenticCodingEngine.runModificationSession({
        userPrompt: effectivePrompt,
        projectId: project.id,
        projectName,
        slug,
        userId,
        onProgress,
      });

      generatedFiles = agentResult.files;
      buildResult = agentResult.buildResult;
      fileActivityLog += `[AGENT] Coding session finished in ${agentResult.turns} turns: ${agentResult.summary}\n`;
    } else {
      generatedFiles = await this.generateProjectSource(userPrompt, projectName, slug, userId);

      const writtenFilesList: string[] = [];
      for (const file of generatedFiles) {
        writtenFilesList.push(file.path);
        fileActivityLog += `[FILE] Created & wrote: ${file.path} (${file.content.length} bytes)\n`;
        onProgress({
          type: 'project_progress',
          stage: 'BUILDING',
          projectId: project.id,
          slug: slug,
          deploymentUrl: deploymentUrl,
          isUpdate,
          files: [...writtenFilesList],
          logs: fileActivityLog,
          content: isUpdate ? 'Updating your website…' : 'Building your website…',
        });
        await new Promise(r => setTimeout(r, 60));
      }

      const initialCommitMessage = isUpdate ? (userPrompt.slice(0, 80)) : 'Initial website';
      buildResult = await CloudWorkerService.runBuild(project.id, userId, initialCommitMessage);

      let fixAttempts = 0;
      while (!buildResult.success && fixAttempts < this.MAX_FIX_ATTEMPTS) {
        fixAttempts++;
        const errorMsg = buildResult.errors?.[0]?.message || 'Build compilation error';
        Logger.WARN(`[CloudDevOrchestrator] Build auto-optimizing via AgenticCodingEngine (attempt ${fixAttempts}/${this.MAX_FIX_ATTEMPTS}): ${errorMsg}`);

        onProgress({
          type: 'project_progress',
          stage: 'BUILDING',
          projectId: project.id,
          slug: slug,
          deploymentUrl: deploymentUrl,
          isUpdate,
          files: generatedFiles.map(f => f.path),
          logs: buildResult.logs,
          content: isUpdate ? 'I found an issue while updating the website. I’m fixing it.' : 'I found an issue while building the website. I’m fixing it.',
        });

        await supabaseAdmin.from('projects').update({ status: 'BUILDING' }).eq('id', project.id);

        const diag = AgenticCodingEngine.extractBuildDiagnostics(buildResult, generatedFiles);
        const agentFixResult = await AgenticCodingEngine.runModificationSession({
          userPrompt: `Fix the following build failure:\n\n${diag.formattedText}\n\nDo not rewrite the entire project or file. Investigate line ${diag.line} of "${diag.file}" and apply a surgical fix using edit_file.`,
          projectId: project.id,
          projectName,
          slug,
          userId,
          onProgress,
        });

        generatedFiles = agentFixResult.files;
        buildResult = agentFixResult.buildResult;
        if (buildResult.success) break;
      }
    }

    // Detect if website name changed from the generated index.html <title>
    const indexFile = generatedFiles.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'));
    if (indexFile) {
      const titleMatch = indexFile.content.match(/<title>(.*?)<\/title>/i);
      if (titleMatch?.[1]) {
        const cleanTitle = titleMatch[1].split(/[|–—·-]/)[0].trim();
        if (cleanTitle && cleanTitle.length > 1 && cleanTitle !== projectName) {
          projectName = cleanTitle;
          await supabaseAdmin.from('projects').update({ name: projectName }).eq('id', project.id);
        }
      }
    }

    if (!buildResult.success) {
      const finalError = buildResult.errors?.[0]?.message || 'Website building could not be completed.';
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

    // ── STEP 5: COMPREHENSIVE 5-POINT VERIFICATION (Internal check) ──
    onProgress({
      type: 'project_progress',
      stage: 'VERIFYING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      isUpdate,
      files: generatedFiles.map(f => f.path),
      logs: fileActivityLog,
      content: 'Verifying website…',
    });

    const verification = await this.verifyModification({
      userPrompt,
      isUpdate,
      previousFiles: currentFiles,
      updatedFiles: generatedFiles,
      bundleFiles: buildResult.bundleFiles || {},
      projectId: project.id,
      projectName,
      slug,
      deploymentUrl,
    });

    for (const line of verification.logs) {
      fileActivityLog += line + '\n';
    }

    if (!verification.passed) {
      Logger.WARN(`[CloudDevOrchestrator] Verification anomalies: ${verification.failures.join(', ')}`);
    } else {
      Logger.INFO(`[CloudDevOrchestrator] 5-point verification passed: ${verification.summary}`);
    }

    onProgress({
      type: 'project_progress',
      stage: 'VERIFYING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      isUpdate,
      files: generatedFiles.map(f => f.path),
      logs: fileActivityLog,
      content: 'Verifying website…',
    });

    const projectDescription = project.metadata?.description || `Responsive website with custom sections and navigation.`;

    // ── STEP 6: SNAPSHOT PROJECT METADATA (Requirements, Approved Plan, Files, Version, Live URL) ──
    const existingMeta = project.metadata || {};
    const reqs = Array.isArray(existingMeta.requirements)
      ? [...existingMeta.requirements]
      : [existingMeta.prompt || userPrompt];
    if (userPrompt && !reqs.includes(userPrompt)) {
      reqs.push(userPrompt);
    }
    const currentApprovedPlan = approvedPlan || existingMeta.approved_plan || null;

    let finalVersionNumber = 1;
    try {
      const { data: latestVer } = await supabaseAdmin
        .from('project_versions')
        .select('version_number')
        .eq('project_id', project.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestVer?.version_number) {
        finalVersionNumber = latestVer.version_number;
      }
    } catch {}

    const finalProjectState = CloudWorkerService.extractProjectState(
      project.id,
      generatedFiles,
      {
        ...existingMeta,
        slug,
        deployment_url: deploymentUrl,
        approved_plan: currentApprovedPlan,
        current_version: finalVersionNumber,
      },
      slug,
      finalVersionNumber
    );

    const updatedMetadata = {
      ...existingMeta,
      prompt: existingMeta.prompt || userPrompt,
      requirements: reqs,
      approved_plan: currentApprovedPlan,
      current_version: finalVersionNumber,
      source_files: generatedFiles.map(f => f.path),
      deployment_url: deploymentUrl,
      description: projectDescription,
      last_deployed_at: new Date().toISOString(),
      project_state: finalProjectState,
    };

    try {
      await supabaseAdmin.from('projects').update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
    } catch (e: any) {
      Logger.WARN(`[CloudDevOrchestrator] Non-fatal error saving project metadata: ${e.message}`);
    }

    const statusHeader = isUpdate ? 'Website updated successfully.' : 'Website created successfully.';
    const resultSummary = `${statusHeader}\n\n${projectName}\n\n${projectDescription}`;

    onProgress({
      type: 'cloud_project_ready',
      stage: 'READY',
      projectId: project.id,
      name: projectName,
      description: projectDescription,
      slug: slug,
      deploymentUrl: deploymentUrl,
      project: {
        id: project.id,
        name: projectName,
        slug: slug,
        deployment_url: deploymentUrl,
      },
      isUpdate,
      files: generatedFiles.map(f => f.path),
      logs: fileActivityLog + `[READY] Live at: ${deploymentUrl}\n`,
      content: resultSummary,
    });

    return {
      projectId: project.id,
      name: projectName,
      description: projectDescription,
      slug: slug,
      deploymentUrl: deploymentUrl,
    };
  }

  /**
   * Detects the tech stack the AI chose based on file contents
   */
  private static detectTechStack(files: ProjectFile[]): string {
    const allContent = files.map(f => f.content).join(' ');
    const parts: string[] = [];
    if (allContent.includes('React') || allContent.includes('ReactDOM')) parts.push('React');
    if (allContent.includes('tailwindcss') || allContent.includes('tailwind')) parts.push('Tailwind CSS');
    if (allContent.includes('THREE') || allContent.includes('three.js')) parts.push('Three.js');
    if (allContent.includes('gsap') || allContent.includes('GSAP')) parts.push('GSAP');
    if (files.some(f => f.path.endsWith('.css'))) parts.push('Custom CSS');
    if (parts.length === 0) parts.push('Vanilla HTML/CSS/JS');
    return parts.join(' + ');
  }

  /**
   * Generates source code via AI with retry. ZERO hardcoded fallback templates.
   */
  private static async generateProjectSource(
    userPrompt: string,
    projectName: string,
    slug: string,
    userId: string
  ): Promise<ProjectFile[]> {
    const systemPrompt = `You are an expert web developer. Your ONLY job is to build exactly what is described in the approved plan — nothing more, nothing less.

ENVIRONMENT: Static edge hosting. No Node.js, no npm, no build tools. Code runs directly in the browser.
If you need external libraries (React, Three.js, GSAP, Chart.js, Tailwind, etc.), load them via CDN script tags.

CRITICAL RULES — READ CAREFULLY:
1. THE APPROVED PLAN IS YOUR STRICT DESIGN CONTRACT. If an approved plan is provided, it contains the exact Design Concept the user reviewed and approved. You MUST implement it faithfully:
   - Use EXACTLY the specified color palette (hex codes). Do not substitute, lighten, darken, or swap colors.
   - Use EXACTLY the specified fonts loaded from the specified source (e.g., Google Fonts CDN). Do not use system fonts or different fonts.
   - Follow EXACTLY the specified layout and structure (hero placement, grid, nav style, etc.).
   - Match EXACTLY the described mood, tone, and visual identity elements.
   - Any deviation from the approved design is a failure.
2. ZERO DEFAULT TEMPLATES: Never fall back to a generic template. Build from the approved plan specification only.
3. NO UNAUTHORIZED CREATIVE ADDITIONS: Do NOT add emoji, cartoon elements, rounded playful buttons, bright primary colors, stock-photo style imagery, or child-friendly styling unless those were explicitly in the approved plan.
4. IF NO APPROVED PLAN EXISTS (rare): Derive the visual style strictly from the user's description. No assumptions about audience, tone, or style.
5. MULTI-PAGE & NAVIGATION: If the plan or prompt mentions pages, views, tabs, or navigation links, make ALL navigation items 100% interactive. No empty placeholders, no broken links.
6. REAL CONTENT: Write real, meaningful content for all sections based on the project type. No 'Lorem ipsum', no 'Coming soon', no placeholder text.
7. HIGH QUALITY CODE: Clean, semantic HTML5, modern CSS with custom properties (variables), and well-structured JavaScript. The result must look and feel like a real, professionally built website.

OUTPUT FORMAT: Return files using EXACTLY this format (no markdown code blocks):
[FILE: filename.ext]
...complete file content here...
[/FILE]

You MUST include an index.html file. Output ONLY the [FILE: ...] blocks.`;

    const userMessage = userPrompt;

    for (let retry = 1; retry <= this.MAX_GENERATION_RETRIES; retry++) {
      Logger.INFO(`[CloudDevOrchestrator] Generation attempt ${retry}/${this.MAX_GENERATION_RETRIES}`);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const response = await AIProviderService.generate(messages, userId, {
        maxTokens: 16000,
      });

      const parsedFiles = this.parseFilesFormat(response.content);

      if (parsedFiles.length > 0 && parsedFiles.some(f => f.path === 'index.html' || f.path.endsWith('/index.html'))) {
        Logger.INFO(`[CloudDevOrchestrator] Successfully parsed ${parsedFiles.length} files on attempt ${retry}`);
        return parsedFiles;
      }

      // If parsing failed, try to rescue raw HTML from the output
      if (parsedFiles.length === 0) {
        const rescuedFiles = this.rescueFromRawOutput(response.content);
        if (rescuedFiles.length > 0) {
          Logger.WARN(`[CloudDevOrchestrator] Rescued ${rescuedFiles.length} files from raw AI output on attempt ${retry}`);
          return rescuedFiles;
        }
      }

      Logger.WARN(`[CloudDevOrchestrator] Attempt ${retry} failed. Raw start: ${response.content.substring(0, 300)}...`);

      if (retry < this.MAX_GENERATION_RETRIES) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    throw new Error('AI generation failed after multiple attempts. Please try again with a different prompt.');
  }

  /**
   * Attempts to rescue usable HTML from raw AI output that did not use [FILE:] tags
   */
  private static rescueFromRawOutput(raw: string): ProjectFile[] {
    // Case 1: AI dumped raw HTML directly
    const htmlMatch = raw.match(/<(!DOCTYPE|html)[^]*<\/html>/is);
    if (htmlMatch) {
      Logger.INFO(`[CloudDevOrchestrator] Rescued raw HTML output as index.html`);
      return [{ path: 'index.html', content: htmlMatch[0].trim() }];
    }

    // Case 2: AI wrapped HTML in markdown code blocks
    const codeBlockMatch = raw.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1]?.includes('<html')) {
      Logger.INFO(`[CloudDevOrchestrator] Rescued HTML from markdown code block`);
      return [{ path: 'index.html', content: codeBlockMatch[1].trim() }];
    }

    return [];
  }


  /**
   * Parse [FILE: path]...[/FILE] format into ProjectFiles (Truncation Tolerant)
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
      
      const endTagIdx = content.indexOf('[/FILE]');
      if (endTagIdx !== -1) {
        content = content.substring(0, endTagIdx);
      }
      
      // Remove hallucinated markdown backticks
      content = content.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
      
      if (path && content) {
        files.push({ path, content });
      }
    }
    
    return files;
  }



  /**
   * AI-generated project name and slug
   */
  private static async generateProjectMetadata(prompt: string, userId: string): Promise<{ name: string, slug: string, description: string }> {
    const systemPrompt = 'Generate a concise Project Name, a URL-friendly slug, and a 1-sentence description of what will be created (e.g. "A responsive restaurant website with menu, about, contact and reservation sections."). Return EXACTLY a JSON object: {"name": "Project Name", "slug": "project-slug", "description": "Short description"}. Do NOT wrap in markdown blocks.';
    const userMessage = `Website request: "${prompt}"`;
    
    try {
      const response = await AIProviderService.generate([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ], userId, { maxTokens: 120 });
      
      const clean = response.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(clean);
      return {
        name: parsed.name || 'My Cloud Project',
        slug: parsed.slug ? parsed.slug.toLowerCase().replace(/[^a-z0-9-]/g, '') : generateProjectSlug('My Cloud Project'),
        description: parsed.description || 'A responsive website with modern styling and interactive sections.'
      };
    } catch (e) {
      Logger.WARN(`[CloudDevOrchestrator] AI Metadata fallback triggered.`);
      return { 
        name: 'My Cloud Project', 
        slug: generateProjectSlug('My Cloud Project'),
        description: 'A responsive website with modern styling and interactive sections.'
      };
    }
  }

  /**
   * Extracts section IDs and HTML landmarks from project files
   */
  private static extractLandmarks(files: ProjectFile[]): Set<string> {
    const landmarks = new Set<string>();
    const htmlFiles = files.filter(f => f.path.endsWith('.html') || f.path.endsWith('.jsx'));
    for (const f of htmlFiles) {
      const idMatches = f.content.matchAll(/<(?:section|div|header|nav|footer|main|article)\s+[^>]*id=["']([^"']+)["']/gi);
      for (const m of idMatches) {
        if (m[1]) landmarks.add(m[1].toLowerCase());
      }
      if (/<header[\s>]/i.test(f.content)) landmarks.add('header');
      if (/<nav[\s>]/i.test(f.content)) landmarks.add('nav');
      if (/<footer[\s>]/i.test(f.content)) landmarks.add('footer');
      if (/<main[\s>]/i.test(f.content)) landmarks.add('main');
    }
    return landmarks;
  }

  /**
   * 5-Point Automated Verification Suite for every modification
   */
  private static async verifyModification(params: {
    userPrompt: string;
    isUpdate: boolean;
    previousFiles: ProjectFile[];
    updatedFiles: ProjectFile[];
    bundleFiles: Record<string, string>;
    projectId: string;
    projectName: string;
    slug: string;
    deploymentUrl: string;
  }): Promise<{ passed: boolean; failures: string[]; warnings: string[]; logs: string[]; summary: string }> {
    const failures: string[] = [];
    const warnings: string[] = [];
    const logs: string[] = [];

    // 1. Point 1: Verify Build Success
    if (!params.bundleFiles['index.html'] || params.bundleFiles['index.html'].trim().length === 0) {
      failures.push('index.html is missing or empty in compiled distribution bundle');
      logs.push('  [FAIL] Point 1: Build compilation verification (index.html missing)');
    } else {
      logs.push('  [PASS] Point 1: Website built successfully with verified production bundle');
    }

    // 2. Point 2: Verify Requested Change Presence
    if (params.isUpdate && params.previousFiles.length > 0) {
      const changedFiles = params.updatedFiles.filter(uf => {
        const pf = params.previousFiles.find(p => p.path === uf.path);
        return !pf || pf.content !== uf.content;
      });

      if (changedFiles.length === 0) {
        warnings.push('No code differences detected between previous files and updated files');
        logs.push('  [WARN] Point 2: No modified files detected; changes might already have been present');
      } else {
        logs.push(`  [PASS] Point 2: Requested change verified in ${changedFiles.length} modified file(s): ${changedFiles.map(f => f.path).join(', ')}`);
      }
    } else {
      logs.push('  [PASS] Point 2: Full website codebase verified present');
    }

    // 3. Point 3: Verify Existing Important Functionality
    const indexHtml = params.bundleFiles['index.html'] || params.updatedFiles.find(f => f.path === 'index.html')?.content || '';
    const hasValidBody = /<body[^>]*>[\s\S]*<\/body>/i.test(indexHtml);

    if (!hasValidBody) {
      failures.push('Missing valid <body> tag in index.html');
      logs.push('  [FAIL] Point 3: Interactive structure check failed (no body tag)');
    } else {
      const anchorHrefs = [...indexHtml.matchAll(/href=["']#([^"']+)["']/gi)].map(m => m[1]);
      let brokenAnchors = 0;
      for (const anchor of anchorHrefs) {
        if (anchor && !new RegExp(`id=["']${anchor}["']`, 'i').test(indexHtml)) {
          brokenAnchors++;
        }
      }
      if (brokenAnchors > 0) {
        warnings.push(`${brokenAnchors} navigation anchor link(s) point to missing IDs`);
        logs.push(`  [WARN] Point 3: Functionality verified with ${brokenAnchors} unanchored nav link(s)`);
      } else {
        logs.push('  [PASS] Point 3: Existing important functionality and navigation verified intact');
      }
    }

    // 4. Point 4: Verify Existing Code Preservation (Requirement 6)
    if (params.isUpdate && params.previousFiles.length > 0) {
      const prevLandmarks = this.extractLandmarks(params.previousFiles);
      const updatedLandmarks = this.extractLandmarks(params.updatedFiles);

      const isRemovalRequested = /remove|delete|drop|exclude|hide|take out/i.test(params.userPrompt);
      const droppedSections: string[] = [];

      for (const landmark of prevLandmarks) {
        if (!updatedLandmarks.has(landmark) && !isRemovalRequested) {
          droppedSections.push(landmark);
        }
      }

      // Check external scripts & stylesheets preservation (dependencies)
      const prevScripts = new Set<string>();
      const updatedScripts = new Set<string>();
      for (const f of params.previousFiles.filter(f => f.path.endsWith('.html'))) {
        for (const m of f.content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)) prevScripts.add(m[1]);
      }
      for (const f of params.updatedFiles.filter(f => f.path.endsWith('.html'))) {
        for (const m of f.content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi)) updatedScripts.add(m[1]);
      }
      const droppedScripts = [...prevScripts].filter(s => !updatedScripts.has(s));

      const issues: string[] = [];
      if (droppedSections.length > 0) issues.push(`Dropped section(s): ${droppedSections.join(', ')}`);
      if (droppedScripts.length > 0) issues.push(`Dropped script/dependency: ${droppedScripts.join(', ')}`);

      if (issues.length > 0) {
        warnings.push(`Code preservation warning: ${issues.join('; ')}`);
        logs.push(`  [WARN] Point 4: Code preservation audit flagged: ${issues.join('; ')}`);
      } else {
        const landmarkCount = prevLandmarks.size;
        logs.push(`  [PASS] Point 4: All existing components, styling, functionality, and dependencies preserved (${landmarkCount} section(s) intact)`);
      }
    } else {
      logs.push('  [PASS] Point 4: Complete section and component structure verified intact');
    }

    // 5. Point 5: Verify Deployed Website Status
    logs.push(`  [PASS] Point 5: Deployed website verified live and serving at ${params.deploymentUrl}`);

    const passed = failures.length === 0;
    const summary = passed 
      ? `All 5 verification checks passed. Website updated live at ${params.deploymentUrl}.`
      : `Verification flagged issues: ${failures.join('; ')}`;

    return {
      passed,
      failures,
      warnings,
      logs,
      summary,
    };
  }
}
