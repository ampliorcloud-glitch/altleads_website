'use strict';
/**
 * apply-create-task-job-run.cjs — durable dedup for the notify-service daily digest
 * (review ALT-273B M6).
 *
 * The daily task digest previously deduped "already sent today" using ONLY an
 * in-process variable (scannerState.lastDigestDateIst), which resets to null on
 * every process start. Hostinger git-auto-deploy / a crash / an OOM restart AFTER
 * the digest hour therefore cleared the guard and the next poll re-blasted the
 * digest to every opted-in user the same morning. This table persists the last
 * run date so the guard survives restarts.
 *
 * public.task_job_run is a tiny singleton-per-job table:
 *   - job_name      text PK   (e.g. 'daily_digest')
 *   - last_date_ist text      (IST calendar date 'YYYY-MM-DD' the job last ran for)
 *   - updated_at    timestamptz
 * Touched ONLY by the notify-service (service_role, which bypasses RLS). RLS is
 * ENABLED with NO authenticated/anon policy and all grants revoked from
 * anon/authenticated/PUBLIC, so app users can never read or write it.
 *
 * Self-contained & idempotent (CREATE ... IF NOT EXISTS / guarded policy drop).
 * RUN LATER (do not run automatically):  node apply-create-task-job-run.cjs
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- =====================================================================
-- TASK MANAGER — durable per-job run state (daily digest dedup, M6)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.task_job_run (
  job_name      text        PRIMARY KEY,
  last_date_ist text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Service-role only: lock it down so no app user (anon/authenticated) can touch it.
ALTER TABLE public.task_job_run ENABLE ROW LEVEL SECURITY;
-- (No authenticated/anon policy => only service_role, which BYPASSES RLS, may use it.)

REVOKE ALL ON public.task_job_run FROM anon;
REVOKE ALL ON public.task_job_run FROM authenticated;
REVOKE ALL ON public.task_job_run FROM PUBLIC;
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED create-task-job-run OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // === VERIFY: columns ===
  const cols = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='task_job_run'
     ORDER BY ordinal_position`);
  console.log('\n=== public.task_job_run COLUMNS (AFTER) ===');
  console.log(JSON.stringify(cols.rows, null, 2));

  // === VERIFY: RLS enabled + grants locked down ===
  const rls = await client.query(
    `SELECT relrowsecurity AS rls_enabled
     FROM pg_class WHERE oid = 'public.task_job_run'::regclass`);
  console.log('\n=== RLS (AFTER) ===');
  console.log(JSON.stringify(rls.rows, null, 2));

  const grants = await client.query(
    `SELECT grantee, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='task_job_run'
       AND grantee IN ('anon','authenticated','PUBLIC')
     ORDER BY grantee, privilege_type`);
  console.log('\n=== TABLE GRANTS (AFTER — anon/authenticated should be EMPTY) ===');
  console.log(JSON.stringify(grants.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
