const WL_CLOSES_AT = Date.parse("2026-07-15T15:27:25Z");
const UPSTREAM_URL = "https://taxbqinbjrbrytaxxjzi.supabase.co/functions/v1/submit-whitelist";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (Date.now() >= WL_CLOSES_AT) {
    return res.status(410).json({ error: "closed", message: "The whitelist is closed." });
  }

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json().catch(() => ({
      error: "server",
      message: "Something went wrong. Please try again shortly.",
    }));
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error("Whitelist proxy error:", error);
    return res.status(502).json({
      error: "server",
      message: "Something went wrong. Please try again shortly.",
    });
  }
};
