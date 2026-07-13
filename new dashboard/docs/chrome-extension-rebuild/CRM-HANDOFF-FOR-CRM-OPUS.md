# CRM Handoff — What the Chrome Extension Needs From the CRM

> **From:** the Extension-rebuild Opus (working in `Chrome Extension EcoSystem/` + this `docs/chrome-extension-rebuild/`).
> **To:** the CRM Opus that owns `new-code/web`, `new-code/notify-service`, `new-code/migration`.
> **Purpose:** keep the CRM side in the loop on what the new MV3 LinkedIn extension will consume from the CRM, and request the discrete CRM-side changes the extension depends on. **Every ask below is grounded in source we verified** (file + line cited). Anything we could not confirm against the live DB is marked **[UNCERTAIN — verify on live DB]** — the migration `.sql` appliers are the source of truth that was applied, but no live query was run.

> **⚠️ Scope guarantee — NO page injection, NO LinkedIn DOM reading.** The extension is **URL-only + side-panel**: it reads `window.location.href` to grab the `/in/<slug>` and renders in the browser's own side panel. It does **NOT** inject a panel into the LinkedIn page, does **NOT** scrape/parse the LinkedIn DOM, and does **NOT** read profile fields off the page. Therefore **the CRM side needs ZERO LinkedIn-scraping support** — no name/title/company parsing endpoints, no enrichment-from-page. The only CRM-side asks are: (1) the masking-safe **read RPC(s)**, (2) the company-assignment **approval workflow**, and (3) **exposing the already-built project selection** to the extension. Anything that smells like "accept scraped LinkedIn fields" is out of scope by design.

---

## 0. TL;DR for the CRM Opus

We are building **one MV3 Chrome extension** that, when the user is on a LinkedIn `/in/<slug>` profile, matches that profile to an **existing** `contact_master` row and shows the contact + its associated records "in short" in an in-page panel. **Phase 1 is read-only and shippable today** against primitives that already exist (`find_contact_dup`, `contact_master_masked`, `linkedin_clean`). **Phase 2 (edit-in-place) is hard-blocked on ALT-152** (the `created_by`-vs-assigned write blocker) and on the **interaction-audit insert gate**, which is a *second, independent* owner-only gate the launch blueprint under-counts.

The extension uses **Option A auth**: the public anon key + the user's real Supabase JWT + RLS — so it is indistinguishable from the web app to PostgREST/RPC, and it inherits the **exact same** RLS, masking, and write blockers. **The service-role key will never be in the extension.**

**What we need from you, in priority order:**

1. **Confirm** the `linkedin_clean` column + its index are in production (we verified the migration; not the live DB).
2. **Add a richer, masking-safe read RPC** (`find_contact_by_linkedin`) so a non-owner agent sees more than name+company — *optional but high-value* (TODO-2).
3. **Fix ALT-152 so it aligns ALL THREE write gates** — `contact_master`, `contact_project_status`, **and** `interaction`-on-contact — not just one. This is the gate on Phase 2 (TODO-4).
4. **Add an atomic SECURITY-INVOKER write RPC** (status UPSERT + interaction append in one txn) — *optional, Phase 2* (TODO-5).
5. **Do not** build a service-role record-edit endpoint just to unblock the extension (TODO-6 = explicit non-goal).

**NEW — three owner decisions locked 2026-06-22 (detail in §7, TODOs A/B/C):**

6. **TODO-A — `find_contact_for_panel(p_linkedin, p_project_id)` RPC.** A non-owner agent must still see, for a matched contact: **contact name + company name + COMPANY STATUS for the selected project (incl. DNC, must be visible) + last activity date + OWNER NAME** — but **NULL contact PII** (no email/phone/linkedin). This supersedes the lighter TODO-2 as the recommended read RPC because it adds company status, last-activity, and owner name. *(Grounded: `company_project_status.account_status`/`owner_user_id`, `user_master.full_name`, `interaction.occurred_at` all verified in source.)*
7. **TODO-B — Company-assignment request → Team-Lead approval workflow.** Reuse the existing `lead_report` approval pattern (status-on-row + `notifyApproversOfRequest` + `in_app_notification` + email). Agent requests a company from the extension; their TL approves; on approve, ownership re-points so RLS lets the agent reveal/edit. This is **one of ALT-152's assignment mechanisms** (TODO-4).
8. **TODO-C — Expose the (already-built) project selector to the extension.** The CRM **already has** a global project selector (`ProjectSwitcher` + `ProjectContext`, persisted to `localStorage`); the new ask is to (a) make sure the user's choice is persisted as a personal default and (b) expose the currently-selected project so the extension stays in sync. *(Mostly a bridge, not a new selector.)*

---

## 1. Confirm / add the normalized LinkedIn column on the contact table

### What the schema agent actually found (quoted)

> "YES — a LinkedIn URL column EXISTS on contacts, and crucially there is a PRE-NORMALIZED match column. Exact: **`public.contact_master.linkedin_url`** (raw, text) AND **`public.contact_master.linkedin_clean`** (normalized profile slug, text). `linkedin_clean` has a dedicated index **`idx_contact_master_linkedin_clean`**."

> "On migration, `linkedin_clean = lower(regexp_replace ... )` strips `https?://`, `www.`, leading `linkedin.com/in/`, and trailing `/` from `lead_master.linkedin_url` (see companies-contacts.sql lines 62-76)."

We **independently verified in source**:

- `Contact` interface in `new-code/web/src/data/contacts.ts` (lines 10-11) carries both `linkedin_url: string | null` and `linkedin_clean: string | null`.
- `find_contact_dup` matches on `cm.linkedin_clean = p_linkedin` (exact `=`, **no on-the-fly normalization**) — `new-code/migration/access-masking-v1b.sql` line 192.

### ✅ Checklist for the CRM Opus

- [ ] **Confirm on the live DB** that `public.contact_master.linkedin_clean` exists and that index `idx_contact_master_linkedin_clean` is present and **valid** (not `INVALID` from a failed concurrent build). **[UNCERTAIN — verify on live DB]** — we only saw the migration file, never ran a live `\d contact_master`.
- [ ] **Confirm the masking posture** still holds in prod: the 5 detail columns (`email`, `mobile_no`, `alt_mobile_no`, `linkedin_url`, `linkedin_clean`) are **column-REVOKEd** on the base table for `authenticated`, and `contact_master_masked` NULLs them unless `can_see_contact_details(created_by)`. (Source: `access-masking-v1b.sql`.) This is *why* the extension cannot `SELECT ... WHERE linkedin_clean = ?` directly and must go through the RPC.
- [ ] **Report data quality**: how many of the ~607 contacts have non-null `linkedin_clean`? The schema agent's caveat:
  > "DATA QUALITY CAVEAT: `linkedin_clean` is only non-null where the source contact actually had a LinkedIn URL — many of the 607 migrated contacts will have NULL ... So a match works ONLY for contacts that have a stored LinkedIn."

  A one-line count tells us the real match-coverage ceiling: `SELECT count(*) FILTER (WHERE linkedin_clean IS NOT NULL), count(*) FROM contact_master WHERE deleted_date IS NULL AND is_demo = false;`. **[UNCERTAIN — needs live count]**
- [ ] **⚠️ Normalization-consistency bug to fix on the CRM side (this affects match coverage):** the migration backfill used `lower(regexp_replace(...))`, but the app-side `deriveLinkedinClean()` (`contacts.ts` lines 47-54) **does NOT lowercase** — it only strips `^https?://(www\.)?linkedin\.com/in/`, a trailing `/`, and trims. So **contacts edited/created through the web app store a mixed-case `linkedin_clean`**, which the exact-`=` RPC will then fail to match for any slug with capitals. **Ask:** add `.toLowerCase()` to `deriveLinkedinClean()` and run a one-time `UPDATE contact_master SET linkedin_clean = lower(linkedin_clean) WHERE linkedin_clean <> lower(linkedin_clean)`. The extension will apply identical lowercasing on its side, but the stored values must be lowercased too or matches silently miss. *(We verified the missing `.toLowerCase()` directly in source.)*

> Note: `company_master.linkedin_url` exists but is the **company page, not a person**, and has **no** cleaned/indexed variant — ignore it for person matching.

---

## 2. The READ API the extension will call (match by LinkedIn URL → records "in short")

### What exists today and works (Phase 1, no new CRM work strictly required)

The extension's match primitive is the **existing** SECURITY DEFINER RPC — verified in `access-masking-v1b.sql` lines 166-201:

```sql
find_contact_dup(p_email text, p_linkedin text, p_mobile text)
  RETURNS TABLE (contact_id bigint, full_name text, company_id bigint, company_name text)
  LANGUAGE sql STABLE SECURITY DEFINER
  -- WHERE deleted_date IS NULL AND is_demo = false
  --   AND (lower(email)=lower(p_email) OR linkedin_clean = p_linkedin OR mobile_no = p_mobile)
  -- REVOKE from PUBLIC/anon; GRANT EXECUTE to authenticated.
```

Extension call: `supabase.rpc('find_contact_dup', { p_email: null, p_linkedin: <cleaned-slug>, p_mobile: null })`. This is the **only masking-safe** way to look up by `linkedin_clean` (the column is REVOKEd/NULLed everywhere else). It returns no detail columns, so there is no leak.

After a match, the extension loads the "in short" view by mirroring `ContactDetailPage.tsx`, all through existing query shapes:

- **Contact detail** → `fetchContactById(contact_id)` reads the **view** `contact_master_masked` (detail cols may be NULL = correctly masked, not missing).
- **Leads/deals** → `fetchContactLeads(contact_id, source_lead_id)` on `lead_master` (ORs `contact_id` + the historical `source_lead_id` back-link).
- **Per-project status** → `getContactStatus(contact_id, project_id)` on `contact_project_status`.
- **Activity feed** → `fetchActivity('contact', contact_id)` on `interaction` (`record_type='contact' AND record_id=contact_id`).
- **Tasks** → `task WHERE contact_id` (`tasks.ts`).
- **Meetings** → no direct `contact_id`; chain is `contact_id → lead_master.lead_id → lead_report.report_id → meeting_schedule → meeting_master`.

**Auth/RLS path for reads:** `find_contact_dup` is `EXECUTE`-granted to `authenticated` and is SECURITY DEFINER, so it runs regardless of the caller's row ownership (returns id/name/company only). The follow-up detail reads run as the user via the masked view, so `can_see_contact_details()` decides which detail columns the agent sees. **No new read endpoint is required for a working-but-thin Phase 1.**

### The gap worth closing (recommended new RPC)

For an outreach agent who does **not own** a matched contact, the masked view returns name + company only — every other field is NULL. That makes the panel thin for exactly the records an agent is trying to work. From the open questions:

> "Masking vs. usefulness: detail columns (email/phone/linkedin) are NULL for non-owners via `contact_master_masked` ... do we want a new owner/manager-aware RPC (e.g. `find_contact_by_linkedin` returning a bit more) — still masking-safe — to improve the read experience?"

### ✅ Read-API checklist for the CRM Opus

- [ ] **Confirm** `find_contact_dup` is deployed in prod with `EXECUTE` granted to `authenticated` only (REVOKEd from `anon`/`PUBLIC`). **[UNCERTAIN — verify on live DB]**
- [ ] **Decide** whether to ship **TODO-2** (`find_contact_by_linkedin`) below.

---

## 3. The WRITE / EDIT path (how an extension edit becomes a CRM-recorded change) + the ownership/RLS blocker

### How a write must look (so it's indistinguishable from a web edit)

The extension will route every write through the **same data-layer recipe** the web app uses (`projectStatus.ts`), never raw row updates. Verified conventions:

1. **Identity stamping** — `created_by` / `updated_by` store the acting user's **numeric `user_id` AS TEXT** (e.g. `"42"`), taken from `profiles.user_id` (exposed by `AuthContext`), **NOT** the auth uuid. Always stamp `*_date` ISO timestamps. Never supply IDENTITY PKs.
2. **Status change on a contact** — UPSERT `contact_project_status` on `(contact_id, project_id)` **AND** append a `status_change` row to `interaction` (`record_type='contact'`, `record_id=contact_id`, with a `describeChange()`-style note). Mirror onto the company feed via `logCompanyContactActivity()`.
3. **Log a call** — append a `call` `interaction` row.
4. **Edit contact fields** — UPDATE `contact_master`, **re-derive `linkedin_clean`** via `deriveLinkedinClean()` so the match key stays correct, set `updated_date`.
5. **Lead-scoped comments** — `lead_activity` via `addActivityComment()` / `logSystemActivity()`.
6. **Optional notifications** — `notifyInApp()` writes `in_app_notification`; `notify()` POSTs `/notify` for the email.

### The ownership/RLS blocker — and what we specifically need to resolve it

This is the crux. We verified the predicates directly in `access-rls-v1.sql`. **There are THREE separate write gates, with THREE different predicates** — the extension hits all three, and a fix that touches only one leaves the extension half-broken:

| Table | Write predicate (verified) | Source |
|---|---|---|
| `contact_master` (INSERT/UPDATE/DELETE) | `is_admin() OR created_by = current_user_id()::text` — **owner-only, no manager branch** | `access-rls-v1.sql` 209-218 |
| `contact_project_status` (status) | `is_admin() OR record_owner_id('contact', contact_id) = current_user_id() OR manages_project(project_id)` — **owner OR manager** | `access-rls-v1.sql` 231-256 |
| `interaction` ON A CONTACT (audit append) | `is_admin() OR record_owner_id(record_type, record_id) = current_user_id() OR (record_type='lead' AND manages_project(...))` — **the manager branch is `lead`-ONLY; for `record_type='contact'` this is effectively owner-only** | `access-rls-v1.sql` 307-314 |

Consequences the extension inherits **exactly** as the web app does:

- Because data was **bulk-migrated**, `created_by` = the legacy/internal owner, not the agent now responsible. A real agent fails `created_by = current_user_id()` and gets **Postgres `42501`** on most records. The web app already surfaces this with the friendly string *"You can only edit records you own (ask an admin or the owner's manager)"* (`contacts.ts` 286-293; `projectStatus.ts` 113-117, 226-231).
- **The audit append is independently blocked.** Even where a manager could pass the `contact_project_status` UPSERT (it has a `manages_project` branch), the matching `interaction`-on-contact insert has **no contact manager branch** (307-314), so the `status_change`/`call` audit row fails `42501`. **The "recorded exactly as in the CRM" goal is therefore ALT-152-blocked on its own, not just the status row.** *(We verified this gap in source — it is the most important correction in this handoff.)*
- **The three predicates are non-uniform.** A manager can set status but cannot edit the contact (`contact_master` owner-only) nor write the contact's audit row (`interaction` owner-only). So a single "edit records assigned to you" rule applied to `contact_master` ownership alone still leaves the manager-status and audit paths inconsistent.

### ✅ What we need ALT-152's fix to do (so the extension's edit path works AND is attributed correctly)

Per ADR-21 (`DECISIONS.md`): agents must edit records **ASSIGNED** to them (assignment-based write, with ownership re-pointed/derived for migrated rows), create rights default ADMIN-only, outreach roles are update-only. For the extension specifically, the fix must:

- [ ] **Align all three tables to the same effective write rule** — `contact_master`, `contact_project_status`, and `interaction`-on-contact must accept the same set of writers (admin OR assignee OR appropriate manager). If only `contact_master` ownership is re-pointed, the audit append still `42501`s. **This alignment is the acceptance bar for unblocking the extension's edit feature.**
- [ ] **Define the assignment source of truth** the extension can rely on for attribution. CLAUDE.md says lead↔salesperson is `lead_report.user_id` (not `created_by`). Confirm whether contact "ownership/assignment" will derive from `lead_report.user_id` via the contact→lead link, from a new owner field on `contact_master`, or from a contact-assignment table — the extension needs a deterministic answer to know *who* is allowed to edit a given matched contact and how to stamp it.
- [ ] **Keep attribution correct after the fix:** writes must still stamp `created_by`/`updated_by` as the acting agent's numeric `user_id`-as-text. Re-pointing ownership for migrated rows must not retroactively rewrite historical `interaction.created_by` (it's append-only history).
- [ ] **Validate with a real, non-admin agent login** before any inline edit ships (per ADR-21). The extension reuses the identical RLS, so your validation doubles as the extension's validation.

> Until ALT-152 lands and aligns all three gates, **the extension ships Phase 1 read-only** and surfaces the same friendly `42501` message if any write is attempted. We will **not** work around this by embedding service-role in the extension.

---

## 4. Extension auth approach the CRM should support

**Chosen: Option A — public anon key + the user's real Supabase JWT + RLS.** Verified-safe rationale: the anon key is already public in the shipped web bundle; every PostgREST/RPC call carries the user's JWT; `auth.uid() → profiles → current_user_id()` resolves identically to the web app, driving `is_admin()` / `manages_project()` / `can_see_contact_details()`. The extension is therefore **indistinguishable from the web app** to PostgREST, RPC, and `notify-service`.

Two sub-paths:

- **A1 (ship first):** extension popup prompts email/password → `supabase.auth.signInWithPassword` → its own session JWT. Mirror `AuthContext` to load `profiles` (`id`, `user_id`, `role`) + `user_role × role_master`, so we have `profiles.user_id` for write stamping.
- **A2 (SSO upgrade):** with host permission for `crm.altleads.com`, lift the persisted Supabase session from the CRM tab's `localStorage` and `setSession` → single sign-on with the open CRM tab.

**Explicitly avoided:**
- **Portal session path** (`portal.client_portal_user` / `usePortalSession.ts`): a RESTRICTIVE deny-policy locks portal sessions out of every CRM base table. The extension uses the **normal `authenticated`** path, never portal.
- **Service-role key in the extension:** never — it bypasses all RLS and stays server-only in `notify-service`.
- **Option B (notify-service Bearer JWT):** only useful for the existing `/notify` email + admin user-mgmt endpoints; there is **no record-edit service endpoint** today, so B does not help inline editing.

### ✅ What we need from the CRM side for auth

- [ ] **Confirm** there is no IP allowlist / CORS restriction on the Supabase PostgREST + Auth endpoints that would block a `chrome-extension://` origin. Supabase normally allows any origin with the anon key, but please confirm no custom gateway/WAF rule exists. **[UNCERTAIN — verify]**
- [ ] **Confirm A2 security posture is acceptable** — i.e. it is OK for an extension with host permission for `crm.altleads.com` to read the persisted Supabase session from that tab's `localStorage` for SSO. If not, we restrict to A1 (explicit popup login). *(This is also in the owner open-questions.)*
- [ ] **No CRM code change is required for A1.** A2 needs nothing server-side either; it's an extension-only read of the existing session.

---

## 5. New endpoints / RPCs / migrations the CRM side must provide (discrete TODOs)

Each TODO has acceptance criteria. **TODO-1, -3, -4 are the load-bearing asks; -2 and -5 are recommended; -6 is a non-goal we want recorded.**

### TODO-1 — Confirm `linkedin_clean` + index in prod, and lowercase the app-write path *(blocking Phase 1 match coverage)*
- **Do:** verify `contact_master.linkedin_clean` + `idx_contact_master_linkedin_clean` exist and are valid in prod; add `.toLowerCase()` to `deriveLinkedinClean()` (`contacts.ts`); run a one-time `UPDATE ... SET linkedin_clean = lower(linkedin_clean)` to fix any mixed-case app-written rows.
- **Acceptance:** for a contact with `linkedin_url = https://www.linkedin.com/in/John-Doe/`, `find_contact_dup(null, 'john-doe', null)` returns that contact. A re-run of `deriveLinkedinClean('.../in/John-Doe')` yields `'john-doe'`. Live count of non-null `linkedin_clean` is reported back to us.

### TODO-2 — New masking-safe read RPC `find_contact_by_linkedin` *(recommended; improves Phase 1 usefulness)*
- **Do:** add a SECURITY DEFINER RPC that takes a cleaned slug and returns the matched contact **plus a richer but masking-aware payload** — i.e. include detail columns only when `can_see_contact_details(created_by)` is true for the caller (compute inside the function), otherwise NULL them, and always return a `details_hidden` boolean and the associated-record **counts** (leads/tasks/open meetings/last interaction) so the panel can render "in short" in one round-trip. `EXECUTE` to `authenticated` only; REVOKE from `anon`/`PUBLIC`.
- **Acceptance:** a non-owner agent gets name + company + a `details_hidden=true` flag + record counts (not just name/company); an owner/manager/admin gets the unmasked detail. No path returns another owner's detail columns. Mirrors the `can_see_contact_details()` logic exactly so there is no new leak surface.
- **Note:** if you decline this, Phase 1 still works via `find_contact_dup` + `contact_master_masked`, just thinner for non-owners.

### TODO-3 — Report ALT-152 timing + the chosen assignment source of truth *(blocks Phase 2 planning)*
- **Do:** tell us (a) whether ALT-152 / ADR-21 is scheduled before the extension's edit feature, and (b) the deterministic assignment field/derivation the extension should read to know who may edit a matched contact and how to stamp attribution.
- **Acceptance:** the extension team has a single documented rule like "a contact is editable by `X`, where assignment derives from `Y`", written into `DECISIONS.md` / the backlog ticket.

### TODO-4 — ALT-152 fix that ALIGNS all three contact write gates *(hard gate on Phase 2 edits)*
- **Do:** implement the assignment-based write model so that `contact_master`, `contact_project_status`, and `interaction`-on-contact all accept the same writer set (admin OR assignee OR appropriate manager), with migrated-row ownership re-pointed/derived.
- **Acceptance:** a real non-admin agent assigned to a migrated contact can, in one session: (i) UPDATE the contact, (ii) UPSERT `contact_project_status`, **and** (iii) INSERT the `status_change`/`call` `interaction` row — **all without `42501`**. A non-assigned agent still gets the friendly `42501`. Validated with an actual agent login, not service-role. (Today, gate (iii) fails even when (ii) passes for managers — this must be closed.)

### TODO-5 — Atomic SECURITY-INVOKER write RPC *(recommended; Phase 2)*
- **Do:** add a `SECURITY INVOKER` RPC (so RLS still applies) that does the `contact_project_status` UPSERT + the `interaction` append in **one transaction**, so a status change and its audit row never half-commit.
- **Acceptance:** calling it as an authorized agent writes both rows atomically; calling it as an unauthorized agent fails the whole txn with `42501` (no partial write). Because it's SECURITY INVOKER, it is **still** gated by ALT-152 — it is necessary-but-insufficient on its own (TODO-4 is the real unblock). If declined, the extension does sequential calls exactly like the current web data layer.

### TODO-6 — Do **NOT** build a service-role record-edit bypass endpoint *(explicit non-goal — recording the decision)*
- **Rationale:** routing extension edits through a service-role `notify-service` endpoint would bypass RLS for migrated rows and break the "indistinguishable from a web edit / same RLS" guarantee. The correct unblock is TODO-4, not a bypass.
- **Acceptance:** no new service-role edit endpoint is added unless the owner explicitly decides to, with eyes open. Service-role stays server-only.

---

## 5b. NEW owner decisions — 2026-06-22 (TODOs A / B / C)

> These three were locked by the owner on **2026-06-22**. They are grounded in the **verified** repo schema (paths + lines cited inline). Live-DB facts are still marked **[UNCERTAIN — verify on live DB]**. **All three are CRM-side work** (migration / web / notify-service). They do **not** require any LinkedIn-scraping support (see the scope guarantee at the top).

### TODO-A — `find_contact_for_panel(p_linkedin, p_project_id)`: richer masking-safe panel read *(supersedes TODO-2 as the recommended read RPC)*

**Why:** The non-owned-contact panel must be useful even when the agent does **not** own the contact. Today `find_contact_dup` returns only `contact_id, full_name, company_id, company_name` (verified `access-masking-v1b.sql:171-176`), and the masked view NULLs all PII for non-owners — too thin. The panel needs **company status (incl. DNC), last activity date, and owner name** *without* leaking PII.

**Do:** Add a new **SECURITY DEFINER** RPC, e.g. `find_contact_for_panel(p_linkedin text, p_project_id bigint)`, returning a **limited, masking-safe** payload for the matched contact:

| Field | Source (verified) | Notes |
|---|---|---|
| `contact_id`, `contact_name` | `contact_master.contact_id`, `full_name` (`companies-contacts.sql:16-35`) | always returned |
| `company_id`, `company_name` | `contact_master.company_id` → `company_master.company_name` | always returned |
| `company_status` | `company_project_status.account_status` **for `p_project_id`** (`feature-status-schema.sql:38-53`, `account_status` at line 42) | **must be visible even when it is DNC** |
| `last_activity` | most recent `interaction.occurred_at` for `record_type='contact' AND record_id=contact_id` (`projectStatus.ts:11-28`) | see DNC/`updated_date` note below |
| `owner_name` | resolve owner → `user_master.full_name` (`schema.sql` `user_master`, `full_name varchar(255)`; resolution pattern in `activityTimeline.ts:78-90`) | owner id from `company_project_status.owner_user_id` / `contact_project_status.owner_user_id` (both verified, `feature-status-schema.sql:29,47`); fall back to `contact_master.created_by`-as-`user_id` |
| `details_hidden` (bool) | computed = `NOT can_see_contact_details(created_by)` (`access-masking-v1b.sql:62-83,106`) | tells the panel whether PII was suppressed |
| `email` / `mobile_no` / `linkedin_url` | **NULL unless** `can_see_contact_details(created_by)` is true for the caller — compute inside the function, exactly mirroring `contact_master_masked` (`access-masking-v1b.sql:93-114`) | **never leak for non-owners** |

`EXECUTE` to `authenticated` only; `REVOKE` from `anon`/`PUBLIC` (mirror the `find_contact_dup` grants at `access-masking-v1b.sql:199-201`).

**⚠️ Two schema corrections to honour when you build this (both verified):**
- **`interaction` has no `updated_date`.** The verified columns are `occurred_at` and `created_at` (`projectStatus.ts:11-28`); the brief's "`updated_date`" does not exist on `interaction`. Use `max(occurred_at)` (fall back to `created_at`) for `last_activity`. **[UNCERTAIN — verify on live DB that no `updated_date` column was later added]**
- **"DNC" is NOT a value of `company_project_status.account_status`.** The only verified DNC token is `contact_status='do_not_contact'` in the status options seed (`feature-status-schema.sql:91`), i.e. it lives on the **contact** status, not the **company** account_status. So either (a) return `company_status` *and* the contact's `contact_status` (so a `do_not_contact` flag is visible), or (b) confirm with the owner that company-level DNC is represented some other way. **[UNCERTAIN — verify on live DB what `account_status` values actually carry a DNC meaning]**

**Acceptance:**
- A **non-owner** authenticated agent calling `find_contact_for_panel(<slug>, <project>)` gets `contact_name`, `company_name`, `company_status` (incl. DNC if set), `last_activity`, `owner_name`, and `details_hidden=true` — but `email`/`mobile_no`/`linkedin_url` come back **NULL**.
- An **owner** (or admin/QC/manager per `can_see_contact_details`) gets the same fields **plus** the real PII and `details_hidden=false`.
- No call path returns another owner's PII. The masking decision mirrors `contact_master_masked` exactly, so there is no new leak surface.
- Validated with a real non-admin agent login (not service-role).

### TODO-B — Company-assignment request → Team-Lead approval workflow *(an ALT-152 assignment mechanism — ties to TODO-4)*

**Why:** RLS gates contact writes on ownership. To let an agent work a company's contacts, ownership must be re-pointed to them. The cleanest, governed way is a **request → TL approval** that, on approve, re-points ownership — which is exactly one of the assignment mechanisms ALT-152/ADR-21 needs.

**Reuse the verified existing approval pattern** — do **not** invent a new one:
- **Pattern = status-on-row, not a separate queue table.** Lead approvals are a `report_approval` varchar (`'Pending'`/`'Approved'`/`'Rejected'`) on `lead_report` (`schema.sql:311-328`), driven by `requestApproval()` (`leadWorkspace.ts:761`), `approveReport()`/`rejectReport()` (`approvals.ts:352,438`). **No meeting-approval flow exists** (`meeting_master`/`meeting_schedule` have no approval fields — verified NOT FOUND), so `lead_report` is the template.
- **TL routing is already solved:** `notifyApproversOfRequest()` fans out to `project_user WHERE role_name IN ('TEAM_LEAD','ADMIN')` for the project, falling back to `profiles WHERE role IN ('ADMIN','TEAM_LEAD')` (`approvals.ts:527-561`). Hierarchy is **project-membership + `role_name`**, not a `reports_to` column (verified: no `manager_id`/`reports_to`).
- **Bell + email already wired:** in-app via `notifyInApp()` (`lib/notify.ts:64-97`) → `in_app_notification` (`schema.sql:213-232`), shown by the TopBar bell (`TopBar.tsx:179-217`) + `NotificationsPage.tsx`; email via `notify()` (`lib/notify.ts:28-54`) → `notify-service` `/notify` (`server.js:683-728`) with templates in `email-templates.js`.
- **Approval queue UI already exists:** `ApprovalsPage.tsx` (guarded to ADMIN/TEAM_LEAD), fed by `fetchPendingApprovals()` (`approvals.ts:116`). Extend it (or add a sibling tab) for company-assignment requests.

**Proposed schema + endpoints (to confirm with the owner):**
- New table `company_assignment_request` mirroring the `lead_report` approval shape: `request_id`, `company_id` (→ `company_master`), `project_id` (→ `project`), `requesting_user_id`, `target_owner_user_id` (usually = requester), `approval_status varchar` (`Pending`/`Approved`/`Rejected`), `reason`/`note`, standard `created_by/created_date/updated_by/updated_date` audit cols (as a tracked `.js`/`.cjs` applier, raw `.sql` gitignored). **[UNCERTAIN — confirm whether to add a table vs. a status column on an existing assignment table like `wishlist_assign`]**
- `requestCompanyAssignment(companyId, projectId, actor)` (extension calls this) → inserts a `Pending` row → `notifyApproversOfRequest()` (reuse) → in-app + email to the project's TLs/Admins.
- `approveCompanyAssignment(requestId, actor)` → set `Approved` + **re-point ownership** so RLS passes: set `company_project_status.owner_user_id` and the contacts' ownership (`contact_project_status.owner_user_id`, and/or `contact_master` ownership per the ALT-152 model) to the requester. **Must align with the ALT-152 write-gate fix (TODO-4)** — re-pointing only one of the three gates leaves the others `42501`.
- `rejectCompanyAssignment(requestId, reason, actor)` → set `Rejected` + notify requester (reuse `rejectReport` shape).

**Acceptance:**
- An agent submits a company-assignment request **from the extension**; a `Pending` row is created.
- The project's **Team Lead sees it in the CRM approval queue** (ApprovalsPage) and gets a **bell notification + email**.
- On **approve**, ownership re-points and the agent can then **see/edit** that company's contacts under the existing/ALT-152 RLS (reveal PII, write status + audit) — verified with a real agent login, no service-role.
- On **reject**, nothing changes and the requester is notified.

### TODO-C — Persist the project selection + expose it to the extension *(NOT a new selector — the CRM already has one)*

**Correction to the brief's premise:** the CRM web app **already has** a global project selector in the top panel — `ProjectSwitcher` rendered in `TopBar.tsx:150` (`{isInternalUser && <ProjectSwitcher />}`), backed by `ProjectContext` (`contexts/ProjectContext.tsx`). The selection is **already persisted to `localStorage`** per user:
- live selection key: `altleads:selected-project:<userId>` (`ProjectContext.tsx:35`)
- personal default key: `altleads:default-project:<userId>` (`ProjectContext.tsx:36`), settable on `SettingsPage.tsx:80-120`
- value is `'all'`/`'null'` (= no filter) or a numeric `project_id` string; on load it validates the stored id against `fetchMyProjects()` and falls back to "All" (`ProjectContext.tsx:99-154`).
- `AuthContext` exposes `profile.user_id` (so the extension can compute the key) but holds **no** project info — scope lives entirely in `ProjectContext` (`AuthContext.tsx:20-46`).

So TODO-C is mostly a **bridge**, not a build:

**Do:**
- **Persist as the user's default** (largely done via `defaultProjectKey` + Settings). Confirm the default-to-single-project behaviour: if the user has exactly one accessible project, default to it rather than "All". **[UNCERTAIN — verify current single-project default behaviour]**
- **Expose the current selection to the extension.** Since the extension authenticates as the same user (Option A) it can read `localStorage['altleads:selected-project:'+userId]` from a `crm.altleads.com` tab (A2/host-permission), but that is fragile (requires a tab open + knowing `userId`). **Recommended:** have the CRM emit a small, stable signal the extension can consume without scraping React state — e.g. (a) a `postMessage`/`window.postMessage({type:'ALT_PROJECT_CHANGED', userId, projectId})` on selection change, or (b) write a single canonical key like `altleads:active-context` = `{ userId, projectId }` that the extension reads. Pick one and document it so both sides agree. **[UNCERTAIN — owner/CRM Opus to choose the bridge mechanism]**

**Acceptance:**
- Changing the project in the CRM **or** in the extension scopes `contact_project_status` / `company_project_status` / meetings consistently in **both** surfaces (same `project_id` used by `getContactStatus(contact_id, project_id)`, `getCompanyStatus(companyId, projectId)`, and the meetings filter `m.projectId !== selectedProjectId` — all verified in `projectStatus.ts` / `MeetingsPage.tsx`).
- The user's choice persists across sessions (already true for the CRM via `localStorage`); a single-project user defaults to that project.
- The extension can read the current project **deterministically** via the agreed bridge, without reading React state or any LinkedIn DOM.

---

## 6. Open questions for the owner

1. **ALT-152 timing:** Phase-2 inline edit is hard-blocked until the assignment-based write model (ADR-21) lands **and aligns all three contact write gates**, validated with a real agent login. Is that fix scheduled before we want the extension's edit feature, or should Phase 2 ship later as a separate milestone?
2. **Masking vs. usefulness (TODO-A, was TODO-2):** ~~name + company only~~ — decided 2026-06-22: build `find_contact_for_panel` returning **company status (incl. DNC) + last activity + owner name**, PII still NULL for non-owners. Remaining sub-question: is company-level DNC carried on `company_project_status.account_status`, or should the panel surface the contact-level `do_not_contact` status instead? (verified DNC token is `contact_status='do_not_contact'`).
3. **SSO posture (A2):** OK for the extension to read the Supabase session from `crm.altleads.com` `localStorage` (host-permission SSO), or restrict to explicit email/password login in the popup (A1)?
4. **Project bridge (TODO-C):** the CRM already has the selector + `localStorage` persistence — which exposure mechanism do we standardise on for the extension: a `postMessage` on change, or a single canonical `altleads:active-context` key? And should a single-project user auto-default to that project?
4b. **Company-assignment approval (TODO-B):** add a new `company_assignment_request` table, or hang an `approval_status` column off an existing assignment table (e.g. `wishlist_assign`)? And does "approve" re-point **company-only** ownership or **company + all its contacts**?
5. **Atomic-write RPC (TODO-5):** OK to add a new SECURITY-INVOKER RPC to the migration set for atomic status+audit writes, or should the extension do sequential calls like the current web data layer?
6. **"Add to CRM" on no-match:** keep strictly admin/data-team only (outreach-only north-star), or allow behind a per-project config like the create-rights decision?
7. ~~**LinkedIn ToS / visible launcher**~~ — **RESOLVED 2026-06-22:** the extension does **NO** page injection and does **NOT** read `window.location`/the page DOM. It is an action-icon-only Chrome **side panel** that reads **only the active tab's address-bar URL** via the `"tabs"` permission. (LinkedIn banned the owner's users' personal accounts over injection.) No CRM-side work — listed here only so the boundary is unambiguous.
8. **Lowercase backfill (TODO-1):** confirm we may run the one-time `UPDATE contact_master SET linkedin_clean = lower(...)` and patch `deriveLinkedinClean()` — it is a low-risk data fix but touches production data, so it needs owner sign-off per the manual-deploy posture.

---

### Source references (all verified during this handoff)
- `new-code/web/src/data/contacts.ts` — `Contact` interface (10-11), `deriveLinkedinClean()` (47-54, **missing `.toLowerCase()`**), friendly `42501` string (286-293).
- `new-code/migration/access-masking-v1b.sql` — `find_contact_dup` definition + exact `linkedin_clean` match + grants (166-201); `contact_master_masked` view (93-114); `can_see_contact_details()` (62-83).
- `new-code/migration/access-rls-v1.sql` — `contact_master` write (209-218), `contact_project_status` write (231-256), `interaction` write incl. lead-only manager branch (307-314).
- Data/blueprint context: `new-code/web/src/data/projectStatus.ts`, `new-code/web/src/data/tasks.ts`, `new-code/web/src/pages/ContactDetailPage.tsx`, `docs/product/COMPANIES-CONTACTS-BLUEPRINT.md`, `docs/product/DECISIONS.md` (ADR-21), and the ALT-152 backlog ticket.

### Source references for the NEW TODOs A/B/C (verified 2026-06-22)
- **TODO-A:** `new-code/migration/feature-status-schema.sql` — `contact_project_status` incl. `owner_user_id` (22-35), `company_project_status` incl. `account_status` + `owner_user_id` (38-53), DNC token `('contact_status','do_not_contact',...)` (91). `new-code/migration/companies-contacts.sql` — `contact_master` incl. `created_by` (16-35). `new-code/migration/schema.sql` — `user_master.full_name` (≈762-793). `new-code/web/src/data/activityTimeline.ts` — owner-name resolution via `user_master` join (78-90). `new-code/web/src/data/projectStatus.ts` — `interaction` shape: `occurred_at`/`created_at`, **no `updated_date`** (11-28). NOT FOUND: a dedicated owner-name RPC; `interaction.updated_date`.
- **TODO-B:** `new-code/migration/schema.sql` — `lead_report` w/ `report_approval` (311-328), `in_app_notification` (213-232), `project_user` w/ `role_name` (597-610), `user_role` (795-801). `new-code/web/src/data/approvals.ts` — `fetchPendingApprovals` (116), `approveReport`/`rejectReport` (352/438), `notifyApproversOfRequest` (527-561). `new-code/web/src/data/leadWorkspace.ts` — `requestApproval` (761). `new-code/web/src/lib/notify.ts` — `notify` (28-54) + `notifyInApp` (64-97). `new-code/notify-service/server.js` — `/notify` (683-728). `new-code/web/src/pages/ApprovalsPage.tsx`, `NotificationsPage.tsx`, `components/layout/TopBar.tsx` (bell 179-217). NOT FOUND: any meeting-approval flow; any `reports_to`/`manager_id` column; a pre-existing `company_assignment_request` table.
- **TODO-C:** `new-code/web/src/components/layout/ProjectSwitcher.tsx`; rendered in `TopBar.tsx:150`; `new-code/web/src/contexts/ProjectContext.tsx` — keys `altleads:selected-project:<userId>` (35) / `altleads:default-project:<userId>` (36), hydration/validation (99-154). `new-code/web/src/pages/SettingsPage.tsx` — default-project setter (80-120). `new-code/web/src/contexts/AuthContext.tsx` — exposes `profile.user_id`, no project info (20-46). `new-code/migration/schema.sql` — table is named `project` (not `project_master`), 583-594. `new-code/web/src/pages/MeetingsPage.tsx` — `m.projectId !== selectedProjectId` filter. NOT FOUND: any `user_settings`/`user_preferences` DB table (scope is localStorage-only); a `project_master` table name.
