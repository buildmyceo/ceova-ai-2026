import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync(".env", "utf8");
let dbUrl = "", dbKey = "";
envFile.split("\n").forEach(line => {
  if (line.startsWith("SUPABASE_URL=")) dbUrl = line.split("=")[1].replace(/"/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE=")) dbKey = line.split("=")[1].replace(/"/g, "").trim();
});

const supabase = createClient(dbUrl, dbKey);
supabase.from('user_google_tokens').select('*').limit(1).then(res => {
  if (res.error) {
    console.error("Error:", res.error);
  } else {
    console.log("Token:", JSON.stringify(res.data, null, 2));
  }
});
