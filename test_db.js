import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: files } = await supabase.from('files').select('id, name, web_view_link');
  console.log("FILES:", files);
  
  const { data: messages } = await supabase.from('messages').select('id, attachments').not('attachments', 'is', null);
  console.log("MESSAGES with attachments:", JSON.stringify(messages, null, 2));
}

run();
