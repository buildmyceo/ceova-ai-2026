
import { GmailConnectorTool } from './supabase/functions/_shared/tools/tools/gmail.ts';
import "https://deno.land/std@0.177.0/dotenv/load.ts";

async function run() {
  console.log("Testing Gmail Tool...");
  const res = await GmailConnectorTool.execute({
    userId: "a12dc493-6f2f-435a-bfae-f81a63acdd15",
    args: { action: "read_inbox" },
    onStatusUpdate: (s) => console.log("Status:", s)
  });
  console.log(JSON.stringify(res, null, 2));
}

run();
