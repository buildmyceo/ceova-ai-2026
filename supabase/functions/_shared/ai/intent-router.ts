/**
 * CEOVA Intent Router
 * 
 * A lightweight, zero-cost keyword matcher that runs BEFORE calling GPT.
 * It decides which tools and memories to load for a given user message.
 * 
 * This avoids sending thousands of tokens of tool schemas for simple conversations.
 * e.g. "hi" → loads 0 tools (saves ~6,000 tokens)
 *      "send email" → loads only gmail schema (~400 tokens)
 */

import { CAPABILITIES, Capability } from "./capabilities.ts";
import { toolRegistry } from "../tools/registry.ts";

export type TaskScope = 'simple' | 'complex';

export interface IntentRouterResult {
  /** Tool IDs selected for this request */
  toolIds: string[];
  /** Tool schemas to inject into the system prompt */
  toolSchemas: any[];
  /** Memory categories to filter memory fetch */
  memoryCategories: string[];
  /** Whether the user is doing a complex task (IDE/multi-step) */
  isComplexTask: boolean;
  /** Whether this is a casual/conversational message with no tools needed */
  isCasualChat: boolean;
  /** Determined scope of the task (Requirement 13) */
  taskScope: TaskScope;
}

// Patterns for casual chat — no tools needed at all
const CASUAL_PATTERNS = [
  // Greetings with optional friendly suffix (e.g. "hy", "hy bro", "hello ceova", "hey there", "good morning everyone")
  /^(?:hi+|hello+|hey+|hii+|helo+|hai+|hy+|hye+|yo+|hola|namaste|gm|gn)\b(?:\s+(?:bro|bhai|mate|friend|buddy|ceova|there|everyone|all|team|sir|ji|bot|dear))?[\s!?.]*$/i,
  /^(?:good\s+(?:morning|evening|afternoon|night))(?:\s+(?:bro|bhai|mate|friend|buddy|ceova|there|everyone|all|sir|ji))?[\s!?.]*$/i,
  /^(?:how\s+(?:are\s+you|is\s+it\s+going|are\s+things|r\s+u|do\s+you\s+do|have\s+you\s+been))[\s!?.]*$/i,
  /^(?:what's\s+up|whatsup|wassup|sup)[\s!?.]*$/i,
  /^(?:thanks|thank\s+you|ty|thx|cool|nice|great|awesome|perfect|sure|got\s+it|ok|okay)[\s!?.]*$/i,
  /^(?:bye|goodbye|see\s+you|cya|later|take\s+care)[\s!?.]*$/i,
  /^(?:what\s+can\s+you\s+do|what\s+are\s+you|who\s+are\s+you|tell\s+me\s+about\s+yourself|who\s+made\s+you|who\s+created\s+you)[\s?!.]*$/i,
  /^[\s!?.]{0,5}$/,  // Empty or just punctuation
];

// Video URL patterns — auto-trigger video capability when pasted
const VIDEO_URL_PATTERNS = [
  /youtube\.com\/watch/i,
  /youtu\.be\//i,
  /youtube\.com\/shorts/i,
  /instagram\.com\/(p|reel|tv)\//i,
  /\.mp4(\?|$)/i,
  /\.webm(\?|$)/i,
  /\.m3u8(\?|$)/i,
  /twitter\.com\/.*\/status/i,
  /x\.com\/.*\/status/i,
  /tiktok\.com\/@.*\/video/i,
  /vimeo\.com\/\d+/i,
  /dailymotion\.com\/video/i,
];

// Known client-side tools (executed on frontend, not server-side)
const CLIENT_SIDE_TOOLS = ["write_local_files", "run_terminal_command", "read_local_files", "list_local_files"];

// Tool schema map — only loaded when needed
const TOOL_SCHEMA_CACHE: Map<string, any> = new Map();

function getToolSchema(toolId: string): any | null {
  if (TOOL_SCHEMA_CACHE.has(toolId)) {
    return TOOL_SCHEMA_CACHE.get(toolId)!;
  }
  const tool = toolRegistry.getTool(toolId);
  if (!tool || !tool.metadata.enabled) return null;
  const schema = tool.metadata;
  TOOL_SCHEMA_CACHE.set(toolId, schema);
  return schema;
}

/** Client-side tool schema stubs — minimal schemas for frontend tools */
const CLIENT_TOOL_SCHEMAS: Record<string, any> = {
  write_local_files: {
    id: "write_local_files",
    name: "Write Local Files",
    description: "Write files directly to the user's connected local folder.",
    parameters: {
      type: "object",
      properties: {
        files: { 
          type: "array", 
          description: "Array of {path, content} objects to write",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path (e.g. index.html or src/app.js)" },
              content: { type: "string", description: "The full code/content of the file" }
            },
            required: ["path", "content"]
          }
        }
      },
      required: ["files"]
    }
  },
  run_terminal_command: {
    id: "run_terminal_command",
    name: "Run Terminal Command",
    description: "Run a terminal command in the user's connected local folder.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run" }
      },
      required: ["command"]
    }
  },
  read_local_files: {
    id: "read_local_files",
    name: "Read Local Files",
    description: "Read the content of files from the user's connected local folder.",
    parameters: {
      type: "object",
      properties: {
        paths: { type: "array", description: "Array of file paths to read" }
      },
      required: ["paths"]
    }
  },
  list_local_files: {
    id: "list_local_files",
    name: "List Local Files",
    description: "List files and folders in the user's connected local directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list (default: root)" }
      }
    }
  }
};

/**
 * Detects if the user is asking an informational question or inquiry
 * about a model, tool, system, or past turn rather than commanding a tool action.
 */
export function isQuestionOrInquiry(message: string): boolean {
  const trimmed = (message || "").trim().toLowerCase();
  if (!trimmed) return false;
  
  // Explicit questions about models, tools, or operation
  const metaPatterns = [
    /\b(?:which|what)\s+model\b/i,
    /\b(?:which|what)\s+tool\b/i,
    /\b(?:how\s+(?:did\s+you|do\s+you|was\s+this|is\s+this|does\s+it))\b/i,
    /\b(?:can\s+you\s+(?:explain|tell\s+me|describe|clarify))\b/i,
    /\b(?:tell\s+me\s+(?:about|how|what|why))\b/i,
    /\b(?:why\s+(?:did\s+you|do\s+you|is\s+it|are\s+you))\b/i,
    /\b(?:explain\s+(?:how|why|what|the))\b/i,
    /\b(?:what\s+is\s+the\s+difference|difference\s+between)\b/i,
    /\b(?:cost|pricing|price)\s+of\b/i,
    /\bhow\s+much\s+(?:does|is|did)\b/i,
    /\b(?:what|which)\s+(?:mail|email|message|action|file|code|text|response)\b/i,
    /\b(?:what|which)\s+(?:did\s+you|have\s+you|had\s+you)\b/i,
    /\b(?:did\s+you|have\s+you|had\s+you)\s+(?:send|sent|sended|write|reply|draft)\b/i,
    /\b(?:what\s+(?:did\s+you|was|had\s+you)\s+(?:send|sent|sended))\b/i,
    /\bwhat\s+did\s+you\s+(?:do|write|reply)\b/i,
    /\bshow\s+(?:me\s+)?(?:the\s+)?(?:mail|email|draft|message)\b/i
  ];
  if (metaPatterns.some(p => p.test(trimmed))) {
    return true;
  }

  // Interrogative sentences that are NOT imperative requests
  if (trimmed.endsWith('?')) {
    const isActionRequest = /^(?:can\s+you|could\s+you|please|would\s+you)\s+(?:generate|genrate|create|make|draw|paint|sketch|render|build|deploy)\b/i.test(trimmed);
    if (!isActionRequest) return true;
  }

  return false;
}

/**
 * Routes a user message to the appropriate tools and memory categories.
 * This is a pure function — no network calls, no async, very fast.
 */
export function routeIntent(
  message: string,
  hasImage: boolean = false,
  hasDocument: boolean = false,
  hasLocalFolder: boolean = true,
  history: any[] = [],
  hasCloudProject: boolean = false,
  isThinking: boolean = false,
  isWebSearch: boolean = false
): IntentRouterResult {
  const lowerMessage = (message || '').toLowerCase().trim();
  const isQuestion = isQuestionOrInquiry(lowerMessage);

  // Only inherit previous assistant text for short confirmatory replies (e.g. "yes", "proceed")
  // For normal messages or questions, evaluate the user's message itself to prevent history leakage.
  const isShortConfirmation = /^(?:yes|yep|yeah|sure|ok|okay|proceed|go ahead|build it|do it|approved|start|lets do it|let's do it)\b/i.test(lowerMessage);
  let contextText = lowerMessage;
  if (isShortConfirmation && history && Array.isArray(history)) {
    const lastAssistantMsg = history.slice().reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg && typeof lastAssistantMsg.content === 'string') {
      contextText = lastAssistantMsg.content + " " + lowerMessage;
    }
  }

  const lowerContext = contextText.toLowerCase().trim();

  // ── Casual chat check — load nothing (saves 4,000+ tokens on greetings) ────
  if (!hasImage && !hasDocument && !isThinking && !isWebSearch && CASUAL_PATTERNS.some(p => p.test(lowerMessage))) {
    return {
      toolIds: [],
      toolSchemas: [],
      memoryCategories: [],
      isComplexTask: false,
      isCasualChat: true,
      taskScope: 'simple',
    };
  }

  // Helper to match keywords cleanly with word boundaries (prevents "guide" matching "ui", etc.)
  const matchesKeyword = (text: string, kw: string): boolean => {
    const cleanKw = kw.trim().toLowerCase();
    if (!cleanKw) return false;
    if (cleanKw.includes(" ")) {
      return text.includes(cleanKw);
    }
    const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  };

  // ── Image tool matching ───────────────────────────────────────────────────
  const matchedCapabilities: Capability[] = [];

  // Detect imperative image generation requests (both with or without attached image)
  const isExplicitGenAction = !isQuestion && (
    /^\s*\/?generate_image\b/i.test(lowerMessage) ||
    /\b(?:generate|genrate|create|make|draw|paint|sketch|render|design)\s+(?:a |an |me |the |this )?(?:image|picture|photo|illustration|artwork|graphic|logo|wallpaper|portrait|banner|avatar|poster|flyer|creative|ad|advertisement|visual|mockup|post)\b/i.test(lowerMessage) ||
    /^\s*(?:genrate|genrate image|genrate picture|genrate a|genrate an)\b/i.test(lowerMessage) ||
    /\b(?:ai\s+image|ai\s+generated\s+image|generate\s+image|genrate\s+image|image\s+generation)\b/i.test(lowerMessage) ||
    /\b(?:make|create|generate|design|draw)\s+(?:a |an |me |the )?(?:poster|flyer|banner|creative|ad|visual)\b/i.test(lowerMessage)
  );

  const isImageGenConfirmation = isShortConfirmation && history && Array.isArray(history) && history.some(m => 
    typeof m.content === 'string' && /generate|recreated|recreation/i.test(m.content) && m.role === 'assistant'
  );

  const hasImageInHistory = history && Array.isArray(history) && history.some(m => 
    (m.attachments && m.attachments.some((a: any) => a.type?.startsWith('image/'))) ||
    (typeof m.content === 'string' && /data:image\//i.test(m.content))
  );

  const isImageRemovalOrEdit = (hasImage || hasImageInHistory) && !isQuestion && (
    /(?:remove|erase|delete|crop\s*out|take\s*out|cut\s*out|clear|get\s*rid\s*of)\s+(?:the\s+|that\s+|this\s+|both\s+|all\s+)?(?:\w+)/i.test(lowerMessage) ||
    /\b(?:without|no)\s+(?:the\s+|that\s+)?(?:\w+)\b/i.test(lowerMessage) ||
    /\b(?:recreate|generate|edit|modify)\s+(?:the\s+)?(?:image|scene|photo|picture)\s+(?:without|with|removing|erasing)\b/i.test(lowerMessage)
  );

  const isImageTransformOrPoster = (hasImage || hasImageInHistory) && !isQuestion && (
    /\b(?:poster|flyer|banner|creative|ad|advertisement|graphic|visual|post)\b/i.test(lowerMessage) &&
    /\b(?:make|create|generate|design|turn|convert|produce|draw)\b/i.test(lowerMessage)
  );

  if (isExplicitGenAction || isImageGenConfirmation || isImageRemovalOrEdit || isImageTransformOrPoster) {
    const imageGenCap = CAPABILITIES.find(c => c.id === "image_gen");
    if (imageGenCap && !matchedCapabilities.includes(imageGenCap)) {
      matchedCapabilities.push(imageGenCap);
    }
  }

  if (hasImage) {
    const isExplicitToolAction = !isQuestion && /(?:remove|cut\s*out|strip)\s+(?:the\s+)?(?:bg|background)|transparent\s+(?:png|background|bg)|(?:make|create)\s+(?:it\s+)?transparent/i.test(lowerMessage);

    if (isExplicitToolAction) {
      const imageProcessCap = CAPABILITIES.find(c => c.id === "image_process");
      if (imageProcessCap && !matchedCapabilities.includes(imageProcessCap)) {
        matchedCapabilities.push(imageProcessCap);
      }
    }
  }

  // ── Document always needs document tools ───────────────────────────────────
  if (hasDocument) {
    const pdfCap = CAPABILITIES.find(c => c.id === "pdf");
    if (pdfCap && !matchedCapabilities.includes(pdfCap)) matchedCapabilities.push(pdfCap);
  }

  // ── Video URL auto-detection: trigger video capability when URL is pasted ──────
  if (VIDEO_URL_PATTERNS.some(p => p.test(message))) {
    const videoCap = CAPABILITIES.find(c => c.id === "video");
    if (videoCap && !matchedCapabilities.includes(videoCap)) matchedCapabilities.push(videoCap);
  }

  // ── Web Dev Action & Confirmation Check ─────────────────────────────────────
  // Having an existing project only loads cloud_dev if the user actually commands a site change
  // (e.g. "change background to black", "fix navbar", "update font") or confirms a pending plan.
  // Casual queries or general chit-chat do NOT load website builder tools.
  const isWebDevAction = /change|update|add|fix|modify|edit|style|design|make|set|remove|replace|rewrite|tweak|improve|deploy|publish|navbar|footer|header|button|hero|section|background|color/i.test(lowerMessage);
  const isWebDevConfirmation = isShortConfirmation && history && Array.isArray(history) && history.some(m => 
    typeof m.content === 'string' && /website|web\s*app|site|project|build|plan|ceova\.online|create_project/i.test(m.content)
  );

  if ((hasCloudProject && isWebDevAction) || isWebDevConfirmation) {
    const cloudCap = CAPABILITIES.find(c => c.id === "cloud_dev");
    if (cloudCap && !matchedCapabilities.includes(cloudCap)) {
      matchedCapabilities.push(cloudCap);
    }
  }

  // ── Web search explicit toggle or thinking deep research ─────────────────────
  if (isWebSearch || (isThinking && !isShortConfirmation && lowerMessage.length > 5)) {
    const webSearchCap = CAPABILITIES.find(c => c.id === "web_search");
    if (webSearchCap && !matchedCapabilities.includes(webSearchCap)) {
      matchedCapabilities.push(webSearchCap);
    }
  }

  // ── Provenance & Watermark Verification ─────────────────────────────────────
  const isProvenanceIntent = 
    /\b(?:watermark|water\s*mark|watermarks|provenance|authentic|authenticity)\b/i.test(lowerMessage) ||
    /\b(?:which|what|is\s+this|are\s+these|did\s+you|who)\b.*\b(?:ceova|genrat\w+|generat\w+|creat\w+|made)\b/i.test(lowerMessage) ||
    /\b(?:generated|genrated|created|made)\s+by\s+ceova\b/i.test(lowerMessage) ||
    /\bwhich\s+(?:image|picture|photo|file|one)\s+is\s+(?:genrated|generated|made|created)\b/i.test(lowerMessage) ||
    (hasImage && /\b(?:ceova|watermark|water\s*mark|provenance)\b/i.test(lowerMessage));

  if (isProvenanceIntent) {
    const provCap = CAPABILITIES.find(c => c.id === "provenance");
    if (provCap && !matchedCapabilities.includes(provCap)) {
      matchedCapabilities.push(provCap);
    }
  }

  // ── Keyword matching across all capabilities ─────────────────────────────────
  for (const cap of CAPABILITIES) {
    if (matchedCapabilities.includes(cap)) continue; // already added

    // If the message is an inquiry/question about how tools work or what model is used,
    // do not load action tools unless the user explicitly requested an action.
    if (isQuestion && ['image_gen', 'image_process', 'tools', 'files'].includes(cap.id)) {
      continue;
    }

    // If the message is a question about what was sent, drafted, or past email actions, don't load gmail tools
    if (isQuestion && cap.id === 'gmail' && /\b(?:what|which|show|did\s+you|have\s+you|had\s+you)\b/i.test(lowerMessage) && !/\b(?:search|inbox|find|unread)\b/i.test(lowerMessage)) {
      continue;
    }

    const matched = cap.keywords.some(kw => matchesKeyword(lowerContext, kw));
    if (matched) {
      matchedCapabilities.push(cap);
    }
  }

  // ── Determine Task Scope (Requirement 13) ───────────────────────────────────
  const taskScope = determineTaskScope(message, { isExistingProject: !!hasCloudProject });

  // ── If no capability matched, treat as general chat (no tools) ───────────────
  if (matchedCapabilities.length === 0) {
    return {
      toolIds: [],
      toolSchemas: [],
      memoryCategories: [],
      isComplexTask: isThinking,
      isCasualChat: !hasImage && !hasDocument && !isThinking && !isWebSearch,
      taskScope: isThinking ? 'complex' : taskScope,
    };
  }

  // ── Collect tool IDs and memory categories ───────────────────────────────────
  const toolIdSet = new Set<string>();
  const memoryCategorySet = new Set<string>();

  for (const cap of matchedCapabilities) {
    cap.toolIds.forEach(id => toolIdSet.add(id));
    cap.memoryCategories.forEach(cat => memoryCategorySet.add(cat));
  }

  const toolIds = Array.from(toolIdSet);

  // ── Fetch only required tool schemas ────────────────────────────────────────
  const toolSchemas: any[] = [];
  const finalToolIds: string[] = [];
  for (const toolId of toolIds) {
    if (CLIENT_SIDE_TOOLS.includes(toolId)) {
      toolSchemas.push(CLIENT_TOOL_SCHEMAS[toolId]);
      finalToolIds.push(toolId);
    } else {
      const schema = getToolSchema(toolId);
      if (schema) {
        toolSchemas.push(schema);
        finalToolIds.push(toolId);
      }
    }
  }

  // Complex tasks or IDE tasks get extended history/context
  const isComplexTask = taskScope === 'complex' || matchedCapabilities.some(c => c.id === "ide");

  return {
    toolIds: finalToolIds,
    toolSchemas,
    memoryCategories: Array.from(memoryCategorySet),
    isComplexTask,
    isCasualChat: false,
    taskScope,
  };
}

/**
 * Requirement 13: Handle simple and complex tasks differently
 * The agent should determine the scope of the task.
 * 
 * Simple task
 * Examples: Change restaurant name, Change button text, Change phone number,
 * Change color, Change image, Change heading, small text/styling tweaks.
 * Workflow: search → read relevant code → targeted edit → verify.
 * No unnecessary planning or broad context.
 * 
 * Complex task
 * Examples: Add an entire booking system UI, Redesign homepage, Add a complete gallery,
 * Create a new page, Major navigation change, multi-step flow, cart/checkout.
 * Workflow: understand → inspect architecture → identify affected files →
 * retrieve relevant context → implement → build → test → fix → verify.
 * The agent may retrieve more files when the task genuinely requires them.
 */
export function determineTaskScope(message: string, context?: { isExistingProject?: boolean }): TaskScope {
  const msg = (message || '').trim().toLowerCase();

  // Explicit complex patterns (Requirement 13)
  const complexPatterns = [
    /\b(?:entire|complete|full)\s+(?:booking|reservation|cart|checkout|gallery|ecommerce|auth|dashboard|admin|system|store)\b/i,
    /\b(?:add|build|create|implement)\s+(?:an?\s+)?(?:entire|complete|full|new)\s+(?:booking|reservation|gallery|page|system|shop|store)\b/i,
    /\bredesign\s+(?:the\s+)?(?:homepage|home|website|site|entire|page|landing)\b/i,
    /\bcreate\s+(?:a\s+)?(?:new\s+)?(?:page|route|subpage)\b/i,
    /\bmajor\s+(?:navigation|layout|architectur\w+|overhaul|redesign)\b/i,
    /\b(?:booking\s+system|reservation\s+system|shopping\s+cart|payment\s+gateway|multi-step|user\s+auth)\b/i,
    /\badd\s+(?:a\s+)?(?:complete|full)\s+gallery\b/i,
  ];

  for (const pattern of complexPatterns) {
    if (pattern.test(msg)) {
      return 'complex';
    }
  }

  // Compound intent / contextual modifier detection (Flexible Intent Recognition):
  // If the user prompt includes secondary clauses specifying audience, theme, purpose, or multiple actions,
  // do NOT pigeonhole into a simple micro-edit. Give the agent full cognitive scope to adapt both.
  const hasContextualClause = 
    /\b(?:as|because|since)\s+(?:the|it|this|that)\b/i.test(msg) ||
    /\bfor\s+(?:children|childs|childrens|kids|toddlers|babies|families|students|gamers|developers|luxury|seniors|teens)\b/i.test(msg) ||
    /\b(?:theme|rebrand|makeover|overhaul|redesign|vibe|mood|audience|aesthetic)\b/i.test(msg) ||
    /\b(?:and\s+also|along\s+with|as\s+well\s+as|in\s+addition)\b/i.test(msg);

  if (hasContextualClause && !/\b(?:what|who|how|where|when|why|is\s+there)\b/i.test(msg)) {
    return 'complex';
  }

  // Explicit simple patterns (Requirement 13)
  const simplePatterns = [
    /\b(?:change|update|fix|replace|tweak|modify|make|set)\s+(?:the\s+)?(?:restaurant\s+)?name\b/i,
    /\b(?:change|update|fix|replace|tweak|modify|make|set)\s+(?:the\s+)?(?:button|btn)(?:\s+text)?\b/i,
    /\b(?:change|update|fix|replace|tweak|modify|make|set)\s+(?:the\s+)?(?:phone|mobile|telephone|call)(?:\s+number)?\b/i,
    /\b(?:change|update|fix|replace|tweak|modify|make|set)\s+(?:the\s+)?(?:color|colour|background|bg|font|theme\s+color)\b/i,
    /\b(?:change|update|fix|replace|tweak|modify|make|set)\s+(?:the\s+)?(?:image|photo|picture|icon|logo)\b/i,
    /\b(?:change|update|fix|replace|tweak|modify|make|set)\s+(?:the\s+)?(?:heading|headline|title|subheading|text|label|caption|badge)\b/i,
    /\b(?:change|update|fix|tweak)\s+(?:the\s+)?(?:navbar|nav|header|footer|link)\b/i,
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(msg)) {
      return 'simple';
    }
  }

  // If modifying an existing project and the prompt is short/isolated, default to simple
  if (context?.isExistingProject) {
    if (msg.split(/\s+/).length < 25 && !/\b(?:entire|complete|all\s+pages|full\s+redesign|new\s+page)\b/i.test(msg)) {
      return 'simple';
    }
  }

  // Creating a new site from scratch or executing an approved plan is complex
  if (/\b(?:creat|create|build|make|start|generate|design)\s+(?:a\s+)?(?:completely\s+)?(?:new\s+)?(?:website|web\s*app|site|landing|portfolio|restaurant|resturent|store|bakery|project|page)/i.test(msg) ||
      /^(?:proceed|yes|build it|go ahead|approved|approve|sure|ok|start|do it|let's do it|lets do it)\b/i.test(msg)) {
    return 'complex';
  }

  return 'simple';
}

