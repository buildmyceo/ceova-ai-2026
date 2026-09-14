import { getAdminClient } from "./auth.ts";
import { Logger } from "./logger.ts";

export const loadMemory = async (userId: string) => {
  const supabase = getAdminClient();
  // user_ai_configs is deprecated and dropped
  const configs = null;
    
  return { configs };
};

export const loadConversation = async (userId: string) => {
  // Logic to load previous messages
  return [];
};
