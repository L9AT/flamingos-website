# Flamingos WL — Setup Guide

## Quick Start

### 1 — Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/taxbqinbjrbrytaxxjzi)
2. Go to **Settings → API**
3. Copy the **anon (public)** key → paste into `config.js` under `SUPABASE_ANON_KEY`
4. Copy the **service_role (secret)** key → you'll need this for the Edge Function secret (step 3)

### 2 — Cloudflare Turnstile

1. Open [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new site → choose **Invisible** or **Managed** widget type
3. Add your domain (e.g. `flamingos.xyz`) and `localhost` for local dev
4. Copy the **Site Key** → paste into `config.js` under `TURNSTILE_SITE_KEY`
5. Copy the **Secret Key** → you'll need this for the Edge Function secret (step 3)

### 3 — Edge Function Secrets

In Supabase Dashboard → **Edge Functions → submit-whitelist → Secrets**, add:

| Key | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Your service-role key from step 1 |
| `TURNSTILE_SECRET_KEY` | Your Turnstile secret key from step 2 |

> These secrets are injected as `Deno.env.get(...)` inside the Edge Function.
> They are never exposed to the browser.

### 4 — X (Twitter) URLs

Edit `config.js`:

```js
X_PROFILE_URL : 'https://x.com/YOUR_HANDLE',
X_POST_URL    : 'https://x.com/YOUR_HANDLE/status/YOUR_POST_ID',
```

### 5 — Database (already applied)

The `whitelist_submissions` table and RLS are already set up via the MCP migration.
You can verify in Supabase → **Table Editor → whitelist_submissions**.

RLS is enabled. The public browser **cannot** read, update, or delete submissions.
All inserts happen through the secure Edge Function using the service-role key.

---

## File Overview

| File | Purpose |
|---|---|
| `config.js` | All configurable constants (URLs, keys) |
| `index.html` | Updated hero button + modal markup |
| `style.css` | Modal CSS (appended, existing styles untouched) |
| `script.js` | WLModal JS module (appended, existing code untouched) |
| `.env.example` | Template for secrets |
| `vercel.json` | Vercel deployment config (caching, security headers) |

## Edge Function

Deployed at:
```
https://taxbqinbjrbrytaxxjzi.supabase.co/functions/v1/submit-whitelist
```

Security layers applied:
- Turnstile token verified server-side
- EVM wallet validated server-side
- Honeypot field checked
- Minimum 3-second form fill time gate
- 5 requests per IP per hour rate limit
- Body size capped at 32 KB
- Service-role key never sent to browser
- RLS locks down direct DB access
- Generic error messages (no internal details leaked)

## Production Checklist

- [ ] Replace Turnstile test keys with real keys
- [ ] Narrow `Access-Control-Allow-Origin` in Edge Function to your production domain
- [ ] Set `X_PROFILE_URL` and `X_POST_URL` in `config.js`
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` and `TURNSTILE_SECRET_KEY` as Edge Function secrets
- [ ] Remove `localhost` from Turnstile allowed origins after launch

## Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import the `flamingos-website` GitHub repository
3. Framework preset: **Other** (no build step needed — pure static site)
4. Root directory: `.` (the repo root)
5. Click **Deploy** — done!

> The `vercel.json` in this repo automatically configures caching for images/assets and security headers.

---

## Community Gallery Setup

The gallery UI is in `gallery.html`. The private moderation page is `gallery-admin.html`.

1. In **Supabase → SQL Editor**, run `supabase/migrations/002_community_gallery.sql`.
2. Deploy the Edge Function in `supabase/functions/community-gallery` with the name `community-gallery`.
3. In the function secrets, add a long random `GALLERY_ADMIN_KEY` alongside the existing `SUPABASE_SERVICE_ROLE_KEY`.
4. Open `/gallery-admin.html` and enter that admin key to approve/reject submissions and grant GTD spots.

Never put `GALLERY_ADMIN_KEY` or the Supabase service-role key in `config.js`.
