export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "Missing Supabase credentials" });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/subscription-cron`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Cron forwarding error:", error);
    return res.status(500).json({ error: error.message });
  }
}
