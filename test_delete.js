import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function testDelete() {
    const { data: mData, error: msgErr } = await supabase.from('messages').select('user_id').limit(1);
    console.log("messages user_id select error:", msgErr, mData);

    const { data: cData, error: chatErr } = await supabase.from('chats').select('user_id').limit(1);
    console.log("chats user_id select error:", chatErr, cData);
}

testDelete();
