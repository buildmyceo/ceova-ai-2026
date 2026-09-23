/**
 * Curated greeting headlines and subtitle placeholders for Ceova.
 * Each headline is designed to form a concise 3-4 word title when paired with the user's name:
 * e.g. "Good morning, Harshit" (3 words), "Rise and shine, Harshit" (4 words), "Ready to build, Harshit" (4 words).
 * 
 * Exactly 10 curated headlines per time of day (morning, afternoon, evening, night).
 */

export const TIME_GREETINGS = {
    morning: [
        "Good morning",
        "Rise and shine",
        "Ready to build",
        "Start your day",
        "Time to create",
        "Make today count",
        "Kickstart your day",
        "A fresh start",
        "Welcome back today",
        "Great seeing you"
    ],
    afternoon: [
        "Good afternoon",
        "Keep pushing forward",
        "Afternoon focus mode",
        "Midday momentum boost",
        "Ready for more",
        "Time to build",
        "Back at it",
        "Powering through midday",
        "Afternoon is yours",
        "Keep up momentum"
    ],
    evening: [
        "Good evening",
        "Winding down today",
        "Time to reflect",
        "Evening wrap up",
        "Finishing strong today",
        "Great evening ahead",
        "Review your wins",
        "Unwind and reflect",
        "Peaceful evening vibes",
        "Closing out today"
    ],
    night: [
        "Good night",
        "Late night hustle",
        "Burning midnight oil",
        "Late night flow",
        "Working late tonight",
        "Midnight ideas flowing",
        "Deep night focus",
        "Night owl mode",
        "Still crushing goals",
        "Quiet night thoughts"
    ]
};

export const TIME_SUBTITLES = {
    morning: [
        "What would you like to build or explore this morning?",
        "How can Ceova help you kick off your day?",
        "Set your goals and let's bring your ideas to life.",
        "Ready to dive into your next big milestone?"
    ],
    afternoon: [
        "What would you like to build or explore this afternoon?",
        "Keep the momentum rolling—what's on your agenda?",
        "Let's tackle your priorities and optimize your workflow.",
        "Ceova is ready to collaborate on your midday tasks."
    ],
    evening: [
        "How can Ceova assist you this evening?",
        "Time to wrap up key items or reflect on today's progress.",
        "Let's polish your projects before calling it a day.",
        "Winding down or sketching tomorrow's strategy?"
    ],
    night: [
        "Burning the midnight oil? How can Ceova help you tonight?",
        "Late hours, deep focus. What are we solving tonight?",
        "The quiet hours are great for deep thinking and code.",
        "Ceova is always here whenever inspiration strikes."
    ]
};

/**
 * Returns the current time period block.
 * @param {Date} [date] 
 * @returns {'morning' | 'afternoon' | 'evening' | 'night'}
 */
export function getTimePeriod(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
}

/**
 * Resolves the user name strictly from Profile (Google OAuth metadata or 'profile' category memory).
 * NEVER matches business or customer memories (like 'Customer Name: Rohit').
 * 
 * @param {object} session - Supabase session object
 * @param {Array} userMemories - List of memories
 * @returns {string} Formatted first name or empty string
 */
export function getGreetingName(session, userMemories = []) {
    // 1. Google OAuth user metadata
    const googleGiven = session?.user?.user_metadata?.given_name?.trim();
    const googleFull = session?.user?.user_metadata?.full_name?.trim();
    const googleName = session?.user?.user_metadata?.name?.trim();

    let rawName = googleGiven || (googleFull ? googleFull.split(/\s+/)[0] : '') || (googleName ? googleName.split(/\s+/)[0] : '');

    // 2. If not in Google metadata, check memory ONLY with category === 'profile'
    if (!rawName && Array.isArray(userMemories)) {
        const profileMemory = userMemories.find(m => {
            const cat = String(m.category || '').toLowerCase().trim();
            const title = String(m.title || '').toLowerCase().trim();
            return cat === 'profile' && (title.includes('user') || title.includes('name') || title === 'profile');
        });

        if (profileMemory?.value) {
            rawName = String(profileMemory.value).trim().split(/\s+/)[0];
        }
    }

    // 3. Fallback to email username if nothing else
    if (!rawName && session?.user?.email) {
        rawName = session.user.email.split('@')[0].trim();
    }

    if (!rawName) return '';

    // Clean and capitalize first letter
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
}

/**
 * Generates the greeting headline string in format: {headline}, {userName}
 * @param {'morning' | 'afternoon' | 'evening' | 'night'} timePeriod 
 * @param {number} index 
 * @param {string} userName 
 * @returns {string}
 */
export function getGreetingHeadline(timePeriod, index, userName) {
    const list = TIME_GREETINGS[timePeriod] || TIME_GREETINGS.afternoon;
    const safeIndex = Math.abs(Number(index) || 0) % list.length;
    const headline = list[safeIndex];
    return userName ? `${headline}, ${userName}` : headline;
}

/**
 * Returns a matching subtitle for the time period and index.
 * @param {'morning' | 'afternoon' | 'evening' | 'night'} timePeriod 
 * @param {number} index 
 * @returns {string}
 */
export function getGreetingSubtitle(timePeriod, index) {
    const list = TIME_SUBTITLES[timePeriod] || TIME_SUBTITLES.afternoon;
    const safeIndex = Math.abs(Number(index) || 0) % list.length;
    return list[safeIndex];
}
