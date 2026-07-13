# Launch-Blocker RLS Plan — Canonical Assignment Ownership

**Author:** senior DB engineer (drafting/analysis only — nothing applied).
**Date:** 2026-06-25.
**Scope:** Fixes SCHEMA-AUDIT **N1** (split ownership / wrong RLS key — THE launch blocker) and **N5** (no FORCE RLS + broad anon grants). Reviewed against the real artifacts:
`new-code/migration/apply-assignment-rls.cjs`, `docs/SCHEMA-AUDIT.md`, and the data layer (`new-code/web/src/data/{assignment,projectStatus,realLeads,callLogs,calls,leadWorkspace,approvals,contacts}.ts`).

> **Owner action:** this is a review document. Nothing here is applied. Each step is staged as an additive, reversible migration and **must** be validated on throwaway non-admin logins (ALT-153/229 gate) before any prod apply (CLAUDE.md §2). I do NOT recommend running `apply-assignment-rls.cjs` as-is — see §1.

---

## 0. The problem in one paragraph (verified live)

Ownership is split **three ways** and RLS historically keyed on the wrong one:
- `*_master.created_by varchar` = the **bulk-import actor** (live: `"7"`×130, `"60"`×99, `"59"`×86, `"1"`×49…), NOT the assigned caller. Confirmed in code: `realLeads.ts:292` reads `created_by` as the "Owner"; `leadWorkspace.ts:9` documents "Lead ownership = lead_master.created_by".
- The **real assignment** lives in `lead_report.user_id`. `realLeads.ts:305-308` reads "Assigned salesperson" from the *latest* report's `user_id`. The audit's "597/598 leads have exactly one report → backfill is 1:1" holds.
- A **dead** `lead_master.agent_id` (132/607, no FK, unused by RLS — `realLeads.ts:9-10` confirms it's NULL for 476 leads and was abandoned), plus per-project `company_project_status.owner_user_id` / `contact_project_status.owner_user_id` (25/28, 19/26 — `projectStatus.ts` and `assignment.ts:312+` use these for company/contact reassignment).

Because every base-record UPDATE policy keys on `created_by`, an assigned agent is told **"you can only edit records you own"** for the ~600 migrated leads. That string is literally hard-coded in `projectStatus.ts:119,233,308` and `assignment.ts:34`.

---

## 1. Assessment of the existing `apply-assignment-rls.cjs`

**What it actually does** (verified line-by-line):

1. **`assigned_to(rtype, rid)`** SECURITY DEFINER helper (lines 75-102): resolves the assigned user three different ways by type — `lead` → latest `lead_report.user_id` **ordered by `report_id DESC`**; `company`/`contact` → `*_project_status.owner_user_id` **ordered by `project_id`** (first non-null).
2. **`meeting_lead_id(meeting_id)`** (lines 107-120): meeting → lead via `meeting_schedule.report_id → lead_report.lead_id`. **Defined but never referenced** in any policy in this file.
3. **`lead_master_update`** (lines 126-142): keeps every existing term — including `created_by = current_user_id()` — and **adds** an OR-term `assigned_to('lead', lead_id) = current_user_id()`.
4. **`lead_report_reassign_guard`** (lines 152-165): a RESTRICTIVE UPDATE policy so only the assignee (self), the project manager, or admin can UPDATE a report row (the `user_id` rewrite that *is* a reassignment). ANDs with the existing blanket `authenticated_full_access`, so SELECT/INSERT/DELETE are untouched.
5. **`company_project_status_update` / `contact_project_status_update`** (lines 171-201): keep `record_owner_id(...) = current_user_id()` (the **created_by**-based term) and **add** `owner_user_id = current_user_id()`.

**Where it falls short (the specific gaps):**

- **G1 — Layers instead of replaces `created_by`.** The `lead_master` and `*_project_status` policies still carry the legacy `created_by`/`record_owner_id()` term (lines 131, 176, 182, 198). Per the audit's own diagnosis (N1 "Fix"), `created_by` is the *importer*, so leaving it in the policy means the bulk-import actors (users `"7"`, `"60"`, `"59"`, `"1"`) retain edit rights on **hundreds of records they never owned** — e.g. whoever is user 7 can edit 130 leads. That is an over-grant, not just cosmetic. The canonical model must **drop** `created_by` from the *write* predicate (keep it as an audit column only).

- **G2 — Three-way assignee resolution, with an ordering inconsistency.** `assigned_to()` resolves leads by `report_id DESC` but the app (`realLeads.ts`) resolves the displayed assignee by **`updated_date`** (latest report). For the 597/598 single-report leads these agree; for any multi-report lead the **policy and the UI can name a different assignee**, so an agent who *appears* assigned in the UI could be denied by RLS (or vice-versa). Worse: `assignment.ts:160-164` `reassignLead` rewrites `user_id` on **ALL** active report rows for a lead — so a lead never legitimately has two different assignees, but a partial-failure or legacy data could. A single canonical column removes the ambiguity entirely.

- **G3 — Does not touch SELECT/visibility.** It only rewrites UPDATE policies. The "my leads" lists, dashboards, and PII reads still run under the legacy blanket `authenticated_full_access` SELECT policy, so this migration does **not** scope who can *see* a record — only who can edit. That may be acceptable for v1 (read-all internally) but must be a **conscious owner decision**, not an accident (see Open Q-3).

- **G4 — Meeting edits not covered.** `meeting_lead_id()` is defined but unused; no policy on `meeting_master` / `feedback_answer` consults assignment. `REBUILD_LOG.md:540` confirms `meeting_master`/`feedback_answer` are "still blanket". So meeting feedback/reschedule writes are currently *open to all authenticated* — the assignment model stops at the lead.

- **G5 — No FORCE RLS, no anon REVOKE (N5).** This file's header (lines 39-43) explicitly says it "does NOT touch FORCE (all tables stay ENABLE)". Combined with `relforcerowsecurity = false` on every hot table and Supabase's broad `anon`/`authenticated` grants, the table **owner** and any forgotten grant bypass RLS on PII. The assignment fix is incomplete for launch without N5.

- **G6 — `manages_project()` ≠ a person hierarchy.** The policy's manager branch uses `manages_project(project_id)` (project membership), and the sibling `manages_user()` helper (apply-task-rls.cjs:60-70) **fails closed (`AND false`)** — there is no `manager_id`/`sales_head_user_id` source in the public schema yet. So "team_lead sees downline" is **not** actually implemented for the CRM tables; with one project today, `manages_project` grants every project member manager rights, which over-broadly lets any project member edit any lead in that project once the `everyone`/`team` edit-scope dials are set. The downline model is an unresolved dependency (ALT-167), see Open Q-1.

**Verdict:** `apply-assignment-rls.cjs` is the right *shape* and a safe *additive* step, but it is a **bridge**, not the destination. Ship the canonical column model below instead (or land the column first, then point a simplified version of this file's policies at it).

---

## 2. Recommended canonical model

### 2.1 One source of truth: `assignee_user_id`

Add a single canonical column per assignable base record, backfilled from the real assignment, read by **both** RLS and the app. Prefer a column over a thin `assignment` table for v1 (simpler RLS, one project, 1:1 backfill); the `assignment` table is the future path if multi-assignee/role-tagged assignment is needed (Open Q-4).

```sql
-- Additive columns (nullable, reversible). NOT a type change.
ALTER TABLE public.lead_master    ADD COLUMN IF NOT EXISTS assignee_user_id bigint;
ALTER TABLE public.company_master ADD COLUMN IF NOT EXISTS assignee_user_id bigint;  -- optional; companies are project-scoped (see note)
ALTER TABLE public.contact_master ADD COLUMN IF NOT EXISTS assignee_user_id bigint;  -- optional

-- FK is added AFTER backfill validates clean (see §4 sequencing), nullable.
-- ALTER TABLE public.lead_master ADD CONSTRAINT lead_master_assignee_fk
--   FOREIGN KEY (assignee_user_id) REFERENCES public.user_master(user_id);
```

> **Company/contact note:** their assignment is genuinely **per-project** (`*_project_status.owner_user_id`), not per-base-record — a company can have different owners in different projects. With one project today a base-record column is fine, but the *correct* long-term key for company/contact is the per-project `owner_user_id` (keep using it). For v1 I recommend: **leads → canonical base column `assignee_user_id`; companies/contacts → keep `*_project_status.owner_user_id` as their canonical per-project assignment** (do NOT add a base column you'll have to deprecate). This avoids a 4th ownership channel.

### 2.2 Backfill (deterministic, 1:1)

```sql
-- Leads: latest non-deleted report's user_id. Tie-break MUST match the app.
-- App reads the assignee by latest updated_date (realLeads.ts). Use the SAME
-- ordering here so RLS and UI never disagree (fixes G2). report_id DESC is the
-- secondary tiebreak for equal/NULL updated_date.
UPDATE public.lead_master lm
SET assignee_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (lr.lead_id) lr.lead_id, lr.user_id
  FROM public.lead_report lr
  WHERE lr.deleted_date IS NULL AND lr.user_id IS NOT NULL
  ORDER BY lr.lead_id, lr.updated_date DESC NULLS LAST, lr.report_id DESC
) sub
WHERE lm.lead_id = sub.lead_id;

-- VALIDATION QUERY (run before adding FK / policies — must return 0 surprises):
-- (a) leads with a report assignee but a NULL canonical column:
SELECT count(*) FROM public.lead_master lm
WHERE lm.assignee_user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.lead_report lr
              WHERE lr.lead_id = lm.lead_id AND lr.deleted_date IS NULL AND lr.user_id IS NOT NULL);
-- (b) canonical column pointing at a non-existent user (FK would reject):
SELECT count(*) FROM public.lead_master lm
WHERE lm.assignee_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.user_master u WHERE u.user_id = lm.assignee_user_id);
-- (c) multi-report leads where report_id-order vs updated_date-order disagree
--     (the leads where the staged migration would have keyed RLS on the wrong user):
SELECT count(*) FROM (
  SELECT lead_id,
    (array_agg(user_id ORDER BY updated_date DESC NULLS LAST, report_id DESC))[1] AS by_date,
    (array_agg(user_id ORDER BY report_id DESC))[1] AS by_id
  FROM public.lead_report WHERE deleted_date IS NULL AND user_id IS NOT NULL
  GROUP BY lead_id
) t WHERE by_date IS DISTINCT FROM by_id;
```
Audit says 597/598 leads have exactly one report, so (c) should be ~0; any rows are the exact cases where the staged migration's `report_id DESC` would mis-key — surface them to the owner.

### 2.3 Canonical RLS policies (replace, don't layer)

Helper functions already in the DB (do **not** redefine): `is_admin()`, `current_user_id()` (returns the caller's bigint `user_id` from `profiles`), `manages_project(project_id)`, `is_member(project_id)`, `edit_scope_of(rtype, project_id)`, `record_owner_id(rtype,id)` (legacy created_by — to be retired from write predicates), `manages_user(uid)` (currently fails closed).

```sql
-- ── lead_master UPDATE: canonical, created_by REMOVED from the write predicate ──
DROP POLICY IF EXISTS lead_master_update ON public.lead_master;
CREATE POLICY lead_master_update ON public.lead_master
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()                                            -- ADMIN: all
    OR assignee_user_id = public.current_user_id()               -- AGENT/SP: own-assigned
    OR public.manages_project(project_id)                        -- TL/SH: managed project (downline proxy until Open Q-1 lands)
    OR (public.edit_scope_of('lead', project_id) = 'everyone'    -- explicit "team can edit all" dial
        AND public.is_member(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR assignee_user_id = public.current_user_id()
    OR public.manages_project(project_id)
    OR (public.edit_scope_of('lead', project_id) = 'everyone' AND public.is_member(project_id))
  );
-- NOTE: `created_by = current_user_id()` is intentionally GONE (fixes G1).
```

```sql
-- ── lead_report: RESTRICTIVE reassign guard (keep — this part of the staged file is correct) ──
-- The user_id rewrite IS a reassignment; only assignee self-edit or a manager/admin may do it.
DROP POLICY IF EXISTS lead_report_reassign_guard ON public.lead_report;
CREATE POLICY lead_report_reassign_guard ON public.lead_report
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR user_id = public.current_user_id()
    OR public.manages_project((SELECT project_id FROM public.lead_master WHERE lead_id = lead_report.lead_id))
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = public.current_user_id()
    OR public.manages_project((SELECT project_id FROM public.lead_master WHERE lead_id = lead_report.lead_id))
  );
-- TRIGGER REQUIRED: when lead_report.user_id is rewritten, lead_master.assignee_user_id
-- must follow (so the canonical column stays the source of truth). See §4 data-layer note —
-- either a BEFORE UPDATE trigger on lead_report, or the app writes both. Trigger is safer.
```

```sql
-- ── company_project_status / contact_project_status UPDATE: owner_user_id only (drop record_owner_id) ──
DROP POLICY IF EXISTS company_project_status_update ON public.company_project_status;
CREATE POLICY company_project_status_update ON public.company_project_status
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR owner_user_id = public.current_user_id()
    OR public.manages_project(project_id)
  )
  WITH CHECK (
    public.is_admin()
    OR owner_user_id = public.current_user_id()
    OR public.manages_project(project_id)
  );
-- contact_project_status: identical, swapping company_id→contact_id / table name.
-- created_by/record_owner_id('company',...) term REMOVED (fixes G1 for the side tables).
```

```sql
-- ── meeting_master / feedback_answer UPDATE: cover the gap (G4) ──
-- meeting → lead → assignee. Reuse meeting_lead_id() (already defined in the staged file).
DROP POLICY IF EXISTS meeting_master_update ON public.meeting_master;
CREATE POLICY meeting_master_update ON public.meeting_master
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (SELECT assignee_user_id FROM public.lead_master
        WHERE lead_id = public.meeting_lead_id(meeting_id)) = public.current_user_id()
    OR public.manages_project((SELECT project_id FROM public.lead_master
        WHERE lead_id = public.meeting_lead_id(meeting_id)))
  )
  WITH CHECK ( /* same */ );
-- feedback_answer is keyed by meeting_id → reuse the same predicate via meeting_master.
-- CONFIRM with owner whether meeting edits should be assignee-only or project-wide (Open Q-3).
```

### 2.4 FORCE RLS + anon REVOKE (N5)

```sql
-- Force RLS so the table OWNER is also subject to policy (defense-in-depth on PII).
-- EXCLUDE any table whose writes depend on a SECURITY DEFINER trigger that runs as the
-- table owner WITHOUT a matching INSERT/UPDATE policy — forcing those would break writes
-- (this is exactly why portal.meeting_snapshot is ENABLE-not-FORCE; see apply-portal-rls.cjs:197).
-- => Before forcing each table, confirm a permissive INSERT/UPDATE policy exists for its writers,
--    OR that its writer is service_role (which has BYPASSRLS and is unaffected by FORCE).
ALTER TABLE public.lead_master            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_report            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_master         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_master         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.company_project_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_project_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_master         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interaction            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activity          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task                   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_master            FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist               FORCE ROW LEVEL SECURITY;
-- CAUTION: the public meeting snapshot trigger write_meeting_snapshot() runs as table owner.
-- It writes portal.meeting_snapshot (FORCE-excluded), NOT public tables, so forcing public
-- meeting_master is safe for the snapshot — but RE-VERIFY against any other definer trigger first.

-- Revoke broad anon grants (Supabase ships GRANTs to anon/authenticated on every table).
-- Mirror the call_log REVOKE-from-anon discipline table-wide.
REVOKE ALL ON public.lead_master, public.lead_report, public.company_master,
  public.contact_master, public.company_project_status, public.contact_project_status,
  public.meeting_master, public.interaction, public.lead_activity, public.task,
  public.user_master, public.wishlist
  FROM anon;
-- authenticated keeps table-level grants (RLS does the row gating); anon gets nothing.
```

---

## 3. Throwaway-login validation harness (run BEFORE prod)

**How to run non-destructively.** Two options, in order of preference:

- **A — Supabase branch / throwaway project (preferred for FORCE + grant changes):** apply the full migration to a fork, run the matrix below by signing in as each throwaway user through the real auth path (so `auth.uid()` / `current_user_id()` resolve exactly as prod). This is the only way that genuinely exercises FORCE + anon REVOKE end-to-end.
- **B — In-prod read-only transaction probe (for policy logic only, no schema change):** wrap policy `USING`/`WITH CHECK` expression checks in `BEGIN; … ROLLBACK;` using `set local role authenticated; set local request.jwt.claims = '{"sub":"<auth_uid>"}';` then attempt the SELECT/UPDATE and **ROLLBACK**. Never COMMIT. This does not test FORCE/grants (those need a fresh connection as the owner/anon role), so it is a *supplement* to A, not a replacement.

**Throwaway users to provision (one per role, on the throwaway project):** `t_admin` (role 1), `t_tl` (role 2, made a `project_user` of project P), `t_agent_assigned` (role 3; set as `assignee_user_id` on a chosen lead L1), `t_agent_other` (role 3; assigned to a different lead L2, NOT L1), `t_sh` (role 4), `t_sp` (role 5), `t_qc` (role 6).

**Test matrix** (record = lead L1 unless noted; expected = pass ✓ / deny ✗):

| # | Logged-in role | Action | Target | Expect | Proves |
|---|---|---|---|---|---|
| 1 | t_agent_assigned | UPDATE lead | L1 (assigned to them) | ✓ | THE blocker fixed — assigned agent can edit a migrated lead |
| 2 | t_agent_other | UPDATE lead | L1 (not theirs) | ✗ (42501 / 0 rows) | non-assignee denied |
| 3 | t_agent_other | SELECT lead | L1 | ✓ or ✗ | confirms read posture decision (Open Q-3) |
| 4 | (bulk-import actor, e.g. user 7) | UPDATE lead | a lead where created_by='7' but assignee≠7 | ✗ | **G1 fixed** — importer no longer has edit rights |
| 5 | t_agent_assigned | UPDATE lead_report.user_id → t_agent_other (reassign) | L1's report | ✗ | agent cannot reassign away |
| 6 | t_tl (manages P) | UPDATE lead_report.user_id → t_agent_other | L1's report | ✓ | manager can reassign within project |
| 7 | t_tl | UPDATE lead | L1 | ✓ | manager edit within managed project |
| 8 | t_sp | UPDATE company_project_status (owner=them) | C1 | ✓ | per-project owner can edit own status |
| 9 | t_sp | UPDATE company_project_status (owner≠them) | C2 | ✗ | non-owner denied |
| 10 | t_admin | UPDATE any lead / report / status | any | ✓ | admin unrestricted |
| 11 | t_agent_assigned | UPDATE meeting_master | meeting of L1 | ✓ | meeting gap (G4) closed for assignee |
| 12 | t_agent_other | UPDATE meeting_master | meeting of L1 | ✗ | non-assignee meeting denied |
| 13 | anon (no JWT) | SELECT lead_master | any | ✗ (no rows / permission denied) | **N5** anon REVOKE works |
| 14 | table owner role (direct) | SELECT lead_master ignoring policy | any | ✗ | **N5** FORCE actually forces the owner |
| 15 | service_role | INSERT portal.meeting_snapshot via meeting create | new meeting | ✓ | FORCE did NOT break the definer-trigger write path |
| 16 | t_agent_assigned | reassignLead() full app flow (writes all report rows) | L1 | ✓ + `assignee_user_id` follows | trigger keeps canonical column in sync |

**Regression checks (must still pass):** report-submit / stage-change for the assignee; the meeting snapshot trigger still writes `portal.meeting_snapshot`; "my leads" lists populate; notify-service service-role endpoints (login/reset/provision) unaffected (service_role has BYPASSRLS).

---

## 4. Rollback + sequencing (additive-first, each step reversible)

Land in this order; each step is independently reversible and validated before the next:

1. **S1 — Additive columns only.** `ADD COLUMN assignee_user_id` (nullable, no FK, no policy change). Zero behavioural impact. *Rollback:* `DROP COLUMN`.
2. **S2 — Backfill + validation queries (§2.2).** Data-only `UPDATE`. Run validation (a)(b)(c); surface (c) rows to owner. *Rollback:* `UPDATE … SET assignee_user_id = NULL`.
3. **S3 — Sync trigger.** `BEFORE UPDATE` trigger on `lead_report`: when `user_id` changes, set `lead_master.assignee_user_id` for that lead. Keeps canonical column live without changing the app yet. *Rollback:* `DROP TRIGGER`.
4. **S4 — FK (optional, after (b) returns 0).** Add nullable FK `assignee_user_id → user_master`. *Rollback:* `DROP CONSTRAINT`.
5. **S5 — Policy swap (the canonical policies, §2.3).** This is the only behaviour-changing step for writes; validate the FULL matrix (§3) on a throwaway project first. Keep `apply-assignment-rls.cjs --rollback`-style `ROLLBACK_SQL` to restore the prior policy bodies. *Rollback:* re-create prior `*_update` policies (the staged file already carries these in its `ROLLBACK_SQL`).
6. **S6 — Meeting policies (G4).** Add `meeting_master`/`feedback_answer` UPDATE policies. *Rollback:* `DROP POLICY` (reverts to blanket).
7. **S7 — FORCE RLS + anon REVOKE (N5).** Last, because it's the highest blast-radius. Validate tests 13-15 + all regressions. *Rollback:* `NO FORCE ROW LEVEL SECURITY` + `GRANT` restore.

**Data-layer coordination (which `data/*.ts` must change — do at S5):**
- `realLeads.ts` — read the assignee from `lead_master.assignee_user_id` (canonical) instead of re-deriving "latest report by updated_date" (lines 305-308). Keep `created_by` display as "internal owner" if still wanted, but it is no longer ownership.
- `leadWorkspace.ts:9` — fix the doc/derivation: "Lead ownership = created_by" is now **wrong**; ownership = `assignee_user_id`.
- `assignment.ts` `reassignLead` (lines 152-167) — still writes `lead_report.user_id`; the S3 trigger propagates to `assignee_user_id`. Alternatively have the app write both in one round-trip; trigger is preferred (single source of truth, no app race).
- `projectStatus.ts` / `assignment.ts` company-contact paths — already use `owner_user_id`; no change, but the hard-coded "you can only edit records you own" message (`projectStatus.ts:119,233,308`) is now accurate.
- The bulk-import / create paths that stamp `created_by` are unaffected (audit-only).

**Do BEFORE this work:** decide downline/manager model (Open Q-1) if team-scope edit is in launch scope. **Do AFTER:** the SELECT-scoping pass (Open Q-3) and the rest of the audit's NOW items can follow independently.

---

## 5. Open questions for the owner

1. **Downline / manager hierarchy (BLOCKS team_lead scoping).** There is no `manager_id`/`sales_head_user_id` in the public schema; `manages_user()` fails closed and `manages_project()` grants rights to *every* member of a project. For internal launch, is **"admin + assignee-only (no team-lead downline yet)"** acceptable, deferring the real hierarchy to ALT-167? Or must TL/SH see/edit their reps' leads at launch (then we need the `manager_id` migration first)?
2. **Sales-role scoping (roles 4/5).** Sales Head / Sales Person are `is_web=false` and live primarily in the **portal** (which already has `portal.downline_user_ids` locked to role-5 reps). Should the CRM-side policies treat roles 4/5 at all, or are they out of scope for the internal CRM launch and handled entirely portal-side?
3. **Read posture.** §2 fixes *write* (edit) scoping. Should SELECT stay **read-all internally** for launch (current blanket SELECT), or must reads also be scoped to assignee + managers? This changes whether tests #3/#12 expect ✓ or ✗ and whether the masking model (`access-masking-v1b`) is the read gate.
4. **Column vs `assignment` table.** I recommend a canonical `assignee_user_id` **column** on `lead_master` for v1 (1:1, one project). Do you foresee **multi-assignee** or **role-tagged** assignment (e.g. agent + SH on one lead) soon enough to justify the thin `assignment(record_type, record_id, user_id, role, assigned_at, assigned_by)` table now instead?
5. **Company/contact base column?** I recommend NOT adding `assignee_user_id` to `company_master`/`contact_master` (their assignment is genuinely per-project via `owner_user_id`). Confirm you don't want a base-record owner for companies/contacts that would override per-project ownership.
6. **`agent_id` retirement.** OK to formally deprecate the dead `lead_master.agent_id` (132 rows, no FK, unused) as part of this — leave the column, stop reading it, document it dead?

---

## Appendix — verified code vs audit

- Audit N1 claim "staged migration layers assignment on top of created_by" — **CONFIRMED** (`apply-assignment-rls.cjs:131,176,182,198` keep the `created_by`/`record_owner_id` term).
- Audit N1 "resolves assignee three different ways" — **CONFIRMED** (`assigned_to()` lines 82-101: lead by report_id DESC, company/contact by project_id).
- **NEW finding (not in audit):** `assigned_to('lead')` orders by `report_id DESC` while the app (`realLeads.ts:305-308`) derives the assignee by **`updated_date`** — a latent RLS/UI disagreement on multi-report leads (G2). Backfill §2.2 uses the app's ordering to eliminate it.
- **NEW finding:** `meeting_lead_id()` is defined but **unused** in the staged file — meeting edits remain blanket-open (G4); `REBUILD_LOG.md:540` independently confirms `meeting_master`/`feedback_answer` are "still blanket".
- Audit N5 "no FORCE, broad anon grants" — **CONFIRMED**; staged file header explicitly declines to touch FORCE (lines 39-43). `manages_user()` fail-closed confirmed at `apply-task-rls.cjs:60-70`.

---

# ⚠️ Security-QC adversarial review (2026-06-25) — MUST address before applying

Verdict: **SOUND** — the plan *would* fix the launch blocker — **but** an adversarial security review found silent-deny vectors that must be closed first. **Do NOT apply until these are resolved.** The recurring danger is the classic RLS regression: a policy that silently returns *false* (hides rows / blocks edits) for legitimate users.

### Regression risks (could silently lock people out)
1. **`profiles`-row coverage = the critical one.** `current_user_id()` resolves the caller's bigint from the **sparse `profiles` table**. If a bulk-provisioned login has **no `profiles` row**, `current_user_id()` → NULL → *every* new write predicate (`assignee_user_id = NULL`) is false → **total silent denial for that user**. The throwaway-login harness provisions through the real auth path (which creates a profile), so it would **NOT** catch the production case of provisioned-but-profileless users. → This binds the RLS fix to the **bulk-login provisioning** work: every provisioned user must get a `profiles` row, and we must assert coverage before forcing.
2. **Meeting/feedback silent-deny.** The new meeting policy (§2.3) denies the legitimate assignee whenever `meeting_lead_id()` returns NULL — i.e. any `meeting_master` row with no `meeting_schedule` bridge, or `feedback_answer` rows whose meeting lacks a schedule link. No coverage check exists before forcing assignee-only meeting edits.
3. **Orphan leads stranded admin-only.** Dropping the `created_by` term is correct, but leads where backfill leaves `assignee_user_id = NULL` (the 1/598 zero-report lead + any NULL `lead_report.user_id`) become **admin-only** for both `lead_master` and `lead_report` edits. The plan detects them (validation query a) but defines **no remediation**.
4. **FORCE without a SELECT-policy audit.** Forcing RLS on `user_master` / `lead_report` / `interaction` when a table has ENABLE-but-no-permissive-SELECT-policy returns **zero rows to all non-admins** (breaks user-label lookups etc.). Need a per-table policy pre-flight inventory before forcing.
5. **Reassign guard compounds the orphan problem** — the RESTRICTIVE `lead_report` update guard ANDs onto *all* report updates, so orphan/NULL-user_id leads can't be edited by anyone but admin.
6. **anon REVOKE** doesn't verify no current public/unauthenticated surface relied on the anon key (none evidenced, but unverified).

### Gaps to fill in the plan
- A coverage/backfill check that **every `meeting_master` row resolves to a lead** before forcing the meeting policy.
- A validation step asserting **all active/provisioned users have a `profiles` row** (non-NULL `current_user_id()`).
- A defined **remediation for NULL-assignee orphan leads**.
- A **per-table SELECT/INSERT/UPDATE policy inventory** before the FORCE step.
- Spell out the **`feedback_answer` → `meeting_master` → `meeting_lead_id()` join** (feedback_answer is keyed only by `meeting_id`).
- Harness **option B must verify `current_user_id()` actually resolves** the probe's auth uid to a bigint via `profiles`.
- Validate **company/contact rows with NULL `owner_user_id`** (per audit ~3/28, ~7/26 unfilled) behave correctly after dropping the legacy term.

### Owner questions (these need Ankit before applying)
1. **Do ALL provisioned/active users have a `profiles` row?** (If not, the model silently denies them — must be guaranteed first.)
2. Who should edit **NULL-assignee orphan leads** (currently → admin-only)?
3. Should meetings with **no schedule bridge** be backfilled, or should the meeting policy **fall back to project membership**?
4. Is **read-all-internally** the intended launch posture, or must SELECT also be scoped? (changes tests + masking gate)
5. Confirm the **FORCE list** (should `user_master`/`interaction` be forced at launch, and do they each have a permissive SELECT policy?).
6. Confirm acceptance of the core recommendation: **land the canonical `assignee_user_id` model (plan §2) INSTEAD of running `apply-assignment-rls.cjs` as-is** (the staged file over-grants the bulk-import actors via the retained `created_by` term).

> Status: **DRAFT + reviewed, NOT ready to apply.** Next non-prod step once the owner answers the above: revise §2–§3 to close gaps 1–7, then validate on throwaway logins (never prod) before any apply.
