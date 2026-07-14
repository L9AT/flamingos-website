/* ═══════════════════════════════════════
   FLAMINGOS — CONFIG.JS
   All configurable constants in one place.
   Edit this file — do not hardcode values elsewhere.
═══════════════════════════════════════ */

window.WL_CONFIG = Object.freeze({
  /* Set this to the final public domain, e.g. https://flamingos.xyz */
  SITE_URL: 'https://www.flamingoseth.xyz',
  /* ── Social links ────────────────────────────────────── */
  X_PROFILE_URL: 'https://x.com/intent/follow?screen_name=Flamingos_ETH',
  X_POST_URL: 'https://x.com/YOUR_HANDLE/status/YOUR_POST_ID',

  /* ── Supabase ────────────────────────────────────────── */
  SUPABASE_URL: 'https://taxbqinbjrbrytaxxjzi.supabase.co',
  // Anon key is safe to expose in the browser (read-only + RLS protected)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheGJxaW5ianJicnl0YXh4anppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTM4NTYsImV4cCI6MjA5MjM2OTg1Nn0.sZ8mbg1LUs2mJepn9DqHqBenM12TjsLlAdbeicMVP_A',

  /* ── Edge Function endpoint ──────────────────────────── */
  EDGE_FUNCTION_URL: 'https://taxbqinbjrbrytaxxjzi.supabase.co/functions/v1/submit-whitelist',
  GALLERY_FUNCTION_URL: 'https://taxbqinbjrbrytaxxjzi.supabase.co/functions/v1/community-gallery',

  /* ── Cloudflare Turnstile (replace before launch) ────── */
  // Test keys: site key = '1x00000000000000000000AA', always passes
  TURNSTILE_SITE_KEY: '1x00000000000000000000AA',

  /* ── Minimum form-fill time (ms) to block instant bots ─ */
  MIN_ELAPSED_MS: 3000,
});
