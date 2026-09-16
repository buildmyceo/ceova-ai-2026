// Automated Test Suite for Modern AI Memory System (Gatekeeper & JIT Retrieval)

console.log("====================================================================");
console.log("TEST SUITE: Modern AI Relevance-Gated Memory Retrieval System");
console.log("====================================================================");

let passedCount = 0;
let totalCount = 0;

function assert(condition, description) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ FAILED: ${description}`);
  }
}

// Replicate MemoryGate logic for pure Node.js test execution
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

const GENERIC_QUERY_PATTERNS = [
  /^(?:how\s+to|how\s+do\s+i|how\s+does|what\s+is|what\s+are|explain|why\s+does|difference\s+between)\s+[a-z0-9\s_-]+$/i,
  /^(?:write|create|implement|give\s+me)\s+(?:a|an)\s+(?:function|algorithm|script|regex|snippet|code|query|example)\s*(?:in|for)?\s*[a-z0-9#+.]*$/i,
  /^(?:sort|reverse|filter|parse|convert|calculate|sum|count|find)\s+[a-z0-9\s_-]+$/i,
  /^(?:npm|yarn|pnpm|git|docker|pip|curl|cargo|deno)\s+[a-z0-9\s_.-]+$/i,
];

class MemoryGate {
  static evaluate(message, intent) {
    const trimmed = (message || '').trim();
    if (!trimmed || intent?.isCasualChat) {
      return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
    }

    for (const pattern of SELF_REFERENTIAL_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        let searchQuery = match[1]?.trim();
        if (!searchQuery) {
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

    const isGeneric = GENERIC_QUERY_PATTERNS.some(p => p.test(trimmed));
    const hasPersonalPronoun = /\b(my|i|me|mine|myself)\b/i.test(trimmed);
    if (isGeneric && !hasPersonalPronoun) {
      return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
    }

    if (intent && intent.memoryCategories && intent.memoryCategories.length > 0) {
      const activeTools = intent.toolIds || [];
      const categories = [];

      if (activeTools.includes('create_project') || trimmed.match(/\b(design|website|landing page|theme|color palette|brand)\b/i)) {
        categories.push('design_preferences', 'current_projects');
      }
      if (activeTools.includes('gmail_connector') || trimmed.match(/\b(email|mail|inbox|send email)\b/i)) {
        categories.push('email', 'contacts');
      }
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

    return { shouldRetrieve: false, targetCategories: [], reason: 'none' };
  }
}

class MemoryRetriever {
  static async getRelevantContext(supabaseMock, userId, message, intent, options = {}) {
    const evaluation = MemoryGate.evaluate(message, intent);
    if (!evaluation.shouldRetrieve) {
      return '';
    }

    const maxTokens = options.maxTokens || 120;
    const maxItems = options.maxItems || 3;
    const retrievedFacts = [];

    if (evaluation.searchQuery) {
      const ftsMatches = await supabaseMock.rpc('search_memory_longterm_fts', { search_query: evaluation.searchQuery });
      if (Array.isArray(ftsMatches)) {
        for (const m of ftsMatches) {
          if (m.title && m.value) {
            retrievedFacts.push(`• [${m.category || 'Profile'}] ${m.title}: ${m.value}`);
          }
        }
      }
    }

    if (retrievedFacts.length < maxItems && evaluation.targetCategories.length > 0) {
      const { data: rows } = await supabaseMock
        .from('memory_summaries')
        .select('category, summary')
        .eq('user_id', userId)
        .in('category', evaluation.targetCategories)
        .order('updated_at', { ascending: false })
        .limit(2);

      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row.summary) {
            retrievedFacts.push(`• [${row.category}] ${row.summary}`);
          }
        }
      }
    }

    if (retrievedFacts.length === 0) return '';

    let block = 'RELEVANT USER CONTEXT (use only if directly relevant to user request):\n';
    let charBudget = maxTokens * 4;
    let currentChars = block.length;
    const includedLines = [];

    for (const fact of retrievedFacts) {
      const line = fact.trim();
      if (currentChars + line.length + 1 > charBudget) {
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

// ── Test 1: Zero-Memory Gate for Casual & Generic Questions ───────────────────
console.log("\n--- Test 1: Zero-Memory Gate for Casual & Generic Questions ---");
const casualEval = MemoryGate.evaluate("hy", { isCasualChat: true });
assert(casualEval.shouldRetrieve === false, "Casual message 'hy' receives 0 memory");

const flexboxEval = MemoryGate.evaluate("explain CSS flexbox layout", { isCasualChat: false });
assert(flexboxEval.shouldRetrieve === false, "Generic technical query 'explain CSS flexbox layout' receives 0 memory");

const fibonacciEval = MemoryGate.evaluate("write a function in python for fibonacci", { isCasualChat: false });
assert(fibonacciEval.shouldRetrieve === false, "Generic programming query receives 0 memory");

const npmEval = MemoryGate.evaluate("npm install tailwindcss", { isCasualChat: false });
assert(npmEval.shouldRetrieve === false, "Terminal package install command receives 0 memory");

// ── Test 2: Self-Referential Query Activation ─────────────────────────────────
console.log("\n--- Test 2: Self-Referential Query Activation ---");
const whoAmIEval = MemoryGate.evaluate("who am I?", { isCasualChat: false });
assert(whoAmIEval.shouldRetrieve === true, "'who am I?' activates memory retrieval");
assert(whoAmIEval.reason === 'self_referential', "Identified reason as self_referential");

const bizEval = MemoryGate.evaluate("what is my business name?", { isCasualChat: false });
assert(bizEval.shouldRetrieve === true, "'what is my business name?' activates memory retrieval");
assert(bizEval.searchQuery === "business name", "Search query accurately extracted: 'business name'");

const petEval = MemoryGate.evaluate("do you remember my dog's name?", { isCasualChat: false });
assert(petEval.shouldRetrieve === true, "'do you remember my dog's name?' activates memory retrieval");

const gstEval = MemoryGate.evaluate("for my company invoice, what is my GST number?", { isCasualChat: false });
assert(gstEval.shouldRetrieve === true, "Self-referential business query activates memory");

// ── Test 3: Domain Task Scoped Preference Activation ─────────────────────────
console.log("\n--- Test 3: Domain Task Scoped Preference Activation ---");
const websiteTaskEval = MemoryGate.evaluate("build a luxury restaurant website", {
  isCasualChat: false,
  toolIds: ['create_project'],
  memoryCategories: ['coding', 'projects', 'design_preferences']
});
assert(websiteTaskEval.shouldRetrieve === true, "Website design task activates memory retrieval");
assert(websiteTaskEval.targetCategories.includes('design_preferences'), "Website task targets 'design_preferences' category");
assert(!websiteTaskEval.targetCategories.includes('email'), "Website task does NOT target unrelated 'email' category");

const emailTaskEval = MemoryGate.evaluate("draft an email to the client", {
  isCasualChat: false,
  toolIds: ['gmail_connector'],
  memoryCategories: ['email', 'contacts', 'communication']
});
assert(emailTaskEval.shouldRetrieve === true, "Email task activates memory retrieval");
assert(emailTaskEval.targetCategories.includes('email'), "Email task targets 'email' category");
assert(!emailTaskEval.targetCategories.includes('design_preferences'), "Email task does NOT target 'design_preferences'");

// ── Test 4: MemoryRetriever Output & Token Budget ─────────────────────────────
console.log("\n--- Test 4: MemoryRetriever Output & Token Budget ---");

const mockSupabase = {
  rpc: async (fn, args) => {
    if (fn === 'search_memory_longterm_fts') {
      if (args.search_query.includes('business')) {
        return [
          { category: 'Business', title: 'Business Name', value: 'Savoria Italian Cuisine' },
          { category: 'Business', title: 'GST Number', value: '29ABCDE1234F1Z5' }
        ];
      }
      return [];
    }
    return [];
  },
  from: (table) => ({
    select: (cats) => ({
      eq: () => ({
        in: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                { category: 'design_preferences', summary: 'Prefers dark minimal aesthetics with gold accents (#D4AF37).' }
              ],
              error: null
            })
          })
        })
      })
    })
  })
};

(async () => {
  // 1. Generic query produces 0 tokens
  const genericContext = await MemoryRetriever.getRelevantContext(
    mockSupabase,
    'user-123',
    'how to implement quicksort in go',
    { isCasualChat: false }
  );
  assert(genericContext === '', "Generic query returns empty string (0 memory tokens)");

  // 2. Business query retrieves only business facts
  const bizContext = await MemoryRetriever.getRelevantContext(
    mockSupabase,
    'user-123',
    'what is my business name?',
    { isCasualChat: false },
    { maxTokens: 100 }
  );
  assert(bizContext.includes('Savoria Italian Cuisine'), "Targeted business name fact retrieved");
  assert(bizContext.includes('RELEVANT USER CONTEXT'), "Proper modern context header applied");
  const bizTokens = Math.ceil(bizContext.length / 4);
  assert(bizTokens < 100, `Context is ultra-lean (${bizTokens} tokens < 100 tokens budget)`);

  // 3. Design query retrieves design preference
  const designContext = await MemoryRetriever.getRelevantContext(
    mockSupabase,
    'user-123',
    'build a landing page',
    { isCasualChat: false, toolIds: ['create_project'], memoryCategories: ['design_preferences'] },
    { maxTokens: 100 }
  );
  assert(designContext.includes('gold accents'), "Domain preference for design retrieved");
  assert(!designContext.includes('Savoria'), "Unrelated business details excluded from design prompt");

  console.log("\n====================================================================");
  console.log(`RESULTS: ${passedCount} / ${totalCount} tests passed.`);
  console.log("====================================================================");

  if (passedCount === totalCount) {
    console.log("✓ All modern memory system tests passed successfully!");
  } else {
    process.exit(1);
  }
})();
