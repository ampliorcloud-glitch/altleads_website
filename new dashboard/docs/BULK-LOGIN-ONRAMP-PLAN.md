# Bulk-Login On-Ramp Plan — provisioning that guarantees a `profiles` row (RSK-10)

**Author:** engineer + release manager (DRAFTING / ANALYSIS ONLY — nothing applied, nothing queried, no email sent, no login provisioned).
**Date:** 2026-06-25.
**Owner action:** Ankit (PM) executes later. This is a review document.
**Why now (launch-critical):** the new assignee-RLS resolves the caller via `public.current_user_id()`, which reads the **sparse `public.profiles` table**. A provisioned auth login with **no matching `profiles` row** → `current_user_id()` returns NULL → every write predicate (`assignee_user_id = NULL`, `owner_user_id = NULL`, …) is **false** → that user is **silently denied ALL edits**. So bulk-login provisioning MUST also guarantee a correct `profiles` row for every active user, and we must **prove coverage before forcing RLS**. See `docs/LAUNCH-BLOCKER-RLS-PLAN.md` (Security-QC §, regression risk #1) and `docs/Amplior-Review-Hub.xlsx` RSK-10.

> Verified against real code: `new-code/notify-service/server.js`, `new-code/web/src/data/admin.ts`, `new-code/web/src/contexts/AuthContext.tsx`, `new-code/migration/access-rls-v1.sql`, `new-code/migration/apply-assignment-rls.cjs`. Where docs and code disagree, it is called out inline.

---

## 1. CURRENT STATE — how a login + `profiles` row get created today

There is **no dedicated "provision login" endpoint and no bulk endpoint**. Two admin-only endpoints in `new-code/notify-service/server.js` (both behind `requireAdmin`, both using the **service-role** client `getSupabaseAdmin()`):

### 1a. `POST /api/users/create` (`server.js:741`) — for *new* users
Per call it: derives the actor from the caller's `profiles.user_id` (`:782-789`) → `INSERT user_master` (`:807`) → `INSERT user_role` (`:829`) → generates a 12-char temp password (`genTempPassword()`, `:45`) → `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm:true })` (`:849`) → **then calls `ensureProfileLink(...)`** (`:869`) → returns `{ ok, user_id, tempPassword }` (`:879`). The temp password is **returned in the response body** (admin reads it out / hands it over); **no email is sent** by this endpoint.

### 1b. `POST /api/users/reset-password` (`server.js:903`) — the BULK-PROVISION path for the ~110 legacy users
This is the one that matters for launch ("only ~1 of 111 had a login"). Per call, given `{ user_id }` and/or `{ email }`:
1. Resolve `email + full_name` from `user_master` (`:923-934`). If no email on file → 404 `"add an email before setting a password"` (`:935`).
2. Generate a temp password (`:940`).
3. `findAuthUserByEmail()` (`:63`, pages `listUsers`) — if an auth account exists, `updateUserById({ password, email_confirm:true })` (`:948`); **else `auth.admin.createUser(...)` creates a fresh login** (`:957`). So this single endpoint **provisions a login for a legacy user that never had one** (`created=true`).
4. **`ensureProfileLink(...)`** (`:973`) to (re)link the auth uid → numeric `user_id`.
5. Returns `{ ok, tempPassword, created }` (`:978`). **No email sent**; temp password returned in body.

### 1c. `ensureProfileLink()` (`server.js:81`) — DOES create the `profiles` row, but **best-effort**
This is the crux of CURRENT STATE. It:
- Resolves the role name from the user's **most-privileged** (`MIN(role_id)`) live `user_role` row → `role_master.name` (`:84-93`).
- Builds `row = { id: authUid, email }`, and conditionally adds `user_id` (only `if (userId != null)`, `:95`), `full_name` (`:96`), `role` (only `if (roleName)`, `:97`).
- `admin.from('profiles').upsert(row, { onConflict: 'id' })` (`:98`).
- **Wrapped in try/catch that only logs** (`:99-102`) and is documented "Best-effort: logs and continues on failure (never blocks the password action)" (`:79`).

**CURRENT-STATE VERDICT:** Today's provisioning **does** create BOTH an auth user AND a `profiles` row carrying `{ id: auth.uid, user_id, role }` — for **both** endpoints. **BUT** three gaps make it unsafe to rely on for RSK-10 coverage:

- **G-A — Best-effort, never asserted.** The `profiles` upsert can silently fail (caught + logged, `:99`) while the password action **succeeds and returns 200**. Result: a working login with **no/partial `profiles` row** → `current_user_id()` NULL → silent total edit-deny. The HTTP 200 gives false confidence.
- **G-B — `user_id` / `role` are conditional.** If `userId == null` (e.g. reset-by-email where `user_master` lookup missed) the upsert writes a `profiles` row with **NULL `user_id`** → `current_user_id()` NULL anyway. If the user has **no live `user_role`** row, `role` is omitted → `is_admin()`/role gating misbehaves. Both pass without error.
- **G-C — No bulk runner, no coverage proof.** `resetUserPassword(userId)` (`admin.ts:782`) calls the endpoint **once per user_id**; there is **no loop / CSV / "provision all active users" action** anywhere in the repo. So "bulk" today = an admin clicking reset 110 times, with **no post-run assertion** that every active user now resolves via `current_user_id()`.

> Doc vs code: `INTERNAL-LAUNCH-PLAN.md:40` sizes "Provision logins" at "½ session" and does not mention the `profiles`-coverage assertion — this plan adds the missing dry-run + coverage gate that RSK-10 requires.

---

## 2. THE DRY-RUN (read-only) — REPORT coverage, change nothing

**DO NOT EXECUTE.** This section is a runnable read-only report the owner can run later (psql against the service-role/PG connection in `.credentials/`, or wired as a new `GET /api/users/coverage-report` read endpoint guarded by `requireAdmin`). Every statement below is `SELECT`-only. It deliberately covers the THREE silent-deny sources: missing auth login, missing `profiles` row, and NULL/mismatched `user_id`/`role`.

> Auth users live in `auth.users` (uuid `id`, `email`). The bridge is `public.profiles (id uuid = auth.uid, user_id bigint, role text)`. "Active" = `user_master.enabled = true` and not soft-deleted. Confirm the exact active/deleted predicate with the owner (Open Q-5) before running.

```sql
-- =====================================================================
-- BULK-LOGIN COVERAGE DRY-RUN  (READ-ONLY — runs zero writes)
-- Run as service_role / DB owner so auth.users is visible.
-- =====================================================================

-- (0) Define "active" once. Adjust the predicate per Open Q-5.
--     Using a CTE keeps every count consistent.
WITH active_users AS (
  SELECT um.user_id, lower(trim(um.email)) AS email, um.full_name, um.enabled
  FROM public.user_master um
  WHERE um.enabled = true
    AND um.email IS NOT NULL AND trim(um.email) <> ''
    -- AND um.deleted_date IS NULL   -- include if the column exists / is used
)
SELECT count(*) AS active_user_count FROM active_users;   -- expect ~111

-- (a) ACTIVE users with NO auth login (cannot sign in at all):
WITH active_users AS ( /* same CTE as (0) */
  SELECT um.user_id, lower(trim(um.email)) AS email
  FROM public.user_master um
  WHERE um.enabled = true AND um.email IS NOT NULL AND trim(um.email) <> ''
)
SELECT au.user_id, au.email
FROM active_users au
LEFT JOIN auth.users a ON lower(a.email) = au.email
WHERE a.id IS NULL
ORDER BY au.user_id;
-- COUNT of this list = users still needing a login provisioned.

-- (b) AUTH users with NO profiles row (the RSK-10 core: can log in, current_user_id()=NULL):
SELECT a.id AS auth_uid, a.email
FROM auth.users a
LEFT JOIN public.profiles p ON p.id = a.id
WHERE p.id IS NULL
ORDER BY a.email;

-- (c) PROFILES rows with a NULL or mismatched user_id / role
--     (login works but current_user_id() resolves wrong/NULL, or role gating is off):
SELECT p.id AS auth_uid, p.email, p.user_id, p.role,
       um.user_id AS user_master_user_id,
       rl.expected_role
FROM public.profiles p
LEFT JOIN public.user_master um ON lower(um.email) = lower(p.email)
LEFT JOIN LATERAL (
  -- the role ensureProfileLink WOULD write: most-privileged live role name
  SELECT rm.name AS expected_role
  FROM public.user_role ur
  JOIN public.role_master rm ON rm.role_id = ur.role_id
  WHERE ur.user_id = p.user_id AND ur.deleted_date IS NULL
  ORDER BY ur.role_id ASC
  LIMIT 1
) rl ON true
WHERE p.user_id IS NULL                                   -- NULL bigint -> current_user_id() NULL
   OR (um.user_id IS NOT NULL AND p.user_id IS DISTINCT FROM um.user_id)  -- points at wrong user
   OR p.role IS NULL                                      -- no role -> is_admin()/gating off
   OR (rl.expected_role IS NOT NULL AND p.role IS DISTINCT FROM rl.expected_role)
ORDER BY p.email;

-- (d) THE RSK-10 EXPOSURE LIST — provisioned-but-profileless / unresolvable ACTIVE users
--     who WOULD be silently denied all edits the moment FORCE RLS lands.
--     = has an auth login, but profiles cannot resolve a valid user_id.
WITH active_users AS ( /* same CTE as (0) */
  SELECT um.user_id, lower(trim(um.email)) AS email, um.full_name
  FROM public.user_master um
  WHERE um.enabled = true AND um.email IS NOT NULL AND trim(um.email) <> ''
)
SELECT au.user_id, au.email, au.full_name,
       a.id AS auth_uid,
       p.id IS NOT NULL AS has_profile,
       p.user_id        AS profile_user_id,
       p.role           AS profile_role
FROM active_users au
JOIN auth.users a   ON lower(a.email) = au.email         -- has a login
LEFT JOIN public.profiles p ON p.id = a.id
WHERE p.id IS NULL                 -- no profiles row at all
   OR p.user_id IS NULL            -- profile exists but user_id NULL
   OR p.user_id IS DISTINCT FROM au.user_id   -- profile points at the wrong user
ORDER BY au.user_id;
-- GO/NO-GO: this list MUST be empty before FORCE RLS (see §4).

-- (e) Bonus self-check: does current_user_id() resolve for a sample?
--     (read-only probe; do NOT commit) — confirms the join chain end-to-end.
--   BEGIN;
--     SET LOCAL request.jwt.claims = '{"sub":"<an auth_uid from (d)>"}';
--     SELECT public.current_user_id();   -- NULL here == this user is silently denied
--   ROLLBACK;
```

**What the four counts tell the owner:**
- (a) = how many of the ~111 still need a **login** created.
- (b) = auth users (legacy or freshly provisioned) with **no profiles row** at all.
- (c) = profiles that exist but are **NULL/mismatched** on `user_id` or `role`.
- (d) = the **RSK-10 exposure list** — the exact people who would silently lose all edit rights at FORCE. This is the go/no-go list.

---

## 3. THE ONE-BUTTON PROVISIONING FLOW (safe, idempotent, re-runnable)

Goal: one admin action — **"Provision logins for all active users"** — that for EACH active user guarantees (auth login) AND (correct `profiles` row), produces a CSV/preview, and ends with a coverage assertion. Build it as a new endpoint that loops the *existing, proven* per-user logic, but upgrades `ensureProfileLink` from best-effort to **must-succeed-or-report**.

### 3a. Per-user steps (idempotent)
For each active `user_master` row (has email):
1. **Auth login:** `findAuthUserByEmail()` → if exists, optionally `updateUserById` (only if (re)setting password); else `auth.admin.createUser({ email, password: temp, email_confirm:true })`. (Reuse `reset-password` logic verbatim.)
2. **Temp password vs reset-link:** per Open Q-1 — either set a temp password (returned for hand-off, current behavior) **or** generate a reset/recovery link (`auth.admin.generateLink`) and email it. Pick ONE policy before running.
3. **`profiles` upsert — STRICT:** upsert `{ id: authUid, user_id, role, email, full_name }` where:
   - `user_id` is **required** (resolved from `user_master`); if it cannot be resolved → **fail that user, record the error, do NOT 200**. (Closes G-B.)
   - `role` resolved from most-privileged live `user_role`; if the user has **no role** → record a warning and surface it (a user with no role is itself a data bug to fix before launch).
   - On upsert error → **collect into a failures list**, do NOT swallow. (Closes G-A.)
4. **Per-user verdict:** `provisioned | already_ok | failed(reason)`.

### 3b. Idempotency / re-runnability
- Auth: create-if-missing (the `findAuthUserByEmail` → update/create branch already is idempotent).
- `profiles`: `upsert(..., { onConflict: 'id' })` is idempotent.
- Re-running on an already-correct user → `already_ok`, no password change unless explicitly `--reset-passwords`.
- Service-role client has BYPASSRLS, so this flow is unaffected by FORCE RLS (it can run before or after the schema work).

### 3c. CSV / preview (before commit)
- **Preview (dry-run mode):** returns the §2 report — who will get a new login, who already has one, who has a missing/NULL/mismatched profile, who has no email/role — **without writing anything**. Owner reviews, then runs for real.
- **Run output CSV:** one row per active user: `user_id, email, full_name, role, login_action (created|reset|existing), profile_action (created|updated|ok), temp_password_or_reset_link, status`. Temp passwords/links are sensitive — write to a gitignored location only, hand off securely (never commit; `.xlsx`/CSV with secrets stay local per CLAUDE.md §2).

### 3d. Post-run coverage assertion (the proof)
After the loop, re-run §2 query (d). The action is only **green** when:
- §2(a) exposure (active users with no login) = **0**, AND
- §2(d) exposure (login but unresolvable profile) = **0**.

Emit the assertion result in the response: `{ active: N, logins_created: x, profiles_fixed: y, exposure_remaining: 0 }`. **If `exposure_remaining > 0`, the action reports NOT-SAFE-TO-FORCE and lists the offenders.**

### 3e. Test posture
All test emails/links go to `ankit.s@amplior.com` (never mohit) per CLAUDE.md §3. Validate the flow against a throwaway user first; never test against live agents' inboxes.

---

## 4. SEQUENCING vs the RLS fix — coverage BEFORE force (RSK-10)

The bulk-login work and the assignee-RLS work are **coupled**: forcing RLS on a profile-less user silently bricks them. Order:

```
1. (login provisioning + profiles coverage)  -- §3, run in DRY-RUN then for real
2. PROVE coverage: §2(a) = 0  AND  §2(d) = 0   <-- GO/NO-GO GATE for RSK-10
3. Land assignee_user_id canonical model + backfill  (LAUNCH-BLOCKER-RLS-PLAN §2, steps S1-S6)
4. Validate on throwaway logins (RLS plan §3 matrix)
5. ONLY THEN: S7 FORCE RLS + anon REVOKE   <-- the irreversible-feeling, high-blast-radius step
```

**GO/NO-GO check before any FORCE:** re-run §2 query (d) live. **It must return zero rows.** If non-empty, FORCE is blocked — every listed user would be silently denied all edits. Re-run §3 provisioning to clear them, re-check, then proceed.

> Note: `current_user_id()` itself is **not** newly forced — the danger is purely that the *write policies* (which all reference it) evaluate to false for a NULL result once the blanket `authenticated_full_access` policy is replaced. So the gate must pass **before the policy swap (S5)**, not only before FORCE (S7). Safest reading: **profiles coverage proven before S5.**

The throwaway-login harness in the RLS plan provisions through the real auth path (which runs `ensureProfileLink`), so it will **NOT** reproduce the production profile-less case — that is exactly why this independent §2 coverage report against **live `auth.users` × `profiles`** is mandatory (RLS plan Security-QC #1 makes the same point).

---

## 5. OPEN QUESTIONS for the owner

1. **Temp-password vs reset-link policy.** Today both endpoints **set a temp password and return it in the response (no email)**. For ~110 users, do you want (a) temp passwords handed off out-of-band, or (b) a Supabase reset/recovery **link emailed** to each user (`generateLink`)? This changes the on-ramp and whether any email is sent at all.
2. **Which roles get a WEB (CRM) login vs a SALES/PORTAL login?** `AuthContext.tsx:15-18` splits `SALES_ROLE_NAMES = [SALES_HEAD, SALES_PERSON]` (portal `/sales`) from `INTERNAL_ROLE_NAMES = [ADMIN, TEAM_LEAD, AGENT, QC]` (CRM). Provisioning is auth-account-level (one login serves both), but should the bulk run include sales roles 4/5 now, or only internal roles 1/2/3/6 for the internal launch?
3. **`is_web=false` sales roles (CLAUDE.md §3).** Sales roles are flagged `is_web=false`. Do they need a Supabase Auth login + `profiles` row at all for the *internal CRM* launch, or are they entirely portal-side (separate on-ramp)? If they get logins, they still need a `profiles` row or they'd hit the same RSK-10 deny in any shared table.
4. **Inactive / duplicate `user_master` rows.** Define "active" precisely: is `user_master.enabled = true` sufficient, or is there a soft-delete column to also filter? How to handle **duplicate emails** (the dry-run's email-join would double-count) and rows with **no email** (reset-password 404s today)? These must be excluded/cleaned before the run so the coverage count is trustworthy.
5. **Users with NO live `user_role` row.** `ensureProfileLink` omits `role` when there's no role. Should provisioning **block** such users (data bug), default them to a safe role, or provision login-without-role and fix roles separately? (A roleless profile breaks `is_admin()` and any role-gated policy.)
6. **Where do temp passwords / reset links land?** Confirm the secure hand-off channel and that the run CSV (with secrets) stays in a gitignored local path only (CLAUDE.md §2 — never commit secrets/`.xlsx`/CSV with credentials).

---

## Appendix — verified code vs docs

- `ensureProfileLink` upserts `{ id, user_id, role, email, full_name }` — **CONFIRMED** `server.js:94-98`. Contradicts any assumption that provisioning creates "only an auth user": it creates **both** today.
- It is **best-effort / non-blocking** — **CONFIRMED** `server.js:79, 99-102`. This is the RSK-10 hole: 200 OK does not guarantee a profile.
- `reset-password` **creates a login for legacy users that lack one** — **CONFIRMED** `server.js:956-969` (`created=true` branch).
- **No bulk endpoint / no CSV loop** in repo — **CONFIRMED**: `admin.ts:782 resetUserPassword(userId)` is strictly per-user; nothing iterates all users.
- `current_user_id()` reads `profiles` (caller bigint) — consistent with `AuthContext.fetchProfile` (`AuthContext.tsx:67-75`) and `access-rls-v1.sql:31` ("helpers already present: current_user_id() bigint"); the function body predates these migration files (defined in the live DB, not in the tracked `.sql`).
- `INTERNAL-LAUNCH-PLAN.md:40` ("Provision logins … ½ session") **omits** the profiles-coverage assertion this plan adds — doc gap, now covered by §2/§4.
