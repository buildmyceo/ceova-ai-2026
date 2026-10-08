/**
 * Ceova Memory Retriever (Gemini / ChatGPT Architecture)
 * 
 * Provides persistent memory across all conversations.
 * If personalization / memory is enabled, key remembered facts (Profile, Business,
 * Preferences, General facts) are seamlessly provided in the model's background context.
 * Targeted FTS search is performed if the user query contains specific keywords.
 */

import { IntentRouterResult } from "./intent-router.ts";

export interface MemoryRetrievalOptions {
  maxTokens?: number;
  maxItems?: number;
}

export class MemoryRetriever {
  /**
   * Retrieves relevant memory context for a given message and user.
   * Returns formatted background facts if memory is enabled and facts exist.
   */
  static async getRelevantContext(
    supabaseAdmin: any,
    userId: string,
    message: string,
    _intent?: IntentRouterResult,
    options: MemoryRetrievalOptions = {}
  ): Promise<string> {
    if (!supabaseAdmin || !userId) return '';

    const maxTokens = options.maxTokens || 450;
    const maxItems = options.maxItems || 12;
    const retrievedFacts: string[] = [];
    const seenValues = new Set<string>();

    const addFact = (category: string, title: string, value: string) => {
      const normalized = (value || '').trim().toLowerCase();
      if (!normalized || seenValues.has(normalized)) return;
      seenValues.add(normalized);
      retrievedFacts.push(`• [${category || 'General'}] ${title ? `${title}: ` : ''}${value.trim()}`);
    };

    // 1. Core Saved Facts from user_memory_longterm (Persistent cross-chat memory)
    try {
      const { data: directMemories, error: directErr } = await supabaseAdmin
        .from('user_memory_longterm')
        .select('category, title, value')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(maxItems);

      if (!directErr && Array.isArray(directMemories) && directMemories.length > 0) {
        for (const m of directMemories) {
          if (m.value) {
            addFact(m.category, m.title, m.value);
          }
        }
      }
    } catch (e: any) {
      console.warn('[MemoryRetriever] Core memory query skipped:', e.message);
    }

    // 2. Targeted Full-Text Search if message has specific search keywords
    const trimmedMsg = (message || '').trim();
    if (trimmedMsg.length >= 3 && retrievedFacts.length < maxItems) {
      try {
        const cleanQuery = trimmedMsg.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        const words = cleanQuery.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          const searchTerm = words.slice(0, 3).join(' ');
          const { data: ftsMatches, error: ftsErr } = await supabaseAdmin.rpc('search_memory_longterm_fts', {
            search_query: searchTerm,
            user_id_filter: userId,
            max_results: 5
          });

          if (!ftsErr && Array.isArray(ftsMatches) && ftsMatches.length > 0) {
            for (const m of ftsMatches) {
              if (m.value) {
                addFact(m.category, m.title, m.value);
              }
            }
          }
        }
      } catch (e: any) {
        console.warn('[MemoryRetriever] FTS memory search skipped:', e.message);
      }
    }

    // 3. Category Summaries (if any exist in memory_summaries)
    if (retrievedFacts.length < maxItems) {
      try {
        const { data: summaryRows } = await supabaseAdmin
          .from('memory_summaries')
          .select('category, summary')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(2);

        if (Array.isArray(summaryRows) && summaryRows.length > 0) {
          const LABELS: Record<string, string> = {
            overview: 'Overview',
            current_projects: 'Active Project',
            design_preferences: 'Design Preference',
            development_tools: 'Dev Preference',
            business_context: 'Business Context',
          };

          for (const row of summaryRows) {
            if (row.summary) {
              const label = LABELS[row.category] || row.category || 'Context';
              addFact('Summary', label, row.summary);
            }
          }
        }
      } catch {}
    }

    // 4. Knowledge documents fallback if query explicitly asks about documents
    if (/\b(document|note|docs|pdf|knowledge|file)\b/i.test(trimmedMsg)) {
      try {
        const { data: docs } = await supabaseAdmin.rpc('search_knowledge_memory_fts', {
          search_query: trimmedMsg,
          user_id_filter: userId,
          max_results: 1
        });
        if (Array.isArray(docs) && docs.length > 0 && docs[0]?.content) {
          addFact('Document', 'Relevant Note', docs[0].content.slice(0, 200));
        }
      } catch {}
    }

    if (retrievedFacts.length === 0) {
      return '';
    }

    // Assemble clean block respecting token budget
    const blockHeader = 'USER SAVED MEMORIES (Personal facts & context remembered across chats):\n';
    const charBudget = maxTokens * 4; // ~4 chars per token
    let currentChars = blockHeader.length;

    const includedLines: string[] = [];
    for (const fact of retrievedFacts) {
      const line = fact.trim();
      if (currentChars + line.length + 1 > charBudget) break;
      includedLines.push(line);
      currentChars += line.length + 1;
    }

    if (includedLines.length === 0) return '';

    return `\n\n${blockHeader}${includedLines.join('\n')}\nMEMORY GUIDELINES:\n- You remember the above facts about the user across conversations.\n- When the user asks about their identity, startup, business, projects, preferences, or past context (e.g. "what's my startup?", "whats its name?", "who am I?"), always answer accurately using their saved facts.\n- Never state that you don't know or don't have records of information that is stored in their saved memories above.\n`;
  }
}
