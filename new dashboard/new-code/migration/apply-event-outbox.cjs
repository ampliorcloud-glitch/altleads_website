'use strict';
/**
 * apply-event-outbox.cjs — Event-outbox + feature-flag foundation (automation rails, v0)
 *
 * Creates:
 *   public.event_outbox  — transactional outbox for domain events
 *   public.feature_flag  — canonical per-env feature flag table (Block 1, FOUNDATION-BUILD-PLAN §0)
 *
 * Design notes:
 *   - event_outbox is the write-side of the transactional outbox pattern.  Domain
 *     operations (stage change, DNC, reassign, etc.) insert a row here IN THE SAME
 *     logical flow as the domain write; a background worker later drains it.  This
 *     decouples side-effects (notifications, automations) from the hot path without
 *     losing events if the worker is slow or down.
 *
 *   - feature_flag uses the canonical shape agreed in FOUNDATION-BUILD-PLAN §0
 *     (flag_name text PK, enabled boolean DEFAULT false).  Every other block
 *     consumes this table — do NOT create a second one.  The outbox worker itself
 *     checks the `outbox_worker` flag before processing, so the whole subsystem
 *     can be killed with a single DB row flip.
 *
 * Safety / idempotency:
 *   - All DDL uses CREATE … IF NOT EXISTS / CREATE OR REPLACE / DO-block guards.
 *   - No existing table is altered destructively; no existing route/behaviour changes.
 *   - Wrapped in a single BEGIN/COMMIT; ROLLBACK on any error.
 *
 * STAGED — do NOT run automatically.
 * Run when ready: node new-code/migration/apply-event-outbox.cjs
 * Verify first:   node -c new-code/migration/apply-event-outbox.cjs
 */

require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- =====================================================================
-- AUTOMATION RAILS v0: event_outbox + feature_flag
-- =====================================================================

-- -------------------------------------------------------------------
-- 1. public.feature_flag (canonical — Block 1 / FOUNDATION-BUILD-PLAN §0)
--    Shape must NOT be changed; every block reads it with:
--      SELECT enabled FROM feature_flag WHERE flag_name = $1
--    Fail-closed: any error → false (never enable by surprise).
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flag (
  flag_name   text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Row-level security: authenticated users may SELECT; only ADMIN may write.
-- (is_admin() RPC must already exist — it does; created in apply-assignment-rls.cjs.)
ALTER TABLE public.feature_flag ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='feature_flag' AND policyname='ff_select_authenticated'
  ) THEN
    CREATE POLICY ff_select_authenticated ON public.feature_flag
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='feature_flag' AND policyname='ff_write_admin'
  ) THEN
    CREATE POLICY ff_write_admin ON public.feature_flag
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

GRANT SELECT ON public.feature_flag TO authenticated;

-- Seed the outbox worker flag (off by default — nothing starts automatically).
INSERT INTO public.feature_flag (flag_name, enabled, description)
VALUES ('outbox_worker', false, 'Enable the event-outbox background worker in notify-service')
ON CONFLICT (flag_name) DO NOTHING;

-- Seed the flags that downstream blocks will need (all false — no change until explicitly flipped).
INSERT INTO public.feature_flag (flag_name, enabled, description)
VALUES
  ('event_spine_reads',    false, 'Gate fetchActivity / fetchCallLogs on public.event table (Block 2)'),
  ('metadata_registry',    false, 'Enable metadata-registry endpoints (Block 3)'),
  ('call_log_live',        false, 'Read call logs from live capture table (Block 4)'),
  ('outbox_email',         false, 'Route email side-effects through the outbox drain (Block 1-C)'),
  ('outbox_bell',          false, 'Route in-app bell inserts through the outbox drain (Block 1-C)'),
  ('api_v2',               false, 'Enable versioned /api/v2/* routes (Block 1-E)'),
  ('identity_resolution',  false, 'Enable identity-resolution enrichment pass (Block 5)')
ON CONFLICT (flag_name) DO NOTHING;


-- -------------------------------------------------------------------
-- 2. public.event_outbox — transactional domain-event outbox
--
-- Column glossary:
--   id             — surrogate PK; ALWAYS AS IDENTITY (no gaps, no client supply).
--   event_type     — coarse-grained domain verb: 'lead.stage_changed',
--                    'lead.dnc_marked', 'lead.reassigned', 'record.feasibility_set',
--                    'task.created', 'task.completed', etc.
--   aggregate_type — the root entity the event belongs to: 'lead', 'contact',
--                    'company', 'task', 'user'. Used for routing + display.
--   aggregate_id   — PK of that entity in its primary table (lead_id, contact_id, etc.).
--   payload        — arbitrary JSON snapshot of the change (before/after values,
--                    context the handler needs — kept small; no PII blobs).
--   actor_user_id  — numeric user_id of the person/system that caused the event
--                    (derived server-side from the write-gateway actor, never trusted
--                    from the client). NULL for system-initiated events.
--   created_at     — wall-clock insert time (indexed; used by the worker poll query).
--   processed_at   — set by the worker when the row is successfully handled.
--   attempts       — incremented by the worker on each claim; capped at MAX_ATTEMPTS
--                    (configurable) before the row is permanently failed.
--   status         — 'pending' | 'processing' | 'done' | 'failed'
--                    'processing' is set while the worker holds the row (claim lock).
--   error          — last error message from the worker (for ops visibility).
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_outbox (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type     text        NOT NULL,
  aggregate_type text        NOT NULL,
  aggregate_id   bigint      NOT NULL,
  payload        jsonb       NOT NULL DEFAULT '{}',
  actor_user_id  bigint,                                   -- nullable: system events have no actor
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  attempts       integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','done','failed')),
  error          text
);

-- Service-role only: no app-tier role should ever read or write the outbox directly.
-- The write path uses the service-role client (via writeGateway.js / emitEvent()).
-- The read/claim path (worker) also uses service-role.
ALTER TABLE public.event_outbox ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='event_outbox' AND policyname='outbox_deny_public'
  ) THEN
    CREATE POLICY outbox_deny_public ON public.event_outbox
      FOR ALL TO anon, authenticated USING (false);
  END IF;
END $$;

REVOKE ALL ON public.event_outbox FROM anon;
REVOKE ALL ON public.event_outbox FROM authenticated;
REVOKE ALL ON public.event_outbox FROM PUBLIC;

-- Indexes:
--   Primary worker poll: pending rows ordered by creation time.
CREATE INDEX IF NOT EXISTS event_outbox_status_created_at_idx
  ON public.event_outbox (status, created_at)
  WHERE status = 'pending';

--   Secondary: find all events for a given aggregate (audit / replay).
CREATE INDEX IF NOT EXISTS event_outbox_aggregate_idx
  ON public.event_outbox (aggregate_type, aggregate_id);

--   Actor lookup (who caused these events? visibility for future audit UI).
CREATE INDEX IF NOT EXISTS event_outbox_actor_idx
  ON public.event_outbox (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

--   Failed rows drill-down (ops / alerting).
CREATE INDEX IF NOT EXISTS event_outbox_failed_idx
  ON public.event_outbox (created_at)
  WHERE status = 'failed';
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED event-outbox migration OK (committed).');
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
    WHERE table_schema='public' AND table_name IN ('event_outbox','feature_flag')
    ORDER BY table_name
  `);
  console.log('\n=== TABLES (AFTER) ===');
  console.log(tables.rows.map(r => r.table_name));

  const cols = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('event_outbox','feature_flag')
    ORDER BY table_name, ordinal_position
  `);
  console.log('\n=== COLUMNS (AFTER) ===');
  console.log(JSON.stringify(cols.rows, null, 2));

  const indexes = await client.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('event_outbox','feature_flag')
    ORDER BY tablename, indexname
  `);
  console.log('\n=== INDEXES (AFTER) ===');
  console.log(JSON.stringify(indexes.rows, null, 2));

  const rls = await client.query(`
    SELECT relname, relrowsecurity AS rls_enabled
    FROM pg_class
    WHERE oid IN (
      'public.event_outbox'::regclass,
      'public.feature_flag'::regclass
    )
  `);
  console.log('\n=== RLS (AFTER) ===');
  console.log(JSON.stringify(rls.rows, null, 2));

  const flags = await client.query(`
    SELECT flag_name, enabled, description FROM public.feature_flag ORDER BY flag_name
  `);
  console.log('\n=== feature_flag SEED ROWS (AFTER) ===');
  console.log(JSON.stringify(flags.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
