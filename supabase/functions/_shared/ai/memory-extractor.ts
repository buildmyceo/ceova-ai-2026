/**
 * Instant Deterministic Memory Extractor
 * 
 * Extracts high-confidence factual statements (name, company, location, preferences,
 * explicit "remember that...") directly from the user's message and commits them
 * to user_memory_longterm in < 5ms using supabaseAdmin.
 */

export interface ExtractedFact {
  category: 'Profile' | 'Business' | 'Preference' | 'General';
  title: string;
  value: string;
  confidence: number;
}

const DETERMINISTIC_EXTRACTION_RULES: Array<{
  category: 'Profile' | 'Business' | 'Preference' | 'General';
  title: string | ((m: RegExpMatchArray) => string);
  regex: RegExp;
  extract: (m: RegExpMatchArray) => string;
}> = [
  // ── Name ─────────────────────────────────────────────────────────────────
  {
    category: 'Profile',
    title: 'User Name',
    regex: /(?:my name(?:\s+is)?|you know my name is|you know i am|call me|i'm called|remember my name is|set my name to)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    extract: (m) => m[1].trim()
  },
  // ── Company / Business ───────────────────────────────────────────────────
  {
    category: 'Business',
    title: 'Business Name',
    regex: /(?:my (?:company|business|startup|project)(?:\s+name)?(?:\s+(?:is|called|named))?(?:\s+(?:called|named))?)\s+([A-Za-z0-9\s._&-]{2,50})/i,
    extract: (m) => m[1].trim().replace(/^(?:called|named|is called|is named)\s+/i, '').replace(/[.!?]+$/, '')
  },
  {
    category: 'Business',
    title: 'Profession/Role',
    regex: /(?:i work (?:at|for)|i founded|i am the (?:founder|ceo|owner|creator|director) of)\s+([A-Za-z0-9\s._&-]{2,50})/i,
    extract: (m) => m[1].trim().replace(/[.!?]+$/, '')
  },
  // ── Location ─────────────────────────────────────────────────────────────
  {
    category: 'Profile',
    title: 'Location',
    regex: /(?:i (?:live|reside) in|i'm based in|i am based in|my city is|my location is|i'm from|i am from)\s+([A-Za-z\s,.-]{2,50})/i,
    extract: (m) => m[1].trim().replace(/[.!?]+$/, '')
  },
  // ── Preferences ──────────────────────────────────────────────────────────
  {
    category: 'Preference',
    title: 'User Preference',
    regex: /(?:i prefer|i always use|i like using)\s+([^.!?\n]{3,80})/i,
    extract: (m) => m[1].trim().replace(/[.!?]+$/, '')
  },
  // ── Explicit Memorization ("remember that ...") ──────────────────────────
  {
    category: 'General',
    title: (m) => {
      const text = m[1].trim();
      const firstFewWords = text.split(/\s+/).slice(0, 4).join(' ');
      return `Fact: ${firstFewWords}`;
    },
    regex: /(?:remember\s+(?:that|this)?|save\s+(?:this|that)?|note\s+(?:that|this)?|please\s+remember(?:\s+that)?)\s*[:\-]?\s*([^.!?\n]{4,150})/i,
    extract: (m) => m[1].trim().replace(/[.!?]+$/, '')
  }
];

export class MemoryExtractor {
  /**
   * Fast regex-based factual extractor.
   * Returns array of extracted facts, or empty array if no explicit facts present.
   */
  static extractFacts(text: string): ExtractedFact[] {
    if (!text || typeof text !== 'string') return [];
    const trimmed = text.trim();
    if (trimmed.length < 3) return [];

    const facts: ExtractedFact[] = [];
    for (const rule of DETERMINISTIC_EXTRACTION_RULES) {
      const match = trimmed.match(rule.regex);
      if (match) {
        const val = rule.extract(match);
        if (val && val.length >= 2) {
          // Avoid common false positives (e.g. "I prefer not to", "I live in fear")
          if (/^(not to|no|nothing|that|it|them|this)$/i.test(val)) continue;

          const title = typeof rule.title === 'function' ? rule.title(match) : rule.title;
          
          // If a business name statement also describes what they build or do, split cleanly
          if (title === 'Business Name' && /\s+(?:and\s+we\s+(?:build|make|create|do|sell)|which\s+builds)\s+/i.test(val)) {
            const parts = val.split(/\s+(?:and\s+we\s+(?:build|make|create|do|sell)|which\s+builds)\s+/i);
            const bName = parts[0]?.trim();
            const bProd = parts[1]?.trim();
            if (bName) {
              facts.push({
                category: 'Business',
                title: 'Business Name',
                value: bName.slice(0, 100),
                confidence: 1.0
              });
            }
            if (bProd) {
              facts.push({
                category: 'Business',
                title: 'Startup Product / Focus',
                value: bProd.slice(0, 300),
                confidence: 1.0
              });
            }
            continue;
          }

          facts.push({
            category: rule.category,
            title: title.slice(0, 100),
            value: val.slice(0, 500),
            confidence: 1.0
          });
        }
      }
    }
    return facts;
  }

  /**
   * Instantly upserts deterministic facts into `user_memory_longterm`.
   * Executed synchronously before/during prompt processing with zero external HTTP latency.
   */
  static async extractAndSaveSync(
    supabaseAdmin: any,
    userId: string,
    message: string
  ): Promise<ExtractedFact[]> {
    if (!supabaseAdmin || !userId || !message) return [];

    const facts = this.extractFacts(message);
    if (facts.length === 0) return [];

    for (const fact of facts) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('user_memory_longterm')
          .select('id')
          .eq('user_id', userId)
          .eq('title', fact.title)
          .maybeSingle();

        if (existing?.id) {
          await supabaseAdmin
            .from('user_memory_longterm')
            .update({
              value: fact.value,
              updated_at: new Date().toISOString(),
              last_accessed: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabaseAdmin
            .from('user_memory_longterm')
            .insert({
              user_id: userId,
              category: fact.category,
              title: fact.title,
              value: fact.value,
              confidence: fact.confidence
            });
        }
        console.info(`[MemoryExtractor] Persisted memory fact [${fact.title}: ${fact.value}] for user ${userId}`);
      } catch (e: any) {
        console.warn(`[MemoryExtractor] Failed to persist memory fact:`, e.message);
      }
    }

    return facts;
  }
}
