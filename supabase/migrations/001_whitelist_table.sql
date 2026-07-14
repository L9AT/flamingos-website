-- ═══════════════════════════════════════════════════════
-- FLAMINGOS — Whitelist Submissions Table (Simplified)
-- Migration: 002_simplified_whitelist_table
-- ═══════════════════════════════════════════════════════

DROP TABLE IF EXISTS whitelist_submissions CASCADE;

CREATE TABLE whitelist_submissions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address      TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevents the same wallet submitting twice
  CONSTRAINT uq_wallet_address UNIQUE (wallet_address)
);

-- Fast duplicate lookup index
CREATE INDEX IF NOT EXISTS idx_wl_wallet_address
  ON whitelist_submissions (wallet_address);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Public browser: NO read / write / delete
-- All inserts go through the Edge Function (service-role key)
-- ═══════════════════════════════════════════════════════
ALTER TABLE whitelist_submissions ENABLE ROW LEVEL SECURITY;