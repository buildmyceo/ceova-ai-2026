/**
 * CEOVA Context Reconstruction Service (Requirement 14)
 * 
 * "Do not confuse context with memory.
 * The model should not be expected to permanently remember the entire website.
 * Instead:
 * Persistent project state
 *         +
 * Project files
 *         +
 * Search/read tools
 *         +
 * Current conversation/task
 *         +
 * Version information
 *         ↓
 * GPT-6 Luna
 * This allows the agent to reconstruct the context it needs for each task."
 */

import { ProjectFile, ProjectState } from "../worker/worker-service.ts";

export interface ReconstructedContextParams {
  projectState: ProjectState;
  projectFiles: ProjectFile[];
  userTask: string;
  projectName: string;
  slug: string;
  projectId: string;
  currentVersion: number;
  latestChange: string;
  versionHistory?: Array<{ version: number; description: string; created_at?: string }>;
  isHistoryQuery?: boolean;
}

export interface ReconstructedContext {
  persistentProjectState: ProjectState;
  filesIndex: string;
  searchReadToolsSummary: string;
  currentTaskContext: string;
  versionInformation: {
    currentVersion: number;
    latestChange: string;
    versionHistorySummary: string;
  };
  formattedContext: string;
}

export class ContextReconstructionService {
  /**
   * Reconstructs the 5-pillar context for GPT-6 Luna on-demand
   */
  public static reconstruct(params: ReconstructedContextParams): ReconstructedContext {
    const {
      projectState,
      projectFiles,
      userTask,
      projectName,
      slug,
      projectId,
      currentVersion,
      latestChange,
      versionHistory = [],
      isHistoryQuery = false
    } = params;

    // 1. Pillar 1: Persistent Project State
    const stateSummary = `
  • framework: "${projectState.framework || 'vanilla-html'}"
  • build_system: "${projectState.build_system || 'static-edge-bundler'}"
  • entry_points: [${(projectState.entry_points || ['index.html']).join(', ')}]
  • routes: [${(projectState.routes || ['/']).join(', ')}]
  • pages: [${(projectState.pages || ['index.html']).join(', ')}]
  • components: [${(projectState.components || []).join(', ')}]
  • assets: ${(projectState.assets || []).length} tracked asset(s)
  • current_version: v${currentVersion}
  • latest_change: "${latestChange}"
  • approved_plan: ${projectState.approved_plan ? 'Active approved plan' : 'Baseline plan'}
  • deployment_url: "https://www.ceova.online/p/${slug}"`.trim();

    // 2. Pillar 2: Project Files Index (Paths, sizes, line counts - NO raw code dumps)
    const filesIndex = projectFiles.length > 0
      ? projectFiles.map(f => {
          const lines = (f.content || '').split('\n').length;
          const bytes = (f.content || '').length;
          return `  - ${f.path} (${bytes} bytes, ${lines} lines)`;
        }).join('\n')
      : '  - index.html (entry file)';

    // 3. Pillar 3: Search/Read Tools
    const searchReadToolsSummary = `
  - search_code: Query the codebase with regex/substring to pinpoint file and line numbers.
  - read_file: Retrieve targeted slices of code (start_line, end_line) without dumping entire files.
  - edit_file: Apply surgical modifications (- old + new).
  - run_build: Compile, bundle, and test updates with instant status and diagnostic extraction.`.trim();

    // 4. Pillar 4: Current Conversation / Task
    const currentTaskContext = `User Request: "${userTask}"`.trim();

    // 5. Pillar 5: Version Information
    let versionHistorySummary = `v${currentVersion} (Latest: "${latestChange}")`;
    if (isHistoryQuery && Array.isArray(versionHistory) && versionHistory.length > 0) {
      const recent = versionHistory.slice(-10);
      versionHistorySummary += `\n  Recent versions:\n${recent.map(v => `    • v${v.version}: ${v.description}`).join('\n')}`;
    }

    // ── Assembled 5-Pillar Context ──────────────────────────────────────────
    const formattedContext = `
================================================================================
RECONSTRUCTED PROJECT CONTEXT (MANDATORY REQUIREMENT 14):
The model is stateless and is not expected to permanently remember the entire website.
Instead, context is dynamically reconstructed for each task via the 5-pillar architecture:
Persistent project state + Project files + Search/read tools + Current task + Version info → GPT-6 Luna

[PILLAR 1: PERSISTENT PROJECT STATE]
${stateSummary}

[PILLAR 2: PROJECT FILES INDEX (Source code not pre-loaded; inspect on demand)]
${filesIndex}

[PILLAR 3: SEARCH / READ TOOLS (Progressive retrieval)]
${searchReadToolsSummary}

[PILLAR 4: CURRENT TASK]
${currentTaskContext}

[PILLAR 5: VERSION INFORMATION]
${versionHistorySummary}
================================================================================
`.trim();

    return {
      persistentProjectState: projectState,
      filesIndex,
      searchReadToolsSummary,
      currentTaskContext,
      versionInformation: {
        currentVersion,
        latestChange,
        versionHistorySummary
      },
      formattedContext
    };
  }
}
