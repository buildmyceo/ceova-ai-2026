import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync(".env", "utf8");
let dbUrl = "", dbKey = "";
envFile.split("\n").forEach(line => {
  if (line.startsWith("SUPABASE_URL=")) dbUrl = line.split("=")[1].replace(/"/g, "").trim();
  if (line.startsWith("SUPABASE_SERVICE_ROLE=")) dbKey = line.split("=")[1].replace(/"/g, "").trim();
});

const supabase = createClient(dbUrl, dbKey);
async function run() {
    // try to select one row from user_memory
    const { data, error } = await supabase.from('user_memory').select('*').limit(1);
    if (error) {
        console.error("Error reading user_memory:", error);
    } else {
        console.log("Found row:");
        if (data && data.length > 0) {
            console.log(Object.keys(data[0]));
        } else {
            console.log("No data, but query succeeded");
        }
    }
}
run();
