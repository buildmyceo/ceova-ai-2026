import { getAdminClient } from "./auth.ts";
import { Logger } from "./logger.ts";

export const loadMemory = async (userId: string) => {
  const supabase = getAdminClient();
  // Fetch user preferences/configs
  const { data: configs } = await supabase
    .from('user_ai_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  return { configs };
};

export const loadConversation = async (userId: string) => {
  // Logic to load previous messages
  return [];
};
