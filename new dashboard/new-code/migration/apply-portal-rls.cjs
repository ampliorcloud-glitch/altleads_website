'use strict';
/**
 * ALT-227 / ALT-228 — Client Portal RLS (multi-tenant isolation is EXISTENTIAL).
 *
 * Enables RLS on portal.client_portal_user, portal.meeting_snapshot, portal.notification
 * and installs the resolver helpers + policies. ALSO closes the base-table leak: it adds a
 * RESTRICTIVE "deny portal sessions" policy to every RLS-enabled public.* table so a portal
 * session can NEVER read CRM base tables (company_master / contact_master / lead_master / …)
 * directly, only the scoped portal.* views.
 *
 * ============================================================================
 * ROLE / IDENTITY BRIDGE (reviewer MUST-FIX). See apply-portal-foundation.cjs header.
 * ----------------------------------------------------------------------------
 * Supabase connects ALL logged-in users (CRM staff AND portal clients) as the built-in
 * `authenticated` Postgres role. So:
 *   - Every portal policy is `TO authenticated` (the role that actually connects), NOT a
 *     custom `portal_client` role (which nothing bridged and which is now removed).
 *   - A session is a *portal session* iff portal.caller_client_assoc_id() IS NOT NULL
 *     (there is an enabled portal.client_portal_user row for auth.uid()). Every portal
 *     policy requires this, so CRM-staff sessions (no portal row) match no portal policy.
 *   - To stop a portal session from reading CRM base tables via the CRM's own permissive
 *     `FOR SELECT TO authenticated USING(true)` policies (company_master, contact_master,
 *     contact_project_status, company_project_status, interaction, …), we add a RESTRICTIVE
 *     policy `deny_portal_session` to EVERY RLS-enabled public.* table. A restrictive policy
 *     is AND-ed with all permissive policies, so a portal session fails the base-table check
 *     regardless of how many permissive `authenticated` policies exist now or later.
 *
 * meeting_snapshot SELECT policy (per portal_role), all gated on "is a portal session":
 *   COMPANY_ADMIN : client_assoc_id = caller's client_assoc_id              (all their company's projects)
 *   SALES_HEAD    : project_id IN caller_project_ids() OR assigned_user_id IN downline (own project(s) + downline)
 *   SALES_PERSON  : assigned_user_id = caller's user_id                     (own assigned only)
 * There is NO INSERT/UPDATE/DELETE policy on meeting_snapshot for clients — meeting
 * create/reschedule/delete is structurally impossible from the portal.
 *
 * notification policy:
 *   SELECT/UPDATE : recipient_auth_uid = auth.uid() AND client_assoc_id = caller's client_assoc_id
 *   INSERT        : service-role only (no client INSERT policy exists).
 *
 * client_portal_user policy: a portal user may SELECT only their OWN row (self-introspection);
 * no client write path (provisioning is service-role, notify-service side).
 *
 * Convention: single BEGIN/COMMIT; idempotent (OR REPLACE / DROP POLICY IF EXISTS);
 * embedded SQL; VERIFY after commit. RUN AFTER apply-portal-foundation.cjs.
 * RUN ONLY via `node apply-portal-rls.cjs`.
 *
 * HARD GATE (per plan §4): after applying, validate with throwaway logins (one per portal
 * role + one ordinary CRM-staff login) BEFORE prod, and re-run after the backfill on real
 * volume. The CRM-staff login MUST still read company_master/contact_master; a portal login
 * MUST read NOTHING from any public.* base table and only its own tenant's portal.* rows.
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- ============================================================
-- 0. Resolver helpers (SECURITY DEFINER, STABLE; search_path pinned).
--    These read portal.client_portal_user / public.project_user as the table owner,
--    so RLS on the snapshot can call them without granting clients base-table access.
--    EXECUTE is revoked from PUBLIC and granted only to authenticated + service_role.
-- ============================================================

-- caller_client_assoc_id(): the caller's client (NULL if not an enabled portal user).
-- THIS is the portal-session predicate: IS NOT NULL  <=>  caller is a registered portal user.
CREATE OR REPLACE FUNCTION portal.caller_client_assoc_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = portal, public
AS $$
  SELECT cpu.client_assoc_id
  FROM portal.client_portal_user cpu
  WHERE cpu.auth_uid = auth.uid()
    AND cpu.enabled = true
    AND cpu.deleted_date IS NULL
  LIMIT 1
$$;

-- caller_user_id(): the caller's bigint user_id (the assigned-salesperson identity).
CREATE OR REPLACE FUNCTION portal.caller_user_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = portal, public
AS $$
  SELECT cpu.user_id
  FROM portal.client_portal_user cpu
  WHERE cpu.auth_uid = auth.uid()
    AND cpu.enabled = true
    AND cpu.deleted_date IS NULL
  LIMIT 1
$$;

-- caller_portal_role(): COMPANY_ADMIN | SALES_HEAD | SALES_PERSON | NULL.
CREATE OR REPLACE FUNCTION portal.caller_portal_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = portal, public
AS $$
  SELECT cpu.portal_role
  FROM portal.client_portal_user cpu
  WHERE cpu.auth_uid = auth.uid()
    AND cpu.enabled = true
    AND cpu.deleted_date IS NULL
  LIMIT 1
$$;

-- caller_project_ids(): the project_id set the caller belongs to (own + explicitly-added).
-- project_user.user_id = the portal user's bigint user_id; "explicitly added to another
-- project" = an extra project_user row (granted Amplior-side, per plan §2).
CREATE OR REPLACE FUNCTION portal.caller_project_ids()
RETURNS SETOF bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = portal, public
AS $$
  SELECT DISTINCT pu.project_id
  FROM public.project_user pu
  WHERE pu.user_id = portal.caller_user_id()
    AND pu.deleted_date IS NULL
$$;

-- downline_user_ids(uid): user_ids that report to the Sales Head identified by auth uid.
--
-- DOWNLINE DEFINITION (reviewer MUST-FIX — was over-broad "everyone on my projects",
-- which exposed peer Sales Heads' reps within the same project). LOCKED definition:
--   downline = { the Sales Head's own user_id }
--             ∪ { user_id of every project_user on the Head's project(s) whose role is a
--                 NON-manager sales role (SALES_PERSON, role_id 5) }
-- i.e. a Head sees its OWN records + its reps' records, but NOT peer Sales Heads (role 4)
-- or other managers (TEAM_LEAD role 2 / ADMIN) who merely co-exist on a shared project.
-- This is same-tenant either way (client_assoc_id is still enforced by the snapshot policy),
-- but this removes the cross-OWNER over-exposure the reviewer flagged.
-- project_user.role_name stores the role NAME -> join role_master to resolve the role_id.
CREATE OR REPLACE FUNCTION portal.downline_user_ids(p_auth_uid uuid)
RETURNS SETOF bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = portal, public
AS $$
  WITH me AS (
    SELECT cpu.user_id
    FROM portal.client_portal_user cpu
    WHERE cpu.auth_uid = p_auth_uid
      AND cpu.enabled = true
      AND cpu.deleted_date IS NULL
    LIMIT 1
  ),
  my_projects AS (
    SELECT DISTINCT pu.project_id
    FROM public.project_user pu, me
    WHERE pu.user_id = me.user_id
      AND pu.deleted_date IS NULL
  ),
  reps AS (
    SELECT DISTINCT pu.user_id
    FROM public.project_user pu
    JOIN my_projects mp ON mp.project_id = pu.project_id
    JOIN public.role_master rm ON rm.name = pu.role_name
    WHERE pu.deleted_date IS NULL
      AND rm.role_id = 5                       -- SALES_PERSON only (no peer Heads / managers)
  )
  SELECT user_id FROM reps
  UNION
  SELECT user_id FROM me                       -- the Head also sees own records
$$;

-- Lock down EXECUTE: SECURITY DEFINER functions are EXECUTE-to-PUBLIC by default, which
-- would let any role invoke the owner-privileged resolvers if portal is ever exposed.
REVOKE EXECUTE ON FUNCTION
  portal.caller_client_assoc_id(),
  portal.caller_user_id(),
  portal.caller_portal_role(),
  portal.caller_project_ids(),
  portal.downline_user_ids(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  portal.caller_client_assoc_id(),
  portal.caller_user_id(),
  portal.caller_portal_role(),
  portal.caller_project_ids(),
  portal.downline_user_ids(uuid)
  TO authenticated, service_role;

-- ============================================================
-- 1. Enable RLS on the three portal base tables.
--    client_portal_user + notification are FORCE: the table owner is also subject to policy.
--    Their writers are service-role only (service_role has BYPASSRLS, so provisioning +
--    notification inserts still work), and the SECURITY DEFINER resolvers only ever read
--    the caller's own row keyed on auth.uid(), so FORCE is safe + defense-in-depth there.
--
--    meeting_snapshot is ENABLE-only (NOT FORCE) — DELIBERATELY. The snapshot is written by
--    write_meeting_snapshot(), a SECURITY DEFINER trigger on public.meeting_master that runs
--    as the table OWNER (the migration postgres role, which on Supabase does NOT have
--    BYPASSRLS — only the JWT-backed service_role does, and the trigger never runs as
--    service_role). Under FORCE the owner would be subject to RLS, and since there is no
--    INSERT/UPDATE policy here, the snapshot INSERT inside the trigger would be denied and
--    roll back EVERY meeting create/edit in the CRM. ENABLE lets the owner/definer bypass for
--    the write while STILL gating reads: portal sessions connect as the authenticated role
--    (not the owner), so the SELECT policies below still fully isolate them. This mirrors the
--    project baseline (new-code/migration/rls-policies.sql: NOT FORCE so table owners still
--    bypass RLS, which the onboarding flow needs) for exactly this SECURITY DEFINER pattern.
-- ============================================================
ALTER TABLE portal.client_portal_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.meeting_snapshot   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.notification       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.client_portal_user FORCE ROW LEVEL SECURITY;
ALTER TABLE portal.notification       FORCE ROW LEVEL SECURITY;
-- NOTE: meeting_snapshot intentionally NOT forced (see block comment above).

-- ============================================================
-- 2. client_portal_user — a portal user may read ONLY their own row. No client writes.
-- ============================================================
DROP POLICY IF EXISTS cpu_self_select ON portal.client_portal_user;
CREATE POLICY cpu_self_select ON portal.client_portal_user
  FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() AND enabled = true AND deleted_date IS NULL);
-- (No INSERT/UPDATE/DELETE policy for authenticated => provisioning is service-role only.)

-- ============================================================
-- 3. meeting_snapshot — SELECT-only, role-scoped. Every policy first asserts the session is
--    a registered portal session (caller_client_assoc_id() IS NOT NULL). NO write policy.
-- ============================================================
DROP POLICY IF EXISTS ms_company_admin_select ON portal.meeting_snapshot;
CREATE POLICY ms_company_admin_select ON portal.meeting_snapshot
  FOR SELECT TO authenticated
  USING (
    portal.caller_client_assoc_id() IS NOT NULL          -- portal session only
    AND portal.caller_portal_role() = 'COMPANY_ADMIN'
    AND client_assoc_id = portal.caller_client_assoc_id()
  );

DROP POLICY IF EXISTS ms_sales_head_select ON portal.meeting_snapshot;
CREATE POLICY ms_sales_head_select ON portal.meeting_snapshot
  FOR SELECT TO authenticated
  USING (
    portal.caller_client_assoc_id() IS NOT NULL          -- portal session only
    AND portal.caller_portal_role() = 'SALES_HEAD'
    -- defense-in-depth: still bound to the caller's client even via project/downline
    AND client_assoc_id = portal.caller_client_assoc_id()
    AND (
      project_id IN (SELECT portal.caller_project_ids())
      OR assigned_user_id IN (SELECT portal.downline_user_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS ms_sales_person_select ON portal.meeting_snapshot;
CREATE POLICY ms_sales_person_select ON portal.meeting_snapshot
  FOR SELECT TO authenticated
  USING (
    portal.caller_client_assoc_id() IS NOT NULL          -- portal session only
    AND portal.caller_portal_role() = 'SALES_PERSON'
    AND client_assoc_id = portal.caller_client_assoc_id()
    AND assigned_user_id = portal.caller_user_id()
  );
-- (No FOR INSERT / UPDATE / DELETE policy on meeting_snapshot for authenticated =>
--  clients can never create, reschedule, or delete a meeting snapshot.)

-- ============================================================
-- 4. notification — recipient + client scoped SELECT/UPDATE; service-role INSERT only.
-- ============================================================
DROP POLICY IF EXISTS notif_select ON portal.notification;
CREATE POLICY notif_select ON portal.notification
  FOR SELECT TO authenticated
  USING (
    portal.caller_client_assoc_id() IS NOT NULL
    AND recipient_auth_uid = auth.uid()
    AND client_assoc_id = portal.caller_client_assoc_id()
  );

DROP POLICY IF EXISTS notif_update_read ON portal.notification;
CREATE POLICY notif_update_read ON portal.notification
  FOR UPDATE TO authenticated
  USING (
    portal.caller_client_assoc_id() IS NOT NULL
    AND recipient_auth_uid = auth.uid()
    AND client_assoc_id = portal.caller_client_assoc_id()
  )
  WITH CHECK (
    portal.caller_client_assoc_id() IS NOT NULL
    AND recipient_auth_uid = auth.uid()
    AND client_assoc_id = portal.caller_client_assoc_id()
  );
-- (No INSERT/DELETE policy for authenticated => only the service role writes notifications.)

-- ============================================================
-- 5. BASE-TABLE LEAK CLOSURE (reviewer MUST-FIX — EXISTENTIAL).
--    The CRM grants permissive 'FOR SELECT TO authenticated USING(true)' on company_master,
--    contact_master, contact_project_status, company_project_status, interaction, etc. A
--    portal session connects as 'authenticated' and would otherwise read every tenant's data.
--    Add a RESTRICTIVE policy 'deny_portal_session' to EVERY RLS-enabled public.* table.
--    Restrictive policies are AND-ed with all permissive policies, so any portal session
--    (caller_client_assoc_id() IS NOT NULL) fails the base-table check for ALL commands,
--    while ordinary CRM-staff sessions (NULL) are unaffected.
--
--    Applied dynamically across all RLS-enabled public tables so future base tables are
--    covered too; re-running is idempotent (DROP POLICY IF EXISTS before CREATE).
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true                         -- only tables that have RLS enabled
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_portal_session ON public.%I', r.relname);
    EXECUTE format($p$
      CREATE POLICY deny_portal_session ON public.%I
        AS RESTRICTIVE
        FOR ALL TO authenticated
        USING (portal.caller_client_assoc_id() IS NULL)
        WITH CHECK (portal.caller_client_assoc_id() IS NULL)
    $p$, r.relname);
  END LOOP;
END$$;
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED apply-portal-rls OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // VERIFY: RLS enabled + forced on all three portal tables
  const rls = await client.query(
    `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='portal' AND c.relkind='r'
       AND c.relname IN ('client_portal_user','meeting_snapshot','notification')
     ORDER BY c.relname`);
  console.log('\n=== portal RLS STATUS (AFTER — all three should be enabled AND forced) ===');
  console.log(JSON.stringify(rls.rows, null, 2));

  // VERIFY: portal policies all target authenticated
  const pol = await client.query(
    `SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
     FROM pg_policies
     WHERE schemaname='portal'
     ORDER BY tablename, cmd, policyname`);
  console.log('\n=== portal POLICIES (AFTER — roles must be {authenticated}) ===');
  console.log(JSON.stringify(pol.rows, null, 2));

  // VERIFY: every RLS-enabled public table has the restrictive deny_portal_session policy.
  const deny = await client.query(
    `SELECT
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=true) AS rls_tables,
        (SELECT count(*)::int FROM pg_policies
           WHERE schemaname='public' AND policyname='deny_portal_session') AS deny_policies`);
  console.log('\n=== BASE-TABLE LEAK CLOSURE (deny_policies should equal rls_tables) ===');
  console.log(JSON.stringify(deny.rows, null, 2));

  // VERIFY: resolver helpers exist, SECURITY DEFINER, and NOT executable by PUBLIC.
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef,
            has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='portal'
       AND p.proname IN ('caller_client_assoc_id','caller_user_id','caller_portal_role',
                         'caller_project_ids','downline_user_ids')
     ORDER BY p.proname`);
  console.log('\n=== portal RESOLVER HELPERS (AFTER — prosecdef=true, public_can_execute=false) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // SANITY: confirm there is NO write policy on meeting_snapshot for clients.
  const writePol = await client.query(
    `SELECT count(*)::int AS write_policies
     FROM pg_policies
     WHERE schemaname='portal' AND tablename='meeting_snapshot'
       AND cmd IN ('INSERT','UPDATE','DELETE')`);
  console.log('\n=== meeting_snapshot CLIENT WRITE POLICIES (must be 0) ===');
  console.log(JSON.stringify(writePol.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
