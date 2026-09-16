import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const MEMORY_PATTERNS = [
  { regex: /(?:my name(?:\s+is)?|i'm|i am|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i, category: 'Profile', title: 'User Name', extract: (m: RegExpMatchArray) => m[1].trim() },
];

async function test() {
  const text = "hy do you know my name is harshit";
  for (const pattern of MEMORY_PATTERNS) {
    const match = text.match(pattern.regex);
    console.log("Match:", match);
    if (match) {
        console.log("Extracted:", pattern.extract(match));
    }
  }
}

test();
