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
}

// Patterns for casual chat — no tools needed at all
const CASUAL_PATTERNS = [
  /^(hi|hello|hey|hii|helo|hai)[\s!?.]*$/i,
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
  hasLocalFolder: boolean = true
): IntentRouterResult {
  const lower = message.toLowerCase().trim();

  // ── Casual chat check — load nothing ────────────────────────────────────────
  if (!hasImage && !hasDocument && CASUAL_PATTERNS.some(p => p.test(lower))) {
    return {
      toolIds: [],
      toolSchemas: [],
      memoryCategories: [],
      isComplexTask: false,
      isCasualChat: true,
    };
  }

  // ── Image always needs image tools ───────────────────────────────────────────
  const matchedCapabilities: Capability[] = [];

  if (hasImage) {
    const imageCap = CAPABILITIES.find(c => c.id === "image");
    if (imageCap) matchedCapabilities.push(imageCap);
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

  // ── Keyword matching across all capabilities ─────────────────────────────────
  for (const cap of CAPABILITIES) {
    if (matchedCapabilities.includes(cap)) continue; // already added
    const matched = cap.keywords.some(kw => lower.includes(kw.toLowerCase()));
    if (matched) {
      matchedCapabilities.push(cap);
    }
  }

  // ── If no capability matched, treat as general chat (no tools) ───────────────
  if (matchedCapabilities.length === 0) {
    return {
      toolIds: [],
      toolSchemas: [],
      memoryCategories: [],
      isComplexTask: false,
      isCasualChat: false,
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

  // IDE tasks are "complex" — more history, more context allowed
  const isComplexTask = matchedCapabilities.some(c => c.id === "ide");

  return {
    toolIds: finalToolIds,
    toolSchemas,
    memoryCategories: Array.from(memoryCategorySet),
    isComplexTask,
    isCasualChat: false,
  };
}
