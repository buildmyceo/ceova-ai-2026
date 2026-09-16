import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let SUPABASE_URL = "";
let SUPABASE_KEY = "";

// Check all env files
const files = ['.env', '.env.local', '.env.production'];
for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    content.split('\n').forEach(line => {
      if (line.startsWith("VITE_SUPABASE_URL=")) SUPABASE_URL = line.split("=")[1].replace(/"/g, "").trim();
      if (line.startsWith("VITE_SUPABASE_ANON_KEY=")) SUPABASE_KEY = line.split("=")[1].replace(/"/g, "").trim();
      if (line.startsWith("SUPABASE_URL=")) SUPABASE_URL = line.split("=")[1].replace(/"/g, "").trim();
      if (line.startsWith("SUPABASE_KEY=")) SUPABASE_KEY = line.split("=")[1].replace(/"/g, "").trim();
    });
  }
}

if (!SUPABASE_URL) {
  console.error("No SUPABASE_URL found");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const email = `testuser_${Date.now()}@example.com`;
  const password = "password123";
  console.log("Signing up with", email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Test User" } }
  });
  
  if (error) {
    console.error("Signup error:", error);
  } else {
    console.log("Signup success:", data);
  }
}
test();
