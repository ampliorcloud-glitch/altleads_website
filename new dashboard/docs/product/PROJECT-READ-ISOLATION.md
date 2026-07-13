# Project-Membership-Gated READ Isolation (RLS)

**Status:** STAGED — not applied to prod  
**Migration file:** `new-code/migration/apply-project-read-isolation-rls.cjs`  
**Date authored:** 2026-06-29  
**Depends on:** `apply-access-control-rls.cjs`, `apply-portal-rls.cjs`

---

## 1. Why this exists

Today every authenticated user can SELECT rows from every project's data tables. RLS only scopes WRITE operations. The requirement: a user must not be able to read a client's records unless they are explicitly added to that project — enforced at the DB level, not just UI.

---

## 2. Auth identity chain

```
auth.uid()  (uuid, from JWT)
   ↓ profiles.id = auth.uid()
profiles.user_id  (bigint)          ← current_user_id()
   ↓ project_user.user_id
project_user rows for this user     ← is_member(project_id)
```

Both `current_user_id()` and `is_member(pid)` already exist as SECURITY DEFINER, STABLE helper functions (defined by the existing migration set). No new helper is required.

`project_user` schema (confirmed):

| column          | type   | notes                              |
|-----------------|--------|------------------------------------|
| project_user_id | bigint | PK                                 |
| project_id      | bigint | the project                        |
| user_id         | bigint | maps to profiles.user_id           |
| role_name       | varchar| role within this project           |
| deleted_date    | tstz   | soft-delete; NULL = active member  |

Membership = `project_user.user_id = current_user_id() AND deleted_date IS NULL`.

---

## 3. Table classification

### 3.1 Project-scoped tables (READ ISOLATION APPLIED)

#### Group A — Direct `project_id` column

| Table                   | Resolves project via      | Old policy (SELECT)             |
|-------------------------|---------------------------|---------------------------------|
| `lead_master`           | `project_id` (direct)     | `lead_master_select` (partial)  |
| `interaction`           | `project_id` (nullable)   | `interaction_select` (open)     |
| `company_project_status`| `project_id` (direct)     | `company_project_status_select` (open) |
| `contact_project_status`| `project_id` (direct)     | `contact_project_status_select` (open) |

New policy shape (Group A):
```sql
USING (
  is_admin()
  OR is_qc()
  OR is_member(project_id)
)
```

#### Group B — Reach project via `lead_id → lead_master.project_id`

| Table                | FK chain                            | Old policy |
|----------------------|-------------------------------------|------------|
| `lead_report`        | `lead_id → lead_master.project_id`  | open (FOR ALL USING true) |
| `lead_status_history`| `lead_id → lead_master.project_id`  | open |
| `lead_activity`      | `lead_id → lead_master.project_id`  | open |

New policy shape (Group B):
```sql
USING (
  is_admin()
  OR is_qc()
  OR EXISTS (
    SELECT 1 FROM lead_master lm
    WHERE lm.lead_id = <table>.lead_id
      AND is_member(lm.project_id)
  )
)
```

#### Group C — Reach project via `meeting_id → meeting_schedule → lead_report → lead_master`

`meeting_master` has NO `project_id` column. The chain is:

```
meeting_master.meeting_id
  → meeting_schedule.meeting_id
  → meeting_schedule.report_id
  → lead_report.lead_id
  → lead_master.project_id
```

| Table                | FK chain       |
|----------------------|----------------|
| `meeting_master`     | via meeting_schedule |
| `meeting_schedule`   | report_id → lead_report.lead_id → lead_master |
| `meeting_question`   | meeting_id → (same chain) |
| `meeting_participant`| meeting_id → (same chain) |
| `meeting_reschedule` | meeting_id → (same chain) |
| `feedback_answer`    | meeting_id → (same chain) |

New policy shape (Group C — full chain):
```sql
USING (
  is_admin()
  OR is_qc()
  OR EXISTS (
    SELECT 1
    FROM meeting_schedule ms
    JOIN lead_report lr ON lr.report_id = ms.report_id
    JOIN lead_master  lm ON lm.lead_id   = lr.lead_id
    WHERE ms.meeting_id = <table>.meeting_id
      AND is_member(lm.project_id)
    LIMIT 1
  )
)
```

For `meeting_schedule` itself, the shorter chain (via `report_id`) is used:
```sql
OR EXISTS (
  SELECT 1
  FROM lead_report lr
  JOIN lead_master lm ON lm.lead_id = lr.lead_id
  WHERE lr.report_id = meeting_schedule.report_id
    AND is_member(lm.project_id)
  LIMIT 1
)
```

#### Group D — Reach project via `report_id → lead_report → lead_master`

| Table               | FK chain                                       |
|---------------------|------------------------------------------------|
| `pre_sales_answer`  | `report_id → lead_report.lead_id → lead_master.project_id` |
| `new_sales_question`| same                                           |

New policy shape (Group D):
```sql
USING (
  is_admin()
  OR is_qc()
  OR EXISTS (
    SELECT 1
    FROM lead_report lr
    JOIN lead_master lm ON lm.lead_id = lr.lead_id
    WHERE lr.report_id = <table>.report_id
      AND is_member(lm.project_id)
    LIMIT 1
  )
)
```

#### Group E — User-recipient scoped (not project-scoped)

| Table                 | Scope                   | Old policy |
|-----------------------|-------------------------|------------|
| `in_app_notification` | `user_id` = recipient   | open (FOR ALL USING true) |

New SELECT policy:
```sql
USING (
  is_admin()
  OR user_id = current_user_id()
)
```

Write access (INSERT/UPDATE/DELETE) remains open to authenticated (preserved via a separate blanket FOR ALL policy covering non-SELECT commands).

---

### 3.2 Globally shared tables (READ ISOLATION INTENTIONALLY NOT APPLIED)

`company_master` and `contact_master` are the global entity pools. They have **no `project_id` column**. Every project references companies/contacts from the same shared pool; gating reads on project membership would break the entire data model (the same company can be a lead for multiple projects).

The project-private data is in the **per-project status tables** (`company_project_status`, `contact_project_status`), which ARE gated by this migration.

Leak-risk audit on `company_master` columns (confirmed 2026-06-29):

- `company_name`, `email`, `linkedin_url`, `company_web_url` — business-public data, no client identity leaked.
- `is_lead` (boolean), `is_wishlist` (varchar), `lead_name` — these signal that a company is in "some" project's pipeline, but do NOT reveal which project or client. Low risk; acceptable for shared pool.
- `created_by` (varchar) — internal user ID; not client-identifying.
- No `client_assoc_id`, no `project_id` — confirmed no per-client tenant column exists.

**Verdict:** `company_master` and `contact_master` columns carry no client-tenant identity. Open read is correct for the shared-pool model. No action required.

`contact_master` similarly has no project-scoped columns. The `source_lead_id` FK points to `lead_master` (which IS project-gated) but `contact_master` itself holds only person demographics.

---

### 3.3 Out-of-scope tables (reference / lookup data, no PII)

These tables have RLS enabled but their SELECT policies (`USING true`) are correct — they contain shared configuration/lookup data with no per-client records:

`role_master`, `stage_master`, `status_master`, `source_master`, `industry_master`, `sub_industry_master`, `company_sector`, `domain_master`, `designation_master`, `turnover_master`, `city_master`, `state_master`, `countrycode_master`, `dropdown_option`, `pre_sales_question`, `feedback_question_master`, `use_cases`, `project_visibility_setting`, `rbac_master`

Also out of scope (already tightly scoped by non-project isolation applied in prior migrations):

| Table            | Current isolation        | Migration that controls it    |
|------------------|--------------------------|-------------------------------|
| `task`           | `owner_user_id`          | apply-task-rls.cjs            |
| `task_user_pref` | `user_id`                | apply-task-rls.cjs            |
| `call_log`       | `owner_user_id`          | apply-call-log-rls.cjs        |
| `user_view_pref` | `user_id = current_user_id()` | existing policy          |

---

## 4. Flags for Ankit — confirm before applying

**FLAG-1 (lead_master SELECT — view_scope_of configurability):**  
The pre-existing `lead_master_select` policy restricted visibility further via `view_scope_of('lead', project_id)` — agents in a project with `view_scope_of = 'owner'` could only see their own leads, not all project leads.

This migration replaces that with plain `is_member(project_id)` — all project members see all project leads. This is consistent with the "project membership = read access" requirement as stated.

**Confirm:** do you want to preserve the `view_scope_of` per-project restriction on lead_master SELECT on top of membership? If yes, the policy should be:
```sql
USING (
  is_admin() OR is_qc()
  OR manages_project(project_id)
  OR (is_member(project_id) AND view_scope_of('lead', project_id) IN ('team','everyone'))
  OR (is_member(project_id) AND assigned_to('lead', lead_id) = current_user_id())
)
```

**FLAG-2 (lead_designation):**  
`lead_designation` has no `lead_id`, `project_id`, or any FK to the project chain (confirmed introspection). It is left open (existing `authenticated_full_access` unchanged). Verify what this table stores — if it contains PII or project-specific data, a schema fix (add `lead_id` FK) is needed first.

**FLAG-3 (Group C join-chain depth):**  
Meeting-related policies join 3 tables to reach `project_id`. Each EXISTS uses `LIMIT 1` and short-circuits. Performance should be fine at current scale (~10K meetings). If volume grows significantly, consider adding `project_id` as a denorm column on `meeting_schedule` or `meeting_master`.

**FLAG-4 (in_app_notification):**  
No `project_id` on this table. We scope SELECT to `user_id = current_user_id()` (recipient) OR admin. This is correct privacy behaviour for notifications. Confirm this is intended.

---

## 5. What this migration does NOT touch

- Write policies (INSERT/UPDATE/DELETE) — those live in `apply-access-control-rls.cjs` and `apply-assignment-rls.cjs`. This migration only replaces SELECT arms.
- Portal isolation (`deny_portal_session` RESTRICTIVE policies) — those live in `apply-portal-rls.cjs`. The portal deny policy AND-s with our new SELECT policies, so portal sessions are doubly excluded.
- `company_master` / `contact_master` SELECT (globally shared, intentionally open).
- Reference/lookup tables (no client data).

---

## 6. Apply + validate runbook

### Prerequisites
- `apply-access-control-rls.cjs` applied (or apply them together in order)
- `apply-portal-rls.cjs` applied (for deny_portal_session)
- Test Supabase Auth users created: one member of project P, one non-member, one admin, one QC

### Apply order
```
1. apply-access-control-rls.cjs          (role-scoped writes)
2. apply-assignment-rls.cjs              (assignment write model)
3. apply-portal-rls.cjs                  (portal isolation)
4. apply-project-read-isolation-rls.cjs  (THIS migration)
```

### Validate (throwaway login per scenario)

**Member of project P:**
```sql
-- MUST return rows
SELECT * FROM lead_master WHERE project_id = <P>;
SELECT * FROM lead_report WHERE lead_id IN (SELECT lead_id FROM lead_master WHERE project_id = <P>);
SELECT * FROM interaction WHERE project_id = <P>;
SELECT * FROM company_project_status WHERE project_id = <P>;
SELECT * FROM contact_project_status WHERE project_id = <P>;
SELECT * FROM meeting_master WHERE meeting_id IN (
  SELECT ms.meeting_id FROM meeting_schedule ms
  JOIN lead_report lr ON lr.report_id = ms.report_id
  JOIN lead_master lm ON lm.lead_id = lr.lead_id
  WHERE lm.project_id = <P>);

-- MUST return 0 rows (different project Q)
SELECT * FROM lead_master WHERE project_id = <Q>;
SELECT * FROM lead_report WHERE lead_id IN (SELECT lead_id FROM lead_master WHERE project_id = <Q>);
```

**Non-member (authenticated, no project_user row for P):**
```sql
-- MUST return 0 rows
SELECT * FROM lead_master WHERE project_id = <P>;
SELECT * FROM lead_report WHERE lead_id IN (SELECT lead_id FROM lead_master WHERE project_id = <P>);

-- MUST still work (shared pool)
SELECT COUNT(*) FROM company_master;
SELECT COUNT(*) FROM contact_master;
```

**Admin:**
```sql
-- MUST return rows from ALL projects
SELECT COUNT(*), project_id FROM lead_master GROUP BY project_id;
```

**QC:**
```sql
-- MUST return rows from ALL projects
SELECT COUNT(*), project_id FROM lead_master GROUP BY project_id;
```

**in_app_notification:**
```sql
-- MUST return own notifications only
SELECT * FROM in_app_notification;   -- returns only rows WHERE user_id = current_user
-- Must return 0 for another user's notifications
SELECT * FROM in_app_notification WHERE user_id = <other_user_id>;
```

**Regression — write paths:**
```sql
-- Agent assigned to a lead in project P: UPDATE must still work
UPDATE lead_report SET stage_id = 4 WHERE lead_id = <assigned_lead_id>;

-- Portal session: must see 0 rows from ANY public base table
-- (relies on deny_portal_session RESTRICTIVE policy from apply-portal-rls.cjs)
SELECT * FROM lead_master;  -- as a portal-session user: must return 0 rows
```

### Rollback
Paste `DOWN_SQL` from the migration file into the Supabase SQL editor if any validation fails. It restores all previous open policies.
