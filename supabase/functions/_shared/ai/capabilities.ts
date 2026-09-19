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
    keywords: [
      // Website creation
      "website", "build website", "create website", "make website", "develop website", "design website",
      "web app", "landing page", "landing", "page", "pages", "cloud project", "deploy", "ceova.online",
      "restaurant website", "portfolio", "store", "ecommerce", "saas", "frontend", "build app", "create app",
      "site", "webpage", "web page", "dashboard", "fullstack app", "build me", "create me",
      // Modifications
      "update", "modify", "change", "add page", "make that pages", "fix website", "edit website",
      // Plan/approval flow
      "plan", "implementation plan", "proceed", "build it", "website plan", "go ahead", "approved",
      "start building", "looks good", "approve", "use placeholders", "placeholder", "placeholders", "build", "cafe website",
      // UI component keywords
      "buttons", "tab", "tabs", "navigation", "nav", "navbar", "change navbar", "update navbar",
      "hero", "menu", "overview", "calendar", "event", "user", "header", "footer",
      "section", "modal", "card", "badge", "banner", "announcement",
      "restaurant name", "button text", "hero heading", "contact number",
      "change name", "change heading", "change text", "change image", "smaller button",
      // Technical specification terms — so detailed prompts always trigger tools
      "html", "css", "javascript", "js", "responsive", "layout", "flex", "grid", "flexbox",
      "media query", "breakpoint", "viewport", "mobile", "desktop", "tablet",
      "animation", "transition", "hover", "sticky", "fixed", "position", "z-index",
      "font", "typography", "color palette", "background", "border", "padding", "margin",
      "container", "wrapper", "component", "design system", "ui", "ux", "interface",
      "index.html", "style.css", "app.js", "script", "stylesheet",
      "react", "vue", "tailwind", "bootstrap", "gsap", "three.js", "chart.js",
      "cdn", "inline", "single file", "self-contained",
      // Specification / detailed prompt indicators
      "specification", "spec", "requirement", "requirements", "detailed", "implement",
      "i want", "i need", "please create", "please build", "please make", "please design",
      "build a", "create a", "make a", "design a", "develop a",
      // Website types
      "blog", "portfolio", "agency", "startup", "product", "service", "booking",
      "hotel", "travel", "food", "cafe", "salon", "gym", "fitness", "clinic",
      "school", "education", "real estate", "property", "finance", "crypto",
      "music", "photography", "artist", "gallery", "event", "wedding",
    ],
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
    id: "image_gen",
    description: "Generate high-quality AI images, illustrations, and art from text prompts using DALL-E. Use this when the user wants to CREATE/GENERATE a NEW image from a text description.",
    keywords: [
      "generate image", "create image", "make image", "draw", "paint", "illustration", "generate picture", "create picture",
      "make picture", "generate photo", "create photo", "dall-e", "dalle", "render image", "generate artwork", "draw me",
      "design logo", "generate graphic", "generate an image", "generate a photo", "generate a picture", "create an image",
      "create a picture", "make an image", "ai image", "artwork", "generate_image",
      "genrate", "genrate image", "genrate picture", "genrate photo", "genrate a", "genrate an", "genrate artwork",
      "generate a", "generate an", "draw a", "draw me", "paint a", "paint me", "sketch a", "sketch of",
      "illustration of", "picture of", "pic of", "photo of", "photograph of", "image of", "artwork of",
      "render a", "rendering of", "make a picture", "make a photo", "make an illustration", "wallpaper of",
      "image", "photo", "picture"
    ],
    toolIds: ["generate_image"],
    memoryCategories: ["preferences"],
  },
  {
    id: "image_process",
    description: "Analyze images, remove backgrounds, describe image contents, and perform OCR. Use this when the user has ATTACHED an existing image and wants it processed.",
    keywords: [
      "background", "remove background", "analyze image", "describe image", "what is this",
      "ocr", "read image", "detect", "vision", "remove bg", "transparent", "cutout",
      "what's in this", "identify", "extract text"
    ],
    toolIds: ["image_analysis", "background_remover"],
    memoryCategories: ["preferences"],
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
