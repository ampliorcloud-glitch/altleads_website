'use strict';
/**
 * apply-saved-views.cjs — Saved Views DB slice (ALT-270).
 *
 * STATUS: STAGED — NOT executed against any database.
 *         Syntax-check: node -c apply-saved-views.cjs
 *         Execute against throwaway environment first; apply to prod only after
 *         the owner gives the go-ahead (CLAUDE.md §2).
 *
 * Creates public.saved_view per ADVANCED-FILTERS-SPEC.md §6:
 *   • Columns: id, user_id, project_id, entity, name, is_default,
 *     filter_state, sort_state, column_prefs, density, page_size, view_mode,
 *     created_at, updated_at.
 *   • UNIQUE NULLS NOT DISTINCT (user_id, entity, project_id, name) — prevents
 *     duplicate names per scope (Postgres 15+, supported on Supabase).
 *   • Partial-unique index: at most one is_default=true per (user_id, entity, project_id).
 *   • RLS: own-rows only via current_user_id() (same helper used on user_view_pref).
 *   • updated_at auto-touched via trigger.
 *   • No changes to user_view_pref or data/views.ts — they remain independent.
 *
 * Idempotent: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
 *
 * RUN LATER — node apply-saved-views.cjs   (after reviewing with Ankit)
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- =====================================================================
-- SAVED VIEWS — public.saved_view  (ALT-270)
-- =====================================================================

-- 1. Table
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_view (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       integer NOT NULL
                  REFERENCES user_master(user_id) ON DELETE CASCADE,
  project_id    integer
                  REFERENCES project_master(project_id) ON DELETE SET NULL,
  entity        text    NOT NULL
                  CHECK (entity IN ('leads','companies','contacts','meetings','wishlist')),
  name          text    NOT NULL,
  is_default    boolean NOT NULL DEFAULT false,
  filter_state  jsonb,
  sort_state    jsonb,
  column_prefs  jsonb,
  density       text    CHECK (density IN ('comfortable','compact')),
  page_size     integer CHECK (page_size IN (25,50,100)),
  view_mode     text    CHECK (view_mode IN ('table','grid','kanban')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Unique name per (user, entity, project) scope
--    NULLS NOT DISTINCT: two rows with project_id IS NULL count as the same scope.
--    Requires Postgres 15+ (Supabase supports this).
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'saved_view_unique_name'
      AND conrelid = 'public.saved_view'::regclass
  ) THEN
    ALTER TABLE public.saved_view
      ADD CONSTRAINT saved_view_unique_name
      UNIQUE NULLS NOT DISTINCT (user_id, entity, project_id, name);
  END IF;
END $$;

-- 3. Partial-unique index: at most one is_default=true per scope
-- -----------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS saved_view_one_default_per_scope
  ON public.saved_view (user_id, entity, project_id)
  WHERE is_default = true;

-- 4. Performance index for the common list query
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS saved_view_user_entity_idx
  ON public.saved_view (user_id, entity);

-- 5. updated_at auto-touch trigger
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.saved_view_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS saved_view_updated_at ON public.saved_view;
CREATE TRIGGER saved_view_updated_at
  BEFORE UPDATE ON public.saved_view
  FOR EACH ROW EXECUTE FUNCTION public.saved_view_touch_updated_at();

-- 6. Row-Level Security — own rows only
--    current_user_id() is the helper already used on user_view_pref (ALT-131).
-- -----------------------------------------------------------------------
ALTER TABLE public.saved_view ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_view'
      AND policyname = 'users manage own saved views'
  ) THEN
    CREATE POLICY "users manage own saved views"
      ON public.saved_view
      FOR ALL
      USING  (user_id = current_user_id())
      WITH CHECK (user_id = current_user_id());
  END IF;
END $$;

-- Service-role bypass (Supabase default — no action needed; documented here).
-- The anon role never reaches this table.
`;

// -----------------------------------------------------------------------
// Runner — reads PG connection from .env (same pattern as other appliers)
// -----------------------------------------------------------------------

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('[apply-saved-views] BEGIN');
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('[apply-saved-views] COMMIT — saved_view table created.');

    // Verify
    const verify = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'saved_view'
      ORDER BY ordinal_position;
    `);
    console.log('[apply-saved-views] Columns:');
    for (const row of verify.rows) {
      console.log(`  ${row.column_name} (${row.data_type})`);
    }

    const idxVerify = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'saved_view' ORDER BY indexname;
    `);
    console.log('[apply-saved-views] Indexes:', idxVerify.rows.map((r) => r.indexname).join(', '));

    const rlsVerify = await client.query(`
      SELECT policyname FROM pg_policies WHERE tablename = 'saved_view';
    `);
    console.log('[apply-saved-views] Policies:', rlsVerify.rows.map((r) => r.policyname).join(', '));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[apply-saved-views] ROLLBACK due to error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[apply-saved-views] Fatal:', err);
  process.exit(1);
});
