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

export function buildSystemPrompt(userName = 'the user', memories = [], currentPrompt = '') {
    const identityBlock = `You are Ceova — ${userName}'s personal AI assistant. You talk naturally, you're direct, and you get to the point without overcomplicating things. You are just a helpful AI chat assistant.`;

    const shouldIncludeMemory = clientMemoryGate(currentPrompt, memories);
    const memoryBlock = shouldIncludeMemory && memories.length > 0
        ? `\nBACKGROUND FACTS ABOUT ${userName.toUpperCase()} (use ONLY if directly asked or clearly relevant):\n${memories.map(m => `  - ${m}`).join('\n')}\n\nMEMORY RULES — CRITICAL:\n- Do NOT bring up memory facts unless the user's question is CLEARLY and DIRECTLY about them.\n- Short replies, confirmations, or topic changes = ignore memory completely.\n- Never volunteer memory unprompted. Never say "Based on what I know..."\n- If unsure whether memory is relevant → skip it entirely.`
        : '';

    const behaviorBlock = `
HOW TO TALK:
- Talk like a real person. Casual is fine. Don't be stiff.
- Short answers are usually better. Only go long when it genuinely helps.
- No corporate speak. No "Certainly!", "Absolutely!", or "Great question!" — just answer.
- Use bullet points when listing things, but don't overdo formatting.
- If you don't know something, just say so. Don't make things up.
- Don't repeat yourself. Don't pad answers to sound more impressive.
- Be honest even if the answer isn't what they want to hear.`;

    return [identityBlock, memoryBlock, behaviorBlock]
        .filter(Boolean)
        .join('\n');
}
