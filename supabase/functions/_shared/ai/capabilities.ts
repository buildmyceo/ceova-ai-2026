/**
 * CEOVA Capability Registry
 * 
 * This is the ONLY thing sent to the LLM to describe available capabilities.
 * It intentionally contains NO implementation details, NO parameters, NO schemas.
 * Tool schemas are injected separately and only when the intent router selects them.
 * 
 * Target size: < 600 tokens (vs 6,000+ for full tool schemas)
 */

export interface Capability {
  id: string;
  description: string;
  /** Keywords used by the intent router to match user messages */
  keywords: string[];
  /** Tool IDs to load when this capability is needed */
  toolIds: string[];
  /** Memory categories relevant to this capability */
  memoryCategories: string[];
}

export const CAPABILITIES: Capability[] = [
  {
    id: "gmail",
    description: "Read, search, send, reply, draft and organize Gmail. IMPORTANT: When asked to send an email, ALWAYS use draft_email first. Tell the user you created a draft and ask for confirmation. ONLY use send_email if the user explicitly confirms.",
    keywords: ["email", "mail", "gmail", "send", "inbox", "reply", "draft", "message", "compose", "unread", "attachment", "forward", "cc", "bcc", "subject"],
    toolIds: ["gmail_connector"],
    memoryCategories: ["email", "contacts", "communication"],
  },
  {
    id: "calendar",
    description: "Create, edit, delete and search Google Calendar events.",
    keywords: ["calendar", "event", "meeting", "schedule", "appointment", "remind", "reminder", "book", "reschedule", "cancel", "invite", "agenda", "tomorrow", "next week"],
    toolIds: ["calendar_connector"],
    memoryCategories: ["calendar", "timezone", "work_schedule", "preferences"],
  },
  {
    id: "drive",
    description: "Search, upload and manage Google Drive files and folders.",
    keywords: ["drive", "file", "folder", "document", "spreadsheet", "sheet", "slides", "upload", "share", "gdrive", "google doc", "google sheet"],
    toolIds: ["drive_connector"],
    memoryCategories: ["drive", "files"],
  },
  {
    id: "telegram",
    description: "Read and send Telegram messages.",
    keywords: ["telegram", "message", "chat", "send message", "notify", "notification"],
    toolIds: [],
    memoryCategories: ["telegram", "communication"],
  },
  {
    id: "cloud_dev",
    description: "Build, test, update, and deploy production web applications, landing pages, SaaS apps, portfolios, and websites to https://<project>.ceova.online in isolated cloud workspaces. For new sites or major structural changes, present an implementation plan first and wait for approval. For tiny changes on existing sites (text edits, styling tweaks), execute directly.",
    keywords: ["website", "build website", "create website", "make website", "develop website", "web app", "landing page", "landing", "page", "pages", "cloud project", "deploy", "ceova.online", "restaurant website", "portfolio", "store", "ecommerce", "saas", "frontend", "build app", "create app", "site", "webpage", "web page", "dashboard", "fullstack app", "build me", "create me", "update", "modify", "change", "add page", "make that pages", "buttons", "tab", "tabs", "navigation", "nav", "overview", "calendar", "event", "user", "fix website", "edit website", "plan", "implementation plan", "proceed", "build it", "website plan", "go ahead", "approved", "start building", "looks good", "approve", "restaurant name", "button text", "hero heading", "contact number", "change name", "change heading", "change text", "change image", "smaller button"],
    toolIds: ["create_project"],
    memoryCategories: ["coding", "projects", "design_preferences"],
  },
  {
    id: "ide",
    description: "Local workspace tools for interacting with a connected local folder on the user device.",
    keywords: ["local folder", "local directory", "connected folder", "save to my computer", "save to my machine", "local disk", "download to folder"],
    toolIds: ["write_local_files", "run_terminal_command", "read_local_files", "list_local_files"],
    memoryCategories: ["coding", "projects", "preferences"],
  },
  {
    id: "pdf",
    description: "Merge, compress, split, convert, and extract/read text from PDFs.",
    keywords: ["pdf", "merge", "split", "extract", "read", "compress pdf", "convert pdf", "pages", "rotate", "watermark"],
    toolIds: ["pdf_toolkit"],
    memoryCategories: [],
  },
  {
    id: "image",
    description: "Analyze images, remove backgrounds, and process images.",
    keywords: ["image", "photo", "picture", "background", "remove background", "analyze image", "describe image", "what is this", "ocr", "read image", "detect", "vision"],
    toolIds: ["image_analysis", "background_remover"],
    memoryCategories: [],
  },
  {
    id: "files",
    description: "Convert, compress and reduce size of files and media.",
    keywords: ["convert", "compress", "reduce", "resize", "file size", "smaller", "mp4", "mp3", "wav", "png", "jpg", "webp", "gif", "media", "video", "audio"],
    toolIds: ["file_size_reduction", "file_converter", "media_converter"],
    memoryCategories: [],
  },
  {
    id: "tools",
    description: "Generate QR codes, barcodes, invoices, color palettes, and hash passwords.",
    keywords: ["qr", "qr code", "barcode", "invoice", "bill", "receipt", "color", "palette", "hex", "rgb", "password", "hash", "encrypt"],
    toolIds: ["qr_barcode", "invoice_generator", "color_toolkit", "password_hash"],
    memoryCategories: [],
  },
];

/**
 * Returns a compact string describing all capabilities.
 * This is what gets injected into the system prompt (not the full tool schemas).
 */
export function getCapabilitySummary(): string {
  return CAPABILITIES.map(c => `- ${c.id}: ${c.description}`).join("\n");
}
