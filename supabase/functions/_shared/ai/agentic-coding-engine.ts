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
          name: 'list_files',
          description: 'Lists all files in the project workspace with their relative paths, sizes, and line counts.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'search_code',
          description: 'Fast keyword or pattern search across project files. Returns matching line numbers and snippets.',
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
          name: 'read_files',
          description: 'Batch reads multiple files at once. Returns the contents or headers of requested files.',
          parameters: {
            type: 'object',
            properties: {
              paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of relative file paths to read',
              },
            },
            required: ['paths'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'create_file',
          description: 'Creates a new file in the project with the specified content.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the new file (e.g. "src/components/Gallery.jsx")' },
              content: { type: 'string', description: 'Content to write to the file' },
            },
            required: ['path', 'content'],
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
              changes: {
                type: 'array',
                description: 'Optional array of changes [{ target_content, replacement_content }]',
                items: {
                  type: 'object',
                  properties: {
                    target_content: { type: 'string' },
                    replacement_content: { type: 'string' },
                  },
                  required: ['target_content', 'replacement_content'],
                },
              },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'delete_file',
          description: 'Deletes an unwanted or obsolete file from the project workspace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to delete' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'move_file',
          description: 'Moves or renames a file from old_path to new_path.',
          parameters: {
            type: 'object',
            properties: {
              old_path: { type: 'string', description: 'Current relative path of the file' },
              new_path: { type: 'string', description: 'New relative path for the file' },
            },
            required: ['old_path', 'new_path'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'run_command',
          description: 'Executes a project command in the isolated workspace (e.g. "build", "test", "lint", "npm install <pkg>").',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Command to run (e.g. "build", "test", "lint")' },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'get_build_status',
          description: 'Checks the status of the current project build, compilation duration, and deployment status.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'get_build_errors',
          description: 'Retrieves detailed compilation errors, test failures, and recent compiler diagnostic logs.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'preview_website',
          description: 'Gets the current live sandbox preview URL and deployment readiness status.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'inspect_website',
          description: 'Inspects website HTML structure, DOM landmarks, section IDs, linked scripts, and stylesheets for integrity.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'deploy_website',
          description: 'Runs final build verification, packages a new release version, and activates it on the live URL.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'run_build',
          description: 'Compiles the bundle, runs sanity tests, and verifies code integrity in the isolated sandbox.',
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

MANDATORY INSPECT-BEFORE-EDIT WORKFLOW:
For an existing website, you MUST NOT GUESS where a change belongs or edit blindly.
Always follow this strict multi-step inspection sequence:

1. SEARCH & LOCATE:
   - Call 'search_code' with the target keyword, current text, button label, or component name (e.g. search_code({ query: "${projectName}" }) or search_code({ query: "keyword" })).
   - This determines all exact relevant files and line numbers where the content exists (e.g. index.html, src/data/siteData.js, src/components/Navbar.jsx, src/components/Hero.jsx).

2. RETRIEVE ONLY NECESSARY CONTEXT:
   - Once relevant files are identified from search results, call 'read_file' with 'start_line' and 'end_line' (or 'read_files') to read ONLY the necessary surrounding lines (15-25 lines).
   - DO NOT load or read unrelated files.
   - DO NOT read entire large files when you only need a specific section.

3. SURGICAL EDIT:
   - Only after reading the exact context and verifying exact characters and indentation, call 'edit_file' with matching 'target_content' and 'replacement_content'.
   - Never edit a file without inspecting its lines first.

4. BUILD & VERIFY:
   - Call 'run_command' (command: "build") or 'deploy_website' to verify compilation.

5. FINISH:
   - Call 'finish_task' with a concise summary once the build succeeds and the changes are verified.

CRITICAL MODIFICATION RULES:
- Never overwrite unrelated sections or delete existing functionality (Navigation, About, Menu, Contact, Footer, etc. must remain intact).
- Make precise, surgical modifications.
- Ensure the project builds cleanly before calling 'finish_task'.

Current Project File Structure:
${fileIndex.length > 0 ? fileIndex : '(No files exist yet in project workspace)'}`;

    const isExistingProject = projectFiles.length > 0;
    const initialUserPrompt = isExistingProject
      ? `User Request: "${userPrompt}"\n\nProject: "${projectName}" (slug: ${slug})\n\nINSPECTION MANDATE: Do not guess where this change belongs. First call 'search_code' to locate all relevant files and line numbers. Then call 'read_file' with start_line and end_line to retrieve only the necessary context around the match. Do NOT load unrelated files. Then edit surgically, verify with build, and finish.`
      : `User Request: "${userPrompt}"\n\nPlease implement this website using your tools. Inspect the structure, write the code, verify with build, and call finish_task when done.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialUserPrompt }
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

    const inspectedFiles = new Set<string>();
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
          content: 'Please use your available tools (search_code, read_file, edit_file, create_file, run_command, deploy_website, or finish_task) to execute this task.',
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

            for (const match of matches) {
              inspectedFiles.add(match.path);
            }
            if (targetPath) {
              inspectedFiles.add(targetPath);
            }

            const relevantFiles = Array.from(new Set(matches.map(m => m.path)));

            toolResultText = JSON.stringify({
              query: args.query,
              match_count: matches.length,
              relevant_files: relevantFiles,
              matches,
              guidance: matches.length > 0 
                ? `Matches located in: [${relevantFiles.join(', ')}]. Now call read_file with start_line and end_line for only these files to retrieve the necessary context. Do not load unrelated files.`
                : `No matches found for "${args.query}". Try searching for alternative keywords or inspect website structure with inspect_website or list_files.`
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
            inspectedFiles.add(path);
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
          else if (name === 'read_files') {
            const paths: string[] = Array.isArray(args.paths) ? args.paths : [];
            const results: any[] = [];

            for (const rawPath of paths.slice(0, 10)) {
              const p = CloudWorkerService.sanitizePath(rawPath);
              inspectedFiles.add(p);
              const file = projectFiles.find(f => f.path === p);
              if (!file) {
                results.push({ path: p, error: 'File not found' });
              } else {
                const lines = file.content.split('\n');
                const lineSlice = lines.slice(0, 80).map((l, i) => `${i + 1}: ${l}`).join('\n');
                results.push({
                  path: p,
                  total_lines: lines.length,
                  showing_lines: `1-${Math.min(80, lines.length)}`,
                  content: lineSlice,
                });
              }
            }

            toolResultText = JSON.stringify({ files: results });
          }
          else if (name === 'edit_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            const fileIndex = projectFiles.findIndex(f => f.path === path);

            if (fileIndex === -1) {
              toolResultText = JSON.stringify({ error: `Cannot edit "${path}": File does not exist.` });
            } else if (projectFiles.length > 0 && !inspectedFiles.has(path)) {
              toolResultText = JSON.stringify({
                error: `Inspection required before editing: You have not inspected "${path}" yet. You must first search the project using 'search_code' to locate relevant files or call 'read_file' on "${path}" to read the surrounding context before editing. Do not guess where changes belong.`,
              });
            } else {
              let existingContent = projectFiles[fileIndex].content;
              const edits: Array<{ target_content: string; replacement_content: string }> = [];

              if (Array.isArray(args.changes) && args.changes.length > 0) {
                edits.push(...args.changes);
              } else if (args.target_content !== undefined && args.replacement_content !== undefined) {
                edits.push({ target_content: args.target_content, replacement_content: args.replacement_content });
              }

              if (edits.length === 0) {
                toolResultText = JSON.stringify({ error: 'Missing target_content and replacement_content, or changes array.' });
              } else {
                let errorOccurred = false;
                for (const edit of edits) {
                  if (!existingContent.includes(edit.target_content)) {
                    toolResultText = JSON.stringify({
                      error: `target_content was not found in "${path}". Ensure target_content matches exact characters including whitespace.`,
                    });
                    errorOccurred = true;
                    break;
                  }
                  const occurrences = existingContent.split(edit.target_content).length - 1;
                  if (occurrences > 1) {
                    toolResultText = JSON.stringify({
                      error: `target_content matches ${occurrences} places in "${path}". Provide more surrounding context so it matches uniquely.`,
                    });
                    errorOccurred = true;
                    break;
                  }
                  existingContent = existingContent.replace(edit.target_content, edit.replacement_content);
                }

                if (!errorOccurred) {
                  projectFiles[fileIndex].content = existingContent;
                  // Persist to worker DB
                  await CloudWorkerService.writeProjectFiles(projectId, [{ path, content: existingContent }]);
                  toolResultText = JSON.stringify({
                    success: true,
                    path,
                    edits_applied: edits.length,
                    message: `Successfully edited "${path}" with surgical replacement.`,
                  });
                }
              }
            }
          }
          else if (name === 'create_file' || name === 'write_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            inspectedFiles.add(path);
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
          else if (name === 'delete_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            const fileIndex = projectFiles.findIndex(f => f.path === path);

            if (fileIndex === -1) {
              toolResultText = JSON.stringify({ error: `Cannot delete "${path}": File does not exist.` });
            } else {
              projectFiles.splice(fileIndex, 1);
              await CloudWorkerService.deleteProjectFile(projectId, path);
              toolResultText = JSON.stringify({
                success: true,
                path,
                message: `Successfully deleted "${path}".`,
              });
            }
          }
          else if (name === 'move_file') {
            const oldPath = CloudWorkerService.sanitizePath(args.old_path);
            const newPath = CloudWorkerService.sanitizePath(args.new_path);

            const fileIndex = projectFiles.findIndex(f => f.path === oldPath);
            if (fileIndex === -1) {
              toolResultText = JSON.stringify({ error: `Cannot move "${oldPath}": Source file does not exist.` });
            } else {
              projectFiles[fileIndex].path = newPath;
              await CloudWorkerService.moveProjectFile(projectId, oldPath, newPath);
              toolResultText = JSON.stringify({
                success: true,
                old_path: oldPath,
                new_path: newPath,
                message: `Successfully moved "${oldPath}" to "${newPath}".`,
              });
            }
          }
          else if (name === 'run_command') {
            const command = args.command || '';
            const cmdRes = await CloudWorkerService.executeProjectCommand(projectId, userId, command, projectFiles);

            const lowerCmd = command.trim().toLowerCase();
            if (lowerCmd === 'build' || lowerCmd === 'npm run build' || lowerCmd === 'npx vite build') {
              latestBuildResult = await CloudWorkerService.runBuild(projectId, userId);
            }

            toolResultText = JSON.stringify({
              command,
              success: cmdRes.success,
              output: cmdRes.output,
            });
          }
          else if (name === 'get_build_status') {
            toolResultText = JSON.stringify({
              success: latestBuildResult.success,
              buildId: latestBuildResult.buildId || 'none',
              durationMs: latestBuildResult.durationMs || 0,
              status: latestBuildResult.success ? 'READY' : 'NEEDS_BUILD',
              deploymentUrl: `https://www.ceova.online/p/${slug}`,
            });
          }
          else if (name === 'get_build_errors') {
            toolResultText = JSON.stringify({
              errors: latestBuildResult.errors || [],
              logs: (latestBuildResult.logs || '').slice(-1500),
            });
          }
          else if (name === 'preview_website') {
            toolResultText = JSON.stringify({
              deploymentUrl: `https://www.ceova.online/p/${slug}`,
              status: latestBuildResult.success ? 'READY' : 'BUILD_REQUIRED',
            });
          }
          else if (name === 'inspect_website') {
            inspectedFiles.add('index.html');
            const inspection = CloudWorkerService.inspectProjectWebsite(projectFiles);
            toolResultText = JSON.stringify(inspection);
          }
          else if (name === 'deploy_website' || name === 'run_build') {
            onProgress?.({
              type: 'project_progress',
              stage: 'BUILDING',
              projectId,
              slug,
              isUpdate: true,
              content: 'Building and deploying website release...',
            });

            latestBuildResult = await CloudWorkerService.runBuild(projectId, userId);

            toolResultText = JSON.stringify({
              success: latestBuildResult.success,
              deploymentUrl: `https://www.ceova.online/p/${slug}`,
              version: latestBuildResult.versionNumber,
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
                error: 'Build must succeed before task can be finished. Please fix remaining build errors and run_build or deploy_website again.',
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
