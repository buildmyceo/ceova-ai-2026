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
    description: "Read, search, send, reply, draft and organize Gmail. MANDATORY TWO-WAY DRAFT WORKFLOW: When asked to send OR reply to an email, ALWAYS use draft_email first (pass thread_id if replying to a thread). Present the full draft preview in chat (To, Subject, Body) and ask user to confirm before sending. ONLY use send_email or reply_email after the user explicitly confirms (e.g. 'send it', 'yes').",
    keywords: ["email", "mail", "gmail", "send", "inbox", "reply", "draft", "message", "compose", "unread", "attachment", "forward", "cc", "bcc", "subject"],
    toolIds: ["gmail_connector"],
    memoryCategories: ["email", "contacts", "communication"],
  },
  {
    id: "calendar",
    description: "Create, edit, delete and search Google Calendar events. When user asks to schedule, set, or book a meeting or event, calculate the start and end time from current time and immediately call create_event.",
    keywords: ["calendar", "calender", "clender", "clende", "calander", "event", "meeting", "metting", "schedule", "schedul", "appointment", "apointment", "remind", "reminder", "book", "reschedule", "cancel", "invite", "agenda", "tomorrow", "next week", "set calendar", "set clender", "set calender", "google calendar"],
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
      "web app", "landing page", "cloud project", "deploy website", "ceova.online",
      "restaurant website", "portfolio website", "ecommerce store", "saas app", "frontend", "build app", "create app",
      "webpage", "web page", "dashboard app", "fullstack app", "build me a website", "create me a website",
      // Modifications
      "update website", "modify website", "fix website", "edit website", "redesign website",
      // Plan/approval flow
      "implementation plan", "proceed with website", "build the website", "website plan",
      "start building", "use placeholders", "placeholder content",
      // UI component keywords (specific)
      "navbar", "change navbar", "update navbar", "hero section", "header section", "footer section",
      // Technical specification terms
      "index.html", "style.css", "app.js", "tailwind css", "responsive layout", "three.js", "chart.js",
      // Specific creation triggers
      "please create a website", "please build a website", "build a website", "create a website", "design a website"
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
    description: "Generate high-quality AI images, illustrations, and visual art from text prompts, and perform surgical inpainting / object removal using OpenAI gpt-image-2.5-sunburst. Use this when the user requests to create, draw, generate, or remove objects/people from an image.",
    keywords: [
      "generate image", "create image", "make image", "draw", "paint", "illustration", "generate picture", "create picture",
      "make picture", "generate photo", "create photo", "dall-e", "dalle", "render image", "generate artwork", "draw me",
      "design logo", "generate graphic", "generate an image", "generate a photo", "generate a picture", "create an image",
      "create a picture", "make an image", "ai image", "artwork", "generate_image",
      "genrate image", "genrate picture", "genrate photo", "genrate a", "genrate an", "genrate artwork",
      "generate a", "generate an", "draw a", "draw me", "paint a", "paint me", "sketch a", "sketch of",
      "illustration of", "picture of", "pic of", "photo of", "photograph of", "image of", "artwork of",
      "poster", "make poster", "create poster", "generate poster", "design poster", "launch poster",
      "flyer", "make flyer", "create flyer", "generate flyer", "design flyer",
      "banner", "make banner", "create banner", "generate banner", "design banner",
      "marketing post", "social media post", "creative", "advertisement", "ad",
      "brochure", "cover", "graphic design", "promotional", "mockup",
      "make a poster", "create a poster", "design a poster", "generate a poster",
      "make a flyer", "create a flyer", "design a flyer", "generate a flyer",
      "remove person", "remove both person", "remove people", "erase person", "erase both person", "remove from image",
      "remove object", "recreate scene", "without person", "without people", "erase object", "remove that", "remove this",
      "remove laptop", "remove macbook", "remove mackbook", "remove bottle", "remove bottel", "take out", "cut out", "crop out"
    ],
    toolIds: ["generate_image"],
    memoryCategories: ["preferences"],
  },
  {
    id: "image_process",
    description: "Analyze images, remove backgrounds, describe image contents, and perform OCR. Use this when the user has ATTACHED an existing image and wants it processed.",
    keywords: [
      "remove background", "remove bg", "transparent background", "transparent png", "cutout background",
      "analyze image", "describe image", "what is this", "ocr", "read image", "detect", "vision",
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
  {
    id: "web_search",
    description: "Search the live web and internet for current information, latest news, scientific research, articles, studies, documentation, and live facts. Use this to perform deep research and find live information.",
    keywords: [
      "search", "web search", "google", "browse", "look up", "find online", "research", "reserch",
      "latest", "news", "today", "current", "who is", "what is", "papers", "studies", "article",
      "fact check", "recent", "real time", "deep research", "literature"
    ],
    toolIds: ["web_search"],
    memoryCategories: ["research", "information"],
  },
  {
    id: "provenance",
    description: "Verify whether an image, document, email, or calendar event was generated or handled by Ceova AI by checking its hidden cryptographic watermark and provenance signature. Always use this when the user asks if an image/file was generated by Ceova, asks which image is generated by Ceova, asks to check or verify a watermark, or asks about the authenticity of an artifact.",
    keywords: [
      "watermark", "water mark", "watermarks", "provenance", "ceova",
      "generated by ceova", "genrated by ceova", "is this ceova", "made by ceova",
      "created by ceova", "verify watermark", "check watermark", "is this ai",
      "which image is genrated", "which image is generated", "which one is generated",
      "which one did you generate", "did you generate", "did ceova generate",
      "did you make this", "authentic", "authenticity", "verify", "tamper", "signature"
    ],
    toolIds: ["verify_ceova_provenance"],
    memoryCategories: ["security", "preferences"],
  },
];

/**
 * Returns a compact string describing all capabilities.
 * This is what gets injected into the system prompt (not the full tool schemas).
 */
export function getCapabilitySummary(): string {
  return CAPABILITIES.map(c => `- ${c.id}: ${c.description}`).join("\n");
}
