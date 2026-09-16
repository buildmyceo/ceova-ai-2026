import { Client } from "https://deno.land/x/postgres/mod.ts";
import "https://deno.land/std@0.177.0/dotenv/load.ts";

const dbUrl = Deno.env.get("DATABASE_URL");
if (!dbUrl) throw new Error("DATABASE_URL not found");

const sql = await Deno.readTextFile("supabase/migrations/20260709000000_create_gmail_tokens.sql");

const client = new Client(dbUrl);
await client.connect();
try {
  await client.queryArray(sql);
  console.log("Migration executed successfully!");
} catch(e) {
  console.error("Migration failed", e);
} finally {
  await client.end();
}
