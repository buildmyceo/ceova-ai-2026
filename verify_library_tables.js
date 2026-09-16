import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let dbUrl = "";
let dbKey = "";

if (fs.existsSync(".env")) {
  const envFile = fs.readFileSync(".env", "utf8");
  envFile.split("\n").forEach(line => {
    if (line.startsWith("SUPABASE_URL=")) dbUrl = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("SUPABASE_SERVICE_ROLE=")) dbKey = line.split("=")[1].replace(/"/g, "").trim();
    if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) dbKey = line.split("=")[1].replace(/"/g, "").trim();
  });
}


const supabase = createClient(dbUrl, dbKey);

async function verifyTables() {
  const tables = ['files', 'folders', 'ai_generated_files', 'file_embeddings', 'drive_sync_logs'];
  console.log("Checking CEOVA Library tables on live Supabase project...");
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': ERROR (${error.message})`);
    } else {
      console.log(`Table '${table}': READY ✅`);
    }
  }
}

verifyTables();
