import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY
);

async function check() {
  const { data, error } = await supabase.from('chats').select('*');
  console.log("CHATS:");
  console.log(data);
  const { data: messages } = await supabase.from('messages').select('*');
  console.log("MESSAGES COUNT:");
  console.log(messages?.length);
}
check();
