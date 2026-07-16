const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "https://flamingos-website.vercel.app",
  "https://flamingoseth.xyz",
  "https://www.flamingoseth.xyz",
]);

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet = typeof req.body?.wallet_address === "string"
    ? req.body.wallet_address.trim().toLowerCase()
    : "";

  if (!EVM_RE.test(wallet)) {
    return res.status(400).json({ error: "wallet", message: "Enter a valid EVM wallet." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "server", message: "Checker is temporarily unavailable." });
  }

  try {
    const query = new URL(`${supabaseUrl}/rest/v1/whitelist_submissions`);
    query.searchParams.set("select", "id");
    query.searchParams.set("wallet_address", `eq.${wallet}`);
    query.searchParams.set("limit", "1");

    const response = await fetch(query, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);

    const rows = await response.json();
    return res.status(200).json({ whitelisted: Array.isArray(rows) && rows.length > 0 });
  } catch (error) {
    console.error("WL checker error:", error);
    return res.status(502).json({ error: "server", message: "Unable to check right now. Try again." });
  }
};
