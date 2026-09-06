/**
 * Token Optimization Service (Requirement 15: Optimize for token efficiency)
 * 
 * Implements the architecture so repeated requests do not unnecessarily resend unchanged code.
 * 
 * Prefer:
 *   small stable project context
 *   +
 *   targeted retrieved code
 *   +
 *   current task
 *   +
 *   relevant previous result
 * 
 * Instead of:
 *   entire project
 *   +
 *   entire chat history
 *   +
 *   entire build logs
 *   +
 *   entire previous responses
 * 
 * Note: Leverages OpenAI native Prompt Caching (prompts >= 1,024 tokens with static prefix)
 * without implementing redundant custom caching engines.
 */

export interface LeanContextParams {
  stableProjectContext: {
    projectId: string;
    projectName: string;
    slug: string;
    currentVersion: number;
    deploymentUrl: string;
    framework?: string;
    buildSystem?: string;
    entryPoints?: string[];
    routes?: string[];
    components?: string[];
  };
  targetedRetrievedCode?: {
    path: string;
    startLine: number;
    endLine: number;
    content: string;
  } | null;
  currentTask: {
    message: string;
    scope?: string;
  };
  relevantPreviousResult?: {
    status: 'SUCCESS' | 'FAILED' | 'MODIFIED';
    summary: string;
    relevantError?: string;
  } | null;
}

export interface CompactHistoryOptions {
  isExistingProject?: boolean;
  maxMessages?: number;
  maxCharsPerMessage?: number;
}

export class TokenOptimizerService {
  /**
   * Formats the 4-component lean context required by Requirement 15.
   * Eliminates the anti-pattern of sending entire project + chat history + build logs + responses.
   */
  static formatLeanContext(params: LeanContextParams): {
    smallStableProjectContext: string;
    targetedRetrievedCode: string;
    currentTask: string;
    relevantPreviousResult: string;
    combined: string;
    estimatedTokens: number;
  } {
    const { stableProjectContext, targetedRetrievedCode, currentTask, relevantPreviousResult } = params;

    // Component 1: Small Stable Project Context (Prefix for prompt caching)
    const smallStableProjectContext = [
      `=== 1. SMALL STABLE PROJECT CONTEXT ===`,
      `• Project: "${stableProjectContext.projectName}" (ID: ${stableProjectContext.projectId})`,
      `• URL: ${stableProjectContext.deploymentUrl}`,
      `• Version: v${stableProjectContext.currentVersion}`,
      `• Framework / Build: ${stableProjectContext.framework || 'vanilla-html'} / ${stableProjectContext.buildSystem || 'static-edge-bundler'}`,
      `• Entry Points: [${(stableProjectContext.entryPoints || ['index.html']).join(', ')}]`,
      `• Routes: [${(stableProjectContext.routes || ['/']).join(', ')}]`,
      `• Components: [${(stableProjectContext.components || ['navbar', 'hero', 'about', 'menu', 'contact', 'footer']).join(', ')}]`,
      `(Full project code is excluded to maintain token efficiency; inspect targeted slices via search/read tools).`
    ].join('\n');

    // Component 2: Targeted Retrieved Code
    const targetedRetrievedCodeText = targetedRetrievedCode
      ? [
          `=== 2. TARGETED RETRIEVED CODE ===`,
          `File: ${targetedRetrievedCode.path} (Lines ${targetedRetrievedCode.startLine}-${targetedRetrievedCode.endLine}):`,
          targetedRetrievedCode.content,
        ].join('\n')
      : `=== 2. TARGETED RETRIEVED CODE ===\n(No code slice active yet; use search_code or read_file to retrieve only relevant lines).`;

    // Component 3: Current Task
    const currentTaskText = [
      `=== 3. CURRENT TASK ===`,
      `• User Request: "${currentTask.message}"`,
      `• Task Scope: ${(currentTask.scope || 'simple').toUpperCase()}`
    ].join('\n');

    // Component 4: Relevant Previous Result
    const relevantPreviousResultText = relevantPreviousResult
      ? [
          `=== 4. RELEVANT PREVIOUS RESULT ===`,
          `• Status: ${relevantPreviousResult.status}`,
          `• Summary: ${relevantPreviousResult.summary}`,
          relevantPreviousResult.relevantError ? `• Diagnostic: ${relevantPreviousResult.relevantError}` : ''
        ].filter(Boolean).join('\n')
      : `=== 4. RELEVANT PREVIOUS RESULT ===\n• Initial turn (baseline website deployed and ready).`;

    const combined = [
      `[OPTIMIZED LEAN CONTEXT (Requirement 15: Optimize for token efficiency)]`,
      smallStableProjectContext,
      targetedRetrievedCodeText,
      currentTaskText,
      relevantPreviousResultText,
      `[END LEAN CONTEXT - ZERO REDUNDANT SOURCE / LOG DUMPS]`
    ].join('\n\n');

    return {
      smallStableProjectContext,
      targetedRetrievedCode: targetedRetrievedCodeText,
      currentTask: currentTaskText,
      relevantPreviousResult: relevantPreviousResultText,
      combined,
      estimatedTokens: Math.ceil(combined.length / 4)
    };
  }

  /**
   * Compacts conversation history for repeated requests (e.g. in super-endpoint).
   * Strips bloated code blocks, full HTML files, and multi-page plans from older turns.
   */
  static compactConversationHistory(
    history: any[],
    options: CompactHistoryOptions = {}
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!Array.isArray(history) || history.length === 0) {
      return [];
    }

    const {
      isExistingProject = true,
      maxMessages = 8,
      maxCharsPerMessage = 600
    } = options;

    const slice = history.slice(-maxMessages);

    return slice.map((msg: any, index: number) => {
      const isLatestTurn = index >= slice.length - 2;
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      let content = typeof msg.content === 'string' ? msg.content : '';

      if (role === 'assistant') {
        // Strip out large code blocks (```html ... ```, ```javascript ... ```, etc.)
        content = content.replace(/```[a-zA-Z]*\n[\s\S]*?\n```/g, (match) => {
          // If latest turn and short, keep it; otherwise replace with lean summary
          if (isLatestTurn && match.length < 250) return match;
          return `[Code block omitted for token efficiency; targeted files available in project workspace]`;
        });

        // Strip repetitive website implementation plans from older turns
        if (!isLatestTurn && content.includes('### Website Implementation Plan')) {
          content = content.replace(
            /### Website Implementation Plan[\s\S]*?(?=Would you like me to proceed|$)/i,
            '[Previous Website Implementation Plan approved]'
          );
        }

        // If older message exceeds limit, truncate cleanly
        if (!isLatestTurn && content.length > maxCharsPerMessage) {
          content = content.slice(0, maxCharsPerMessage).trim() + ' ... [Older response compacted for token efficiency]';
        }
      } else {
        // User message — NEVER truncate user messages.
        // User specs, requirements, and prompts are the most critical context.
        // Truncating them causes the AI to ask for "missing" information that was already provided.
        // Only compact if truly enormous (> 8000 chars) AND not recent.
        if (!isLatestTurn && content.length > 8000) {
          content = content.slice(0, 8000).trim() + ' ... [Very long spec compacted — earlier portions preserved in project context]';
        }
      }

      return {
        role,
        content: content.trim()
      };
    }).filter(m => m.content.length > 0);
  }

  /**
   * Prunes intermediate messages in the agentic coding loop across turns.
   * Keeps the static prefix intact (system prompt + initial user task) for OpenAI prompt caching,
   * while pruning obsolete intermediate file reads and old build logs.
   */
  static pruneAgentLoopMessages(messages: any[]): any[] {
    if (!messages || messages.length <= 4) {
      return messages;
    }

    // messages[0] = system prompt (prefix)
    // messages[1] = initial user request
    const pruned: any[] = [messages[0], messages[1]];

    // Examine subsequent turns
    const remaining = messages.slice(2);
    const recentCutoff = Math.max(0, remaining.length - 4); // Keep last 4 messages in full

    for (let i = 0; i < remaining.length; i++) {
      const msg = remaining[i];
      const isRecent = i >= recentCutoff;

      if (isRecent) {
        pruned.push(msg);
        continue;
      }

      // Prune older tool result messages
      if (msg.role === 'tool') {
        let content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

        // Compress older read_file outputs (> 300 chars)
        if (msg.name === 'read_file' && content.length > 300) {
          try {
            const parsed = JSON.parse(content);
            pruned.push({
              ...msg,
              content: JSON.stringify({
                path: parsed.path,
                start_line: parsed.start_line,
                end_line: parsed.end_line,
                lines_read: parsed.lines_read,
                note: '[Code slice content pruned from turn history to preserve token budget. File is available in workspace.]'
              })
            });
            continue;
          } catch {
            pruned.push({
              ...msg,
              content: `[File slice read output pruned for token efficiency; file is in workspace]`
            });
            continue;
          }
        }

        // Compress older build failure logs
        if ((msg.name === 'run_build' || msg.name === 'deploy_website') && content.includes('BUILD FAILED')) {
          const firstTwoLines = content.split('\n').slice(0, 4).join('\n');
          pruned.push({
            ...msg,
            content: `${firstTwoLines}\n(Historical error details pruned for token efficiency)`
          });
          continue;
        }

        pruned.push(msg);
      } else if (msg.role === 'assistant') {
        // If older assistant message has verbose reasoning content, truncate reasoning but keep tool_calls strictly intact
        if (msg.content && msg.content.length > 400 && msg.tool_calls) {
          pruned.push({
            ...msg,
            content: msg.content.slice(0, 200) + '... [Reasoning condensed for token efficiency]'
          });
        } else {
          pruned.push(msg);
        }
      } else {
        pruned.push(msg);
      }
    }

    return pruned;
  }

  /**
   * Estimate token count (~4 characters per token)
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculates token reduction metrics between bloated vs lean contexts
   */
  static calculateSavings(bloatedChars: number, leanChars: number) {
    const bloatedTokens = Math.ceil(bloatedChars / 4);
    const leanTokens = Math.ceil(leanChars / 4);
    const savedTokens = Math.max(0, bloatedTokens - leanTokens);
    const percentage = bloatedTokens > 0 ? Math.round((savedTokens / bloatedTokens) * 100) : 0;

    return {
      bloatedTokens,
      leanTokens,
      savedTokens,
      percentage
    };
  }
}
