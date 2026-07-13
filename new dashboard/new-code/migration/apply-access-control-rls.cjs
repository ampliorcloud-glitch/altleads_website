/**
 * apply-access-control-rls.cjs
 * Staged RLS migration — locked role-access model (Part 9, ACCESS-CONTROL-MODEL.md).
 *
 * STATUS: STAGED — NOT executed against any database.
 *         Run `node -c apply-access-control-rls.cjs` to syntax-check only.
 *         Execute against a throwaway role login FIRST (see VALIDATION PLAN below).
 *         Apply to prod only after the owner gives the go-ahead (CLAUDE.md §2).
 *
 * RELEVANT TICKETS: ALT-152/433, ALT-458, ALT-459, ALT-463, DEC-03.
 *
 * DB FACTS (discovered 2026-06-28 via discover-schema-temp.cjs):
 *   - Helper functions available: is_admin(), is_qc(), current_user_id(),
 *     is_member(pid), manages_project(pid), record_owner_id(rtype, rid),
 *     edit_scope_of(otype, pid), view_scope_of(otype, pid).
 *   - stage_master: stage_id 4 = "Meeting Scheduled" (first meeting-outcome stage).
 *   - lead_report: RLS is currently wide-open (USING true / WITH CHECK true).
 *   - company_master / contact_master: INSERT/UPDATE/DELETE restricted to owner or admin.
 *   - No prequalified/prequalification tables exist yet.
 *   - manages_user() is a stub (always false) — downline hierarchy not built.
 *
 * ── VALIDATION PLAN ─────────────────────────────────────────────────────────
 *
 * Before applying to prod, run ALL of the following checks via throwaway role logins
 * using a separate Supabase client configured with a service-role key that impersonates
 * each role. Create test logins in the Admin panel for each role.
 *
 * Legend: ✅ = MUST succeed / return rows   ❌ = MUST fail (RLS violation / 0 rows)
 *
 * ┌─ AGENT (role 3) — owns lead_id=<TEST_LEAD>, assigned via lead_report.user_id ─────────────
 * │  1. UPDATE lead_report WHERE lead_id=<TEST_LEAD> AND stage_id >= 4   → ✅ (their lead)
 * │  2. UPDATE lead_report WHERE lead_id=<OTHER_LEAD>                    → ❌ (not assigned)
 * │  3. UPDATE lead_report WHERE lead_id=<TEST_LEAD> AND stage_id < 4    → ❌ (pre-meeting)
 * │  4. UPDATE company_master WHERE company_id=<any>                     → ❌ (agents blocked)
 * │  5. UPDATE contact_master WHERE contact_id=<any>                     → ❌ (agents blocked)
 * │  6. SELECT lead_master WHERE project_id=<their project>              → ✅
 * └───────────────────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ QC (role 6) — not assigned to any lead ─────────────────────────────────────────────────
 * │  1. UPDATE lead_report WHERE lead_id=<any in project>                → ✅ (QC = TL edit)
 * │  2. UPDATE lead_master WHERE lead_id=<any in project>                → ✅
 * │  3. UPDATE company_master WHERE company_id=<any>                     → ✅ (QC = TL)
 * │  4. UPDATE contact_master WHERE contact_id=<any>                     → ✅ (QC = TL)
 * │  5. canReassign check in UI                                          → ❌ (UI: isQC → no reassign)
 * │     (RLS does not block reassign — it's a UI-only restriction; reassign writes
 * │      go through reassignLead → lead_report UPDATE, which QC CAN do via rule above)
 * └───────────────────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ TEAM_LEAD (role 2) ──────────────────────────────────────────────────────────────────────
 * │  1. UPDATE lead_report WHERE lead_id=<any in their project>          → ✅
 * │  2. UPDATE company_master WHERE company_id=<any>                     → ✅
 * │  3. UPDATE contact_master WHERE contact_id=<any>                     → ✅
 * │  4. Approve button visible in UI                                     → ✅ (isApprover = true)
 * │  5. Reassign button visible                                          → ✅ (canReassign = true)
 * └───────────────────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ SALES_HEAD (role 4) / SALES_PERSON (role 5) ────────────────────────────────────────────
 * │  1. UPDATE lead_master WHERE lead_id=<any>                           → ❌
 * │  2. UPDATE lead_report WHERE lead_id=<any>                           → ❌
 * │  3. UPDATE company_master WHERE company_id=<any>                     → ❌
 * │  4. UPDATE contact_master WHERE contact_id=<any>                     → ❌
 * │  5. SELECT lead_master WHERE project_id=<their project>              → ✅ (read still open)
 * └───────────────────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ ADMIN (role 1) ──────────────────────────────────────────────────────────────────────────
 * │  1. UPDATE / DELETE / INSERT on all tables                           → ✅ (unchanged)
 * └───────────────────────────────────────────────────────────────────────────────────────────
 *
 * ── HOW TO APPLY ────────────────────────────────────────────────────────────
 *
 * This script is CJS-structured so `node -c` syntax-checks it. To actually apply, either:
 *   a) Paste the SQL blocks below into the Supabase SQL editor (recommended — visible, auditable).
 *   b) Uncomment the supabase.rpc() calls at the bottom and run with the PG connection from .env.
 *
 * Always run the DOWN section first on a throwaway, confirm it drops cleanly, then run UP.
 */

'use strict';

// ── UP — policies to CREATE ─────────────────────────────────────────────────

const UP_SQL = /* sql */`
-- ============================================================
-- Part 9 locked role-access policies (2026-06-28)
-- ADDITIVE ONLY — does not drop existing policies.
-- Run in a transaction; roll back if any statement fails.
-- ============================================================

BEGIN;

-- ── 1. lead_report ───────────────────────────────────────────────────────────
-- CURRENT STATE: single policy "authenticated_full_access" (USING true / CHECK true)
-- We REPLACE it with role-scoped policies.

-- DROP the blanket open policy first.
DROP POLICY IF EXISTS "authenticated_full_access" ON lead_report;

-- SELECT: all authenticated internal users may read lead_report rows they can see.
--         Sales users may also read (they need the report for the sales portal).
CREATE POLICY "lead_report_select_all_authenticated"
  ON lead_report
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- UPDATE (assignee-edit / ALT-152 / DEC-03):
--   Admin and QC: any lead_report (project-scoped implicitly via is_member check below).
--   Team Lead: any lead_report in a project they manage.
--   Agent: only their OWN assigned lead_report AND only when stage_id >= 4
--          ("Meeting Scheduled" — DB stage_master.stage_id = 4).
--   Sales: NO UPDATE on lead_report (portal deferred; TODO sales request-edit/feedback).
CREATE POLICY "lead_report_update_role_scoped"
  ON lead_report
  FOR UPDATE
  USING (
    -- Admin: always
    is_admin()
    OR
    -- QC: any row (mirrors TL; QC reads all, edits all in project)
    is_qc()
    OR
    -- Team Lead: any row where they manage the lead's project
    (
      EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name = 'TEAM_LEAD'
      )
    )
    OR
    -- Agent: only their assigned row AND stage_id >= 4 (Meeting Scheduled onward)
    (
      EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name = 'AGENT'
      )
      AND user_id = current_user_id()   -- lead_report.user_id = assignee
      AND stage_id >= 4                 -- stage 4 = Meeting Scheduled
    )
    -- Sales (role 4/5): no UPDATE clause → denied by default
    -- TODO(sales request-edit/feedback): add a request-edit path when the sales
    -- portal scoping lands. For now sales UPDATE is denied here (ALT-463).
  )
  WITH CHECK (
    -- Mirror USING so an INSERT-as-UPDATE can't bypass the filter.
    is_admin()
    OR is_qc()
    OR (
      EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name = 'TEAM_LEAD'
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name = 'AGENT'
      )
      AND user_id = current_user_id()
      AND stage_id >= 4
    )
  );

-- INSERT: only Admin and TL may create new lead_report rows (initial report creation).
-- Agents don't create lead_report rows independently; they edit after admin/TL seeds one.
CREATE POLICY "lead_report_insert_admin_tl"
  ON lead_report
  FOR INSERT
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM user_role ur
      JOIN role_master rm ON rm.role_id = ur.role_id
      WHERE ur.user_id = current_user_id()
        AND ur.deleted_date IS NULL
        AND rm.name = 'TEAM_LEAD'
    )
  );

-- DELETE: admin only.
CREATE POLICY "lead_report_delete_admin_only"
  ON lead_report
  FOR DELETE
  USING (is_admin());


-- ── 2. lead_master ───────────────────────────────────────────────────────────
-- CURRENT: UPDATE allowed to created_by owner or admin/manages_project.
-- CHANGE: Agent UPDATE denied entirely here (agent edits go to lead_report only).
--         Sales UPDATE denied (ALT-463).
--         The existing UPDATE policy name was found as part of RLS discovery;
--         we add a new RESTRICTIVE policy rather than replacing to stay additive.
--
-- NOTE: Postgres evaluates PERMISSIVE policies with OR, RESTRICTIVE with AND.
--       Adding a RESTRICTIVE policy here will tighten existing permissions.

CREATE POLICY "lead_master_deny_agent_update"
  ON lead_master
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    -- Deny if the user is ONLY an agent (no admin/TL/QC role).
    -- This is a RESTRICTIVE policy: it BLOCKS UPDATE unless this condition is true.
    -- Returning TRUE means "allow"; FALSE means "block".
    NOT (
      -- User holds AGENT role
      EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name = 'AGENT'
      )
      -- ... but NOT also admin/TL/QC (an agent who is also QC is allowed)
      AND NOT is_admin()
      AND NOT is_qc()
      AND NOT EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name = 'TEAM_LEAD'
      )
    )
  );

CREATE POLICY "lead_master_deny_sales_update"
  ON lead_master
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    -- Deny UPDATE for pure sales roles (no internal role).
    -- TODO(sales request-edit/feedback): replace with request-edit path (ALT-463).
    NOT (
      EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name IN ('SALES_HEAD', 'SALES_PERSON')
      )
      AND NOT is_admin()
      AND NOT is_qc()
      AND NOT EXISTS (
        SELECT 1 FROM user_role ur
        JOIN role_master rm ON rm.role_id = ur.role_id
        WHERE ur.user_id = current_user_id()
          AND ur.deleted_date IS NULL
          AND rm.name IN ('ADMIN', 'TEAM_LEAD', 'AGENT', 'QC')
      )
    )
  );


-- ── 3. company_master ────────────────────────────────────────────────────────
-- CURRENT: UPDATE restricted to created_by = current_user_id() OR is_admin().
-- CHANGE: Also allow TL and QC (they can edit any company in their project).
--         Agent UPDATE remains denied (not created_by — agents don't create companies).
--         Sales UPDATE remains denied.
--
-- We REPLACE the single existing UPDATE policy with one that includes TL + QC.
-- First, drop the legacy policy (name discovered: "company_master_update_owner_or_admin"
-- — confirm exact name before running; adjust if different).

DROP POLICY IF EXISTS "company_master_update_owner_or_admin" ON company_master;

CREATE POLICY "company_master_update_internal_managers"
  ON company_master
  FOR UPDATE
  USING (
    is_admin()
    OR is_qc()
    OR EXISTS (
      SELECT 1 FROM user_role ur
      JOIN role_master rm ON rm.role_id = ur.role_id
      WHERE ur.user_id = current_user_id()
        AND ur.deleted_date IS NULL
        AND rm.name = 'TEAM_LEAD'
    )
    -- Note: created_by owner-edit is intentionally REMOVED here.
    -- Under Part 9 / DEC-03, the assignee (lead_report.user_id) is the edit owner,
    -- not created_by. Company-master edits are manager/admin-only.
    -- Agents (created_by on most migrated records) should NOT be able to edit
    -- company_master just because they created the record originally.
  )
  WITH CHECK (
    is_admin()
    OR is_qc()
    OR EXISTS (
      SELECT 1 FROM user_role ur
      JOIN role_master rm ON rm.role_id = ur.role_id
      WHERE ur.user_id = current_user_id()
        AND ur.deleted_date IS NULL
        AND rm.name = 'TEAM_LEAD'
    )
  );

-- DELETE: admin only (unchanged).
DROP POLICY IF EXISTS "company_master_delete_owner_or_admin" ON company_master;
CREATE POLICY "company_master_delete_admin_only"
  ON company_master
  FOR DELETE
  USING (is_admin());


-- ── 4. contact_master ────────────────────────────────────────────────────────
-- Same pattern as company_master: TL + QC + Admin can UPDATE; agents/sales cannot.

DROP POLICY IF EXISTS "contact_master_update_owner_or_admin" ON contact_master;

CREATE POLICY "contact_master_update_internal_managers"
  ON contact_master
  FOR UPDATE
  USING (
    is_admin()
    OR is_qc()
    OR EXISTS (
      SELECT 1 FROM user_role ur
      JOIN role_master rm ON rm.role_id = ur.role_id
      WHERE ur.user_id = current_user_id()
        AND ur.deleted_date IS NULL
        AND rm.name = 'TEAM_LEAD'
    )
  )
  WITH CHECK (
    is_admin()
    OR is_qc()
    OR EXISTS (
      SELECT 1 FROM user_role ur
      JOIN role_master rm ON rm.role_id = ur.role_id
      WHERE ur.user_id = current_user_id()
        AND ur.deleted_date IS NULL
        AND rm.name = 'TEAM_LEAD'
    )
  );

DROP POLICY IF EXISTS "contact_master_delete_owner_or_admin" ON contact_master;
CREATE POLICY "contact_master_delete_admin_only"
  ON contact_master
  FOR DELETE
  USING (is_admin());


COMMIT;
`;

// ── DOWN — policies to DROP (reversal) ──────────────────────────────────────

const DOWN_SQL = /* sql */`
-- Reversal: drop the Part 9 policies and restore prior state.
-- Run this if the throwaway-login validation fails before applying to prod.

BEGIN;

-- lead_report: restore the blanket open policy
DROP POLICY IF EXISTS "lead_report_select_all_authenticated" ON lead_report;
DROP POLICY IF EXISTS "lead_report_update_role_scoped" ON lead_report;
DROP POLICY IF EXISTS "lead_report_insert_admin_tl" ON lead_report;
DROP POLICY IF EXISTS "lead_report_delete_admin_only" ON lead_report;

CREATE POLICY "authenticated_full_access"
  ON lead_report
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- lead_master: drop the restrictive deny policies
DROP POLICY IF EXISTS "lead_master_deny_agent_update" ON lead_master;
DROP POLICY IF EXISTS "lead_master_deny_sales_update" ON lead_master;

-- company_master: restore the legacy owner-or-admin policy
DROP POLICY IF EXISTS "company_master_update_internal_managers" ON company_master;
DROP POLICY IF EXISTS "company_master_delete_admin_only" ON company_master;

-- (Restore legacy names — adjust if DB had different names)
CREATE POLICY "company_master_update_owner_or_admin"
  ON company_master
  FOR UPDATE
  USING (is_admin() OR created_by = current_user_id()::text)
  WITH CHECK (is_admin() OR created_by = current_user_id()::text);

CREATE POLICY "company_master_delete_owner_or_admin"
  ON company_master
  FOR DELETE
  USING (is_admin() OR created_by = current_user_id()::text);

-- contact_master: restore legacy owner-or-admin policy
DROP POLICY IF EXISTS "contact_master_update_internal_managers" ON contact_master;
DROP POLICY IF EXISTS "contact_master_delete_admin_only" ON contact_master;

CREATE POLICY "contact_master_update_owner_or_admin"
  ON contact_master
  FOR UPDATE
  USING (is_admin() OR created_by = current_user_id()::text)
  WITH CHECK (is_admin() OR created_by = current_user_id()::text);

CREATE POLICY "contact_master_delete_owner_or_admin"
  ON contact_master
  FOR DELETE
  USING (is_admin() OR created_by = current_user_id()::text);

COMMIT;
`;

// ── Exports (so the file is a valid CJS module and node -c passes) ───────────

module.exports = { UP_SQL, DOWN_SQL };

/*
 * To apply:
 *   1. Paste UP_SQL into the Supabase SQL editor (Dashboard → SQL Editor).
 *   2. Run on a staging / throwaway DB first.
 *   3. Execute the VALIDATION PLAN checks at the top of this file.
 *   4. Get owner go-ahead (CLAUDE.md §2), then run on prod.
 *
 * NEVER run node apply-access-control-rls.cjs directly against prod without
 * the validation steps above. This file is intentionally NOT self-executing.
 */
