import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GALLERY_ADMIN_KEY = Deno.env.get('GALLERY_ADMIN_KEY') ?? '';
const BUCKET = 'community-gallery';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const ALLOWED_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);
const allowedOrigins = new Set([
  'https://flamingoseth.xyz',
  'https://www.flamingoseth.xyz',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
]);
const rateHits = new Map<string, { count: number; resetAt: number }>();
const voteHits = new Map<string, { count: number; resetAt: number }>();

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://flamingoseth.xyz',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function respond(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isAdmin(req: Request) {
  if (!GALLERY_ADMIN_KEY) return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${GALLERY_ADMIN_KEY}`;
}

function checkRateLimit(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const now = Date.now();
  const current = rateHits.get(ip);
  if (!current || current.resetAt <= now) {
    rateHits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

function checkVoteRateLimit(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const now = Date.now();
  const current = voteHits.get(ip);
  if (!current || current.resetAt <= now) {
    voteHits.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (current.count >= 20) return false;
  current.count += 1;
  return true;
}

async function hashVoterToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cleanText(value: FormDataEntryValue | null, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function validXUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function addSignedUrls(items: Array<Record<string, unknown>>) {
  if (!items.length) return items;
  const paths = items.map((item) => String(item.storage_path));
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) throw error;
  const urls = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return items.map((item) => ({ ...item, image_url: urls.get(String(item.storage_path)) ?? '' }));
}

async function listApproved(req: Request) {
  const { data, error } = await supabase
    .from('community_gallery_submissions')
    .select('id,title,creator_name,x_url,storage_path,gtd_spot,created_at')
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(60);
  if (error) {
    console.error('gallery approved query:', error);
    return respond(req, 500, { message: 'Could not load the gallery.' });
  }
  try {
    const approved = data ?? [];
    const ids = approved.map((item) => item.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: votes, error: votesError } = await supabase
        .from('community_gallery_votes')
        .select('submission_id')
        .in('submission_id', ids);
      if (votesError) console.error('gallery vote counts:', votesError);
      for (const vote of votes ?? []) {
        const id = String(vote.submission_id);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const items = approved.map((item) => ({ ...item, votes: counts.get(String(item.id)) ?? 0 }));
    return respond(req, 200, { items: await addSignedUrls(items) });
  } catch (error) {
    console.error('gallery signed URLs:', error);
    return respond(req, 500, { message: 'Could not load artwork images.' });
  }
}

async function voteArtwork(req: Request) {
  if (!checkVoteRateLimit(req)) return respond(req, 429, { message: 'Too many votes. Please slow down.' });
  let body: { id?: string; voter_token?: string };
  try {
    body = await req.json();
  } catch {
    return respond(req, 400, { message: 'Invalid vote.' });
  }
  const id = String(body.id ?? '');
  const token = String(body.voter_token ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 16 || token.length > 200) {
    return respond(req, 400, { message: 'Invalid vote.' });
  }

  const { data: artwork, error: artworkError } = await supabase
    .from('community_gallery_submissions')
    .select('id')
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();
  if (artworkError) return respond(req, 500, { message: 'Could not verify this artwork.' });
  if (!artwork) return respond(req, 404, { message: 'Artwork is not available for voting.' });

  const voterHash = await hashVoterToken(token);
  const { error: insertError } = await supabase.from('community_gallery_votes').insert({
    submission_id: id,
    voter_hash: voterHash,
  });
  if (insertError && insertError.code !== '23505') {
    console.error('gallery vote insert:', insertError);
    return respond(req, 500, { message: 'Could not save your vote.' });
  }

  const { count, error: countError } = await supabase
    .from('community_gallery_votes')
    .select('*', { count: 'exact', head: true })
    .eq('submission_id', id);
  if (countError) console.error('gallery vote count:', countError);
  if (insertError?.code === '23505') {
    return respond(req, 409, { message: 'You already voted for this artwork.', votes: count ?? 0 });
  }
  return respond(req, 201, { ok: true, votes: count ?? 1 });
}

async function listAdmin(req: Request) {
  if (!isAdmin(req)) return respond(req, 401, { message: 'Wrong admin key.' });
  const requestedStatus = new URL(req.url).searchParams.get('status') ?? 'pending';
  const status = ['pending', 'approved', 'rejected'].includes(requestedStatus) ? requestedStatus : 'pending';
  const [queueResult, pendingResult, approvedResult, rejectedResult, gtdResult] = await Promise.all([
    supabase.from('community_gallery_submissions').select('*').eq('status', status).order('created_at', { ascending: status !== 'pending' }),
    supabase.from('community_gallery_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('community_gallery_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('community_gallery_submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('community_gallery_submissions').select('*', { count: 'exact', head: true }).eq('gtd_spot', true),
  ]);
  if (queueResult.error) {
    console.error('gallery admin query:', queueResult.error);
    return respond(req, 500, { message: 'Could not load submissions.' });
  }
  try {
    const queue = queueResult.data ?? [];
    const voteCounts = new Map<string, number>();
    const ids = queue.map((item) => item.id);
    if (ids.length) {
      const { data: votes, error: votesError } = await supabase
        .from('community_gallery_votes')
        .select('submission_id')
        .in('submission_id', ids);
      if (votesError) console.error('gallery admin vote counts:', votesError);
      for (const vote of votes ?? []) {
        const id = String(vote.submission_id);
        voteCounts.set(id, (voteCounts.get(id) ?? 0) + 1);
      }
    }
    const queueWithVotes = queue.map((item) => ({ ...item, votes: voteCounts.get(String(item.id)) ?? 0 }));
    return respond(req, 200, {
      items: await addSignedUrls(queueWithVotes),
      stats: {
        pending: pendingResult.count ?? 0,
        approved: approvedResult.count ?? 0,
        rejected: rejectedResult.count ?? 0,
        gtd: gtdResult.count ?? 0,
      },
    });
  } catch (error) {
    console.error('gallery admin signed URLs:', error);
    return respond(req, 500, { message: 'Could not load artwork images.' });
  }
}

async function submitArtwork(req: Request) {
  if (!checkRateLimit(req)) return respond(req, 429, { message: 'Too many submissions. Please try again later.' });
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) return respond(req, 413, { message: 'The artwork must be smaller than 8MB.' });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return respond(req, 400, { message: 'Invalid submission.' });
  }
  if (cleanText(form.get('gallery_confirm'), 100)) return respond(req, 200, { ok: true });

  const title = cleanText(form.get('title'), 70);
  const creatorName = cleanText(form.get('creator_name'), 40);
  const xUrl = cleanText(form.get('x_url'), 180);
  const wallet = cleanText(form.get('wallet_address'), 42).toLowerCase();
  const artwork = form.get('artwork');

  if (title.length < 2) return respond(req, 400, { message: 'Add a title for your artwork.' });
  if (creatorName.length < 2) return respond(req, 400, { message: 'Add the artist name we should display.' });
  if (!validXUrl(xUrl)) return respond(req, 400, { message: 'Add a valid X / Twitter profile link.' });
  if (!EVM_RE.test(wallet)) return respond(req, 400, { message: 'Add a valid EVM wallet address.' });
  if (!(artwork instanceof File)) return respond(req, 400, { message: 'Choose your artwork first.' });
  if (!ALLOWED_TYPES.has(artwork.type)) return respond(req, 415, { message: 'Use a PNG, JPG, or WEBP image.' });
  if (!artwork.size || artwork.size > MAX_FILE_SIZE) return respond(req, 413, { message: 'The artwork must be smaller than 8MB.' });

  const id = crypto.randomUUID();
  const extension = ALLOWED_TYPES.get(artwork.type)!;
  const storagePath = `${id}.${extension}`;
  const bytes = await artwork.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: artwork.type,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) {
    console.error('gallery upload:', uploadError);
    return respond(req, 500, { message: 'Could not upload the artwork. Please try again.' });
  }

  const { error: insertError } = await supabase.from('community_gallery_submissions').insert({
    id,
    title,
    creator_name: creatorName,
    wallet_address: wallet,
    x_url: xUrl,
    storage_path: storagePath,
    mime_type: artwork.type,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    console.error('gallery insert:', insertError);
    return respond(req, 500, { message: 'Could not save the submission. Please try again.' });
  }
  return respond(req, 201, { ok: true, id });
}

async function reviewArtwork(req: Request) {
  if (!isAdmin(req)) return respond(req, 401, { message: 'Wrong admin key.' });
  let body: { id?: string; status?: string; gtd_spot?: boolean };
  try {
    body = await req.json();
  } catch {
    return respond(req, 400, { message: 'Invalid review request.' });
  }
  if (!body.id || !['approved', 'rejected'].includes(body.status ?? '')) {
    return respond(req, 400, { message: 'Choose approve or reject.' });
  }
  const { data, error } = await supabase
    .from('community_gallery_submissions')
    .update({
      status: body.status,
      gtd_spot: body.status === 'approved' && body.gtd_spot === true,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('status', 'pending')
    .select('id,storage_path')
    .maybeSingle();
  if (error) {
    console.error('gallery review:', error);
    return respond(req, 500, { message: 'Could not update this submission.' });
  }
  if (!data) return respond(req, 404, { message: 'This submission is no longer pending.' });

  // If rejected, delete the image from storage immediately — no point keeping it.
  if (body.status === 'rejected' && data.storage_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
    if (storageError) console.error('gallery reject storage cleanup:', storageError);
  }

  return respond(req, 200, { ok: true });
}

async function deleteArtwork(req: Request) {
  if (!isAdmin(req)) return respond(req, 401, { message: 'Wrong admin key.' });
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return respond(req, 400, { message: 'Invalid delete request.' });
  }
  if (!body.id) return respond(req, 400, { message: 'Artwork id is required.' });

  const { data: item, error: findError } = await supabase
    .from('community_gallery_submissions')
    .select('id,storage_path')
    .eq('id', body.id)
    .maybeSingle();
  if (findError) return respond(req, 500, { message: 'Could not find this artwork.' });
  if (!item) return respond(req, 404, { message: 'Artwork not found.' });

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.storage_path]);
  if (storageError) {
    console.error('gallery storage delete:', storageError);
    return respond(req, 500, { message: 'Could not delete the artwork image.' });
  }
  const { error: deleteError } = await supabase.from('community_gallery_submissions').delete().eq('id', body.id);
  if (deleteError) {
    console.error('gallery record delete:', deleteError);
    return respond(req, 500, { message: 'Could not delete the artwork record.' });
  }
  return respond(req, 200, { ok: true });
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('mode') === 'approved') return listApproved(req);
    if (req.method === 'GET' && url.searchParams.get('mode') === 'admin') return listAdmin(req);
    if (req.method === 'POST' && url.searchParams.get('mode') === 'vote') return voteArtwork(req);
    if (req.method === 'POST') return submitArtwork(req);
    if (req.method === 'PATCH') return reviewArtwork(req);
    if (req.method === 'DELETE') return deleteArtwork(req);
    return respond(req, 405, { message: 'Method not allowed.' });
  },
};
