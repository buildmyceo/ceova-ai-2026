/**
 * Memory Gatekeeper (Modern AI Relevance-Gated Memory)
 * 
 * Determines whether a user's message genuinely requires user memory context.
 * Prevents dumping hundreds of tokens of unrelated user facts on general coding,
 * technical Q&A, or casual conversation.
 */

import { IntentRouterResult } from "./intent-router.ts";

export interface MemoryEvaluationResult {
  /** Whether any memory retrieval should be performed */
  shouldRetrieve: boolean;
  /** Specific categories to fetch from memory_summaries (if applicable) */
  targetCategories: string[];
  /** Search terms for full-text search in user_memory_longterm (if applicable) */
  searchQuery?: string;
  /** Primary reason for the retrieval decision */
  reason: 'self_referential' | 'domain_preference' | 'explicit_recall' | 'none';
}

// Patterns that indicate the user is asking about themselves, their profile, or stored facts
const SELF_REFERENTIAL_PATTERNS = [
  /\bwho\s+am\s+i\b/i,
  /\bwhat\s+(?:do\s+you\s+know|do\s+you\s+remember)\s+(?:about\s+me)?\b/i,
  /\bwhat(?:'s|\s+is)\s+my\s+([a-z0-9_\s]{2,25})\b/i,
  /\bdo\s+you\s+remember\s+(?:my|what|that)?\s*([a-z0-9_\s]{2,30})?\b/i,
  /\bmy\s+(?:name|company|business|email|phone|brand|website|location|job|profession|role|budget|goal|preference|preferences|style|address|gst|gstin|family|birthday|age|dog|cat|pet)\b/i,
  /\b(?:for\s+my|about\s+my)\s+(?:company|business|brand|website|project|store|app|startup)\b/i,
  /\bas\s+(?:we\s+discussed|i\s+told\s+you|i\s+mentioned)\b/i,
  /\baccording\s+to\s+my\s+(?:preferences|profile|info)\b/i,
];

// Patterns for purely generic/technical queries that NEVER need user memory
const GENERIC_QUERY_PATTERNS = [
  /^(?:how\s+to|how\s+do\s+i|how\s+does|what\s+is|what\s+are|explain|why\s+does|difference\s+between)\s+[a-z0-9\s_-]+$/i,
  /^(?:write|create|implement|give\s+me)\s+(?:a|an)\s+(?:function|algorithm|script|regex|snippet|code|query|example)\s*(?:in|for)?\s*[a-z0-9#+.]*$/i,
  /^(?:sort|reverse|filter|parse|convert|calculate|sum|count|find)\s+[a-z0-9\s_-]+$/i,
  /^(?:npm|yarn|pnpm|git|docker|pip|curl|cargo|deno)\s+[a-z0-9\s_.-]+$/i,
];

export class MemoryGate {
  /**
   * Evaluates whether memory retrieval is necessary for the current turn.
   */
  static evaluate(message: string, intent?: IntentRouterResult): MemoryEvaluationResult {
    const trimmed = (message || '').trim();

    // Gate 1: Empty input check
    if (!trimmed) {
      return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
    }

    // Gate 2: Explicit self-referential check (Highest priority: user asks about themselves)
    for (const pattern of SELF_REFERENTIAL_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        // Extract specific search terms if present
        let searchQuery = match[1]?.trim();
        if (!searchQuery) {
          // If no capture group, extract key terms
          const words = trimmed.replace(/[?!.,]/g, '').split(/\s+/).filter(w => w.length > 2);
          searchQuery = words.slice(-3).join(' ');
        }
        return {
          shouldRetrieve: true,
          targetCategories: ['overview', 'business_context', 'design_preferences'],
          searchQuery: searchQuery || trimmed,
          reason: 'self_referential',
        };
      }
    }

    // Gate 3: Casual chat never retrieves memory
    if (intent?.isCasualChat) {
      return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
    }

    // Gate 3: Generic technical questions with no personal pronouns reject memory retrieval
    const isGeneric = GENERIC_QUERY_PATTERNS.some(p => p.test(trimmed));
    const hasPersonalPronoun = /\b(my|i|me|mine|myself)\b/i.test(trimmed);
    if (isGeneric && !hasPersonalPronoun) {
      return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
    }

    // Gate 4: Intent-based domain preference matching
    // Only load domain preferences if the user is performing an action in that domain
    if (intent && intent.memoryCategories && intent.memoryCategories.length > 0) {
      const activeTools = intent.toolIds || [];
      const categories: string[] = [];

      // E.g., Creating or redesigning a website needs design preferences
      if (activeTools.includes('create_project') || trimmed.match(/\b(design|website|landing page|theme|color palette|brand)\b/i)) {
        categories.push('design_preferences', 'current_projects');
      }

      // Email tasks only need email/contacts
      if (activeTools.includes('gmail_connector') || trimmed.match(/\b(email|mail|inbox|send email)\b/i)) {
        categories.push('email', 'contacts');
      }

      // Scheduling tasks only need calendar/work schedule
      if (activeTools.includes('calendar_connector') || trimmed.match(/\b(meeting|schedule|calendar|appointment)\b/i)) {
        categories.push('calendar', 'work_schedule');
      }

      if (categories.length > 0) {
        return {
          shouldRetrieve: true,
          targetCategories: [...new Set(categories)],
          reason: 'domain_preference',
        };
      }
    }

    // Default: Zero memory retrieval for general messages without personal context
    return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
  }
}
