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
  private static readonly MAX_GENERATION_RETRIES = 3;

  /**
   * Executes the full end-to-end cloud development and hosting flow
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
        deploymentUrl = `https://ceova.online/${slug}`;
        isUpdate = true;
      }
    }

    if (!project) {
      onProgress({
        type: 'project_progress',
        stage: 'CREATING',
        content: 'Creating isolated cloud workspace and reserving subdomain...',
      });

      const metadata = await this.generateProjectMetadata(userPrompt, userId);
      projectName = metadata.name;
      slug = metadata.slug;

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

    onProgress({
      type: 'project_progress',
      stage: 'GENERATING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      content: isUpdate 
        ? `GPT-5.6 Luna is applying changes to ${projectName}...`
        : 'GPT-5.6 Luna is generating your custom website from scratch...',
    });

    await supabaseAdmin.from('projects').update({ status: 'GENERATING' }).eq('id', project.id);

    let generatedFiles: ProjectFile[];
    if (isUpdate) {
      const currentFiles = await CloudWorkerService.getProjectFiles(project.id);
      generatedFiles = await this.modifyProjectSource(userPrompt, currentFiles, projectName, slug, userId);
    } else {
      generatedFiles = await this.generateProjectSource(userPrompt, projectName, slug, userId);
    }

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
      await new Promise(r => setTimeout(r, 80));
    }

    await CloudWorkerService.writeProjectFiles(project.id, generatedFiles);

    onProgress({
      type: 'project_progress',
      stage: 'BUILDING',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      files: generatedFiles.map(f => f.path),
      logs: fileActivityLog + `[SANDBOX] Validating and compiling bundle...\n`,
      content: 'Isolated worker is bundling and testing the project assets...',
    });

    await supabaseAdmin.from('projects').update({ status: 'BUILDING' }).eq('id', project.id);

    let buildResult = await CloudWorkerService.runBuild(project.id, userId);

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
        content: `Build error detected. Auto-fixing (Attempt ${fixAttempts}/${this.MAX_FIX_ATTEMPTS})...`,
      });

      await supabaseAdmin.from('projects').update({ status: 'FIXING' }).eq('id', project.id);

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

    const detectedTech = this.detectTechStack(generatedFiles);

    onProgress({
      type: 'cloud_project_ready',
      stage: 'READY',
      projectId: project.id,
      slug: slug,
      deploymentUrl: deploymentUrl,
      files: generatedFiles.map(f => f.path),
      logs: buildResult.logs + `[READY] Deployed live at: ${deploymentUrl}\n`,
      content: `🎉 **Your website is live and ready!**\n\n🔗 **[${deploymentUrl}](${deploymentUrl})**\n\n- **Project Name**: ${projectName}\n- **Tech Stack**: ${detectedTech}\n- **Status**: Live on edge cloud network`,
    });

    return {
      projectId: project.id,
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
    const systemPrompt = `You are an elite autonomous web developer AI. You build incredible, production-ready websites from scratch.

YOUR ENVIRONMENT:
- Static edge hosting. NO Node.js, NO npm, NO Vite, NO webpack, NO build step.
- Code must run DIRECTLY in the browser. Use CDN links for any libraries.
- If using React: include react.production.min.js, react-dom.production.min.js, and babel-standalone via CDN. Use <script type="text/babel">.
- If using Tailwind: include https://cdn.tailwindcss.com via <script> tag.
- You may also use vanilla HTML/CSS/JS if it produces a better result.

YOUR CREATIVE MANDATE:
- You have TOTAL creative freedom. Design the most stunning, unique, premium website possible.
- Use advanced CSS: animations, gradients, glassmorphism, parallax, scroll effects, custom cursors, particle effects - whatever makes it extraordinary.
- Write real, contextual content. NO "Lorem ipsum", NO generic placeholder text.
- The website must look like it was designed by a top agency, not a template.

OUTPUT FORMAT (MANDATORY):
Return files using EXACTLY this format:
[FILE: filename.ext]
...file content here...
[/FILE]

You MUST include an index.html file. You may include additional .css and .js files.
Do NOT wrap your response in markdown code blocks. Output ONLY the [FILE: ...] blocks.`;

    const userMessage = `Build this: "${userPrompt}"
Project: ${projectName}
URL: https://ceova.online/${slug}`;

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
   * Diagnoses and fixes compilation errors
   */
  private static async fixProjectErrors(
    userPrompt: string,
    files: ProjectFile[],
    errorMessage: string,
    buildLogs: string,
    userId: string
  ): Promise<ProjectFile[]> {
    const systemPrompt = `You are an expert web developer debugging a static website hosted on an edge network.
Fix the errors completely. Remember: NO build step, NO Node.js. Code runs directly in the browser.

Return the corrected files using EXACTLY this format:
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

Fix all errors and return corrected files using the [FILE: path] format.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await AIProviderService.generate(messages, userId, {
      maxTokens: 16000,
    });

    const fixed = this.parseFilesFormat(response.content);
    return fixed.length > 0 ? fixed : files;
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
   * Modifies existing project source files based on user feedback
   */
  private static async modifyProjectSource(
    userPrompt: string,
    existingFiles: ProjectFile[],
    projectName: string,
    slug: string,
    userId: string
  ): Promise<ProjectFile[]> {
    const systemPrompt = `You are an elite autonomous web developer AI modifying an existing website project called '${projectName}'.

YOUR ENVIRONMENT:
- Static edge hosting. NO Node.js, NO build step. Code runs directly in the browser.
- If using React: libraries must be loaded via CDN with Babel standalone.
- If using Tailwind: must use CDN script tag.

INSTRUCTIONS:
- Apply the user's requested changes with your own creative decisions.
- Make the result look stunning and polished.
- Return the COMPLETE updated files (not just diffs).

Return files using EXACTLY this format:
[FILE: filename.ext]
...updated file content here...
[/FILE]

Do NOT wrap the response in markdown code blocks.`;

    const filesContext = existingFiles.map(f => `=== FILE: ${f.path} ===\n${f.content}\n`).join('\n\n');
    const userMessage = `Project: "${projectName}"
Change Request: "${userPrompt}"

Current Files:
${filesContext}

Apply the changes and return complete updated files using the [FILE: path] format.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await AIProviderService.generate(messages, userId, {
      maxTokens: 16000,
    });

    const parsedFiles = this.parseFilesFormat(response.content);
    return parsedFiles.length > 0 ? parsedFiles : existingFiles;
  }

  /**
   * AI-generated project name and slug
   */
  private static async generateProjectMetadata(prompt: string, userId: string): Promise<{ name: string, slug: string }> {
    const systemPrompt = 'Generate a concise, catchy Project Name and a URL-friendly slug for the website described below. Return EXACTLY a JSON object: {"name": "Project Name", "slug": "project-slug"}. Do NOT wrap in markdown blocks.';
    const userMessage = `Website request: "${prompt}"`;
    
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
      return { name: 'My Cloud Project', slug: generateProjectSlug('My Cloud Project') };
    }
  }
}
