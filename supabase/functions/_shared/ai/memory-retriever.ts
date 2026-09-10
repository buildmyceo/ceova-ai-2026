/**
 * Modern AI Memory Retriever
 * 
 * Implements Just-In-Time (JIT) and Relevance-Gated memory retrieval.
 * Instead of dumping all 1,200 tokens of user summaries on every prompt,
 * it queries only targeted facts matching the current context, capped at < 100 tokens.
 */

import { MemoryGate, MemoryEvaluationResult } from "./memory-gate.ts";
import { IntentRouterResult } from "./intent-router.ts";

export interface MemoryRetrievalOptions {
  maxTokens?: number;
  maxItems?: number;
}

export class MemoryRetriever {
  /**
   * Retrieves relevant memory context for a given message and user.
   * Returns an empty string if memory is not relevant (0 tokens consumed).
   */
  static async getRelevantContext(
    supabase: any,
    userId: string,
    message: string,
    intent?: IntentRouterResult,
    options: MemoryRetrievalOptions = {}
  ): Promise<string> {
    if (!supabase || !userId || !message) return '';

    const evaluation: MemoryEvaluationResult = MemoryGate.evaluate(message, intent);
    if (!evaluation.shouldRetrieve) {
      return '';
    }

    const maxTokens = options.maxTokens || 120;
    const maxItems = options.maxItems || 3;
    const retrievedFacts: string[] = [];

    // Strategy 1: Targeted Full-Text Search for explicit/self-referential queries
    if (evaluation.searchQuery) {
      try {
        const { data: ftsMatches, error: ftsErr } = await supabase.rpc('search_memory_longterm_fts', {
          search_query: evaluation.searchQuery,
          user_id_filter: userId,
          max_results: maxItems
        });

        if (!ftsErr && Array.isArray(ftsMatches) && ftsMatches.length > 0) {
          for (const m of ftsMatches) {
            if (m.title && m.value) {
              retrievedFacts.push(`• [${m.category || 'Profile'}] ${m.title}: ${m.value}`);
            }
          }
        }
      } catch (e: any) {
        console.warn('[MemoryRetriever] FTS memory search skipped:', e.message);
      }
    }

    // Strategy 2: Category-Scoped Summaries for domain tasks (e.g. design preferences when building website)
    if (retrievedFacts.length < maxItems && evaluation.targetCategories.length > 0) {
      try {
        const { data: summaryRows, error: sumErr } = await supabase
          .from('memory_summaries')
          .select('category, summary')
          .eq('user_id', userId)
          .in('category', evaluation.targetCategories)
          .order('updated_at', { ascending: false })
          .limit(2);

        if (!sumErr && Array.isArray(summaryRows) && summaryRows.length > 0) {
          const LABELS: Record<string, string> = {
            overview: 'Overview',
            current_projects: 'Active Project',
            design_preferences: 'Design Preference',
            development_tools: 'Dev Preference',
            business_context: 'Business Context',
          };

          for (const row of summaryRows) {
            if (row.summary && !retrievedFacts.some(f => f.includes(row.summary.slice(0, 20)))) {
              const label = LABELS[row.category] || row.category;
              retrievedFacts.push(`• [${label}] ${row.summary}`);
            }
          }
        }
      } catch (e: any) {
        console.warn('[MemoryRetriever] Category summary fetch skipped:', e.message);
      }
    }

    // Strategy 3: Check knowledge documents if query explicitly mentions documents or notes
    if (retrievedFacts.length === 0 && /\b(document|note|docs|pdf|knowledge|file)\b/i.test(message)) {
      try {
        const { data: docs } = await supabase.rpc('search_knowledge_memory_fts', {
          search_query: message,
          user_id_filter: userId,
          max_results: 1
        });
        if (Array.isArray(docs) && docs.length > 0 && docs[0]?.content) {
          retrievedFacts.push(`• [Document] ${docs[0].content.slice(0, 200)}`);
        }
      } catch {}
    }

    if (retrievedFacts.length === 0) {
      return '';
    }

    // Assemble ultra-lean block respecting token budget
    let block = 'RELEVANT USER CONTEXT (use only if directly relevant to user request):\n';
    let charBudget = maxTokens * 4; // ~4 chars per token
    let currentChars = block.length;

    const includedLines: string[] = [];
    for (const fact of retrievedFacts) {
      const line = fact.trim();
      if (currentChars + line.length + 1 > charBudget) {
        // Truncate fact if budget reached
        const allowed = charBudget - currentChars - 10;
        if (allowed > 30) {
          includedLines.push(line.slice(0, allowed) + '…');
        }
        break;
      }
      includedLines.push(line);
      currentChars += line.length + 1;
    }

    if (includedLines.length === 0) return '';
    return `\n\n${block}${includedLines.join('\n')}\n`;
  }
}
