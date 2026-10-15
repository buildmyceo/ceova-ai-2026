/**
 * CEOVA Clean System Prompt Builder (V1 Architecture)
 */

/**
 * Quick client-side memory relevance check.
 * Returns false for messages that obviously don't need memory.
 */
function clientMemoryGate(currentPrompt = '', memories = []) {
    if (!memories || memories.length === 0) return false;
    if (!currentPrompt) return false;

    const p = currentPrompt.trim().toLowerCase().replace(/[!?.]+$/, '');
    const words = p.split(/\s+/).filter(Boolean);

    const neverNeed = new Set([
        'ok', 'okay', 'k', 'yes', 'no', 'sure', 'yep', 'yup', 'nope', 'nah',
        'cool', 'got it', 'alright', 'fine', 'great', 'nice', 'good', 'perfect',
        'thanks', 'thank you', 'ty', 'thx', 'np', 'welcome', 'noted',
        'hi', 'hey', 'hello', 'sup', 'yo', 'hiya', 'howdy', 'hii',
        'lol', 'haha', 'hmm', 'oh', 'ah', 'wow', 'not really', 'nvm'
    ]);
    if (neverNeed.has(p)) return false;

    const hasPersonalQuery = /\b(my|mine|i am|about me|who am i|remember|what do you know|my goal|my name|my age|my job|i live|i study|i work)\b/i.test(currentPrompt);
    if (words.length <= 3 && !hasPersonalQuery) return false;
    if (hasPersonalQuery) return true;

    return true;
}

/**
 * Security Filter: Strip any camera credentials, RTSP passwords, or CCTV secret tokens
 * to ensure camera passwords and device credentials are NEVER exposed to the main AI model.
 */
export function sanitizePromptCredentials(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        // Strip RTSP/HTTP inline credentials: rtsp://user:pass@host -> rtsp://host
        .replace(/(rtsp|http|https):\/\/[^:@\s]+:[^:@\s]+@/gi, '$1://[CREDENTIALS_REDACTED]@')
        // Strip password assignments: cctv_password=..., camera_pass=...
        .replace(/(?:camera|cctv|cam)[_-]?(?:password|pass|secret|pwd)\s*[:=]\s*['"]?[^\s,'"]+['"]?/gi, 'camera_password=[REDACTED]')
        // Strip generic auth tokens related to CCTV
        .replace(/cctv_loopback_[a-zA-Z0-9_-]+/g, '[CCTV_TOKEN_REDACTED]');
}

export function buildSystemPrompt(userName = 'the user', memories = [], currentPrompt = '', cctvContext = null) {
    const sanitizedPrompt = sanitizePromptCredentials(currentPrompt);
    const sanitizedMemories = (memories || []).map(m => sanitizePromptCredentials(m));

    const identityBlock = `You are Ceova — ${userName}'s personal AI assistant. You talk naturally, you're direct, and you get to the point without overcomplicating things. You are just a helpful AI chat assistant.`;

    const shouldIncludeMemory = clientMemoryGate(sanitizedPrompt, sanitizedMemories);
    const memoryBlock = shouldIncludeMemory && sanitizedMemories.length > 0
        ? `\nBACKGROUND FACTS ABOUT ${userName.toUpperCase()} (use ONLY if directly asked or clearly relevant):\n${sanitizedMemories.map(m => `  - ${m}`).join('\n')}\n\nMEMORY RULES — CRITICAL:\n- Do NOT bring up memory facts unless the user's question is CLEARLY and DIRECTLY about them.\n- Short replies, confirmations, or topic changes = ignore memory completely.\n- Never volunteer memory unprompted. Never say "Based on what I know..."\n- If unsure whether memory is relevant → skip it entirely.`
        : '';

    let cctvBlock = '';
    if (cctvContext) {
        const isConn = cctvContext.connected || (cctvContext.cameraCount > 0);
        const cams = cctvContext.cameras || [];
        const camList = cams.length > 0 
            ? cams.map(c => `  - ${c.name} (${c.ip || 'Local Network'}) [${c.status || 'ONLINE'}]`).join('\n')
            : '  - No cameras connected yet';

        cctvBlock = `\nLOCAL CCTV SURVEILLANCE STATUS:
- Status: ${isConn ? 'Online & Connected' : 'Offline / Standby'}
- Active Cameras (${cctvContext.cameraCount || cams.length}):
${camList}
- Local Credentials & Discovery:
  - Username: ${cctvContext.savedCredentials?.username || cams[0]?.username || 'admin'}
  - Camera IP: ${cctvContext.savedCredentials?.targetIp || cams[0]?.ip || 'Local Network'}
  - Password & Credentials: Saved securely on this local device only (NEVER uploaded to server)
- AI Vision Engine: ${cctvContext.aiEngineHealthy ? 'Healthy' : 'Standby'}
${cctvContext.latestReport ? `- Latest Background Surveillance Report: ${cctvContext.latestReport}` : ''}
When user asks about CCTV, cameras, IP, reports, or if CCTV is connected:
1. State clearly whether CCTV is connected (${isConn ? 'Yes, connected and monitoring' : 'Currently in standby/offline'}).
2. Mention the camera name, local IP address (${cctvContext.savedCredentials?.targetIp || cams[0]?.ip || 'Local Network'}), and recent report summary if available.
3. Confirm that credentials and IP are saved locally on this Mac only.`;
    }

    const behaviorBlock = `
HOW TO TALK:
- Talk like a real person. Casual is fine. Don't be stiff.
- Keep all responses extremely short, simple, and focused. Do not be wordy.
- No corporate speak. No "Certainly!", "Absolutely!", or "Great question!" — just answer.
- Use bullet points when listing things, but don't overdo formatting.
- If you don't know something, just say so. Don't make things up.
- Don't repeat yourself. Don't pad answers to sound more impressive.
- Be honest even if the answer isn't what they want to hear.
- Never output or inquire about raw camera or CCTV passwords.`;

    return [identityBlock, memoryBlock, cctvBlock, behaviorBlock]
        .filter(Boolean)
        .join('\n');
}

