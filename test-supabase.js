import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://invalid', 'invalid')
try {
  const { data, error } = await supabase.from('dev_sessions').insert({
    user_id: "not-a-uuid",
    workspace_id: "not-a-uuid",
    title: "Test"
  }).select().single();
  console.log(error);
} catch (e) {
  console.log("THROWN:", e.name, e.message);
}
