-- Flamingos Community Gallery
-- Run this migration once in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS community_gallery_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 70),
  creator_name TEXT NOT NULL CHECK (char_length(creator_name) BETWEEN 2 AND 40),
  wallet_address TEXT NOT NULL,
  x_url TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  gtd_spot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_gallery_status_created
  ON community_gallery_submissions (status, created_at DESC);

ALTER TABLE community_gallery_submissions ENABLE ROW LEVEL SECURITY;

-- The bucket stays private. The Edge Function returns short-lived signed URLs
-- only for approved art and for the authenticated owner review page.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-gallery',
  'community-gallery',
  FALSE,
  8388608,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

