'use strict';
/**
 * apply-project-read-isolation-rls.cjs
 * Staged RLS migration — project-membership-gated SELECT isolation.
 *
 * STATUS: STAGED — NOT executed against any database.
 *         Run `node -c apply-project-read-isolation-rls.cjs` to syntax-check only.
 *         Execute against a throwaway role login FIRST (see VALIDATION PLAN below).
 *         Apply to prod only after Ankit gives the go-ahead (CLAUDE.md §2).
 *
 * RELEVANT TICKETS: ALT-490 (import dedup QC), referenced in ALT-489 notification center.
 * DEPENDS ON: apply-access-control-rls.cjs (defines is_admin, is_qc, current_user_id helpers).
 *             apply-portal-rls.cjs  (adds deny_portal_session RESTRICTIVE policies — run that too).
 *
 * ── PROBLEM ──────────────────────────────────────────────────────────────────
 *
 * The existing SELECT policies on every project-scoped table use `USING (true)`
 * or `USING (auth.role() = 'authenticated')` — any authenticated user can read
 * ANY project's data regardless of whether they are a member of that project.
 *
 * This migration replaces those open SELECT policies with membership-gated ones:
 *   a user can SELECT a row only if they are in project_user for that row's project_id,
 *   OR if they are an admin / QC.
 *
 * ── DESIGN ───────────────────────────────────────────────────────────────────
 *
 * Auth identity chain (confirmed via introspection 2026-06-29):
 *   auth.uid()  (uuid)
 *     → profiles.id = auth.uid()  → profiles.user_id  (bigint)  [current_user_id()]
 *     → project_user.user_id                                      [is_member(pid)]
 *
 * Both helpers already exist (SECURITY DEFINER, STABLE, search_path pinned):
 *   current_user_id() → SELECT user_id FROM profiles WHERE id = auth.uid()
 *   is_member(pid)    → EXISTS(SELECT 1 FROM project_user WHERE project_id=pid
 *                              AND user_id = current_user_id() AND deleted_date IS NULL)
 *
 * No new helper function is required. We reuse is_admin(), is_qc(), is_member()
 * as-is from the existing migration set.
 *
 * ── TABLE CLASSIFICATION (confirmed via introspection) ────────────────────────
 *
 * GROUP A — DIRECT project_id column (straightforward EXISTS on is_member):
 *   lead_master              project_id  (direct)
 *   interaction              project_id  (direct, nullable)
 *   company_project_status   project_id  (direct)
 *   contact_project_status   project_id  (direct)
 *
 * GROUP B — link to project via lead_id → lead_master.project_id:
 *   lead_report              lead_id  → lead_master.project_id
 *   lead_status_history      lead_id  → lead_master.project_id
 *   lead_activity            lead_id  → lead_master.project_id
 *   lead_designation         lead_id  → lead_master.project_id  (no project_id confirmed)
 *
 * GROUP C — link to project via meeting_id → meeting_schedule.report_id
 *           → lead_report.lead_id → lead_master.project_id:
 *   meeting_master           meeting_id (only key; no project_id)
 *   meeting_schedule         meeting_id + report_id (report → lead → project)
 *   meeting_question         meeting_id  (same chain)
 *   meeting_participant      meeting_id  (same chain)
 *   meeting_reschedule       meeting_id  (same chain)
 *   feedback_answer          meeting_id  (same chain)
 *
 * GROUP D — link to project via report_id → lead_report.lead_id → lead_master.project_id:
 *   pre_sales_answer         report_id  → lead_report.lead_id → lead_master.project_id
 *   new_sales_question       report_id  → lead_report.lead_id → lead_master.project_id
 *
 * GROUP E — user-recipient scoped (NOT project-scoped; user_id = recipient):
 *   in_app_notification      user_id  (the recipient — scope to self + admin only)
 *
 * GLOBALLY SHARED (no project_id, intentionally global — NOT scoped):
 *   company_master           globally shared company pool (no project_id column)
 *   contact_master           globally shared contact pool (no project_id column)
 *   -- See §3 of design doc for leak-risk analysis of their columns.
 *
 * OUT OF SCOPE (reference/lookup tables — open read is correct; no client data):
 *   role_master, stage_master, status_master, source_master, industry_master,
 *   sub_industry_master, company_sector, domain_master, designation_master,
 *   turnover_master, city_master, state_master, countrycode_master,
 *   dropdown_option, pre_sales_question, feedback_question_master, use_cases,
 *   project_visibility_setting, rbac_master — all read-only lookup / config tables.
 *
 * OUT OF SCOPE (already tightly scoped by non-project isolation):
 *   task                  — owner_user_id (apply-task-rls.cjs)
 *   task_user_pref        — user_id       (apply-task-rls.cjs)
 *   call_log              — owner_user_id (apply-call-log-rls.cjs)
 *   user_view_pref        — user_id = current_user_id() (existing policy)
 *
 * ── POLICY SHAPE ─────────────────────────────────────────────────────────────
 *
 * For every table in Groups A–D, the pattern is:
 *
 *   USING (
 *     is_admin()
 *     OR is_qc()
 *     OR is_member(<project_id resolution>)
 *   )
 *
 * where <project_id resolution> is:
 *   Group A: <table>.project_id   (direct)
 *   Group B: (SELECT project_id FROM lead_master WHERE lead_id = <table>.lead_id)
 *   Group C: (SELECT lm.project_id
 *              FROM meeting_schedule ms
 *              JOIN lead_report lr ON lr.report_id = ms.report_id
 *              JOIN lead_master lm ON lm.lead_id   = lr.lead_id
 *             WHERE ms.meeting_id = <table>.meeting_id
 *             LIMIT 1)
 *   Group D: (SELECT lm.project_id
 *              FROM lead_report lr
 *              JOIN lead_master lm ON lm.lead_id = lr.lead_id
 *             WHERE lr.report_id = <table>.report_id
 *             LIMIT 1)
 *
 * ── EXISTING lead_master SELECT policy note ──────────────────────────────────
 *
 * lead_master already has a non-trivial SELECT policy "lead_master_select":
 *   is_admin() OR is_qc() OR created_by=current_user_id() OR manages_project()
 *   OR (view_scope_of='everyone' AND is_member())
 *
 * This policy is MORE RESTRICTIVE than what we want for project-read-isolation:
 * a non-creator project member CAN'T read unless view_scope_of='everyone'. The
 * read-isolation requirement (project member = can read) is WIDER than the
 * current policy on lead_master.
 *
 * Resolution: this migration REPLACES "lead_master_select" with a pure membership
 * policy. The view_scope_of() configurability is intentionally dropped here —
 * the product requirement for read-isolation says membership = access, full stop.
 * Ankit should confirm before applying if view_scope_of(='owner') restriction
 * should be preserved as an AND term on top of membership. See FLAG below.
 *
 * ── FLAG FOR ANKIT ───────────────────────────────────────────────────────────
 *
 * FLAG-1 (lead_master SELECT): The existing lead_master SELECT policy uses
 *   view_scope_of('lead', project_id) to further restrict which project members
 *   can see leads (owner-only by default). This migration REPLACES that with
 *   plain is_member(project_id). If you want to keep the per-project view_scope_of
 *   configurability, the policy should be:
 *     is_admin() OR is_qc()
 *     OR manages_project(project_id)
 *     OR (is_member(project_id) AND view_scope_of('lead',project_id) IN ('team','everyone'))
 *     OR (is_member(project_id) AND assigned_to('lead',lead_id) = current_user_id())
 *   The current UP_SQL uses plain is_member() — simpler and consistent with the
 *   "project membership = read access" requirement as stated. Confirm before applying.
 *
 * FLAG-2 (lead_designation): This table has NO lead_id, project_id, or any
 *   discoverable FK to a project chain (confirmed introspection). It's fully
 *   open today. We leave it open (scoped to authenticated) pending a schema
 *   check. It appears to store designation metadata, not PII lead data.
 *   Ankit should verify what this table actually holds.
 *
 * FLAG-3 (meeting_master chain depth): Group C policies join 3 tables to reach
 *   project_id. Each subquery uses EXISTS + LIMIT 1 so it short-circuits, but
 *   the chain adds latency on large datasets. Consider materialising project_id
 *   on meeting_schedule (or meeting_master) as a denorm column once volume grows.
 *
 * FLAG-4 (in_app_notification): This table has no project_id. It has user_id
 *   (the recipient). We scope SELECT to self (user_id = current_user_id()) OR
 *   admin. This is not project-isolation but it's the correct privacy model for
 *   notifications. Confirm this is the intended behaviour.
 *
 * ── VALIDATION PLAN ─────────────────────────────────────────────────────────
 *
 * Before applying to prod, validate with throwaway Supabase Auth logins.
 * Create test users for each scenario in the Supabase Auth dashboard.
 * Use the Supabase JS client (or service-role impersonation) for each check.
 *
 * Legend: ✅ MUST return rows   ❌ MUST return 0 rows (RLS blocks)
 *
 * ┌─ MEMBER of project P (project_user row exists, deleted_date IS NULL) ──────
 * │  SELECT lead_master WHERE project_id = P            → ✅
 * │  SELECT lead_report WHERE lead_id IN (leads of P)   → ✅
 * │  SELECT interaction WHERE project_id = P            → ✅
 * │  SELECT company_project_status WHERE project_id = P → ✅
 * │  SELECT contact_project_status WHERE project_id = P → ✅
 * │  SELECT meeting_master WHERE meeting_id IN (meetings of P) → ✅
 * │  SELECT lead_master WHERE project_id != P           → ❌
 * │  SELECT lead_report WHERE lead_id belongs to Q≠P    → ❌
 * └───────────────────────────────────────────────────────────────────────────
 *
 * ┌─ NON-MEMBER (authenticated, but no project_user row for P) ────────────────
 * │  SELECT lead_master WHERE project_id = P            → ❌
 * │  SELECT lead_report WHERE lead_id belongs to P      → ❌
 * │  SELECT interaction WHERE project_id = P            → ❌
 * │  SELECT company_project_status WHERE project_id = P → ❌
 * │  SELECT contact_project_status WHERE project_id = P → ❌
 * │  SELECT company_master                              → ✅ (shared pool)
 * │  SELECT contact_master                              → ✅ (shared pool)
 * └───────────────────────────────────────────────────────────────────────────
 *
 * ┌─ ADMIN (role_id = 1) ──────────────────────────────────────────────────────
 * │  SELECT lead_master, lead_report (any project)      → ✅
 * │  SELECT interaction, company_project_status (any)   → ✅
 * └───────────────────────────────────────────────────────────────────────────
 *
 * ┌─ QC (role_id = 6) ─────────────────────────────────────────────────────────
 * │  SELECT lead_master, lead_report (any project)      → ✅
 * └───────────────────────────────────────────────────────────────────────────
 *
 * ┌─ in_app_notification ──────────────────────────────────────────────────────
 * │  SELECT WHERE user_id = self                        → ✅
 * │  SELECT WHERE user_id = another user                → ❌
 * └───────────────────────────────────────────────────────────────────────────
 *
 * ┌─ REGRESSION: write policies must be unaffected ────────────────────────────
 * │  Agent UPDATE lead_report (their assigned lead)     → ✅ (unchanged)
 * │  TL UPDATE lead_master (their project)              → ✅ (unchanged)
 * │  Portal session SELECT base public tables           → ❌ (deny_portal_session unchanged)
 * └───────────────────────────────────────────────────────────────────────────
 *
 * ── HOW TO APPLY ─────────────────────────────────────────────────────────────
 *
 * a) Paste UP_SQL into the Supabase SQL editor (recommended).
 * b) OR uncomment the self-execute block at the bottom and run with PG conn from .env.
 *
 * Always run DOWN_SQL first on a throwaway to confirm clean drop, then run UP_SQL.
 * Never apply to prod without the VALIDATION PLAN checks above.
 */

// ── UP — policies to CREATE ─────────────────────────────────────────────────

const UP_SQL = /* sql */`
-- ============================================================
-- Project-membership-gated READ isolation (2026-06-29)
-- ADDITIVE for new policies; DROP IF EXISTS before CREATE.
-- Does NOT touch write policies (those live in apply-access-control-rls.cjs
-- and apply-assignment-rls.cjs).
-- Run in a transaction; roll back if any statement fails.
-- ============================================================

BEGIN;

-- ============================================================
-- GROUP A: Tables with a DIRECT project_id column
-- ============================================================

-- ── A1. lead_master ──────────────────────────────────────────────────────────
-- Replaces: "lead_master_select" (USING true on is_admin/is_qc/created_by/
--   manages_project/view_scope_of). See FLAG-1 in file header before applying.
DROP POLICY IF EXISTS "lead_master_select" ON public.lead_master;

-- NOTE (coordination + DEPENDENCY): apply-assignment-ownership-rls-fix.cjs (the
-- launch-critical fix) must be applied BEFORE this migration — it defines the
-- public.is_lead_assignee(bigint) helper referenced below and fixes the
-- interaction INSERT path (which this migration does NOT touch). We include the
-- assignee branch here too so the agent read path survives regardless of apply
-- order (covers an assignee who is not a project member). is_member already
-- covers the common case; this is defensive.
CREATE POLICY "lead_master_select_project_member"
  ON public.lead_master
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR public.is_member(project_id)
    OR public.is_lead_assignee(lead_id)
  );

-- ── A2. interaction ──────────────────────────────────────────────────────────
-- Replaces: "interaction_select" (USING true).
-- interaction.project_id is nullable; NULL rows fall through to no-match (safe).
DROP POLICY IF EXISTS "interaction_select" ON public.interaction;

CREATE POLICY "interaction_select_project_member"
  ON public.interaction
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR (project_id IS NOT NULL AND public.is_member(project_id))
  );

-- ── A3. company_project_status ───────────────────────────────────────────────
-- Replaces: "company_project_status_select" (USING true).
DROP POLICY IF EXISTS "company_project_status_select" ON public.company_project_status;

CREATE POLICY "company_project_status_select_member"
  ON public.company_project_status
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR public.is_member(project_id)
  );

-- ── A4. contact_project_status ───────────────────────────────────────────────
-- Replaces: "contact_project_status_select" (USING true).
DROP POLICY IF EXISTS "contact_project_status_select" ON public.contact_project_status;

CREATE POLICY "contact_project_status_select_member"
  ON public.contact_project_status
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR public.is_member(project_id)
  );


-- ============================================================
-- GROUP B: Tables that reach project_id via lead_id → lead_master
-- ============================================================

-- ── B1. lead_report ──────────────────────────────────────────────────────────
-- Current policy: "authenticated_full_access" (FOR ALL USING true).
-- The write parts of this policy (INSERT/UPDATE/DELETE) are managed by
-- apply-access-control-rls.cjs. Here we only replace the SELECT access.
-- Strategy: DROP the blanket FOR ALL policy, then recreate as split policies
--   with a membership-gated SELECT + open INSERT/UPDATE/DELETE placeholders
--   that mirror what apply-access-control-rls.cjs will install.
-- NOTE: If apply-access-control-rls.cjs has ALREADY been applied, its
--   "lead_report_select_all_authenticated" policy will exist instead of
--   "authenticated_full_access". Both are handled by the DROPs below.

DROP POLICY IF EXISTS "authenticated_full_access" ON public.lead_report;
DROP POLICY IF EXISTS "lead_report_select_all_authenticated" ON public.lead_report;

CREATE POLICY "lead_report_select_project_member"
  ON public.lead_report
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.lead_master lm
      WHERE lm.lead_id = lead_report.lead_id
        AND public.is_member(lm.project_id)
    )
  );

-- ── B2. lead_status_history ───────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.lead_status_history;

CREATE POLICY "lead_status_history_select_member"
  ON public.lead_status_history
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.lead_master lm
      WHERE lm.lead_id = lead_status_history.lead_id
        AND public.is_member(lm.project_id)
    )
  );

-- ── B3. lead_activity ────────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.lead_activity;

CREATE POLICY "lead_activity_select_member"
  ON public.lead_activity
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.lead_master lm
      WHERE lm.lead_id = lead_activity.lead_id
        AND public.is_member(lm.project_id)
    )
  );

-- ── B4. lead_designation ─────────────────────────────────────────────────────
-- IMPORTANT: lead_designation has NO lead_id, project_id, or FK to any project
-- chain (confirmed introspection 2026-06-29). Leaving SELECT open to authenticated.
-- See FLAG-2 in file header. Admin/owner to confirm what this table stores.
-- (No DROP; the existing authenticated_full_access remains for ALL commands
--  and implicitly covers SELECT — no change needed here unless schema is updated.)


-- ============================================================
-- GROUP C: Tables that reach project_id via meeting_id
--          (meeting_schedule → lead_report → lead_master)
-- ============================================================

-- Helper subquery used in all Group C policies:
--   SELECT lm.project_id
--   FROM meeting_schedule ms
--   JOIN lead_report lr ON lr.report_id = ms.report_id
--   JOIN lead_master lm ON lm.lead_id   = lr.lead_id
--   WHERE ms.meeting_id = <table>.meeting_id
--   LIMIT 1

-- ── C1. meeting_master ────────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
-- meeting_master has NO project_id; reaches project via meeting_schedule.
DROP POLICY IF EXISTS "authenticated_full_access" ON public.meeting_master;

CREATE POLICY "meeting_master_select_project_member"
  ON public.meeting_master
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.meeting_schedule ms
      JOIN public.lead_report lr ON lr.report_id = ms.report_id
      JOIN public.lead_master  lm ON lm.lead_id   = lr.lead_id
      WHERE ms.meeting_id = meeting_master.meeting_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );

-- ── C2. meeting_schedule ──────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
-- meeting_schedule.report_id → lead_report.lead_id → lead_master.project_id
DROP POLICY IF EXISTS "authenticated_full_access" ON public.meeting_schedule;

CREATE POLICY "meeting_schedule_select_project_member"
  ON public.meeting_schedule
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.lead_report lr
      JOIN public.lead_master lm ON lm.lead_id = lr.lead_id
      WHERE lr.report_id = meeting_schedule.report_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );

-- ── C3. meeting_question ──────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.meeting_question;

CREATE POLICY "meeting_question_select_project_member"
  ON public.meeting_question
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.meeting_schedule ms
      JOIN public.lead_report lr ON lr.report_id = ms.report_id
      JOIN public.lead_master  lm ON lm.lead_id   = lr.lead_id
      WHERE ms.meeting_id = meeting_question.meeting_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );

-- ── C4. meeting_participant ───────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.meeting_participant;

CREATE POLICY "meeting_participant_select_project_member"
  ON public.meeting_participant
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.meeting_schedule ms
      JOIN public.lead_report lr ON lr.report_id = ms.report_id
      JOIN public.lead_master  lm ON lm.lead_id   = lr.lead_id
      WHERE ms.meeting_id = meeting_participant.meeting_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );

-- ── C5. meeting_reschedule ────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.meeting_reschedule;

CREATE POLICY "meeting_reschedule_select_project_member"
  ON public.meeting_reschedule
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.meeting_schedule ms
      JOIN public.lead_report lr ON lr.report_id = ms.report_id
      JOIN public.lead_master  lm ON lm.lead_id   = lr.lead_id
      WHERE ms.meeting_id = meeting_reschedule.meeting_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );

-- ── C6. feedback_answer ───────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.feedback_answer;

CREATE POLICY "feedback_answer_select_project_member"
  ON public.feedback_answer
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.meeting_schedule ms
      JOIN public.lead_report lr ON lr.report_id = ms.report_id
      JOIN public.lead_master  lm ON lm.lead_id   = lr.lead_id
      WHERE ms.meeting_id = feedback_answer.meeting_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );


-- ============================================================
-- GROUP D: Tables that reach project_id via report_id → lead_report → lead_master
-- ============================================================

-- ── D1. pre_sales_answer ─────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.pre_sales_answer;

CREATE POLICY "pre_sales_answer_select_project_member"
  ON public.pre_sales_answer
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.lead_report lr
      JOIN public.lead_master lm ON lm.lead_id = lr.lead_id
      WHERE lr.report_id = pre_sales_answer.report_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );

-- ── D2. new_sales_question ────────────────────────────────────────────────────
-- Current: "authenticated_full_access" (USING true).
DROP POLICY IF EXISTS "authenticated_full_access" ON public.new_sales_question;

CREATE POLICY "new_sales_question_select_project_member"
  ON public.new_sales_question
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR EXISTS (
      SELECT 1
      FROM public.lead_report lr
      JOIN public.lead_master lm ON lm.lead_id = lr.lead_id
      WHERE lr.report_id = new_sales_question.report_id
        AND public.is_member(lm.project_id)
      LIMIT 1
    )
  );


-- ============================================================
-- GROUP E: User-recipient scoped (in_app_notification)
-- ============================================================

-- ── E1. in_app_notification ──────────────────────────────────────────────────
-- Current: "authenticated_full_access" (FOR ALL USING true).
-- No project_id on this table. Scope SELECT to recipient (user_id) + admin.
-- See FLAG-4 in file header.
-- Only replacing the SELECT arm; write policies stay on the blanket FOR ALL.
DROP POLICY IF EXISTS "authenticated_full_access" ON public.in_app_notification;

-- Recreate write access as a blanket (preserves current behaviour for non-SELECT).
-- SELECT is gated to self + admin.
CREATE POLICY "in_app_notification_write_authenticated"
  ON public.in_app_notification
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "in_app_notification_select_self"
  ON public.in_app_notification
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR user_id = public.current_user_id()
  );


-- ============================================================
-- SHARED POOL: company_master + contact_master — intentionally NOT gated.
-- These are globally shared entity tables; the per-project data is in
-- company_project_status / contact_project_status (covered by Group A above).
-- The SELECT policies on these two tables stay open (USING true) — no change.
-- ============================================================

-- company_master_select  → USING true  — NO CHANGE (globally shared pool)
-- contact_master_select  → USING true  — NO CHANGE (globally shared pool)


COMMIT;
`;

// ── DOWN — reversal (restore prior open policies) ────────────────────────────

const DOWN_SQL = /* sql */`
-- Reversal: drop the project-read-isolation policies and restore prior open state.
-- Run this if throwaway-login validation fails before applying to prod.

BEGIN;

-- Group A reversals
DROP POLICY IF EXISTS "lead_master_select_project_member"        ON public.lead_master;
DROP POLICY IF EXISTS "interaction_select_project_member"         ON public.interaction;
DROP POLICY IF EXISTS "company_project_status_select_member"      ON public.company_project_status;
DROP POLICY IF EXISTS "contact_project_status_select_member"      ON public.contact_project_status;

-- Restore original lead_master_select (pre-read-isolation form)
CREATE POLICY "lead_master_select"
  ON public.lead_master
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_qc()
    OR (created_by)::text = (public.current_user_id())::text
    OR public.manages_project(project_id)
    OR (public.view_scope_of('lead'::text, project_id) = 'everyone'::text AND public.is_member(project_id))
  );

CREATE POLICY "interaction_select"
  ON public.interaction
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "company_project_status_select"
  ON public.company_project_status
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contact_project_status_select"
  ON public.contact_project_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Group B reversals (restore blanket FOR ALL)
DROP POLICY IF EXISTS "lead_report_select_project_member"         ON public.lead_report;
DROP POLICY IF EXISTS "lead_status_history_select_member"         ON public.lead_status_history;
DROP POLICY IF EXISTS "lead_activity_select_member"               ON public.lead_activity;

-- NOTE: lead_report blanket was "authenticated_full_access" (FOR ALL USING true).
-- If apply-access-control-rls.cjs was applied first, its split policies (insert/update/delete)
-- must be present; we restore only the SELECT arm here.
CREATE POLICY "lead_report_select_all_authenticated"
  ON public.lead_report
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_full_access"
  ON public.lead_status_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_access"
  ON public.lead_activity
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Group C reversals
DROP POLICY IF EXISTS "meeting_master_select_project_member"      ON public.meeting_master;
DROP POLICY IF EXISTS "meeting_schedule_select_project_member"    ON public.meeting_schedule;
DROP POLICY IF EXISTS "meeting_question_select_project_member"    ON public.meeting_question;
DROP POLICY IF EXISTS "meeting_participant_select_project_member" ON public.meeting_participant;
DROP POLICY IF EXISTS "meeting_reschedule_select_project_member"  ON public.meeting_reschedule;
DROP POLICY IF EXISTS "feedback_answer_select_project_member"     ON public.feedback_answer;

CREATE POLICY "authenticated_full_access" ON public.meeting_master    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.meeting_schedule   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.meeting_question   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.meeting_participant FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.meeting_reschedule  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.feedback_answer     FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Group D reversals
DROP POLICY IF EXISTS "pre_sales_answer_select_project_member"    ON public.pre_sales_answer;
DROP POLICY IF EXISTS "new_sales_question_select_project_member"  ON public.new_sales_question;

CREATE POLICY "authenticated_full_access" ON public.pre_sales_answer    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON public.new_sales_question   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Group E reversals
DROP POLICY IF EXISTS "in_app_notification_select_self"           ON public.in_app_notification;
DROP POLICY IF EXISTS "in_app_notification_write_authenticated"   ON public.in_app_notification;

CREATE POLICY "authenticated_full_access"
  ON public.in_app_notification
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
`;

// ── Exports (valid CJS module so `node -c` passes) ───────────────────────────

module.exports = { UP_SQL, DOWN_SQL };

/*
 * To apply:
 *   1. Paste UP_SQL into the Supabase SQL editor (Dashboard → SQL Editor).
 *   2. Run on staging / throwaway DB first.
 *   3. Execute the VALIDATION PLAN checks at the top of this file.
 *   4. Get Ankit's go-ahead (CLAUDE.md §2), then run on prod.
 *
 * NEVER run this file directly against prod without the validation steps above.
 * This file is intentionally NOT self-executing.
 *
 * ORDER OF APPLICATION (when ready to apply all staged migrations):
 *   1. apply-access-control-rls.cjs        (role-scoped write policies)
 *   2. apply-assignment-rls.cjs            (assignment write model)
 *   3. apply-portal-rls.cjs                (portal isolation + deny_portal_session)
 *   4. apply-project-read-isolation-rls.cjs (THIS FILE — project-gated SELECTs)
 *
 * Step 3 must precede step 4 because deny_portal_session is a RESTRICTIVE policy
 * that ANDs with these new SELECT policies. Without it, portal sessions could still
 * satisfy the is_member() check if a portal user is also in project_user.
 */
