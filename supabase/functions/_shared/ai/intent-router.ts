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
  /^(hi+|hello+|hey+|hii+|helo+|hai+|hy+|hye+|yo+|hola|namaste|gm|gn|good\s+(morning|evening|afternoon|night))[\s!?.]*$/i,
  /^(how are you|what's up|whatsup|wassup|sup)[\s!?.]*$/i,
  /^(thanks|thank you|ty|thx|ok|okay|got it|cool|nice|great|awesome|perfect|sure|yes|no|nope|yep|yeah)[\s!?.]*$/i,
  /^(bye|goodbye|see you|cya|later)[\s!?.]*$/i,
  /^(what can you do|what are you|who are you|tell me about yourself)[\s?!.]*$/i,
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
 * Routes a user message to the appropriate tools and memory categories.
 * This is a pure function — no network calls, no async, very fast.
 */
export function routeIntent(
  message: string,
  hasImage: boolean = false,
  hasDocument: boolean = false,
  hasLocalFolder: boolean = true,
  history: any[] = [],
  hasCloudProject: boolean = false
): IntentRouterResult {
  // Use recent conversation context so a simple "yes" doesn't drop the tool schemas
  // If the assistant just asked "Would you like me to send this email?", we want to match "email".
  let contextText = message;
  const lastAssistantMsg = history.slice().reverse().find(m => m.role === 'assistant');
  if (lastAssistantMsg && typeof lastAssistantMsg.content === 'string') {
    contextText = lastAssistantMsg.content + " " + message;
  }

  // We only use the contextText for casual pattern testing if the user's message itself is casual.
  // Wait, if the user's message is "yes", we don't want to just return casual chat.
  // We want to evaluate the whole context.
  const lowerMessage = message.toLowerCase().trim();
  const lowerContext = contextText.toLowerCase().trim();

  // ── Casual chat check — load nothing ────────────────────────────────────────
  // We only treat it as casual if BOTH the message AND the recent context are casual.
  // Or rather, if the user says "yes" but the assistant was asking about an "email", it's NOT casual.
  let isCasual = false;
  if (!hasImage && !hasDocument && !hasCloudProject && CASUAL_PATTERNS.some(p => p.test(lowerMessage))) {
    // User sent a casual message. Let's see if the context suggests a tool.
    // If context contains keywords for tools, we should NOT treat it as casual.
    isCasual = CASUAL_PATTERNS.some(p => p.test(lowerContext));
    
    // If even with context it's casual, return casual.
    if (isCasual) {
      return {
        toolIds: [],
        toolSchemas: [],
        memoryCategories: [],
        isComplexTask: false,
        isCasualChat: true,
        taskScope: 'simple',
      };
    }
  }

  // ── Image always needs image tools ───────────────────────────────────────────
  const matchedCapabilities: Capability[] = [];

  if (hasImage) {
    const imageProcessCap = CAPABILITIES.find(c => c.id === "image_process");
    if (imageProcessCap) matchedCapabilities.push(imageProcessCap);
    // Also check if user wants to generate a NEW image (e.g. "generate a similar image")
    const imageGenCap = CAPABILITIES.find(c => c.id === "image_gen");
    if (imageGenCap) matchedCapabilities.push(imageGenCap);
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

  // ── Existing cloud project in request or history always enables cloud_dev capability ───
  const hasCloudProjectInHistory = hasCloudProject || (history && Array.isArray(history) && history.some(m => 
    (m.attachments && Array.isArray(m.attachments) && m.attachments.some((a: any) => a.type === 'cloud_project')) ||
    (typeof m.content === 'string' && (
      m.content.includes('ceova.online') ||
      m.content.includes('Cloud Project') ||
      m.content.includes('Deployment Successful') ||
      /plan|website|create_project|landing page/i.test(m.content)
    ))
  ));

  if (hasCloudProjectInHistory) {
    const cloudCap = CAPABILITIES.find(c => c.id === "cloud_dev");
    if (cloudCap && !matchedCapabilities.includes(cloudCap)) {
      matchedCapabilities.push(cloudCap);
    }
  }

  // ── Keyword matching across all capabilities ─────────────────────────────────
  for (const cap of CAPABILITIES) {
    if (matchedCapabilities.includes(cap)) continue; // already added
    // Match against the combined context (last assistant message + user message)
    const matched = cap.keywords.some(kw => lowerContext.includes(kw.toLowerCase()));
    if (matched) {
      matchedCapabilities.push(cap);
    }
  }

  // ── Determine Task Scope (Requirement 13) ───────────────────────────────────
  const taskScope = determineTaskScope(message, { isExistingProject: hasCloudProjectInHistory });

  // ── If no capability matched, treat as general chat (no tools) ───────────────
  if (matchedCapabilities.length === 0) {
    return {
      toolIds: [],
      toolSchemas: [],
      memoryCategories: [],
      isComplexTask: false,
      isCasualChat: false,
      taskScope,
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

