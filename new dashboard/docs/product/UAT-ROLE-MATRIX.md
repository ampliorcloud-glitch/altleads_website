# UAT Role-Capability Matrix — AltLeads CRM Internal Launch

**Audit date:** 2026-06-28  
**Scope:** ~112 users, internal launch readiness  
**Method:** Code analysis (AuthContext, App.tsx, RLS migrations) + read-only DB queries (no writes)  
**Temp scripts:** Created and deleted in same session — confirmed gone.

---

## 1. Role Definitions (role_master)

| ID | Name        | is_web | Portal | Internal CRM |
|----|-------------|--------|--------|--------------|
| 1  | ADMIN       | true   | Yes (can view both) | Yes (full) |
| 2  | TEAM_LEAD   | true   | No (internal only) | Yes |
| 3  | AGENT       | true   | No (internal only) | Yes |
| 4  | SALES_HEAD  | false  | Yes (/sales portal) | No (redirected) |
| 5  | SALES_PERSON| false  | Yes (/sales portal) | No (redirected) |
| 6  | QC          | true   | No (internal only) | Yes (limited) |

---

## 2. Permission Flags (AuthContext.tsx)

| Flag | Who gets it | Derivation |
|------|-------------|------------|
| `isAdmin` | ADMIN only | `roles.includes('ADMIN')` |
| `isTeamLead` | TEAM_LEAD only | `roles.includes('TEAM_LEAD')` |
| `isSalesHead` | SALES_HEAD only | `roles.includes('SALES_HEAD')` |
| `isApprover` | ADMIN, TEAM_LEAD, QC | `isAdmin \|\| isTeamLead \|\| roles.includes('QC')` |
| `canReassign` | ADMIN, TEAM_LEAD, SALES_HEAD | `isAdmin \|\| isTeamLead \|\| isSalesHead` |
| `canCreateData` | ADMIN only | `isAdmin` (ADR-21, per-project grant ALT-174 not built yet) |
| `isInternalUser` | ADMIN, TEAM_LEAD, AGENT, QC | any of those role names |
| `isSalesUser` | SALES_HEAD, SALES_PERSON | any of those role names |

---

## 3. Route Access Matrix

### Internal CRM Routes (ProtectedRoute — requires session + internal role)

| Route | Guard | ADMIN | TEAM_LEAD | AGENT | QC | SALES_HEAD | SALES_PERSON |
|-------|-------|-------|-----------|-------|-----|-----------|--------------|
| `/dashboard` | ProtectedRoute | YES | YES | YES | YES | REDIRECT→/sales | REDIRECT→/sales |
| `/leads` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/leads/:id` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/leads/:id/edit` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/leads/new` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/leads/board` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/companies` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/companies/:id` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/companies/new` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/contacts` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/contacts/:id` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/contacts/new` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/meetings` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/meetings/:id` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/tasks` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/wishlist` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/notifications` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/settings` | ProtectedRoute | YES | YES | YES | YES | REDIRECT | REDIRECT |
| `/approvals` | ApproverRoute | YES | YES | NO→/dashboard | YES | REDIRECT | REDIRECT |
| `/admin` | ProtectedRoute (page re-checks isAdmin) | YES | NO (sees page but Sidebar hides it) | NO | NO | REDIRECT | REDIRECT |
| `/import` | AdminRoute | YES | NO→/dashboard | NO | NO | REDIRECT | REDIRECT |
| `/recycle-bin` | AdminRoute | YES | NO→/dashboard | NO | NO | REDIRECT | REDIRECT |

> **Note on `/admin`:** The route guard is `ProtectedRoute` (not `AdminRoute`), but the page itself does `if (!isAdmin) return <Restricted />` and the sidebar hides it for non-admins. A TEAM_LEAD/AGENT/QC who types `/admin` directly gets the Restricted component. This is defence-in-depth, not a true guard.

### Sales Portal Routes (SalesProtectedRoute — requires sales or internal role)

| Route | ADMIN | TEAM_LEAD | AGENT | QC | SALES_HEAD | SALES_PERSON |
|-------|-------|-----------|-------|-----|-----------|--------------|
| `/sales` (leads list) | YES | YES | YES | YES | YES | YES |
| `/sales/leads/:id` | YES | YES | YES | YES | YES | YES |
| `/sales/meetings` | YES | YES | YES | YES | YES | YES |
| `/sales/meetings/:id` | YES | YES | YES | YES | YES | YES |
| `/sales/wishlist` | YES | YES | YES | YES | YES | YES |
| `/sales/feedback` | YES (stub) | YES (stub) | YES (stub) | YES (stub) | YES (stub) | YES (stub) |

> **Critical:** Sales portal does NOT yet scope data to the logged-in sales user's downline. All leads readable by the session are shown (see App.tsx comment: "Data is NOT yet sales-scoped — RLS scoping is a later ticket").

---

## 4. In-Page Capability Matrix

| Capability | ADMIN | TEAM_LEAD | AGENT | QC | SALES_HEAD | SALES_PERSON |
|------------|-------|-----------|-------|-----|-----------|--------------|
| **View leads list** | YES | YES | YES | YES | Via /sales | Via /sales |
| **View lead detail** | YES | YES | YES | YES | Via /sales | Via /sales |
| **Create lead** (New Lead button) | YES | NO | NO | NO | NO | NO |
| **Edit lead** (UI access to form) | YES | YES | YES | YES | NO | NO |
| **Reassign lead** (Change salesperson) | YES | YES | NO | NO | YES | NO |
| **Approve lead report** | YES | YES | NO | YES | NO | NO |
| **View companies list** | YES | YES | YES | YES | NO | NO |
| **Create company** | YES | NO | NO | NO | NO | NO |
| **Edit company status/notes** | YES | YES (project mgr) | PARTIAL* | NO | NO | NO |
| **View contacts list** | YES | YES | YES | YES | NO | NO |
| **Create contact** | YES | NO | NO | NO | NO | NO |
| **Edit contact** | YES | YES (project mgr) | PARTIAL* | NO | NO | NO |
| **View meetings** | YES | YES | YES | YES | Via /sales | Via /sales |
| **Reassign meeting** | YES | YES | NO | NO | YES | NO |
| **View tasks (own)** | YES | YES | YES | YES | NO | NO |
| **Wishlist** | YES | YES | YES | YES | Via /sales | Via /sales |
| **Approvals queue** | YES | YES | NO | YES | NO | NO |
| **Import (CSV/XLSX)** | YES (frontend only) | NO | NO | NO | NO | NO |
| **Recycle Bin** | YES | NO | NO | NO | NO | NO |
| **Admin panel** | YES | NO | NO | NO | NO | NO |
| **Bulk reassign/status/project** | YES | YES (canReassign) | NO | NO | YES | NO |
| **Export** | (not built yet) | — | — | — | — | — |
| **Sales feedback CRUD** | YES | YES | NO | NO | YES | NO |

*PARTIAL = can edit only if `created_by` (importer's user_id) matches, which is broken for bulk-migrated data. See Gap #1.

---

## 5. RLS Policy Summary (current state in DB)

### Applied migrations (active):
- `access-rls-v1.sql` — per-row policies on lead_master, company_master, contact_master, contact_project_status, company_project_status, interaction
- `apply-task-rls.cjs` — task + task_user_pref (owner-only + admin; manages_user() is FAIL-CLOSED returning false)
- `apply-call-log-rls.cjs` — call_log (owner-only + admin; inherits manages_user() fail-closed)
- `apply-portal-rls.cjs` — portal.* tables + deny_portal_session restrictive policy on all public tables

### STAGED (not yet applied — the launch blocker):
- `apply-assignment-rls.cjs` (ALT-152 / ALT-288) — teaches write-path about `lead_report.user_id` assignment. **NOT applied.**

### What the current (pre-ALT-152) write policies allow:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `lead_master` | admin OR qc OR created_by OR project_manager | admin OR created_by | admin OR created_by | admin OR created_by |
| `company_master` | everyone (true) | admin OR created_by | admin OR created_by | admin OR created_by |
| `contact_master` | everyone (true) | admin OR created_by | admin OR created_by | admin OR created_by |
| `company_project_status` | everyone (true) | admin OR record_owner OR project_mgr | admin OR record_owner OR project_mgr | admin OR record_owner OR project_mgr |
| `contact_project_status` | everyone (true) | admin OR record_owner OR project_mgr | admin OR record_owner OR project_mgr | admin OR record_owner OR project_mgr |
| `interaction` | everyone (true) | admin OR record_owner OR lead_project_mgr | same | same |
| `task` | own OR admin (manages_user=false) | own OR admin | own OR admin | own OR admin |
| `call_log` | own OR admin | own OR admin | own OR admin | own OR admin |
| `lead_report` | (blanket authenticated — no row filter) | (blanket) | (blanket) | (blanket) |

> **The critical gap:** `lead_master UPDATE` currently checks `created_by = current_user_id()::text`. Because 608 leads were bulk-migrated, `created_by` is the importer (only 18 distinct creators for 608 leads). An AGENT assigned via `lead_report.user_id` CANNOT update their lead until ALT-152 is applied.

---

## 6. DB Coverage Numbers (2026-06-28)

### Users by role
| Role | Count |
|------|-------|
| ADMIN | 5 |
| TEAM_LEAD | 9 |
| AGENT | 18 |
| SALES_HEAD | 11 |
| SALES_PERSON | 46 |
| QC | 2 |
| **Total in user_master** | **112** |

> Note: user_id=7 holds all 6 roles simultaneously (test/admin account). Some users hold dual roles (e.g. SALES_HEAD+SALES_PERSON, AGENT+SALES_PERSON). Total role assignments exceed 91 because of these overlaps.

### Login / Auth Coverage
| Metric | Count |
|--------|-------|
| Total users (user_master, active) | 112 |
| Users WITH a profiles row (= have auth login) | 2 |
| Users WITHOUT any login | **110** |

**Critical: 110 of 112 users cannot log in at all.** Only user_id=1 (ADMIN) and user_id=124 (dual ADMIN+QC) have active logins. All 18 AGENTs, all 9 TEAM_LEADs, all 57 sales users, and 1 QC have no auth login.

### Lead Assignment Coverage
| Metric | Count |
|--------|-------|
| Total active leads | 608 |
| Leads with a lead_report row | 598 |
| Leads with an assigned user_id (lead_report.user_id NOT NULL) | 598 |
| Leads with no assignment at all | 10 |
| Reports with null user_id | 0 |
| **Leads assigned to a user with NO login** | **598 (100%)** |

All 598 assigned leads point to users who have no auth login. After bulk login provisioning, those users will be able to SELECT their leads (RLS: `manages_project` or `is_qc`) but NOT update them (RLS: `created_by` mismatch — ALT-152 blocks).

### Project Coverage
| Metric | Count |
|--------|-------|
| Total projects (distinct project_user entries) | 14 |
| AGENTs with any project membership | 14 of 18 |
| TEAM_LEADs with any project membership | 8 of 9 |
| Users with NO project membership | 15 |

15 users have no project membership. For AGENTs this means the `manages_project` grant also never fires for them, and they cannot SELECT leads (`lead_master_select` requires `is_admin OR is_qc OR created_by OR manages_project`).

### Lead Creator Distribution
| Metric | Count |
|--------|-------|
| Distinct `created_by` values on active leads | 18 |
| Total active leads | 608 |

18 distinct creators for 608 leads confirms the bulk-migration scenario. No individual agent appears as the creator of their assigned leads.

---

## 7. Launch-Readiness Gaps (Prioritized)

### GAP-1 [P0 — LAUNCH BLOCKER] 110 of 112 users have no auth login
**Impact:** Every AGENT (18), TEAM_LEAD (9), SALES_HEAD (11), SALES_PERSON (46), and 1 QC cannot log in.  
**Root cause:** Bulk login provisioning was never run. Only 2 users (admin accounts) have Supabase Auth credentials.  
**Fix:** Admin bulk-provisions logins via the notify-service `/admin/provision-logins` endpoint (or Supabase dashboard). Tracked in launch plan.  
**Who is blocked:** 110 users — effectively the entire team.

### GAP-2 [P0 — LAUNCH BLOCKER] AGENTs cannot edit assigned leads (ALT-152 not applied)
**Impact:** All 18 AGENTs are assigned leads via `lead_report.user_id`, but the `lead_master UPDATE` RLS policy gates on `created_by = current_user_id()`. Since `created_by` is the bulk-importer (not the agent), every agent update attempt is DENIED.  
**Fix:** Apply `apply-assignment-rls.cjs` (ALT-152) — adds `assigned_to('lead', lead_id) = current_user_id()` to the UPDATE USING clause. Must be validated with a throwaway non-admin login first (ALT-153).  
**Who is blocked:** All 18 AGENTs + 8 TEAM_LEADs who might also try to edit via `manages_project` branch (that part works, but the assignment path does not exist yet).

### GAP-3 [P0 — LAUNCH BLOCKER] 15 users have no project membership — AGENTs cannot SELECT leads
**Impact:** `lead_master_select` requires `is_admin OR is_qc OR created_by OR manages_project(project_id)`. An AGENT with no project membership matches none of these. They log in and see zero leads.  
**Sub-impact:** 4 of 18 AGENTs have no `project_user` entry at all. They will get an empty leads screen with no error.  
**Fix:** Admin assigns these users to the appropriate project(s) via the Admin panel before the bulk login rollout.

### GAP-4 [P1 — HIGH] Sales portal shows unscoped data (all leads the session can read)
**Impact:** SALES_HEAD and SALES_PERSON users hitting `/sales` see ALL leads their session can read — not just their downline's leads. App.tsx comment explicitly documents this: "RLS scoping is a later ticket."  
**Risk:** A SALES_PERSON sees competitor colleagues' leads; a SALES_HEAD sees leads outside their territory.  
**Fix:** Implement sales-portal RLS scoping (downline `project_user` filter) before giving sales users their logins. Tracked as a follow-on sales portal ticket.

### GAP-5 [P1 — HIGH] QC role has effectively one screen (Approvals) and no lead visibility
**Impact:** QC (`is_qc()` = role_id 6) can SELECT leads (`lead_master_select` includes `is_qc()`), but has no write access to leads, companies, or contacts — and the only QC-specific UI is the Approvals queue. They cannot annotate, edit, or take action on records. QC is treated as a passive reviewer.  
**Status:** Documented as AMBIG B1/A5 in AuthContext and code comments. Current behaviour is intentional but needs owner sign-off before launch.  
**Note:** Only 2 QC users exist; 1 has a login (user_id=124), 1 does not (user_id=7 — the all-roles test account).

### GAP-6 [P2 — MEDIUM] TEAM_LEAD approval in ReportTab uses `profile.role` (single role) not `roles` array
**Impact:** `ReportTab.tsx` line 378 derives `isApprover` from `userRole === 'ADMIN' || userRole === 'TEAM_LEAD'` — reading the legacy `profile.role` string, NOT the `roles` array from AuthContext. A user with a dual role (e.g. AGENT primary + TEAM_LEAD secondary in `user_role`) may not see the Approve button in the lead report tab even if `isApprover` is true in AuthContext.  
**Fix:** Replace the local `isApprover` derivation in `ReportTab.tsx` with `useAuth().isApprover` (the context already computes it correctly from the full role set).

### GAP-7 [P2 — MEDIUM] Import Wizard is frontend-only (no write path)
**Impact:** `/import` is ADMIN-only (correct) but the final "Import" action is disabled — there is no server-side admin import endpoint yet. Admins can parse/validate CSV/XLSX but cannot execute the import.  
**Status:** Documented in App.tsx comment: "performs NO writes — the final Import action is disabled pending the server-side admin import endpoint."  
**Fix:** Implement the notify-service `/admin/import` endpoint (ALT-399 backlog). Not a launch blocker for the outreach team, but blocks any future bulk data updates by admin.

### GAP-8 [P3 — LOW] Sidebar `isAdmin`/`isApprover` reads `profile.role` (single role), not `roles` array
**Impact:** `Sidebar.tsx` line 55-57 derives `isAdmin` and `isApprover` from `profile?.role`, not from the AuthContext `roles` array. A user whose primary role in `profiles.role` is e.g. `'AGENT'` but who also has `'TEAM_LEAD'` in `user_role` will not see the Approvals nav item, even though `useAuth().isApprover` would be true.  
**Fix:** Replace `profile?.role === 'ADMIN'` / `profile?.role === 'TEAM_LEAD'` in Sidebar with destructured `isAdmin`, `isApprover`, `isTeamLead` from `useAuth()`.  
**Scope:** Low risk today (most users have one role), but will matter as role combos grow.

---

## 8. Summary Table — What Each Role Can Actually Do Today

| Capability | ADMIN | TEAM_LEAD | AGENT | QC | SALES_HEAD | SALES_PERSON |
|------------|:-----:|:---------:|:-----:|:--:|:----------:|:------------:|
| Log in | YES (2 of 5) | NO | NO | 1 of 2 | NO | NO |
| View leads | YES | YES | PARTIAL (project membership needed) | YES | Via /sales (unscoped) | Via /sales (unscoped) |
| Edit assigned leads | YES | YES (manages_project) | **BLOCKED (ALT-152)** | NO | NO | NO |
| Create leads/companies/contacts | YES | NO | NO | NO | NO | NO |
| Reassign leads | YES | YES | NO | NO | YES (portal, unscoped) | NO |
| Approvals queue | YES | YES | NO | YES | NO | NO |
| Admin panel | YES | NO | NO | NO | NO | NO |
| Import | YES (UI only, no write) | NO | NO | NO | NO | NO |
| Recycle Bin | YES | NO | NO | NO | NO | NO |
| Tasks (own) | YES | YES | YES | YES | NO | NO |
| Wishlist | YES | YES | YES | YES | YES (portal) | YES (portal) |
| Sales portal | YES | YES | YES | YES | YES (home) | YES (home) |

---

## 9. Pre-Launch Checklist

- [ ] **GAP-1:** Bulk-provision auth logins for all 110 users  
- [ ] **GAP-2:** Validate + apply `apply-assignment-rls.cjs` (ALT-152) — throwaway login test first  
- [ ] **GAP-3:** Assign the 4 unproject-membered AGENTs (and 15 total users) to their projects  
- [ ] **GAP-4:** Decide: ship sales logins before or after sales RLS scoping is built  
- [ ] **GAP-5:** Owner sign-off: is QC read-only+approvals acceptable at launch?  
- [ ] **GAP-6:** Fix `ReportTab.tsx` isApprover to use `useAuth().isApprover`  
- [ ] **GAP-8:** Fix `Sidebar.tsx` isAdmin/isApprover to use AuthContext values  

---

*Generated by: read-only UAT audit (no DB writes). Temp scripts deleted. Reviewed against: AuthContext.tsx, App.tsx, access-rls-v1.sql, apply-assignment-rls.cjs, apply-task-rls.cjs, apply-call-log-rls.cjs, Sidebar.tsx, LeadDetailPage.tsx, ReportTab.tsx, CompaniesPage.tsx, ContactsPage.tsx.*
