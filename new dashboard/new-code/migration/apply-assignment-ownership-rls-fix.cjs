'use strict';
/**
 * apply-assignment-ownership-rls-fix.cjs
 * ★ LAUNCH-CRITICAL ★ — fixes the #1 internal-beta blocker (audit 2026-06-30).
 *
 * STATUS: STAGED — NOT executed. `node -c apply-assignment-ownership-rls-fix.cjs`
 *         syntax-checks. Run with `--apply` ONLY after throwaway-login validation
 *         + Ankit sign-off (CLAUDE.md §2). This rewrites live RLS — validate first.
 *
 * ── THE BUG (verified against prod RLS 2026-06-30) ───────────────────────────
 * RLS "ownership" keys on lead_master.created_by, but a lead is ASSIGNED to a rep
 * via lead_report.user_id. After the bulk migration these diverge (created_by =
 * importer/admin, NOT the rep). Result, for a plain AGENT:
 *   • lead_master SELECT is denied (created_by != me; view_scope is 'team' and the
 *     policy only honors 'everyone') → agent can't OPEN leads assigned to them.
 *   • interaction INSERT is denied (record_owner_id('lead') = created_by != me)
 *     → agent can't LOG A CALL on leads assigned to them (error shown to user).
 *
 * ── THE FIX (minimal, decision-independent) ──────────────────────────────────
 * Add an "is the current user the ASSIGNED salesperson of this lead" branch,
 * keyed on lead_report.user_id, to:
 *   1. lead_master SELECT      → agent can SEE their assigned leads.
 *   2. interaction INSERT      → agent can LOG a call on their assigned leads.
 *   3. interaction UPDATE      → agent can edit a call they logged.
 * Everything else in each policy is preserved verbatim. We do NOT touch
 * lead_master UPDATE here (whether agents may edit lead identity fields is a
 * PENDING DECISION — outreach-only model says no; revisit after sign-off).
 *
 * This is additive (ALTER POLICY only widens access for the true assignee); it
 * does not loosen anything for non-assignees.
 *
 * ── COORDINATION (important) ─────────────────────────────────────────────────
 * apply-project-read-isolation-rls.cjs ALSO rewrites lead_master_select. If that
 * migration is applied AFTER this one, its rewrite MUST re-include
 * `OR is_lead_assignee(lead_id)` or it will re-break the agent read path. A
 * matching note has been added there. Sequence + validate together (ALT-229 gate).
 *
 * IDEMPOTENT: CREATE OR REPLACE FUNCTION + ALTER POLICY both re-runnable.
 * RELEVANT: internal-launch write-path/ownership blocker; ALT-152/458/462/463.
 *
 * ── ROLLBACK (restore the pre-fix policies) ──────────────────────────────────
 *   ALTER POLICY lead_master_select ON public.lead_master USING (
 *     is_admin() OR is_qc() OR (created_by::text = current_user_id()::text)
 *     OR manages_project(project_id)
 *     OR (view_scope_of('lead', project_id) = 'everyone' AND is_member(project_id)));
 *   -- and the two interaction policies back to their original (record_owner_id ...) form.
 *   DROP FUNCTION IF EXISTS public.is_lead_assignee(bigint);
 */

const SQL = `
-- 1. Helper: is the current user the assigned salesperson on this lead?
--    (assignment = lead_report.user_id; a lead may have multiple reports/projects)
CREATE OR REPLACE FUNCTION public.is_lead_assignee(p_lead_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_report lr
    WHERE lr.lead_id = p_lead_id
      AND lr.user_id = public.current_user_id()
      AND lr.deleted_date IS NULL
  )
$fn$;

-- 2. lead_master SELECT — append the assignee branch (rest preserved verbatim).
ALTER POLICY lead_master_select ON public.lead_master
  USING (
    is_admin()
    OR is_qc()
    OR ((created_by)::text = (current_user_id())::text)
    OR manages_project(project_id)
    OR ((view_scope_of('lead'::text, project_id) = 'everyone'::text) AND is_member(project_id))
    OR is_lead_assignee(lead_id)
  );

-- 3. interaction INSERT — agent can log a call on a lead assigned to them.
ALTER POLICY interaction_insert ON public.interaction
  WITH CHECK (
    is_admin()
    OR (record_owner_id(record_type, record_id) = current_user_id())
    OR ((record_type = 'lead'::text) AND manages_project(record_project_id('lead'::text, record_id)))
    OR ((record_type = 'lead'::text) AND is_lead_assignee(record_id))
  );

-- 4. interaction UPDATE — agent can edit a call they logged on their lead.
ALTER POLICY interaction_update ON public.interaction
  USING (
    is_admin()
    OR (record_owner_id(record_type, record_id) = current_user_id())
    OR ((record_type = 'lead'::text) AND manages_project(record_project_id('lead'::text, record_id)))
    OR ((record_type = 'lead'::text) AND is_lead_assignee(record_id))
  )
  WITH CHECK (
    is_admin()
    OR (record_owner_id(record_type, record_id) = current_user_id())
    OR ((record_type = 'lead'::text) AND manages_project(record_project_id('lead'::text, record_id)))
    OR ((record_type = 'lead'::text) AND is_lead_assignee(record_id))
  );
`;

// VALIDATION PLAN (run before --apply on prod):
//  1. Apply on a throwaway/staging DB (or crm-test).
//  2. Log in as a throwaway AGENT whose user_id owns some lead_report rows but did
//     NOT create the lead_master rows. Confirm: (a) the agent can OPEN those leads'
//     detail, (b) the leads list shows their name/company, (c) logging a call
//     succeeds (interaction insert), (d) the agent still CANNOT see/log on leads
//     NOT assigned to them (unless view_scope='everyone' is later enabled).
//  3. Confirm admin/QC/TL unaffected. Then sign-off + prod apply.

async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(SQL);
    await c.query('COMMIT');
    console.log('✅ applied: is_lead_assignee + assignee branch on lead_master SELECT + interaction INSERT/UPDATE');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

if (require.main === module && process.argv.includes('--apply')) {
  main();
} else {
  console.log('STAGED — not applied. Run `node apply-assignment-ownership-rls-fix.cjs --apply` AFTER throwaway-login validation + sign-off.');
}
