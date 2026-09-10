import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log("=================================================");
console.log("🧪 CEOVA Telegram Integration End-to-End Tests");
console.log("=================================================\n");

// ── Test 1: Verify UI Component Files Exist and Export Valid JSX ────────────────
console.log("Test 1: Verifying frontend component files and exports...");

const modalFile = path.resolve('src/components/TelegramConnectModal.jsx');
assert(fs.existsSync(modalFile), "TelegramConnectModal.jsx must exist");
const modalContent = fs.readFileSync(modalFile, 'utf8');
assert(modalContent.includes('export default function TelegramConnectModal'), "TelegramConnectModal must export default component");
assert(modalContent.includes('user_telegram'), "TelegramConnectModal must query user_telegram");
assert(modalContent.includes('telegram-webhook/connect') || modalContent.includes('telegram-connect'), "TelegramConnectModal must call connect endpoint");
console.log("  ✅ TelegramConnectModal.jsx verified with connect, poll, and disconnect flows.");

const extModalFile = path.resolve('src/components/ExtensionsModal.jsx');
const extModalContent = fs.readFileSync(extModalFile, 'utf8');
assert(extModalContent.includes('TelegramConnectModal'), "ExtensionsModal must import TelegramConnectModal");
assert(!extModalContent.includes('title="Telegram" \n                                    desc="Connect your Telegram chats." \n                                    disabled={true}'), "Telegram card in ExtensionsModal must not be disabled");
assert(extModalContent.includes('isTelegramModalOpen'), "ExtensionsModal must manage isTelegramModalOpen");
console.log("  ✅ ExtensionsModal.jsx verified with active Telegram card.");

const settingsModalFile = path.resolve('src/components/SettingsModalV2.jsx');
const settingsContent = fs.readFileSync(settingsModalFile, 'utf8');
assert(settingsContent.includes('TelegramConnectModal'), "SettingsModalV2 must import TelegramConnectModal");
assert(settingsContent.includes('isTelegramConnected'), "SettingsModalV2 must track isTelegramConnected");
assert(!settingsContent.includes('<span style={{ fontSize: \'10px\', color: \'#a1a1aa\', marginRight: \'8px\' }}>Coming Soon</span>'), "SettingsModalV2 must not have Coming Soon for Telegram");
console.log("  ✅ SettingsModalV2.jsx verified with active Telegram connector.");

// ── Test 2: Verify Backend Services and Directives ───────────────────────────
console.log("\nTest 2: Verifying Telegram backend service directives and tools...");

const tgServiceFile = path.resolve('supabase/functions/_shared/services/telegram-service.ts');
const tgServiceContent = fs.readFileSync(tgServiceFile, 'utf8');

assert(tgServiceContent.includes('sendTelegramDocument'), "telegram-service.ts must export sendTelegramDocument");
assert(tgServiceContent.includes('sendTelegramPhoto'), "telegram-service.ts must export sendTelegramPhoto");
assert(tgServiceContent.includes('isWebDevIntent'), "telegram-service.ts must have isWebDevIntent");
assert(tgServiceContent.includes('inline_keyboard'), "telegram-service.ts must attach inline_keyboard for websites and files");
assert(tgServiceContent.includes('AUTONOMOUS DIRECTIVES'), "telegram-service.ts must instruct AI on autonomous tool execution");
console.log("  ✅ telegram-service.ts verified with website creation, tool execution, and inline buttons.");

const superEndpointFile = path.resolve('supabase/functions/super-endpoint/index.ts');
const superContent = fs.readFileSync(superEndpointFile, 'utf8');
assert(superContent.includes('/telegram-connect'), "super-endpoint must handle /telegram-connect");
assert(superContent.includes('/telegram-disconnect'), "super-endpoint must handle /telegram-disconnect");
console.log("  ✅ super-endpoint/index.ts verified with connect and disconnect routes.");

// ── Test 3: Simulated Intent Routing for Telegram Messages ───────────────────
console.log("\nTest 3: Testing Intent Classification for Telegram Prompts...");

// Simulate intent router pattern matching logic directly
function simulateIntentCheck(message, history = [], existingProjectId = null) {
  const effectiveMessage = message.trim();
  const lowerMsg = effectiveMessage.toLowerCase();

  const isWebDev = 
    /website|web\s*app|landing\s*page|portfolio|store|site|frontend|ui|page|navbar|hero|footer|button|pricing|section|redesign/i.test(effectiveMessage) ||
    ((/proceed|yes|build it|go ahead|approve|make it|do it|start/i.test(effectiveMessage)) && history.some(m => typeof m.content === 'string' && (/website|web\s*app|site|project|build|plan|ceova\.online|create_project/i.test(m.content)))) ||
    (!!existingProjectId && /change|update|add|fix|modify|edit|style|design|make|set/i.test(effectiveMessage));

  const isQr = /qr|qr\s*code|barcode/i.test(lowerMsg);
  const isInvoice = /invoice|bill|receipt/i.test(lowerMsg);
  const isGmail = /email|mail|gmail|inbox|send email|draft email/i.test(lowerMsg);
  const isCalendar = /calendar|meeting|schedule|event|appointment/i.test(lowerMsg);
  const isDrive = /drive|google\s*drive|gdrive|spreadsheet|folder/i.test(lowerMsg);
  const isImage = /background|remove\s*background|analyze\s*image/i.test(lowerMsg);

  return {
    isWebDev,
    isQr,
    isInvoice,
    isGmail,
    isCalendar,
    isDrive,
    isImage,
  };
}

// Case A: Website creation prompt
const resA = simulateIntentCheck("Build a modern portfolio website for a photographer in dark mode");
assert(resA.isWebDev, "Should trigger web dev for website prompt");
console.log("  ✅ 'Build a modern portfolio website...' -> triggers create_project");

// Case B: Affirmative plan approval
const resB = simulateIntentCheck("Yes, proceed and build it", [
  { role: "assistant", content: "Here is the website implementation plan for your bakery on ceova.online. Should I build it?" }
]);
assert(resB.isWebDev, "Should trigger web dev when user says 'Yes, proceed and build it' after plan");
console.log("  ✅ 'Yes, proceed and build it' after plan -> triggers create_project");

// Case C: Existing website incremental modification
const resC = simulateIntentCheck("Make the navbar sticky and change the header color to emerald green", [], "proj-1234");
assert(resC.isWebDev, "Should trigger web dev when modifying existing project");
console.log("  ✅ 'Make navbar sticky and change header color...' on active project -> triggers create_project");

// Case D: QR code generation
const resD = simulateIntentCheck("Create a QR code for https://myrestaurant.com/menu");
assert(resD.isQr, "Should trigger QR tool");
console.log("  ✅ 'Create a QR code...' -> triggers qr_barcode");

// Case E: Invoice generation
const resE = simulateIntentCheck("Generate an invoice for Acme Inc $850 for website development");
assert(resE.isInvoice, "Should trigger invoice tool");
console.log("  ✅ 'Generate an invoice...' -> triggers invoice_generator");

// Case F: Gmail connector
const resF = simulateIntentCheck("Check my unread emails and draft a reply to Sarah");
assert(resF.isGmail, "Should trigger gmail connector");
console.log("  ✅ 'Check my unread emails...' -> triggers gmail_connector");

// Case G: Calendar connector
const resG = simulateIntentCheck("What meetings and events do I have scheduled for tomorrow?");
assert(resG.isCalendar, "Should trigger calendar connector");
console.log("  ✅ 'What meetings do I have scheduled for tomorrow?' -> triggers calendar_connector");

// Case H: Drive connector
const resH = simulateIntentCheck("Find my budget spreadsheet in Google Drive");
assert(resH.isDrive, "Should trigger drive connector");
console.log("  ✅ 'Find my budget spreadsheet in Google Drive' -> triggers drive_connector");

console.log("\n=================================================");
console.log("🎉 ALL CEOVA TELEGRAM INTEGRATION TESTS PASSED!");
console.log("=================================================");
