import fs from 'fs';

// Read .env to get variables
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function test() {
  // Use REST API to get user_id from subscription_usage
  const dbRes = await fetch(`${url}/rest/v1/subscription_usage?total_tokens=eq.50001&select=user_id`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await dbRes.json();
  const userId = data[0].user_id;
  
  // Call super-endpoint
  const res = await fetch(`${url}/functions/v1/super-endpoint`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: userId,
      prompt: "Hello, this should be blocked."
    })
  });
  
  const status = res.status;
  const json = await res.json();
  console.log(`HTTP ${status}`);
  console.log(JSON.stringify(json, null, 2));
}

test();
