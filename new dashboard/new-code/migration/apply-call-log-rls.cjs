'use strict';
/**
 * apply-call-log-rls.cjs — Call module, DB slice 1 (RLS).
 *
 * Enables RLS on public.call_log and scopes access to: the call's owner OR an
 * admin OR a person-manager of the owner. REUSES the existing helpers
 * public.current_user_id(), public.is_admin() and public.manages_user() AS-IS
 * (current_user_id/is_admin are defined by access-rls-v1.sql; manages_user is
 * defined by apply-task-rls.cjs). This applier MUST NOT redefine them.
 *
 * ISOLATION POSTURE (inherited from the Task Manager): manages_user() FAILS
 * CLOSED today (returns hard FALSE — no trustworthy person-hierarchy source yet),
 * so call_log access is effectively owner-only + is_admin(). When a real
 * manager-of-user source exists, manages_user() is upgraded ONCE and this
 * module inherits it automatically. All policies are scoped TO authenticated
 * (anon holds no privileges; see grants in apply-create-call-log.cjs).
 *
 * Run apply-create-call-log.cjs FIRST (it creates the table), and apply-task-rls.cjs
 * at least once (it creates manages_user()) — both are part of the staged set.
 *
 * Self-contained & idempotent: SQL embedded as a template string; DROP POLICY
 * IF EXISTS before CREATE POLICY + guarded ALTER ... ENABLE RLS. Re-running is safe.
 *
 * Mirrors new-code/migration/apply-task-rls.cjs: single BEGIN/COMMIT transaction,
 * ROLLBACK on error, then VERIFY (pg_proc + pg_policies) AFTER state printed.
 *
 * RUN LATER (do not run automatically):  node apply-call-log-rls.cjs
 */
require('dotenv').config();
const { Pool } = require('pg');

const TABLES = ['call_log'];

const SQL = `
-- =====================================================================
-- CALL MODULE — RLS slice: policies on public.call_log
-- =====================================================================
-- Reuses the existing public.current_user_id(), public.is_admin() and
-- public.manages_user() helpers AS-IS. They are NOT (re)defined here.

-- ---------------------------------------------------------------------
-- 1. Enable RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.call_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. Policies on public.call_log
--    Visibility/edit/delete/insert: own call OR admin OR manages_user(owner).
--    (Identical shape to public.task — same ownership model.)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS call_log_select ON public.call_log;
CREATE POLICY call_log_select ON public.call_log
  FOR SELECT
  TO authenticated
  USING (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );

DROP POLICY IF EXISTS call_log_insert ON public.call_log;
CREATE POLICY call_log_insert ON public.call_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );

DROP POLICY IF EXISTS call_log_update ON public.call_log;
CREATE POLICY call_log_update ON public.call_log
  FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  )
  WITH CHECK (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );

DROP POLICY IF EXISTS call_log_delete ON public.call_log;
CREATE POLICY call_log_delete ON public.call_log
  FOR DELETE
  TO authenticated
  USING (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED call-log-rls OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // === VERIFY: helpers exist (reused, not redefined) ===
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.provolatile, p.prosecdef
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('manages_user','is_admin','current_user_id')
     ORDER BY p.proname`);
  console.log('\n=== HELPER FUNCTIONS (AFTER — reused, not redefined) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // === VERIFY: RLS enabled flag ===
  const rls = await client.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname = ANY($1)
     ORDER BY relname`, [TABLES]);
  console.log('\n=== RLS ENABLED (AFTER) ===');
  console.log(JSON.stringify(rls.rows, null, 2));

  // === VERIFY: policies ===
  const pol = await client.query(
    `SELECT tablename, policyname, cmd, roles, qual, with_check
     FROM pg_policies
     WHERE schemaname='public' AND tablename = ANY($1)
     ORDER BY tablename,
       CASE cmd WHEN 'SELECT' THEN 1 WHEN 'INSERT' THEN 2
                WHEN 'UPDATE' THEN 3 WHEN 'DELETE' THEN 4 ELSE 5 END,
       policyname`, [TABLES]);
  console.log('\n=== POLICIES (AFTER) ===');
  console.log(JSON.stringify(pol.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
