'use strict';
/**
 * apply-import-batches.cjs — Import batch history + undo tables (DEC-14)
 *
 * STAGED — do NOT run automatically.
 * Syntax-check only: node -c new-code/migration/apply-import-batches.cjs
 * Run when ready: node new-code/migration/apply-import-batches.cjs
 *
 * Creates:
 *   public.import_batch — one row per import chunk call; tracks counts + status
 *   public.import_row   — one row per data row processed; stores undo_payload jsonb
 *
 * The undo_payload column enables full batch reversal:
 *   - For inserted rows: { inserted: true, <pk>: <new_id> }
 *   - For updated rows:  { <pk>: <id>, _before: { col: old_val, ... } }
 * The writeGateway undoBatch() handler reads these to restore prior state.
 *
 * Safety:
 *   - All DDL uses CREATE … IF NOT EXISTS / DO-block guards.
 *   - No existing table altered destructively.
 *   - Wrapped in BEGIN/COMMIT; ROLLBACK on any error.
 *   - RLS: service-role only (no app-tier access) — write-gateway uses service-role.
 *
 * Discovered schema (live DB read 2026-06-28, relevant context):
 *   company_master  PK company_id bigint,  domain_clean text (fallback key)
 *   contact_master  PK contact_id bigint,  email text (fallback key)
 *   lead_master     PK lead_id bigint      (record_id only — no fallback key)
 *   profiles        user_id bigint         (import actor reference)
 *
 * Column glossary for import_batch:
 *   id            — surrogate PK (GENERATED ALWAYS AS IDENTITY)
 *   entity        — 'company' | 'contact' | 'lead'
 *   actor_user_id — profiles.user_id of the admin who ran the import
 *   filename      — original upload filename (display only)
 *   total         — total rows sent in this chunk call
 *   inserted      — rows that were newly INSERTed
 *   updated       — rows that were UPDATEd
 *   skipped       — rows skipped by the engine (no match key, ambiguous, blank)
 *   error         — rows that threw a DB error
 *   status        — 'done' | 'partial' | 'undone'
 *   created_at    — wall-clock insert time
 *   updated_at    — set on status change (e.g. when undone)
 *
 * Column glossary for import_row:
 *   id            — surrogate PK
 *   batch_id      — FK → import_batch.id (CASCADE delete)
 *   row_index     — 0-based position in the chunk (for display / debugging)
 *   status        — 'inserted' | 'updated' | 'skipped' | 'error'
 *   record_id     — the PK of the affected row in the target table (null on error/skip)
 *   undo_payload  — jsonb snapshot enabling undo (see above)
 *   error_msg     — error message when status='error'
 */

require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- =====================================================================
-- IMPORT BATCH HISTORY + UNDO (DEC-14)
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. public.import_batch — one row per import chunk call
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_batch (
  id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity        text         NOT NULL
                               CHECK (entity IN ('company', 'contact', 'lead')),
  actor_user_id bigint,                              -- profiles.user_id; nullable (system)
  filename      text,                                -- original upload filename
  total         integer      NOT NULL DEFAULT 0,
  inserted      integer      NOT NULL DEFAULT 0,
  updated       integer      NOT NULL DEFAULT 0,
  skipped       integer      NOT NULL DEFAULT 0,
  error         integer      NOT NULL DEFAULT 0,
  status        text         NOT NULL DEFAULT 'done'
                               CHECK (status IN ('done', 'partial', 'undone')),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- RLS: service-role writes (write-gateway); no app-tier direct access.
ALTER TABLE public.import_batch ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'import_batch'
      AND policyname = 'import_batch_deny_public'
  ) THEN
    CREATE POLICY import_batch_deny_public ON public.import_batch
      FOR ALL TO anon, authenticated USING (false);
  END IF;
END $$;

REVOKE ALL ON public.import_batch FROM anon;
REVOKE ALL ON public.import_batch FROM authenticated;

-- Indexes for common queries:
--   "list all batches newest-first" (admin history panel)
CREATE INDEX IF NOT EXISTS import_batch_created_at_idx
  ON public.import_batch (created_at DESC);

--   "batches by entity type" (filter by company/contact/lead)
CREATE INDEX IF NOT EXISTS import_batch_entity_idx
  ON public.import_batch (entity, created_at DESC);

--   "batches by actor" (who imported what)
CREATE INDEX IF NOT EXISTS import_batch_actor_idx
  ON public.import_batch (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;


-- -------------------------------------------------------------------
-- 2. public.import_row — per-row undo payload + status log
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_row (
  id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id      bigint       NOT NULL
                               REFERENCES public.import_batch (id) ON DELETE CASCADE,
  row_index     integer      NOT NULL,              -- 0-based position in the chunk
  status        text         NOT NULL
                               CHECK (status IN ('inserted', 'updated', 'skipped', 'error')),
  record_id     bigint,                             -- PK in target table; null on skip/error
  undo_payload  jsonb,                              -- see file header for shape
  error_msg     text                                -- only when status='error'
);

-- RLS: same as import_batch — service-role only.
ALTER TABLE public.import_row ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'import_row'
      AND policyname = 'import_row_deny_public'
  ) THEN
    CREATE POLICY import_row_deny_public ON public.import_row
      FOR ALL TO anon, authenticated USING (false);
  END IF;
END $$;

REVOKE ALL ON public.import_row FROM anon;
REVOKE ALL ON public.import_row FROM authenticated;

-- Indexes:
--   "all rows for a batch" (undo loader)
CREATE INDEX IF NOT EXISTS import_row_batch_id_idx
  ON public.import_row (batch_id, row_index);

--   "inserted/updated rows for a batch" (undo filter)
CREATE INDEX IF NOT EXISTS import_row_batch_status_idx
  ON public.import_row (batch_id, status)
  WHERE status IN ('inserted', 'updated');
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED import-batches migration OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // === VERIFY ===
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('import_batch', 'import_row')
    ORDER BY table_name
  `);
  console.log('\n=== TABLES (AFTER) ===');
  console.log(tables.rows.map(r => r.table_name));

  const cols = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('import_batch', 'import_row')
    ORDER BY table_name, ordinal_position
  `);
  console.log('\n=== COLUMNS (AFTER) ===');
  console.log(JSON.stringify(cols.rows, null, 2));

  const indexes = await client.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('import_batch', 'import_row')
    ORDER BY tablename, indexname
  `);
  console.log('\n=== INDEXES (AFTER) ===');
  console.log(JSON.stringify(indexes.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
