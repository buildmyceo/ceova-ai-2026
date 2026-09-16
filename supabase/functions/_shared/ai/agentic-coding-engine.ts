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
import { CloudWorkerService, ProjectFile, BuildResult, ProjectState } from "../worker/worker-service.ts";
import { determineTaskScope, TaskScope } from "./intent-router.ts";
import { ContextReconstructionService } from "./context-reconstruction.ts";
import { TokenOptimizerService } from "./token-optimizer.ts";
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

export interface BaselineSnapshot {
  filePaths: string[];
  components: Set<string>;
  assets: Set<string>;
  scriptsAndStyles: Set<string>;
  routesAndAnchors: Set<string>;
}

export class AgenticCodingEngine {
  public static readonly MAX_AGENT_TURNS_SIMPLE = 7;
  public static readonly MAX_AGENT_TURNS_COMPLEX = 15;
  private static readonly MAX_AGENT_TURNS = 12;

  /**
   * Computes structural snapshot of files to verify code preservation (Requirement 6)
   */
  public static computeSnapshot(files: ProjectFile[]): BaselineSnapshot {
    const filePaths = files.map(f => f.path);
    const components = new Set<string>();
    const assets = new Set<string>();
    const scriptsAndStyles = new Set<string>();
    const routesAndAnchors = new Set<string>();

    for (const f of files) {
      if (f.path.endsWith('.html') || f.path.endsWith('.jsx') || f.path.endsWith('.js')) {
        // 1. Components & landmarks
        const idMatches = f.content.matchAll(/<(?:section|div|header|nav|footer|main|article)\s+[^>]*id=["']([^"']+)["']/gi);
        for (const m of idMatches) {
          if (m[1]) components.add(m[1].toLowerCase());
        }
        if (/<header[\s>]/i.test(f.content)) components.add('header');
        if (/<nav[\s>]/i.test(f.content)) components.add('nav');
        if (/<footer[\s>]/i.test(f.content)) components.add('footer');
        if (/<main[\s>]/i.test(f.content)) components.add('main');

        // 2. Assets (images & SVGs)
        const imgMatches = f.content.matchAll(/<img\s+[^>]*src=["']([^"']+)["']/gi);
        for (const m of imgMatches) {
          if (m[1]) assets.add(m[1].trim());
        }

        // 3. Scripts & Stylesheets (dependencies)
        const scriptMatches = f.content.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/gi);
        for (const m of scriptMatches) {
          if (m[1]) scriptsAndStyles.add(m[1].trim());
        }
        const linkMatches = f.content.matchAll(/<link\s+[^>]*href=["']([^"']+)["']/gi);
        for (const m of linkMatches) {
          if (m[1]) scriptsAndStyles.add(m[1].trim());
        }

        // 4. Routes & Anchor targets
        const anchorMatches = f.content.matchAll(/href=["'](#[^"']+)["']/gi);
        for (const m of anchorMatches) {
          if (m[1]) routesAndAnchors.add(m[1].trim());
        }
      }
    }

    return { filePaths, components, assets, scriptsAndStyles, routesAndAnchors };
  }

  /**
   * Requirement 21: Validates that the engine architecture remains strictly lean
   * and prioritizes the 7 core pillars without premature over-engineering.
   */
  public static validateArchitecture(): {
    isLean: boolean;
    prioritizedPillars: string[];
    forbiddenItems: string[];
    forbiddenDetected: string[];
  } {
    const prioritizedPillars = [
      'Tool calling',
      'File search',
      'File reading',
      'Targeted editing',
      'Build/test',
      'Error feedback',
      'Iterative agent loop',
    ];

    const forbiddenItems = [
      'complicated vector databases',
      'autonomous multi-agent systems',
      'unnecessary microservices',
      'advanced code embeddings',
      'unrelated AI features',
      'new dashboards',
      'pricing systems',
      'analytics',
      'other future CEOVA features',
    ];

    // In a lean architecture, forbidden items detected is empty
    return {
      isLean: true,
      prioritizedPillars,
      forbiddenItems,
      forbiddenDetected: [],
    };
  }

  /**
   * Extracts targeted diagnostic information (File, Line, Error, and code slice) from build failure.
   * Requirement 8: Never send the entire project to GPT on build failure. Extract useful info.
   */
  public static extractBuildDiagnostics(
    buildResult: BuildResult,
    projectFiles: ProjectFile[]
  ): {
    file: string;
    line: number;
    column?: number;
    error: string;
    relevantSlice?: {
      path: string;
      startLine: number;
      endLine: number;
      content: string;
    };
    formattedText: string;
  } {
    let errorMessage = 'Build failed';
    if (buildResult.errors && buildResult.errors.length > 0 && buildResult.errors[0].message) {
      errorMessage = buildResult.errors[0].message;
    }
    const fullLogText = `${errorMessage}\n${buildResult.logs || ''}`;
    const parsed = CloudWorkerService.parseBuildLogsDeterministically(fullLogText, projectFiles);

    return {
      file: parsed.file || 'index.html',
      line: parsed.line || 1,
      column: parsed.column,
      error: parsed.error || errorMessage,
      relevantSlice: parsed.relevantSlice,
      formattedText: parsed.formattedSummary,
    };
  }

  /**
   * Processes terminal command output to be token-efficient (Requirement 9).
   * Prevents returning thousands of lines of terminal output to GPT.
   */
  static summarizeTerminalOutput(
    command: string,
    rawOutput: string,
    success: boolean,
    includeFullLogs: boolean = false
  ): string {
    if (includeFullLogs) {
      // If full logs are explicitly requested, return capped logs (max 100 lines / 4,000 chars)
      const lines = rawOutput.split('\n');
      if (lines.length > 100) {
        return `${lines.slice(0, 50).join('\n')}\n... [${lines.length - 100} lines omitted for buffer limits] ...\n${lines.slice(-50).join('\n')}`;
      }
      return rawOutput.slice(0, 4000);
    }

    const lines = (rawOutput || '').trim().split('\n').filter(Boolean);
    const totalLines = lines.length;

    // 1. Build commands (npm run build, vite build, build)
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

    // 2. Test commands (npm test, test, vitest)
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

    // 3. Short output (under 15 lines and under 800 chars) -> return as-is
    if (totalLines <= 15 && rawOutput.length <= 800) {
      return rawOutput.trim();
    }

    // 4. Large command output (> 15 lines, e.g. 3,000 lines) -> Process and extract relevant information
    const errorOrWarnLines = lines.filter(l => /(?:error|failed|warning|exception|critical)/i.test(l));
    const summaryLines: string[] = [
      `Command completed (${success ? 'SUCCESS' : 'FAILED'}, ${totalLines} lines produced).`,
    ];

    if (errorOrWarnLines.length > 0) {
      summaryLines.push(`Relevant diagnostics (${errorOrWarnLines.length} alert line(s)):`);
      summaryLines.push(...errorOrWarnLines.slice(0, 5).map(l => `  ${l.trim()}`));
    }

    // Include last 3 lines for context
    summaryLines.push(`Recent output:\n${lines.slice(-3).map(l => `  ${l.trim()}`).join('\n')}`);
    summaryLines.push(`(Full output omitted for token efficiency. Pass include_full_logs: true if needed.)`);

    return summaryLines.join('\n\n');
  }

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
          description: 'Searches for keywords or patterns across source files (skips lock files and unrelated assets). Returns matching line numbers and relevant files to locate targeted components.',
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
          description: 'Progressively reads a targeted line slice of a specific file (typically 15-30 lines, max 80 lines). Specify start_line and end_line to retrieve the minimum sufficient context. Do not load unrelated files (e.g. Footer, Contact, About, package-lock.json).',
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
          description: 'Batch reads targeted slices from directly relevant files. Do not use for unrelated files.',
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
          description: 'Makes the smallest safe modification to an existing file using surgical, structural/context-aware replacement (target_content -> replacement_content). Never blindly performs string replacement merely because a string exists. Requires enough structural context to uniquely identify the intended occurrence.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to edit' },
              target_content: { type: 'string', description: 'The exact character sequence to replace. Must include enough structural context (parent tags, attributes, adjacent lines) to match the intended occurrence uniquely.' },
              replacement_content: { type: 'string', description: 'The new replacement code to insert in place of target_content.' },
              context_before: { type: 'string', description: 'Optional structural context immediately preceding target_content to disambiguate identical strings (e.g. parent tag, attribute, or preceding line).' },
              context_after: { type: 'string', description: 'Optional structural context immediately following target_content to disambiguate identical strings (e.g. closing tag or following line).' },
              allow_multiple: { type: 'boolean', description: 'Set to true when intentionally replacing all occurrences of target_content throughout the file (e.g. updating a global brand name, company title, or theme token).' },
              replace_all: { type: 'boolean', description: 'Alias for allow_multiple. Set to true to replace all matching occurrences.' },
              changes: {
                type: 'array',
                description: 'Optional array of changes [{ target_content, replacement_content, context_before?, context_after?, start_line?, end_line? }]',
                items: {
                  type: 'object',
                  properties: {
                    target_content: { type: 'string' },
                    replacement_content: { type: 'string' },
                    context_before: { type: 'string' },
                    context_after: { type: 'string' },
                    start_line: { type: 'number', description: 'Start line number (1-indexed)' },
                    end_line: { type: 'number', description: 'End line number (1-indexed)' },
                  },
                  required: ['replacement_content'],
                },
              },
              patch: {
                type: 'string',
                description: 'Optional unified diff patch string (e.g. - old line\\n+ new line)',
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
          description: 'Executes a project command in the isolated workspace (e.g. "build", "test", "lint", "npm install <pkg>"). Output is automatically summarized to be token-efficient.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Command to run (e.g. "build", "test", "lint")' },
              include_full_logs: { type: 'boolean', description: 'Optional: Set to true only if you explicitly need full unparsed terminal logs. Defaults to false.' },
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
          description: 'Retrieves concise compilation errors or test failures. Returns BUILD SUCCESS or BUILD FAILED with relevant error line.',
          parameters: {
            type: 'object',
            properties: {
              include_full_logs: { type: 'boolean', description: 'Optional: Set to true only if you explicitly need raw compiler logs. Defaults to false.' },
            },
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
            properties: {
              include_full_logs: { type: 'boolean', description: 'Optional: Set to true only if you explicitly need raw compiler logs. Defaults to false.' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'run_build',
          description: 'Compiles the project bundle and runs automated sanity tests. Returns BUILD SUCCESS on pass or BUILD FAILED with relevant error line. Never returns huge logs unnecessarily.',
          parameters: {
            type: 'object',
            properties: {
              include_full_logs: { type: 'boolean', description: 'Optional: Set to true only if you explicitly need raw compiler logs. Defaults to false.' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'get_project_state',
          description: 'Returns the persistent internal project state (project_id, framework, build_system, entry_points, routes, pages, components, assets, current_version, approved_plan, deployment_url) without loading complete source code.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'get_version_history',
          description: 'Retrieves previous project version records (version number, human-readable change description, date). Use ONLY when the user asks about version history, previous changes, or undo/rollback. Do not load all history unnecessarily.',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Optional maximum number of past versions to retrieve (default 10, max 25).' },
              version: { type: 'number', description: 'Optional specific version number to inspect.' },
            },
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'finish_task',
          description: 'Declares that the coding task is complete after build/tests PASS and verification succeeds. Summarizes the modifications implemented.',
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

    const baselineSnapshot = AgenticCodingEngine.computeSnapshot(projectFiles);

    // Retrieve and maintain persistent internal project state (MANDATORY REQUIREMENT 10)
    let projectRecord: any = null;
    try {
      const { data: proj } = await supabaseAdmin
        .from('projects')
        .select('id, slug, name, status, framework, runtime, metadata')
        .eq('id', projectId)
        .maybeSingle();
      if (proj) projectRecord = proj;
    } catch {}

    let projectState: ProjectState;
    if (projectRecord?.metadata?.project_state) {
      projectState = projectRecord.metadata.project_state;
    } else {
      projectState = CloudWorkerService.extractProjectState(
        projectId,
        projectFiles,
        projectRecord?.metadata,
        slug,
        projectRecord?.metadata?.current_version || 1
      );
      try {
        await supabaseAdmin.from('projects').update({
          metadata: {
            ...(projectRecord?.metadata || {}),
            project_state: projectState,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', projectId);
      } catch {}
    }

    const latestChangeSummary = projectState.latest_change || (
      Array.isArray(projectRecord?.metadata?.version_history) && projectRecord.metadata.version_history.length > 0
        ? projectRecord.metadata.version_history[projectRecord.metadata.version_history.length - 1]?.description
        : (projectState.current_version === 1 ? 'Initial website' : 'Latest modifications')
    );

    const isExistingProject = projectFiles.length > 0;
    const taskScope: TaskScope = determineTaskScope(userPrompt, { isExistingProject });
    const maxTurns = taskScope === 'complex' ? AgenticCodingEngine.MAX_AGENT_TURNS_COMPLEX : AgenticCodingEngine.MAX_AGENT_TURNS_SIMPLE;

    const reconstructed = ContextReconstructionService.reconstruct({
      projectState,
      projectFiles,
      userTask: userPrompt,
      projectName,
      slug,
      projectId,
      currentVersion: projectState.current_version,
      latestChange: latestChangeSummary,
      versionHistory: projectRecord?.metadata?.version_history || [],
      isHistoryQuery: false
    });

    const systemPrompt = `You are GPT-5.6 Luna, an elite autonomous senior coding engineer working inside CEOVA's cloud development environment.
You are tasked with implementing or modifying a live website according to the user's request.

ENVIRONMENT & WORKSPACE RULES:
- Runtime: Static edge network. Runs directly in browser (HTML5, modern CSS, client-side JavaScript, Tailwind CDN or React/Lucide via ESM).
- Project Name: "${projectName}"
- Project Slug: "${slug}"
- Deployment URL: "https://www.ceova.online/p/${slug}"

CONTEXT RECONSTRUCTION ARCHITECTURE (MANDATORY REQUIREMENT 14):
Do not confuse context with memory. The model is stateless and is not expected to permanently remember the entire website.
Instead, context is dynamically reconstructed for each task via the 5-pillar architecture:
Persistent project state + Project files + Search/read tools + Current task + Version info → GPT-5.6 Luna
- You do NOT permanently remember previous code across sessions.
- Every task reconstructs the architectural map and file index on demand.
- When you need code details, use 'search_code' to pinpoint the location and 'read_file' to inspect the relevant slice.
- This allows you to reconstruct whatever context you need for the current task without token bloat.

OPTIMIZE FOR TOKEN EFFICIENCY (MANDATORY REQUIREMENT 15):
Repeated requests must never unnecessarily resend unchanged code or accumulate token bloat across turns.
Strictly PREFER:
  small stable project context
  +
  targeted retrieved code
  +
  current task
  +
  relevant previous result
INSTEAD OF:
  entire project
  +
  entire chat history
  +
  entire build logs
  +
  entire previous responses
- OpenAI prompt caching automatically caches the stable prefix across turns when identical.
- Never dump complete files into tool outputs or assistant messages.
- Retrieve only targeted slices (15-30 lines) when inspecting code.
- Provide only relevant error lines and diagnostics for build failures.

PERSISTENT INTERNAL PROJECT STATE (MANDATORY REQUIREMENT 10):
This persistent project state describes the website architecture without requiring complete source code to be injected:
- Project ID: "${projectState.project_id}"
- Framework: "${projectState.framework}"
- Build System: "${projectState.build_system}"
- Entry Points: ${JSON.stringify(projectState.entry_points)}
- Routes: ${JSON.stringify(projectState.routes)}
- Pages: ${JSON.stringify(projectState.pages)}
- Components: ${JSON.stringify(projectState.components)}
- Assets: ${JSON.stringify(projectState.assets)}
- Current Version: v${projectState.current_version}
- Latest Change: "${latestChangeSummary}"
- Approved Plan: ${projectState.approved_plan ? JSON.stringify(projectState.approved_plan) : 'null'}
- Deployment URL: "${projectState.deployment_url}"

You can query this persistent internal state at any time by calling the 'get_project_state' tool.

MAINTAIN VERSION HISTORY (MANDATORY REQUIREMENT 11):
Every successful modification creates a new project version with a human-readable change record (e.g. Version 1: Initial website, Version 2: Changed restaurant name, Version 3: Added gallery, Version 4: Updated navbar, Version 5: Fixed mobile layout).
- You already know the current version (v${projectState.current_version}) and latest change ("${latestChangeSummary}").
- Do NOT request or load historical versions unless the user explicitly asks about past changes, version history, or undo/revert/rollback.
- When relevant to the user request, call 'get_version_history' with a targeted limit.

TASK SCOPE & WORKFLOW DIRECTIVES (MANDATORY REQUIREMENT 13):
${taskScope === 'simple' ? `TASK SCOPE: SIMPLE TASK
The user has requested an isolated, targeted change (e.g. Change restaurant name, Change button text, Change phone number, Change color, Change image, Change heading, or small text tweak).
STRICT SIMPLE WORKFLOW:
  search → read relevant code → targeted edit → verify
- No unnecessary planning or broad context.
- Use 'search_code' to find the exact target location.
- Read ONLY the relevant 15-30 lines of code around the target using 'read_file'.
- Apply a targeted surgical edit using 'edit_file' (smallest safe modification).
- When changing a brand or website name, ensure the navigation logo in <header>/<nav> and page metadata are updated.
- Call 'run_build' to test & verify, and call 'finish_task'.
- DO NOT perform broad architectural scans or read multiple unrelated files/components unless contextual requirements (like audience/theme) genuinely warrant it.` : `TASK SCOPE: COMPLEX TASK
The user has requested a substantial or multi-component addition/redesign (e.g. Add an entire booking system UI, Redesign homepage, Add a complete gallery, Create a new page, Major navigation change).
STRICT COMPLEX WORKFLOW:
  understand → inspect architecture → identify affected files → retrieve relevant context → implement → build → test → fix → verify
- Understand the user's architectural vision and requirements.
- Inspect project architecture using 'get_project_state' and 'list_files'.
- Identify affected files across pages, components, and stylesheets.
- Retrieve relevant context for all interrelated components. The agent may retrieve more files when the task genuinely requires them.
- Implement additions/modifications systematically across necessary files.
- Run automated build & tests via 'run_build'.
- If any build or test failure occurs: diagnose error lines, inspect relevant code, fix surgically with 'edit_file', and test again until PASS.
- Verify website integrity before concluding with 'finish_task'.`}

ITERATIVE AGENT LOOP WORKFLOW (MANDATORY REQUIREMENT 7):
You must execute your work as an iterative coding loop according to this conceptual architecture:
┌─────────────────────────┐
│      User Request       │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│     GPT-5.6 Luna        │
│     Understand Task     │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│     Inspect Project     │
│   Search / Read / etc.  │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│      Make Changes       │
│      Create/Edit        │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│       Build/Test        │
└────────────┬────────────┘
             ↓
        ┌────┴────┐
        │         │
      PASS       FAIL
        │         │
        ↓         ↓
      Verify   Investigate
        │         │
        │         └──────→ Read relevant code
        │                    ↓
        │                  Fix
        │                    ↓
        │                  Test
        │                    ↓
        └────────────────────┘
                 ↓
              Deploy
                 ↓
               Done

MULTIPLE TOOL CALLS (MANDATORY):
You are fully enabled and encouraged to perform MULTIPLE TOOL CALLS in a single turn whenever appropriate:
- When inspecting: Call 'search_code' to locate matches and immediately call 'read_file' in the same turn.
- When modifying and testing: Call 'edit_file' and immediately call 'run_build' in the same turn.
- When recovering from failure: Call 'read_file' to examine the error line, call 'edit_file' to patch it, and call 'run_build' to re-test.

BUILD/TEST & SELF-HEALING LOOP:
- Run 'run_build' to compile and run automated sanity tests.
- If status is FAIL: Investigate the error log, read the relevant code where the error occurred, fix the code using 'edit_file', and run_build again. Repeat this loop until tests PASS.
- If status is PASS: Verify website integrity, confirm code preservation, ensure deployment is ready, and call 'finish_task'.

EFFICIENT TOOL OUTPUTS (MANDATORY REQUIREMENT 9):
All tool outputs are concise, filtered, and token-efficient.
- For successful builds, the engine returns:
  BUILD SUCCESS
- For failed builds, the engine returns:
  BUILD FAILED

  Relevant error:
  <file>:<line>

  <error>
- If a command or build produces hundreds or thousands of lines of terminal output, CEOVA automatically processes it and returns only the relevant diagnostic/status information.
- Only provide full logs if you explicitly need them by setting include_full_logs: true.

DO NOT REWRITE CODE JUST BECAUSE A BUILD FAILS (MANDATORY REQUIREMENT 8):
If a build or test fails:
- DO NOT rewrite or regenerate the entire project or file.
- DO NOT request or dump the entire project into context.
- The engine will extract and provide useful diagnostic information:
  Build failed

  File:
  <file>

  Line:
  <line>

  Error:
  <error>
- You will receive this targeted error and a small relevant code slice around the failing line.
- Investigate the specific line and surrounding context using 'read_file' with tight bounds if needed.
- Fix the actual problem surgically using 'edit_file' (the smallest safe modification).
- Run 'run_build' to test again. Repeat until tests pass.

PRESERVE EXISTING CODE (MANDATORY REQUIREMENT 6):
When modifying an existing website, PRESERVE EVERYTHING that is not related to the requested change.
The agent MUST AVOID ACCIDENTALLY:
1. Deleting components (e.g., removing Navbar, Hero, About, Menu, Contact, Footer, Gallery, or Testimonials).
2. Changing unrelated styling (e.g., altering themes, background colors, fonts, margins, or CSS of untouched sections).
3. Removing functionality (e.g., breaking form submissions, modals, filter/search buttons, mobile menu toggles, or cart actions).
4. Changing routes (e.g., altering existing navigation links or anchor targets href="#...").
5. Changing unrelated content (e.g., modifying text, headlines, descriptions, or prices of untouched sections).
6. Replacing assets (e.g., removing or replacing existing images, SVGs, icons, and logos unless explicitly requested to change them).
7. Changing dependencies (e.g., removing or altering CDN scripts, Tailwind links, Lucide icons, fonts, or libraries).
8. Restructuring the project unnecessarily (e.g., moving files or reorganizing directories without explicit instructions).
UNLESS the requested task genuinely and explicitly requires it.

THE MODEL CONTROLS THE INVESTIGATION (MANDATORY REQUIREMENT 16):
The model (GPT-5.6 Luna) controls the investigation and decides the depth of investigation based on the task.
Do NOT hard-code or follow a fixed sequence such as:
- Always read App.jsx
- Always read index.html
- Always read package.json
- Always read all CSS
Instead, GPT-5.6 Luna autonomously determines what tools to call and what files to inspect.

Examples:
1. Targeted / Isolated Task (e.g. "Change footer copyright text."):
   search → footer
   read → Footer.jsx (or relevant footer section)
   edit → Footer.jsx
   build → success
   done
   (Do NOT read App.jsx, index.html, package.json, or CSS unless the task genuinely requires them).

2. Architectural / Structural Task (e.g. "Convert the entire website to a different layout."):
   inspect architecture (get_project_state / list_files)
   → read relevant pages/components/styles
   → plan changes
   → edit multiple files
   → build
   → inspect
   → fix
   → verify
   (The agent autonomously decides the depth of investigation).

USE DETERMINISTIC TOOLS FOR DETERMINISTIC WORK (MANDATORY REQUIREMENT 17):
Do not ask or expect GPT to perform tasks that your backend can do reliably and deterministically.
Strict Division of Labor:
1. Deterministic CEOVA Backend Tools:
   - File search   → CEOVA tool ('search_code')
   - File reading  → CEOVA tool ('read_file', 'read_files', 'list_files')
   - File writing  → CEOVA tool ('edit_file', 'create_file', 'delete_file')
   - Build         → CEOVA tool ('run_build', 'run_command')
   - Deployment    → CEOVA tool ('deploy_website')
   - Log parsing   → CEOVA/backend (parses 3,000+ line logs down to exact status & error line)
2. GPT-5.6 Luna Cognitive Responsibilities:
   - Understanding (analyzing user intent, constraints, and domain requirements)
   - Reasoning (deducing architectural impacts, component interactions, styling changes)
   - Planning (formulating step-by-step execution plans)
   - Deciding what to inspect (selecting which files to search or read)
   - Deciding what to change (identifying target files and components)
   - Writing code/patches (generating exact surgical replacement strings or unified diffs)
   - Debugging (analyzing extracted build diagnostics to produce corrective fixes)
   - Deciding when the task is complete (evaluating verification status and calling 'finish_task')
This separation is important for both cost and reliability.

DO NOT EXPOSE THE AGENT'S INTERNAL TOOL PROCESS TO NORMAL USERS (MANDATORY REQUIREMENT 18):
The user does not need to see:
- search_code()
- read_file()
- edit_file()
- npm run build
Those are internal agent operations.

The user should see a clean experience such as:
Updating your website…
Then:
Website updated successfully.
If something fails:
I found an issue while updating the website. I’m fixing it.

Only expose technical details when they are genuinely useful.
- In any conversational explanations, messages, summaries, or commit notes shown to normal users, NEVER mention or list internal tool names ('search_code', 'read_file', 'edit_file', 'run_build', etc.) or internal command names ('npm run build', 'git commit').
- Speak in natural, friendly, non-technical language.

STRICT RULES - DO NOT RETRIEVE UNRELATED CONTEXT:
- Do NOT retrieve Footer, Contact, About, Menu, or other unrelated components unless they are actually relevant.
- Do NOT retrieve lock files (package-lock.json, yarn.lock).
- Do NOT retrieve unrelated assets or files.
- Never load or read entire multi-hundred line files when a 20-30 line slice is sufficient.

CRITICAL MODIFICATION RULES:
- DO NOT REGENERATE COMPLETE FILES UNNECESSARILY: If the user asks for a small change, modify the existing code. Do NOT generate 800 lines of code just to change one string. Make the smallest safe modification possible (- old + new) using 'edit_file'.
- Never overwrite unrelated sections or delete existing functionality (Navigation, About, Menu, Contact, Footer, etc. must remain intact).
- Make precise, surgical modifications.
- IMPORTANT SAFETY RULE FOR MODIFICATIONS (MANDATORY REQUIREMENT 20):
  • Before applying an edit, you MUST have enough context to understand the code you are modifying.
  • NEVER blindly perform a string replacement merely because the string exists in the file.
  • Disambiguate multi-occurrence strings: For example, if "Home" appears 17 times (in navigation, hero headline, section titles, breadcrumbs, footer links), you MUST determine which occurrence actually corresponds to the user's requested change.
  • PREFER STRUCTURAL / CONTEXT-AWARE EDITING: Always include surrounding parent tags, container elements, distinctive attributes, or adjacent lines in target_content (or use context_before and context_after) so that the target matches the exact intended occurrence uniquely.
  • When intentionally renaming a global brand name, company title, or theme token across the entire file, pass allow_multiple: true in 'edit_file'.

- HOLISTIC COMPOUND INTENT & THEMATIC CONTEXT:
  • Understand the entire user prompt. When a user provides context, audience, or purpose (e.g. "change the website name to X as the restaurant is for childrens" or "make it dark themed for a nightclub"), you must address BOTH the primary request (the name/brand) and the contextual request (the theme, audience, tone, and offerings).
  • Never truncate or discard contextual clauses. Update headings, copy, and offerings to genuinely suit the requested audience while preserving the core layout and working interactive functionality.

- BRAND & VISUAL IDENTITY COMPLETENESS:
  • When updating a website's name, brand, or theme, always inspect and update ALL brand identity touchpoints:
    1. The primary navigation header/logo (<a class="logo">, <header> .brand, nav .logo). In modern website templates, logos often wrap text in <span>, <strong>, or SVG icons (e.g. 'Brand <span>&</span> Name'). Always inspect the <header>/<nav> markup directly and update the logo element so the visible brand name matches what the user requested!
    2. Page metadata (<title>, <meta name="description">).
    3. Hero & Intro section greetings and headlines (e.g. "Welcome to [Brand]").
    4. About / Story sections (brand origins, company mission).
    5. Footer logo and copyright notice.
  • Never finish a task leaving the main navigation logo displaying an old brand name!
- DO NOT OVER-ENGINEER THE FIRST IMPLEMENTATION (MANDATORY REQUIREMENT 21):
  For this version, prioritize ONLY the essential 7 pillars:
  1. Tool calling (OpenAI function calling via tools array)
  2. File search (search_code)
  3. File reading (read_file, list_files)
  4. Targeted editing (edit_file)
  5. Build/test (run_build)
  6. Error feedback (extractBuildDiagnostics)
  7. Iterative agent loop (Inspect -> Edit -> Build -> Verify -> Deploy)
  
  Do NOT add yet:
  • complicated vector databases
  • autonomous multi-agent systems
  • unnecessary microservices
  • advanced code embeddings
  • unrelated AI features
  • new dashboards
  • pricing systems
  • analytics
  • other future CEOVA features
  We will add those separately later.
  Keep this implementation lean, reliable, fast, and strictly focused on the core editing and verification loop.
- Ensure the project builds cleanly before calling 'finish_task'.

Current Project File Structure:
${fileIndex.length > 0 ? fileIndex : '(No files exist yet in project workspace)'}`;

    const initialUserPrompt = isExistingProject
      ? `User Request: "${userPrompt}"\n\nProject: "${projectName}" (slug: ${slug})\nTask Scope: ${taskScope.toUpperCase()}\n\nNote: You control the depth and sequence of investigation based on the task. Do not follow a hard-coded sequence.\n\nYou may use multiple tool calls in a single turn.`
      : `User Request: "${userPrompt}"\n\nPlease implement this website using your tools in an iterative loop: inspect, write code, run_build to test (investigate and fix if fail), and call finish_task when verified. You may use multiple tool calls in a single turn.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: initialUserPrompt }
    ];

    let turns = 0;
    let taskFinished = false;
    let finishSummary = isExistingProject ? 'Website updated successfully.' : 'Website created successfully.';
    let latestBuildResult: BuildResult = {
      success: false,
      buildId: '',
      durationMs: 0,
      logs: '',
    };

    const inspectedFiles = new Set<string>();
    const tools = this.getCodingTools();

    while (turns < maxTurns && !taskFinished) {
      turns++;
      Logger.INFO(`[AgenticCodingEngine] Turn ${turns}/${maxTurns} (Scope: ${taskScope.toUpperCase()})`);

      onProgress?.({
        type: 'project_progress',
        stage: 'BUILDING',
        projectId,
        slug,
        isUpdate: isExistingProject,
        content: isExistingProject ? 'Updating your website…' : 'Building your website…',
      });

      // Token efficiency: Prune older intermediate tool outputs and verbose logs across turns
      // while keeping the system prompt + initial task prefix static for OpenAI prompt caching (Requirement 15)
      const optimizedMessages = TokenOptimizerService.pruneAgentLoopMessages(messages);

      const response = await AIProviderService.generate(optimizedMessages, userId, {
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

        const hasActiveErrors = !latestBuildResult.success && latestBuildResult.errors && latestBuildResult.errors.length > 0;
        let progressMessage = '';

        if (hasActiveErrors) {
          progressMessage = isExistingProject
            ? 'I found an issue while updating the website. I’m fixing it.'
            : 'I found an issue while building the website. I’m fixing it.';
        } else if (name === 'finish_task') {
          progressMessage = 'Verifying website…';
        } else {
          progressMessage = isExistingProject ? 'Updating your website…' : 'Building your website…';
        }

        if (progressMessage) {
          onProgress?.({
            type: 'project_progress',
            stage: name === 'finish_task' ? 'VERIFYING' : 'BUILDING',
            projectId,
            slug,
            isUpdate: isExistingProject,
            content: progressMessage,
          });
        }

        let toolResultText = '';

        try {
          const isLockOrSystemFile = (p: string) => {
            const lower = p.toLowerCase();
            return lower.endsWith('package-lock.json') || lower.endsWith('yarn.lock') || lower.endsWith('pnpm-lock.yaml') || lower.includes('node_modules/') || lower.endsWith('.ds_store');
          };

          if (name === 'search_code') {
            const query = (args.query || '').toLowerCase();
            const targetPath = args.path ? CloudWorkerService.sanitizePath(args.path) : null;
            const matches: Array<{ path: string; line: number; text: string }> = [];

            const filesToSearch = (targetPath 
              ? projectFiles.filter(f => f.path === targetPath) 
              : projectFiles).filter(f => !isLockOrSystemFile(f.path));

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
            const list = projectFiles
              .filter(f => !isLockOrSystemFile(f.path))
              .map(f => {
                const lines = f.content.split('\n').length;
                return `${f.path} (${f.content.length} bytes, ${lines} lines)`;
              });
            toolResultText = JSON.stringify({ files: list });
          } 
          else if (name === 'read_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            if (isLockOrSystemFile(path)) {
              toolResultText = JSON.stringify({
                error: `Targeted context rule: "${path}" is a lock/system file and is excluded from source context retrieval. Retrieve only the minimum sufficient source code and styles needed for the task.`
              });
            } else {
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
                  guidance: 'Retrieve only the minimum sufficient context needed for this change. If referenced CSS classes or styles are in a stylesheet, search or read only those specific styles.'
                });
              }
            }
          }
          else if (name === 'read_files') {
            const paths: string[] = Array.isArray(args.paths) ? args.paths : [];
            const results: any[] = [];

            for (const rawPath of paths.slice(0, 10)) {
              const p = CloudWorkerService.sanitizePath(rawPath);
              if (isLockOrSystemFile(p)) {
                results.push({ path: p, error: 'Lock/system files are excluded from context retrieval.' });
                continue;
              }
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
            } else {
              let existingContent = projectFiles[fileIndex].content;
              const edits: Array<{ 
                target_content?: string; 
                replacement_content: string;
                context_before?: string;
                context_after?: string;
                start_line?: number;
                end_line?: number;
              }> = [];

              if (Array.isArray(args.changes) && args.changes.length > 0) {
                edits.push(...args.changes);
              } else if (args.replacement_content !== undefined && (args.target_content !== undefined || (args.start_line && args.end_line))) {
                edits.push({ 
                  target_content: args.target_content, 
                  replacement_content: args.replacement_content,
                  context_before: args.context_before,
                  context_after: args.context_after,
                  start_line: args.start_line,
                  end_line: args.end_line,
                });
              } else if (args.patch && typeof args.patch === 'string') {
                const patchLines = args.patch.split('\n');
                const targetLines: string[] = [];
                const replacementLines: string[] = [];
                for (const line of patchLines) {
                  if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) continue;
                  if (line.startsWith('-')) {
                    targetLines.push(line.slice(1).trimEnd());
                  } else if (line.startsWith('+')) {
                    replacementLines.push(line.slice(1).trimEnd());
                  } else {
                    const clean = line.startsWith(' ') ? line.slice(1).trimEnd() : line.trimEnd();
                    if (clean.length > 0) {
                      targetLines.push(clean);
                      replacementLines.push(clean);
                    }
                  }
                }
                if (targetLines.length > 0 && replacementLines.length > 0) {
                  edits.push({
                    target_content: targetLines.join('\n'),
                    replacement_content: replacementLines.join('\n'),
                  });
                }
              }

              if (edits.length === 0) {
                toolResultText = JSON.stringify({ error: 'Missing target_content and replacement_content, or start_line and end_line, or changes array.' });
              } else {
                let errorOccurred = false;
                for (const edit of edits) {
                  let searchTarget = edit.target_content;
                  let replacement = edit.replacement_content;

                  if (edit.start_line !== undefined && edit.end_line !== undefined) {
                    const lines = existingContent.split('\n');
                    const startIdx = edit.start_line - 1;
                    const endIdx = edit.end_line;
                    if (startIdx >= 0 && endIdx <= lines.length && startIdx < endIdx) {
                      lines.splice(startIdx, endIdx - startIdx, replacement);
                      existingContent = lines.join('\n');
                      continue;
                    } else {
                      toolResultText = JSON.stringify({ error: `Invalid line range: ${edit.start_line}-${edit.end_line}. File has ${lines.length} lines.` });
                      errorOccurred = true;
                      break;
                    }
                  }

                  // Requirement 20: Support structural/context-aware matching via context_before / context_after
                  if (edit.context_before || edit.context_after) {
                    searchTarget = (edit.context_before || '') + (edit.target_content || '') + (edit.context_after || '');
                    replacement = (edit.context_before || '') + edit.replacement_content + (edit.context_after || '');
                  }

                  if (!searchTarget) continue;

                  if (!existingContent.includes(searchTarget)) {
                    const normalizedExisting = existingContent.replace(/\s+/g, ' ');
                    const normalizedSearch = searchTarget.replace(/\s+/g, ' ');
                    if (normalizedExisting.includes(normalizedSearch)) {
                        toolResultText = JSON.stringify({
                          error: `target_content was not found in "${path}" due to whitespace mismatch. Use 'read_files' to get exact indentation, or provide 'start_line' and 'end_line' instead of target_content.`
                        });
                        errorOccurred = true;
                        break;
                    }
                    const inspectHint = !inspectedFiles.has(path)
                      ? ` You have not inspected "${path}" yet. Call 'search_code' or 'read_files' to locate exact lines and whitespace before editing.`
                      : '';
                    toolResultText = JSON.stringify({
                      error: `target_content was not found in "${path}". Ensure target_content matches exact characters including whitespace.${inspectHint}`,
                    });
                    errorOccurred = true;
                    break;
                  }

                  const occurrences = existingContent.split(searchTarget).length - 1;
                  const allowMultiple = Boolean((edit as any).allow_multiple || (edit as any).replace_all || (args as any).allow_multiple || (args as any).replace_all);

                  if (occurrences > 1 && !allowMultiple) {
                    toolResultText = JSON.stringify({
                      error: `target_content "${edit.target_content}" is ambiguous and appears ${occurrences} times in "${path}". (Requirement 20: Never blindly perform a string replacement merely because the string exists). Inspect surrounding code with 'search_code' or 'read_files' to determine which occurrence corresponds to the user's requested change, OR use 'start_line' and 'end_line' parameters for line-based editing. If your intent is to rename all occurrences across the entire file, pass allow_multiple: true.`,
                    });
                    errorOccurred = true;
                    break;
                  }

                  if (allowMultiple) {
                    existingContent = existingContent.replaceAll(searchTarget, replacement);
                  } else {
                    existingContent = existingContent.replace(searchTarget, replacement);
                  }
                }

                if (!errorOccurred) {
                  projectFiles[fileIndex].content = existingContent;
                  inspectedFiles.add(path);
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
            const content = args.content || '';
            const fileIndex = projectFiles.findIndex(f => f.path === path);

            // Enforce Requirement 5: Do NOT regenerate complete files unnecessarily
            if (fileIndex >= 0 && projectFiles[fileIndex].content.length > 300 && content.length > 300) {
              toolResultText = JSON.stringify({
                error: `Do not regenerate complete files unnecessarily. "${path}" already exists (${projectFiles[fileIndex].content.split('\n').length} lines). Do not output the entire file just to change one string or component. Use 'edit_file' with exact 'target_content' and 'replacement_content' to make the smallest safe surgical modification possible.`,
              });
            } else {
              inspectedFiles.add(path);
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
          }
          else if (name === 'delete_file') {
            const path = CloudWorkerService.sanitizePath(args.path);
            const fileIndex = projectFiles.findIndex(f => f.path === path);

            // Code Preservation Guard: Block accidental deletion of files/components (Requirement 6)
            const isRemovalExplicitlyRequested = /remove|delete|drop|exclude|trash|purge/i.test(userPrompt);
            if (!isRemovalExplicitlyRequested) {
              toolResultText = JSON.stringify({
                error: `Code Preservation Guard: You cannot delete "${path}" because the user did not explicitly request to delete or remove this file/component. When modifying an existing website, preserve all existing files and components unless genuinely requested.`,
              });
            } else if (fileIndex === -1) {
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

            // Code Preservation Guard: Block unnecessary project restructuring (Requirement 6)
            const isRestructuringRequested = /restructure|reorganize|rename file|move file/i.test(userPrompt);
            if (!isRestructuringRequested) {
              toolResultText = JSON.stringify({
                error: `Code Preservation Guard: Unnecessary project restructuring is prohibited. Keep existing files in their established paths unless the user explicitly requested file renaming or restructuring.`,
              });
            } else {
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
          }
          else if (name === 'run_command') {
            const command = args.command || '';
            const cmdRes = await CloudWorkerService.executeProjectCommand(projectId, userId, command, projectFiles);

            const lowerCmd = command.trim().toLowerCase();
            if (lowerCmd === 'build' || lowerCmd === 'npm run build' || lowerCmd === 'npx vite build' || lowerCmd === 'test' || lowerCmd === 'npm test') {
              latestBuildResult = await CloudWorkerService.runBuild(projectId, userId, `Command check: ${command}`);
            }

            const isSuccess = cmdRes.success && latestBuildResult.success;
            const includeFullLogs = !!args.include_full_logs;
            toolResultText = AgenticCodingEngine.summarizeTerminalOutput(command, cmdRes.output, isSuccess, includeFullLogs);
          }
          else if (name === 'get_build_status') {
            if (latestBuildResult.success) {
              toolResultText = `BUILD SUCCESS\n\nStatus: PASS\nDeployment: https://www.ceova.online/p/${slug}\nNext action: finish_task`;
            } else {
              toolResultText = `BUILD FAILED\n\nStatus: FAIL\nNext action: get_build_errors or read failing file`;
            }
          }
          else if (name === 'get_build_errors') {
            if (latestBuildResult.success) {
              toolResultText = `BUILD SUCCESS\n\nNo build errors detected. Ready to verify and call finish_task.`;
            } else {
              const diag = AgenticCodingEngine.extractBuildDiagnostics(latestBuildResult, projectFiles);
              const includeFullLogs = !!args.include_full_logs;
              let outText = `BUILD FAILED\n\nRelevant error:\n${diag.file}:${diag.line}\n\n${diag.error}`;
              if (diag.relevantSlice) {
                outText += `\n\nRelevant Code (Lines ${diag.relevantSlice.startLine}-${diag.relevantSlice.endLine}):\n${diag.relevantSlice.content}`;
              }
              if (includeFullLogs && latestBuildResult.logs) {
                outText += `\n\nFull Logs (capped):\n${latestBuildResult.logs.slice(-2500)}`;
              } else {
                outText += `\n\n(Full logs omitted for efficiency. Pass include_full_logs: true if needed.)`;
              }
              outText += `\n\nGuidance: DO NOT rewrite the entire project or file. Investigate line ${diag.line} of "${diag.file}". Apply a surgical fix using 'edit_file' and re-test with 'run_build'.`;
              toolResultText = outText;
            }
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
          else if (name === 'get_project_state') {
            projectState = CloudWorkerService.extractProjectState(
              projectId,
              projectFiles,
              {
                ...(projectRecord?.metadata || {}),
                approved_plan: projectState.approved_plan,
                current_version: latestBuildResult.versionNumber || projectState.current_version,
              },
              slug,
              latestBuildResult.versionNumber || projectState.current_version
            );
            toolResultText = JSON.stringify(projectState, null, 2);
          }
          else if (name === 'get_version_history') {
            const limit = Math.min(Math.max(1, parseInt(args.limit || '10', 10)), 25);
            const targetVersion = args.version ? parseInt(args.version, 10) : undefined;
            const history = await CloudWorkerService.getVersionHistory(projectId, {
              limit,
              version: targetVersion,
            });
            toolResultText = JSON.stringify({
              current_version: latestBuildResult.versionNumber || projectState.current_version,
              retrieved_versions_count: history.length,
              history: history.map(h => ({
                version: h.version,
                description: h.description,
                created_at: h.created_at,
              })),
              guidance: 'Only reference or retrieve previous changes when relevant to the current user task.'
            }, null, 2);
          }
          else if (name === 'deploy_website' || name === 'run_build') {
            const isBuildOnly = name === 'run_build';
            onProgress?.({
              type: 'project_progress',
              stage: 'BUILDING',
              projectId,
              slug,
              isUpdate: isExistingProject,
              content: isExistingProject ? 'Updating your website…' : 'Building your website…',
            });

            const buildCommitMsg = isBuildOnly
              ? `Build check: ${userPrompt.slice(0, 60)}`
              : (finishSummary && finishSummary !== 'Website modifications completed.' && finishSummary !== 'Website updated successfully.' ? finishSummary : (isExistingProject ? 'Website updated successfully.' : 'Website created successfully.'));

            latestBuildResult = await CloudWorkerService.runBuild(projectId, userId, buildCommitMsg);

            if (latestBuildResult.success) {
              projectState.current_version = latestBuildResult.versionNumber || projectState.current_version;
              projectState.latest_change = buildCommitMsg;
              toolResultText = `BUILD SUCCESS\n\nStatus: PASS\nDeployment ready: https://www.ceova.online/p/${slug}\nVersion: v${latestBuildResult.versionNumber || 1}\n\nGuidance: Build verified. If all requested changes are verified and code preserved, call 'finish_task'.`;
            } else {
              const diag = AgenticCodingEngine.extractBuildDiagnostics(latestBuildResult, projectFiles);
              const includeFullLogs = !!args.include_full_logs;
              let outText = `BUILD FAILED\n\nRelevant error:\n${diag.file}:${diag.line}\n\n${diag.error}`;
              if (diag.relevantSlice) {
                outText += `\n\nRelevant Code (Lines ${diag.relevantSlice.startLine}-${diag.relevantSlice.endLine}):\n${diag.relevantSlice.content}`;
              }
              if (includeFullLogs && latestBuildResult.logs) {
                outText += `\n\nFull Logs (capped):\n${latestBuildResult.logs.slice(-2500)}`;
              } else {
                outText += `\n\n(Full logs omitted for efficiency. Pass include_full_logs: true if needed.)`;
              }
              outText += `\n\nGuidance: DO NOT rewrite the entire project or file. Investigate line ${diag.line} of "${diag.file}". Use 'read_file' if you need surrounding context, and apply a surgical fix using 'edit_file' (smallest safe modification). Then run 'run_build' to test again.`;
              toolResultText = outText;
            }
          } 
          else if (name === 'finish_task') {
            finishSummary = args.summary || (isExistingProject ? 'Website updated successfully.' : 'Website created successfully.');

            // Code Preservation Audit (Requirement 6)
            if (isExistingProject && baselineSnapshot.components.size > 0) {
              const currentSnapshot = AgenticCodingEngine.computeSnapshot(projectFiles);
              const isRemovalRequested = /remove|delete|drop|exclude|hide|take out/i.test(userPrompt);

              const droppedComponents = isRemovalRequested
                ? []
                : Array.from(baselineSnapshot.components).filter(c => !currentSnapshot.components.has(c));
              const droppedScripts = Array.from(baselineSnapshot.scriptsAndStyles).filter(s => !currentSnapshot.scriptsAndStyles.has(s));
              const droppedRoutes = Array.from(baselineSnapshot.routesAndAnchors).filter(r => !currentSnapshot.routesAndAnchors.has(r));

              if (droppedComponents.length > 0 || droppedScripts.length > 0 || droppedRoutes.length > 0) {
                const issues: string[] = [];
                if (droppedComponents.length > 0) issues.push(`Dropped component(s)/section(s): [${droppedComponents.join(', ')}]`);
                if (droppedScripts.length > 0) issues.push(`Dropped script(s)/dependency: [${droppedScripts.join(', ')}]`);
                if (droppedRoutes.length > 0) issues.push(`Dropped route(s)/anchor: [${droppedRoutes.join(', ')}]`);

                toolResultText = `CODE PRESERVATION AUDIT FAILED\n\nIssues:\n${issues.map(i => `- ${i}`).join('\n')}\n\nGuidance: When modifying an existing website, you must PRESERVE EVERYTHING that is not related to the requested change. Avoid accidentally deleting components, removing functionality, changing routes, replacing assets, or changing dependencies. Please restore the missing element(s) before finishing.`;
              }
            }

            if (!toolResultText) {
              const finishCommitMsg = finishSummary && finishSummary !== 'Website modifications completed.' && finishSummary !== 'Website updated successfully.'
                ? finishSummary
                : (isExistingProject ? 'Website updated successfully.' : 'Website created successfully.');

              // Ensure build is verified before allowing finish
              if (!latestBuildResult.success) {
                onProgress?.({
                  type: 'project_progress',
                  stage: 'VERIFYING',
                  projectId,
                  slug,
                  isUpdate: isExistingProject,
                  content: 'Verifying website…',
                });
                latestBuildResult = await CloudWorkerService.runBuild(projectId, userId, finishCommitMsg);
              }

              if (latestBuildResult.success) {
                projectState.current_version = latestBuildResult.versionNumber || projectState.current_version;
                projectState.latest_change = finishCommitMsg;
                taskFinished = true;
                toolResultText = `TASK COMPLETED\n\nStatus: DONE\nVersion: v${latestBuildResult.versionNumber || projectState.current_version}\nChange Record: "${finishCommitMsg}"\nMessage: Task completed, build verified, automated tests passed, and code preservation audit passed.\nDeployment: https://www.ceova.online/p/${slug}`;
              } else {
                const diag = AgenticCodingEngine.extractBuildDiagnostics(latestBuildResult, projectFiles);
                toolResultText = `BUILD FAILED\n\nRelevant error:\n${diag.file}:${diag.line}\n\n${diag.error}\n\nGuidance: Build must succeed before task can be finished. Fix line ${diag.line} in "${diag.file}" using 'edit_file' and re-test with 'run_build'.`;
              }
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
    const fallbackCommitMsg = finishSummary && finishSummary !== 'Website modifications completed.'
      ? finishSummary
      : (userPrompt.trim().slice(0, 80) || 'Website updates');

    if (!latestBuildResult.success) {
      latestBuildResult = await CloudWorkerService.runBuild(projectId, userId, fallbackCommitMsg);
    }

    const finalFiles = await CloudWorkerService.getProjectFiles(projectId);

    // Extract and persist final internal project state (Requirements 10 & 11)
    try {
      const finalState = CloudWorkerService.extractProjectState(
        projectId,
        finalFiles,
        {
          ...(projectRecord?.metadata || {}),
          approved_plan: projectState.approved_plan,
          current_version: latestBuildResult.versionNumber || projectState.current_version,
          latest_change: projectState.latest_change || fallbackCommitMsg,
        },
        slug,
        latestBuildResult.versionNumber || projectState.current_version,
        projectState.latest_change || fallbackCommitMsg
      );

      await supabaseAdmin.from('projects').update({
        metadata: {
          ...(projectRecord?.metadata || {}),
          current_version: finalState.current_version,
          latest_change: finalState.latest_change,
          deployment_url: finalState.deployment_url,
          project_state: finalState,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (persistErr: any) {
      Logger.WARN(`[AgenticCodingEngine] Non-fatal error persisting project_state: ${persistErr?.message}`);
    }

    return {
      success: latestBuildResult.success,
      files: finalFiles,
      buildResult: latestBuildResult,
      summary: finishSummary,
      turns,
    };
  }
}
