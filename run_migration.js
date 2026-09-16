import fs from "fs";
import pkg from 'pg';
const { Client } = pkg;

const envFile = fs.readFileSync(".env", "utf8");
let dbUrl = "";
envFile.split("\n").forEach(line => {
  if (line.startsWith("DATABASE_URL=")) {
    dbUrl = line.split("=")[1].replace(/"/g, "").trim();
  }
});

const sql = fs.readFileSync("supabase/migrations/20260727000000_workspace_architecture.sql", "utf8");

const client = new Client({ 
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => {
  return client.query(sql);
}).then(() => {
  console.log("Migration executed successfully!");
  return client.end();
}).catch(e => {
  console.error("Migration failed", e);
  client.end();
});
