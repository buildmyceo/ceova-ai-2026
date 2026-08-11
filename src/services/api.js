const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const BACKEND_URL = `${API_BASE}/chat`;
const MESSAGES_URL = `${API_BASE}/messages`;

export async function sendMessage(message, chat_id, user_id) {
    const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ message, chat_id, user_id })
    });

    if (!response.ok) {
        throw new Error("Server error");
    }

    return response.json();
}

export async function loadChatHistory(user_id, chat_id) {
    const response = await fetch(`${MESSAGES_URL}/${user_id}/${chat_id}`);
    if (!response.ok) {
        throw new Error("Failed to load history");
    }
    return response.json();
}
