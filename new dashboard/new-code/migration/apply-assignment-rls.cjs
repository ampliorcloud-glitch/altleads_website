'use strict';
/**
 * apply-assignment-rls.cjs — ALT-152 / ALT-288 assignment write-model (STAGED).
 *
 * ============================ DO NOT AUTO-RUN ============================
 * This is a STAGED migration. Launch posture = MANUAL deploys. It must be run
 * by hand AFTER throwaway non-admin login validation (ALT-153 / ALT-229 gate),
 * and shown to the owner first. Running it in production without that gate is
 * forbidden. Nothing in the build pipeline invokes this file.
 * ========================================================================
 *
 * THE PROBLEM (ALT-152): every per-row WRITE policy keys on `created_by` (the
 * legacy/migrated internal owner). Because the 111-user dataset was bulk
 * migrated, an agent's `created_by` is the importer — NOT the agent. The real
 * assignment is `lead_report.user_id` (the assigned salesperson; CLAUDE.md §3),
 * which no write policy consults. So an assigned agent gets "you can only edit
 * records you own". This migration teaches the write-path about ASSIGNMENT.
 *
 * WHAT IT DOES (additive + reversible — no destructive backfill):
 *   1. NEW helper assigned_to(rtype, rid) — resolves the ASSIGNED user
 *      (lead → latest lead_report.user_id; company/contact → per-project
 *      owner_user_id). Distinct from record_owner_id() which reads created_by.
 *   2. NEW helper meeting_lead_id(meeting_id) — lead behind a meeting via
 *      meeting_schedule.report_id → lead_report.lead_id.
 *   3. lead_master UPDATE: ADD an assignment OR-term to the live v2 dial policy
 *      (keeps every existing term, incl. the legacy created_by term — OD-3).
 *      => an assigned agent can now edit their lead.
 *   4. lead_report: a RESTRICTIVE UPDATE guard so only the assignee (self-edit)
 *      or a project manager / admin may change a report row — including the
 *      user_id rewrite that IS a reassignment (ALT-288 OD-4). RESTRICTIVE ANDs
 *      with the existing blanket authenticated_full_access, so SELECT/INSERT/
 *      DELETE are untouched and reads never break. (Reassignment to ANOTHER user
 *      passes only via the admin / manages_project branch — WITH CHECK.)
 *   5. company_project_status / contact_project_status UPDATE: ADD an
 *      owner_user_id OR-term (the columns already exist; were dormant). A
 *      current owner can edit their own per-project status; reassigning the
 *      owner to someone else passes only for admin / project manager.
 *
 * WHAT IT DOES NOT DO: it does NOT narrow meeting_master / lead_report SELECT or
 * INSERT, does NOT touch FORCE (all tables stay ENABLE so service_role + the
 * snapshot trigger keep bypassing), and does NOT rewrite company_master /
 * contact_master base-record edit gating. Meeting reassignment writes
 * lead_report (covered by #4), not a meeting column.
 *
 * VALIDATION CHECKLIST (run with throwaway logins before prod apply):
 *   - role-3 agent ASSIGNED a lead (lead_report.user_id = them) CAN now UPDATE
 *     that lead; a NON-assigned agent still DENIED.
 *   - agent CANNOT rewrite lead_report.user_id to someone else (reassign);
 *     a TL/admin CAN, within their project.
 *   - company/contact: owner_user_id owner CAN edit their per-project status;
 *     non-owner DENIED; only admin/manager can re-point owner_user_id.
 *   - REGRESSION: legacy created_by owner still has access; the meeting snapshot
 *     trigger still writes portal.meeting_snapshot; stage-change / report-submit
 *     flows still work for the assignee + managers.
 *
 * USAGE:  node apply-assignment-rls.cjs            (apply, staged/manual)
 *         node apply-assignment-rls.cjs --rollback (restore prior policies)
 *
 * Mirrors apply-access-rls.js / apply-task-rls.cjs: single BEGIN/COMMIT, ROLLBACK
 * on error, VERIFY (pg_proc + pg_policies) after. Idempotent.
 */
require('dotenv').config();
const { Pool } = require('pg');

const TABLES = ['lead_master', 'lead_report', 'company_project_status', 'contact_project_status'];

const SQL = `
-- =====================================================================
-- ALT-152 / ALT-288 — ASSIGNMENT WRITE MODEL (additive, reversible)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. assigned_to(rtype, rid): the ASSIGNED user (NOT created_by).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assigned_to(rtype text, rid bigint)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE rtype
    WHEN 'lead' THEN (
      SELECT lr.user_id
      FROM lead_report lr
      WHERE lr.lead_id = rid AND lr.deleted_date IS NULL
      ORDER BY lr.report_id DESC
      LIMIT 1)
    WHEN 'company' THEN (
      SELECT owner_user_id
      FROM company_project_status
      WHERE company_id = rid AND owner_user_id IS NOT NULL
      ORDER BY project_id
      LIMIT 1)
    WHEN 'contact' THEN (
      SELECT owner_user_id
      FROM contact_project_status
      WHERE contact_id = rid AND owner_user_id IS NOT NULL
      ORDER BY project_id
      LIMIT 1)
  END
$$;

-- ---------------------------------------------------------------------
-- 2. meeting_lead_id(meeting_id): lead behind a meeting.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meeting_lead_id(p_meeting_id bigint)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lr.lead_id
  FROM meeting_schedule ms
  JOIN lead_report lr ON lr.report_id = ms.report_id
  WHERE ms.meeting_id = p_meeting_id
  ORDER BY ms.meeting_id DESC
  LIMIT 1
$$;

-- ---------------------------------------------------------------------
-- 3. lead_master UPDATE — add assignment term to the live v2 dial policy.
--    (Every existing term preserved; only the assigned_to() OR-term added.)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS lead_master_update ON public.lead_master;
CREATE POLICY lead_master_update ON public.lead_master
  FOR UPDATE
  USING (
    public.is_admin()
    OR created_by = public.current_user_id()::text
    OR public.assigned_to('lead', lead_id) = public.current_user_id()
    OR (public.edit_scope_of('lead', project_id) IN ('team','everyone') AND public.manages_project(project_id))
    OR (public.edit_scope_of('lead', project_id) = 'everyone' AND public.is_member(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR created_by = public.current_user_id()::text
    OR public.assigned_to('lead', lead_id) = public.current_user_id()
    OR (public.edit_scope_of('lead', project_id) IN ('team','everyone') AND public.manages_project(project_id))
    OR (public.edit_scope_of('lead', project_id) = 'everyone' AND public.is_member(project_id))
  );

-- ---------------------------------------------------------------------
-- 4. lead_report — RESTRICTIVE UPDATE guard (ANDs with the blanket policy).
--    Only the assignee (self-edit) or a project manager / admin may UPDATE a
--    report row. Reassigning user_id to ANOTHER person passes ONLY via the
--    admin / manages_project branch (WITH CHECK). SELECT/INSERT/DELETE remain
--    on the permissive blanket — reads + report creation are unaffected.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS lead_report_reassign_guard ON public.lead_report;
CREATE POLICY lead_report_reassign_guard ON public.lead_report
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = public.current_user_id()
    OR public.manages_project((SELECT project_id FROM lead_master WHERE lead_id = lead_report.lead_id))
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = public.current_user_id()
    OR public.manages_project((SELECT project_id FROM lead_master WHERE lead_id = lead_report.lead_id))
  );

-- ---------------------------------------------------------------------
-- 5. company_project_status / contact_project_status UPDATE — add the
--    owner_user_id assignment term (columns already exist; were dormant).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS company_project_status_update ON public.company_project_status;
CREATE POLICY company_project_status_update ON public.company_project_status
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.record_owner_id('company', company_id) = public.current_user_id()
    OR owner_user_id = public.current_user_id()
    OR public.manages_project(project_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.record_owner_id('company', company_id) = public.current_user_id()
    OR owner_user_id = public.current_user_id()
    OR public.manages_project(project_id)
  );

DROP POLICY IF EXISTS contact_project_status_update ON public.contact_project_status;
CREATE POLICY contact_project_status_update ON public.contact_project_status
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.record_owner_id('contact', contact_id) = public.current_user_id()
    OR owner_user_id = public.current_user_id()
    OR public.manages_project(project_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.record_owner_id('contact', contact_id) = public.current_user_id()
    OR owner_user_id = public.current_user_id()
    OR public.manages_project(project_id)
  );
`;

// Restores the PRIOR policy bodies (from access-dials-v2.sql / access-rls-v1.sql)
// and drops the new guard + helpers. Use if validation fails.
const ROLLBACK_SQL = `
DROP POLICY IF EXISTS lead_report_reassign_guard ON public.lead_report;

DROP POLICY IF EXISTS lead_master_update ON public.lead_master;
CREATE POLICY lead_master_update ON public.lead_master
  FOR UPDATE
  USING (
    public.is_admin()
    OR created_by = public.current_user_id()::text
    OR (public.edit_scope_of('lead', project_id) IN ('team','everyone') AND public.manages_project(project_id))
    OR (public.edit_scope_of('lead', project_id) = 'everyone' AND public.is_member(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR created_by = public.current_user_id()::text
    OR (public.edit_scope_of('lead', project_id) IN ('team','everyone') AND public.manages_project(project_id))
    OR (public.edit_scope_of('lead', project_id) = 'everyone' AND public.is_member(project_id))
  );

DROP POLICY IF EXISTS company_project_status_update ON public.company_project_status;
CREATE POLICY company_project_status_update ON public.company_project_status
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.record_owner_id('company', company_id) = public.current_user_id()
    OR public.manages_project(project_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.record_owner_id('company', company_id) = public.current_user_id()
    OR public.manages_project(project_id)
  );

DROP POLICY IF EXISTS contact_project_status_update ON public.contact_project_status;
CREATE POLICY contact_project_status_update ON public.contact_project_status
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.record_owner_id('contact', contact_id) = public.current_user_id()
    OR public.manages_project(project_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.record_owner_id('contact', contact_id) = public.current_user_id()
    OR public.manages_project(project_id)
  );

DROP FUNCTION IF EXISTS public.meeting_lead_id(bigint);
DROP FUNCTION IF EXISTS public.assigned_to(text, bigint);
`;

(async () => {
  const rollback = process.argv.includes('--rollback');
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(rollback ? ROLLBACK_SQL : SQL);
    await client.query('COMMIT');
    console.log(rollback ? 'ROLLED BACK assignment-rls OK (committed).' : 'APPLIED assignment-rls OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('OPERATION FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // === VERIFY: helper functions ===
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.provolatile, p.prosecdef
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public'
       AND p.proname IN ('assigned_to','meeting_lead_id','record_owner_id','manages_project','current_user_id','is_admin')
     ORDER BY p.proname`);
  console.log('\n=== HELPER FUNCTIONS (AFTER) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // === VERIFY: policies (incl. RESTRICTIVE / PERMISSIVE) ===
  const pol = await client.query(
    `SELECT tablename, policyname, cmd, permissive, roles, qual, with_check
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
