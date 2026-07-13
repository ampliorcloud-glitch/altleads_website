'use strict';
/**
 * apply-task-rls.cjs — Task Manager module, DB slice 1 (RLS).
 *
 * Enables RLS on public.task + public.task_user_pref and creates the NEW
 * SECURITY DEFINER helper public.manages_user(target_user_id) needed for
 * person-owned tasks. (The existing manages_project() is PROJECT-keyed and
 * unusable for tasks, which have no project — TASK-MANAGER.md §3.3.)
 *
 * ISOLATION POSTURE: manages_user() FAILS CLOSED (returns hard FALSE) because
 * no trustworthy person-hierarchy source exists yet. Task access is therefore
 * owner-only + is_admin(). Project co-membership is NOT person-management and
 * must not be used to derive it (would cross-expose co-members' tasks). All
 * policies are scoped TO authenticated (anon holds no privileges; see grants
 * in apply-create-task-table.cjs).
 *
 * Reuses public.is_admin() and public.current_user_id() as-is (already defined
 * by access-rls-v1.sql). Run apply-create-task-table.cjs FIRST.
 *
 * Self-contained & idempotent: SQL embedded as a template string; CREATE OR
 * REPLACE FUNCTION + DROP POLICY IF EXISTS before CREATE POLICY + guarded
 * ALTER ... ENABLE RLS. Re-running is safe.
 *
 * Mirrors new-code/migration/apply-access-rls.js: single BEGIN/COMMIT
 * transaction, ROLLBACK on error, then VERIFY (pg_proc + pg_policies) AFTER
 * state printed.
 *
 * RUN LATER (do not run automatically):  node apply-task-rls.cjs
 */
require('dotenv').config();
const { Pool } = require('pg');

const TABLES = ['task', 'task_user_pref'];

const SQL = `
-- =====================================================================
-- TASK MANAGER — RLS slice: manages_user() helper + policies
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NEW helper: manages_user(target_user_id)
--    Returns TRUE iff the caller is a real person-manager of target_user_id.
--
--    FAIL-CLOSED BY DESIGN — returns hard FALSE today.
--    There is NO trustworthy person-hierarchy source yet. The earlier draft
--    derived "management" from SHARED PROJECT MEMBERSHIP (caller is TL/SALES_HEAD
--    AND target is any co-member of any project the caller is on). That is NOT
--    person-management and it LEAKED isolation: a team lead on project P could
--    SELECT/UPDATE/DELETE the tasks of EVERY other member of P — including people
--    who are not their downline — and tasks are not even scoped back to P (task
--    has no project_id), so a single shared project exposed unrelated tasks.
--    The Task brief required fail-closed (is_admin-only acceptable; "must not
--    accidentally grant broad access").
--
--    Therefore this helper is gated to FALSE: only owner-of-task and is_admin()
--    grant access (see policies below). When a real manager-of-user table
--    exists, replace the body here with a join against THAT table — do NOT
--    re-derive management from project_user co-membership.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manages_user(target_user_id bigint)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Fail closed: no person-hierarchy source exists. Admin-only access is
  -- enforced via is_admin() in the policies. target_user_id is referenced to
  -- keep the signature stable for callers; it intentionally has no effect.
  SELECT (target_user_id IS NOT NULL) AND false
$$;

-- ---------------------------------------------------------------------
-- 2. Enable RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.task           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_user_pref ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Policies on public.task
--    Visibility/edit/delete/insert: own task OR admin OR manages_user(owner).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS task_select ON public.task;
CREATE POLICY task_select ON public.task
  FOR SELECT
  TO authenticated
  USING (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );

DROP POLICY IF EXISTS task_insert ON public.task;
CREATE POLICY task_insert ON public.task
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );

DROP POLICY IF EXISTS task_update ON public.task;
CREATE POLICY task_update ON public.task
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

DROP POLICY IF EXISTS task_delete ON public.task;
CREATE POLICY task_delete ON public.task
  FOR DELETE
  TO authenticated
  USING (
    owner_user_id = public.current_user_id()
    OR public.is_admin()
    OR public.manages_user(owner_user_id)
  );

-- ---------------------------------------------------------------------
-- 4. Policies on public.task_user_pref
--    Own row OR admin (a user manages only their own digest preference).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS task_user_pref_select ON public.task_user_pref;
CREATE POLICY task_user_pref_select ON public.task_user_pref
  FOR SELECT
  TO authenticated
  USING (
    user_id = public.current_user_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS task_user_pref_insert ON public.task_user_pref;
CREATE POLICY task_user_pref_insert ON public.task_user_pref
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.current_user_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS task_user_pref_update ON public.task_user_pref;
CREATE POLICY task_user_pref_update ON public.task_user_pref
  FOR UPDATE
  TO authenticated
  USING (
    user_id = public.current_user_id()
    OR public.is_admin()
  )
  WITH CHECK (
    user_id = public.current_user_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS task_user_pref_delete ON public.task_user_pref;
CREATE POLICY task_user_pref_delete ON public.task_user_pref
  FOR DELETE
  TO authenticated
  USING (
    user_id = public.current_user_id()
    OR public.is_admin()
  );
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED task-rls OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // === VERIFY: manages_user helper exists, SECURITY DEFINER, STABLE ===
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.provolatile, p.prosecdef
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('manages_user','is_admin','current_user_id')
     ORDER BY p.proname`);
  console.log('\n=== HELPER FUNCTIONS (AFTER) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // === VERIFY: RLS enabled flags ===
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
