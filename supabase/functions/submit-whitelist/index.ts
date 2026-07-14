import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants ────────────────────────────────────────────────────────────────
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Test Turnstile secret always passes: '1x0000000000000000000000000000000AA'
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') ?? '1x0000000000000000000000000000000AA';

// EVM address: 0x + 40 hex characters
const EVM_REGEX = /^0x[0-9a-fA-F]{40}$/;

// Simple in-memory rate limiter (resets on cold-start)
const ipHits    = new Map();
const RATE_LIMIT  = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin' : '*', // narrow to your domain in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')   return respond(405, { error: 'Method not allowed' });

  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return respond(429, { error: 'rate_limit', message: 'Too many attempts. Please wait and try again.' });
  }

  // Body size guard (32 KB)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 32768) return respond(413, { error: 'Payload too large' });

  // Parse body
  let body;
  try { body = await req.json(); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  // Honeypot: silently accept to avoid tipping off bots
  if (body.wl_confirm) return respond(200, { ok: true });

  // Minimum time gate
  if (Number(body.elapsed_ms ?? 0) < 3000) {
    return respond(400, { error: 'Form completed too quickly.' });
  }

  // Wallet validation (server-side authoritative)
  const rawWallet = typeof body.wallet_address === 'string' ? body.wallet_address.trim() : '';
  if (!EVM_REGEX.test(rawWallet)) {
    return respond(400, { error: 'wallet', message: 'Please enter a valid EVM wallet address.' });
  }
  const normalizedWallet = rawWallet.toLowerCase();

  // DB insert via service-role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: insertError } = await supabase.from('whitelist_submissions').insert({
    wallet_address: normalizedWallet,
  });

  if (insertError) {
    // PostgreSQL duplicate key violation
    if (insertError.code === '23505') {
      return respond(409, { error: 'duplicate', message: 'This wallet is already registered for the whitelist.' });
    }
    console.error('DB error:', insertError);
    return respond(500, { error: 'server', message: 'Something went wrong. Please try again shortly.' });
  }

  return respond(200, { ok: true });
});

// ── Helper ────────────────────────────────────────────────────────────────────
function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}