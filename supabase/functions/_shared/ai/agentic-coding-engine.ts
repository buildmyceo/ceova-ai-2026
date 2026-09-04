/**
 * CEOVA Agentic Coding Engine (Codex-Style)
 * 
 * An autonomous, tool-driven coding agent for GPT-5.6 Luna.
 * Instead of receiving monolithic file dumps and regenerating entire codebases,
 * the agent operates in an interactive tool loop:
 * Inspect → Reason → Retrieve Relevant Context → Edit → Run → Verify → Fix → Repeat.
 */

import { Logger } from "../services/logger.ts";
import { AIProviderService, ChatMessage } from "./ai-provider.ts";
import { CloudWorkerService, ProjectFile, BuildResult } from "../worker/worker-service.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface AgenticCodingResult {
  success: boolean;
  files: ProjectFile[];
  buildResult: BuildResult;
  summary: string;
  turns: number;
}

export class AgenticCodingEngine {
  private static readonly MAX_AGENT_TURNS = 10;

  /**
   * OpenAI Tool Definitions for the Coding Agent
   */
  private static getCodingTools() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'search_code',
          description: 'Fast keyword search across project files. Returns matching line numbers and snippets to locate exact code.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Keyword or snippet to search for (case-insensitive)' },
              path: { type: 'string', description: 'Optional relative path to search within (e.g. "index.html")' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'list_files',
          description: 'Lists all files in the project workspace with their path and size.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'read_file',
          description: 'Reads a line slice of a file (max 80 lines). Specify start_line and end_line.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to read (e.g. "index.html")' },
              start_line: { type: 'number', description: '1-indexed start line number' },
              end_line: { type: 'number', description: '1-indexed end line number' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'edit_file',
          description: 'Performs a surgical replacement of an exact snippet of text within an existing file. Avoids rewriting the entire file.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to edit' },
              target_content: { type: 'string', description: 'The exact character sequence to replace. Must match the existing file content uniquely.' },
              replacement_content: { type: 'string', description: 'The new replacement code to insert in place of target_content.' },
            },
            required: ['path', 'target_content', 'replacement_content'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'write_file',
          description: 'Writes a complete file (creates a new file or replaces entire content of an existing file). Use edit_file instead for small edits.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file' },
              content: { type: 'string', description: 'Complete content of the file' },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'run_build',
          description: 'Runs the isolated build compiler and tests. Returns compilation success, build logs, and any compiler/runtime errors.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'finish_task',
          description: 'Declares that the coding task is complete, build and verification succeed, and summarizes changes made.',
          parameters: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'Concise summary of the modifications implemented.' },
            },
            required: ['summary'],
          },
        },
      },
    ];
  }

  /**
   * Executes an autonomous coding agent session for modifying or building a website.
   */
  static async runModificationSession(params: {
    userPrompt: string;
    projectId: string;
    projectName: string;
    slug: string;
    userId: string;
    onProgress?: (event: any) => void;
  }): Promise<AgenticCodingResult> {
    const { userPrompt, projectId, projectName, slug, userId, onProgress } = params;

    Logger.INFO(`[AgenticCodingEngine] Starting coding agent session for project ${projectId} (${projectName})`);

    // In-memory workspace cache for fast, safe manipulation before batch sync
    let projectFiles = await CloudWorkerService.getProjectFiles(projectId);

    // If project has no files yet, start with default empty set
    if (!projectFiles || projectFiles.length === 0) {
      projectFiles = [];
    }

    const fileIndex = projectFiles.map(f => {
      const lineCount = f.content.split('\n').length;
      return `- ${f.path} (${f.content.length} bytes, ${lineCount} lines)`;
    }).join('\n');

    const systemPrompt = `You are GPT-5.6 Luna, an elite autonomous senior coding engineer working inside CEOVA's cloud development environment.
You are tasked with implementing or modifying a live website according to the user's request.

ENVIRONMENT & WORKSPACE RULES:
- Runtime: Static edge network. Runs directly in browser (HTML5, modern CSS, client-side JavaScript, Tailwind CDN or React/Lucide via ESM).
- Project Name: "${projectName}"
- Project Slug: "${slug}"
- Deployment URL: "https://www.ceova.online/p/${slug}"

CODEX-STYLE AGENTIC CODING WORKFLOW:
You work strictly through tools:
1. SEARCH & LOCATE: Call 'search_code' to find the exact line numbers of the text, heading, button, or component you need to modify.
2. RETRIEVE SURROUNDING CONTEXT: Call 'read_file' with 'start_line' and 'end_line' (e.g. 15-20 lines around the match) to inspect the exact syntax and indentation.
3. SURGICAL EDIT: Call 'edit_file' with the exact matching 'target_content' and 'replacement_content'.
4. RUN BUILD: Call 'run_build' to compile the bundle in the isolated sandbox.
5. VERIFY & FIX: If run_build reports an error, inspect the log, fix it with 'edit_file', and run_build again.
6. FINISH: Call 'finish_task' with a concise summary once 'run_build' succeeds.

CRITICAL MODIFICATION RULES:
- Never overwrite unrelated sections or delete existing functionality (Navigation, About, Menu, Contact, Footer, etc. must remain intact).
- Make precise, surgical modifications.
- Always call 'run_build' and ensure it passes before calling 'finish_task'.

Current Project File Structure:
${fileIndex.length > 0 ? fileIndex : '(No files exist yet in project workspace)'}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `User Request: "${userPrompt}"\n\nPlease implement this change using your tools. Search the code, inspect the surrounding lines, make surgical edits, verify with run_build, and call finish_task when done.` }
    ];

    let turns = 0;
    let taskFinished = false;
    let finishSummary = 'Website modifications completed.';
    let latestBuildResult: BuildResult = {
      success: false,
      buildId: '',
      durationMs: 0,
      logs: '',
    };

    const tools = this.getCodingTools();

    while (turns < this.MAX_AGENT_TURNS && !taskFinished) {
      turns++;
      Logger.INFO(`[AgenticCodingEngine] Turn ${turns}/${this.MAX_AGENT_TURNS}`);

      onProgress?.({
        type: 'project_progress',
        stage: 'BUILDING',
        projectId,
        slug,
        isUpdate: true,
        content: turns === 1 ? 'Inspecting website code...' : 'Building website updates...',
      });

      const response = await AIProviderService.generate(messages, userId, {
        tools,
        toolChoice: 'auto',
        maxTokens: 1200,
        temperature: 0.1,
      });

      const hasToolCalls = response.rawToolCalls && response.rawToolCalls.length > 0;

      // Record assistant message strictly maintaining tool-call pairing
      messages.push({
        role: 'assistant',
        content: hasToolCalls ? (response.content || null) : (response.content || ''),
        tool_calls: hasToolCalls ? response.rawToolCalls : undefined,
      });

      // If the model did not make tool calls, nudge it to use tools or check completion
      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (latestBuildResult.success) {
          taskFinished = true;
          break;
        }
        messages.push({
          role: 'user',
          content: 'Please use your available tools (edit_file, read_file, run_build, or finish_task) to execute this task.',
        });
        continue;
      }

      // Execute each tool call sequentially
      for (const toolCall of response.toolCalls) {
        const { name, arguments: args } = toolCall.function;
        Logger.INFO(`[AgenticCodingEngine] Executing tool: ${name}(${JSON.stringify(args).substring(0, 100)})`);

        let toolResultText = '';

        try {
          if (name === 'search_code') {
            const query = (args.query || '').toLowerCase();
            const targetPath = args.path ? CloudWorkerService.sanitizePath(args.path) : null;
            const matches: Array<{ path: string; line: number; text: string }> = [];

            const filesToSearch = targetPath 
              ? projectFiles.filter(f => f.path === targetPath) 
              : projectFiles;

            for (const file of filesToSearch) {
              const lines = file.content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(query)) {
                  matches.push({
                    path: file.path,
                    line: i + 1,
                    text: lines[i].trim().slice(0, 160),
                  });
                  if (matches.length >= 10) break;
                }
              }
              if (matches.length >= 10) break;
            }

            toolResultText = JSON.stringify({
              query: args.query,
              match_count: matches.length,
              matches,
            });
          }
          else if (name === 'list_files') {
            const list = projectFiles.map(f => {
              const lines = f.content.split('\n').length;
              return `${f.path} (${f.content.length} bytes, ${lines} lines)`;
            });
            toolResultText = JSON.stringify({ files: list });
          } 
          else if (name === 'read_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            const file = projectFiles.find(f => f.path === path);

            if (!file) {
              toolResultText = JSON.stringify({ error: `File "${path}" not found.` });
            } else {
              const lines = file.content.split('\n');
              let startLine = Math.max(1, parseInt(args.start_line || '1', 10));
              let endLine = args.end_line ? parseInt(args.end_line, 10) : startLine + 79;
              if (endLine - startLine > 80) endLine = startLine + 80;
              endLine = Math.min(lines.length, endLine);

              const slicedLines = lines.slice(startLine - 1, endLine).map((l, i) => `${startLine + i}: ${l}`).join('\n');

              toolResultText = JSON.stringify({
                path,
                total_lines: lines.length,
                showing_lines: `${startLine}-${endLine}`,
                content: slicedLines,
              });
            }
          } 
          else if (name === 'edit_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            const targetContent = args.target_content;
            const replacementContent = args.replacement_content;

            const fileIndex = projectFiles.findIndex(f => f.path === path);
            if (fileIndex === -1) {
              toolResultText = JSON.stringify({ error: `Cannot edit "${path}": File does not exist.` });
            } else {
              const existingContent = projectFiles[fileIndex].content;
              if (!existingContent.includes(targetContent)) {
                toolResultText = JSON.stringify({
                  error: `target_content was not found in "${path}". Ensure target_content matches exact characters including whitespace.`,
                });
              } else {
                const occurrences = existingContent.split(targetContent).length - 1;
                if (occurrences > 1) {
                  toolResultText = JSON.stringify({
                    error: `target_content matches ${occurrences} places in "${path}". Provide more surrounding context so it matches uniquely.`,
                  });
                } else {
                  const updatedContent = existingContent.replace(targetContent, replacementContent);
                  projectFiles[fileIndex].content = updatedContent;
                  // Persist to worker DB
                  await CloudWorkerService.writeProjectFiles(projectId, [{ path, content: updatedContent }]);
                  toolResultText = JSON.stringify({
                    success: true,
                    path,
                    message: `Successfully edited "${path}" with surgical replacement.`,
                  });
                }
              }
            }
          } 
          else if (name === 'write_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            const content = args.content || '';

            const fileIndex = projectFiles.findIndex(f => f.path === path);
            if (fileIndex >= 0) {
              projectFiles[fileIndex].content = content;
            } else {
              projectFiles.push({ path, content });
            }

            // Persist to worker DB
            await CloudWorkerService.writeProjectFiles(projectId, [{ path, content }]);

            toolResultText = JSON.stringify({
              success: true,
              path,
              bytes_written: content.length,
              message: `Successfully written "${path}".`,
            });
          } 
          else if (name === 'run_build') {
            onProgress?.({
              type: 'project_progress',
              stage: 'BUILDING',
              projectId,
              slug,
              isUpdate: true,
              content: 'Building website updates...',
            });

            latestBuildResult = await CloudWorkerService.runBuild(projectId, userId);

            toolResultText = JSON.stringify({
              success: latestBuildResult.success,
              errors: latestBuildResult.errors || [],
              logs: latestBuildResult.logs.slice(-1200),
              bundle_ready: latestBuildResult.success,
            });
          } 
          else if (name === 'finish_task') {
            finishSummary = args.summary || 'Website modifications completed.';

            // Ensure build is verified before allowing finish
            if (!latestBuildResult.success) {
              onProgress?.({
                type: 'project_progress',
                stage: 'VERIFYING',
                projectId,
                slug,
                isUpdate: true,
                content: 'Verifying website...',
              });
              latestBuildResult = await CloudWorkerService.runBuild(projectId, userId);
            }

            if (latestBuildResult.success) {
              taskFinished = true;
              toolResultText = JSON.stringify({
                status: 'COMPLETED',
                message: 'Task completed and verified.',
              });
            } else {
              toolResultText = JSON.stringify({
                status: 'BLOCKED',
                error: 'Build must succeed before task can be finished. Please fix remaining build errors and run_build again.',
                errors: latestBuildResult.errors,
              });
            }
          } 
          else {
            toolResultText = JSON.stringify({ error: `Unknown tool "${name}".` });
          }
        } catch (toolErr: any) {
          toolResultText = JSON.stringify({ error: toolErr.message || 'Tool execution error' });
        }

        // Add tool response message into the conversation
        messages.push({
          role: 'tool',
          name: name,
          tool_call_id: toolCall.id,
          content: toolResultText,
        });
      }
    }

    // Final build check if agent exited loop without calling finish_task
    if (!latestBuildResult.success) {
      latestBuildResult = await CloudWorkerService.runBuild(projectId, userId);
    }

    const finalFiles = await CloudWorkerService.getProjectFiles(projectId);

    return {
      success: latestBuildResult.success,
      files: finalFiles,
      buildResult: latestBuildResult,
      summary: finishSummary,
      turns,
    };
  }
}
