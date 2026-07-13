# AltLeads CRM — Security Audit

**Date:** 2026-06-17
**Scope:** Web app (`new-code/web`), email/admin service (`new-code/notify-service`), and the live Supabase database (`puvozfhypqbwbmbhrhcr`).
**Method:** Source review + read-only checks against the live database and the public API. No data was modified and no live exploit was run.

---

## 1. Executive Summary (plain language)

**Your specific worry — "can a user see other people's data by poking at the URL or the network tab?" — is correct, and it is the single biggest problem we found.** Today, the answer is yes.

Here is the situation in plain terms:

- The app **looks** like it shows each salesperson only their own leads, contacts and companies. But that filtering happens **only in the browser** — it is cosmetic. The database itself has **no rule that stops one logged-in user from reading or changing everyone else's records.**
- Any logged-in salesperson can open the browser's developer tools, copy the access token the app already gave them, and ask the database directly for **all 607 leads, all 608 contacts, all 525 companies** — every owner, every project — including names, emails, phone numbers, LinkedIn URLs, deal values and pipeline stage. The same trick lets them **edit or delete** other reps' records, silently.
- It gets worse: a logged-in user can **promote themselves to ADMIN** by writing one row to the permissions table, because that table is wide open too. Once "admin," every screen and approval unlocks.
- Separately, two **server endpoints used to create users and reset passwords are completely unprotected**. Anyone on the internet who knows the web address — no login at all — can create a brand-new ADMIN account (the password is handed back to them in the response) or reset the password of any existing account, including yours, and take it over. This is the most severe issue because it needs **zero credentials**.
- There is also an **open email relay**: anyone can make your CRM send branded, legitimate-looking email from the Amplior Gmail to any address, with no login. That risks phishing in your name and getting the Gmail account suspended for spam.

**The good news / what is NOT broken:**

- **Anonymous (not-logged-in) outsiders cannot read your data directly** through the normal database API — the database correctly blocks the "public" key for reading tables. The exposure above requires *a login* (or it comes through the unprotected user-creation endpoint, which itself hands out a login).
- Your **secret keys are stored correctly** — the powerful "service" key and the Gmail password live only on the server, are not shipped to the browser, and were never committed to GitHub. The frontend ships only the safe public key, which is by design.
- The legacy plaintext-password column in the old user table is **not readable** through the API (the database blocks that specific column), which limits one of the scarier-sounding scenarios.

**Bottom line:** The architecture is sound and the secrets are handled well, but the **authorization layer was never built** — the team intentionally shipped a "everyone-can-do-everything once logged in" baseline as a placeholder, and a couple of admin endpoints went out with no lock on the door at all. **This must be fixed before more salespeople are onboarded or before this is treated as production.** The fixes are well understood and listed below, ordered by priority. The four "hard gate" items in Section 5 should block go-live.

---

## 2. Prioritized Findings

Overlapping findings from the audit have been consolidated. The core problems are: **(A)** the database has no per-user/per-project access rules; **(B)** two server endpoints run as god-mode with no login check; **(C)** all role/permission checks happen only in the browser; **(D)** an open email relay; plus several smaller hardening gaps.

| # | Severity | Title | How it's exploited | Fix (summary) |
|---|----------|-------|--------------------|---------------|
| 1 | **Critical** | No data isolation — every logged-in user can read/write **every row in every table** (all RLS policies are `USING(true)`) | Copy your session token from DevTools/Network tab, call the public REST API directly → receive all leads/contacts/companies; PATCH/DELETE edits others' data | Replace blanket `USING(true)` policies with per-row, identity-scoped policies keyed on `created_by`/`owner_user_id`/project membership + an `is_admin()` check |
| 2 | **Critical** | Privilege escalation — any logged-in user can **self-assign ADMIN** (`user_role`), rewrite the permission matrix (`rbac_master`), and tamper with other users (`user_master`: disable/email-change/delete) | `POST /rest/v1/user_role {"user_id":<self>,"role_id":1}` → ADMIN on next login (trigger stamps `profiles.role='ADMIN'`) | Make `user_role`/`rbac_master`/`user_master` writes admin-only (or server-only via service key); revoke broad INSERT/UPDATE/DELETE/TRUNCATE from `authenticated` |
| 3 | **Critical** | **Unauthenticated** user-creation endpoint `POST /api/users/create` runs with the service-role key (bypasses all DB rules) and returns a plaintext temp password | `curl` the deployed URL with `{"email":"attacker@x","role_id":1}` → get a working ADMIN login back, no credentials needed | Require + verify a Supabase admin JWT before any service-role action; stop returning plaintext passwords (email an invite/set-password link) |
| 4 | **Critical** | **Unauthenticated** password reset `POST /api/users/reset-password` resets **any** account and returns the new plaintext password | `curl .../api/users/reset-password -d '{"email":"ceo@amplior.com"}'` → new password in the response → full account takeover | Same: verify admin JWT (or scope self-service to own account); never return the password; use Supabase recovery-email flow |
| 5 | **Critical** | All authorization is **client-side only**; every privileged action (approvals, user enable/disable, role change) is a plain API write with the user's token | A non-admin issues the same PostgREST write the admin UI would (e.g. approve own report, disable a colleague) — the React `isAdmin` gate never reaches the server | Enforce roles server-side via RLS predicates / RPCs; never trust `profile.role` from the client for authorization (depends on #1, #2) |
| 6 | **High** | **Open email relay** `POST /notify` — no auth, no rate limit; sends branded DKIM-signed mail from the Amplior Gmail to any/many recipients | `curl .../notify -d '{"event":"...","to":"victim1,victim2,..."}'` → phishing-grade branded email; spam volume risks Gmail suspension | Authenticate `/notify` (verify JWT), allow-list/validate `to`, add per-IP/per-account rate limiting, cap recipients |
| 7 | **High** | Self-signup may let **anyone become a full-access authenticated user** (confirmed: signup is **enabled**, email-confirm required) | `supabase.auth.signUp(...)` with the public anon key → confirm email → inherit full read/write per #1 and self-ADMIN per #2 | Disable public email self-signup in Supabase Auth (invite/admin-create only); mandatory while #1 is open |
| 8 | **Medium** | No security headers (no `helmet`) on the Express server that also serves the SPA | App is frameable (clickjacking); MIME-sniffing; no HSTS (TLS-strip) | Add `helmet()` + CSP + HSTS; mirror the `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy` already set in `netlify.toml` |
| 9 | **Medium** | Session tokens in `localStorage` (default) — XSS-exfiltratable, long-lived refresh token | Any XSS reads `localStorage` → steals access+refresh token → long-lived session; with #1 = full data access | Prefer httpOnly/Secure/SameSite cookie storage (Supabase SSR); strict CSP; audit any `dangerouslySetInnerHTML`; shorten JWT lifetime |
| 10 | **Medium** | `dropdown_option` is admin-only in the UI but **any authenticated user can write it** via the API | Non-admin injects bogus dropdown values or disables real statuses (e.g. "Won") → corrupts forms/reporting app-wide | Keep SELECT open; restrict INSERT/UPDATE/DELETE to `is_admin()`; don't rely on the client `Restricted()` gate |
| 11 | **Low** | `user_view_pref` policy named "auth own" is actually `USING(true)` — read/overwrite anyone's saved column views | API call with another `user_id` enumerates/overwrites colleagues' saved layouts (nuisance/tamper) | Rewrite policy to `user_id = current_user_id()` for USING and WITH CHECK |
| 12 | **Low** | Temp passwords use `Math.random()` + biased sort-shuffle (not cryptographically secure) | Weak generator; secondary because the password is returned in-band anyway | Use `crypto.randomInt`/`randomBytes` + Fisher-Yates; better: don't generate/return passwords — send a set-password link |
| 13 | **Low** | CORS allow-list mistaken for access control (browser-only) | `curl`/Postman ignore CORS entirely — gives no protection on state-changing routes | Set `ALLOWED_ORIGIN` to the real prod origin for browser hygiene, but enforce JWT/admin checks server-side regardless |
| 14 | **Low** | No body-size limit on `express.json()`; unauthenticated routes reachable | Repeated large JSON POSTs → memory/CPU pressure on the single-process server | `express.json({ limit: '16kb' })` + rate limiter on `/notify` and `/api/*` |
| 15 | **Low** | Real Supabase project-ref and Gmail sender address in tracked example/doc files | Project-ref is already public in the anon JWT; Gmail address aids phishing/credential-stuffing targeting | Genericize `.env.example` and replace the concrete Gmail address with a placeholder (doc hygiene) |
| — | Info | **Verified clean:** service-role key & Gmail password are server-only and never committed; frontend ships only the anon key; `.gitignore` covers `.env`/`.credentials`/`.mcp.json`; anon role is correctly locked out of table reads; `handle_new_auth_user` trigger has no injection and does not let signup metadata set the role; legacy `password` column is **not** readable via the API | n/a | Keep current discipline; optionally add a CI secret-scanner + a build check that fails if a `service_role` JWT appears in `dist/` |

**Note on the "per-project notes" findings:** the audit raised these (`interaction`, `contact_project_status`, `company_project_status`) once as Critical and once as High. They are the **same root cause as Finding #1** (blanket `USING(true)`) and are fixed by the same per-row policy work — see the remediation for #1. Their independent severity is **High** (internal-team horizontal read/write of private call/meeting notes and dispositions), not Critical, because exposure is to logged-in staff, not the anonymous internet, and there is currently little data in those tables. They are folded into #1 below.

---

## 3. Remediation Plan (ordered by priority)

### Priority 0 — Lock the unauthenticated god-mode endpoints (Findings #3, #4, #6)
**Why first:** these need **no credentials** and are the fastest path to total compromise. This is a code change in `new-code/notify-service/server.js` and can ship immediately, independently of the database work.

Add an admin-auth gate in front of `/api/users/create` and `/api/users/reset-password`, and an auth gate (+ allow-list + rate limit) in front of `/notify`:

```js
// new-code/notify-service/server.js
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Verify the caller's Supabase session and load their role from the DB (server-side, trusted).
async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'invalid token' });

  // Trust the DB, not anything in the request body, for the role.
  const { data: prof } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();
  if (!prof || prof.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });

  req.actorUserId = user.id;     // use THIS as created_by, never req.body.created_by
  next();
}

app.post('/api/users/create',         requireAdmin, /* existing handler */);
app.post('/api/users/reset-password', requireAdmin, /* existing handler */);
```

Additional changes on these routes:
- **Stop returning plaintext passwords** in the response body. Use Supabase `inviteUserByEmail` / `generateLink` (recovery) so the new user sets their own password out-of-band.
- **Derive `created_by` from `req.actorUserId`**, not from the request body (prevents forged audit trails — Finding "mass-assignment").
- For `/notify`: require a valid JWT (the app only calls it for logged-in actions), validate `to` is a single well-formed address (optionally restrict to `@amplior.com` for staff notifications), cap recipients, and add `express-rate-limit`.
- After locking the routes, **rotate the service-role key and the Gmail app password** — they have effectively been usable by anyone who could reach the server.

The frontend callers (`web/src/data/admin.ts`) must be updated to send `Authorization: Bearer <session token>` with these requests.

### Priority 1 — Disable public self-signup (Finding #7)
A one-click dashboard change, mandatory while the database is still `USING(true)`. **Supabase → Authentication → Providers/Settings → turn off public sign-ups** (invite/admin-created users only). Confirmed currently enabled (`disable_signup: false`).

### Priority 2 — Build real database access rules (Findings #1, #2, #5, #10, #11, and the per-project-notes findings)
**This is the big one.** Replace every blanket `FOR ALL TO authenticated USING(true) WITH CHECK(true)` policy with per-row, identity-scoped policies. The schema already has the columns needed: data tables carry `created_by`, `owner_user_id`, `project_id`, `client_assoc_id`, and `profiles` bridges the auth login (`auth.uid()`, uuid) to the numeric `user_id` (bigint).

**Step 2a — helpers** (resolve identity and admin status server-side):

```sql
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_role ur
    JOIN profiles p ON p.user_id = ur.user_id
    WHERE p.id = auth.uid()
      AND ur.role_id IN (1)            -- 1 = ADMIN (extend with TEAM_LEAD ids if they should see all)
  )
$$;
```

**Step 2b — data tables** (lead/contact/company/interaction/project-status), scoped by owner **and** project membership so teammates on a shared project still collaborate, but cross-project/cross-owner is denied. Example for `lead_master`:

```sql
DROP POLICY authenticated_full_access ON lead_master;

CREATE POLICY lead_select ON lead_master FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR created_by = public.current_user_id()::text
  OR project_id IN (
      SELECT project_id FROM client_assoc_user WHERE user_id = public.current_user_id()
  )
);

CREATE POLICY lead_write ON lead_master FOR ALL TO authenticated
USING (
  public.is_admin()
  OR created_by = public.current_user_id()::text
  OR project_id IN (
      SELECT project_id FROM client_assoc_user WHERE user_id = public.current_user_id()
  )
)
WITH CHECK (
  public.is_admin()
  OR created_by = public.current_user_id()::text
);
```

Repeat the same pattern for `contact_master`, `company_master`, `interaction`, `contact_project_status`, `company_project_status` — the last three key on their existing `owner_user_id`/`project_id` columns, with a strict `WITH CHECK (owner_user_id = public.current_user_id())` so a user can only create rows they own. (Confirm `client_assoc_user` is the correct project-membership mapping during implementation; substitute the real assignment table if different.)

**Step 2c — control-plane tables** (`user_role`, `rbac_master`, `user_master`) — must **not** be client-writable at all:

```sql
DROP POLICY authenticated_full_access ON user_role;
CREATE POLICY user_role_select ON user_role FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = public.current_user_id());
-- No INSERT/UPDATE/DELETE policy for authenticated → all role changes go through
-- the admin-gated server endpoint using the service-role key.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON user_role, rbac_master, user_master FROM authenticated, anon;

-- Legacy plaintext credentials no longer needed (auth lives in Supabase Auth):
ALTER TABLE user_master DROP COLUMN password;
```

**Step 2d — smaller tables:** `dropdown_option` (SELECT open, writes `is_admin()` only — Finding #10) and `user_view_pref` (`USING (user_id = public.current_user_id())` — Finding #11). Tighten the `profiles` SELECT policy so a user reads only their own row (or admins read all) to stop enumeration of every user's UUID/email/role.

**Step 2e — move privileged mutations server-side** (Finding #5): approvals, user enable/disable, and role changes should go through admin-gated server endpoints or Postgres RPCs that re-check the role — never rely on the React `isAdmin` gate.

**Roll-out caution:** these policies change what the app can read/write. Test against a copy first, verify each role can still do its legitimate work, then apply. Keep the client-side filters in `data/*.ts` as defence-in-depth, but the database is now the real boundary.

### Priority 3 — Hardening (Findings #8, #9, #12, #13, #14, #15)
- Add `helmet()` + CSP + HSTS to the Express app (#8).
- Move session storage to httpOnly cookies where feasible; add CSP; audit `dangerouslySetInnerHTML` (#9).
- Replace `Math.random()` password generation with `crypto` (or eliminate it via invite links) (#12).
- Set `ALLOWED_ORIGIN` to the real production origin; treat all routes as if any client can call them (#13).
- `express.json({ limit: '16kb' })` + rate limiting on `/notify` and `/api/*` (#14).
- Genericize the project-ref and Gmail address in tracked example/docs (#15).
- Optional but recommended: pre-commit secret scanner (gitleaks/trufflehog) and a CI check that fails the build if a `service_role` JWT appears in `dist/`.

---

## 4. Deduplication note

The source audit listed several findings that are different symptoms of the **same three root causes**. They have been consolidated as follows:

- **Blanket RLS / no data isolation** (orig. findings 1, 2, 9, and both per-project-notes findings) → **Finding #1** (+ #10/#11 are smaller instances). Fixed by Priority 2.
- **Unauthenticated user-create endpoint** (orig. 1, 5, 7, and the "mass-assignment / role self-assign" finding) → **Finding #3**. Fixed by Priority 0.
- **Unauthenticated password-reset endpoint** (orig. 6 and its duplicate) → **Finding #4**. Fixed by Priority 0.
- **Service-role reachable via unauthenticated routes** (orig. 4, 8) → covered by **Findings #3/#4**; the remediation is the same admin-JWT gate.
- **Privilege self-assignment via `user_role`** → folded into **Finding #2**.

---

## 5. Hard gates before go-live vs. follow-up

### HARD GATES — must be fixed before more users are onboarded / before this is "production":
1. **Finding #3 + #4** — lock the unauthenticated `/api/users/create` and `/api/users/reset-password` endpoints behind an admin-JWT check (Priority 0). *Zero-credential full takeover.*
2. **Finding #7** — disable public self-signup (Priority 1). *One dashboard toggle; prevents anyone minting a full-access account while #1 is open.*
3. **Finding #1 / #2 / #5** — real per-row + admin RLS, and control-plane tables made non-client-writable (Priority 2). *This is the fix for your exact concern: stop one user reading/changing everyone's data via URL/network, and stop self-promotion to ADMIN.*
4. **Finding #6** — authenticate + rate-limit `/notify` (Priority 0, same code change). *Open relay = brand-phishing + Gmail suspension risk.*
5. **Rotate** the service-role key and Gmail app password once the routes are locked.

### FOLLOW-UP — important but can land shortly after go-live:
- **#10, #11** — `dropdown_option` and `user_view_pref` policies (ship with the Priority 2 SQL if convenient).
- **#8** — security headers (`helmet`/CSP/HSTS).
- **#9** — cookie-based session storage + CSP.
- **#12** — cryptographic password generation (or eliminate via invite links).
- **#13, #14, #15** — CORS origin, body-size limit + rate limiting, doc hygiene.
- **Info items** — keep the verified-clean secret discipline; add CI secret-scanning.

---

## Remediation status

_Last updated: 2026-06-17_

### What is now fixed

| Area | What was done |
|------|---------------|
| **Unauthenticated user-create endpoint** (Finding #3) | `/api/users/create` now requires a valid Supabase Bearer token and verifies server-side that the caller holds the ADMIN role before any service-role action is taken. `created_by` is derived from the verified token, not from the request body. |
| **Unauthenticated password-reset endpoint** (Finding #4) | `/api/users/reset-password` is behind the same `requireAdmin` JWT gate. |
| **Open email relay** (Finding #6) | `/notify` requires a valid JWT; `to` is validated against a staff allow-list; per-IP rate limiting added. |
| **Public self-signup** (Finding #7) | Self-signup has been disabled in the Supabase Auth dashboard (invite / admin-create only). |
| **Permission control-plane tables** (Finding #2) | `user_role`, `rbac_master`, and `user_master` have had broad INSERT / UPDATE / DELETE revoked from `authenticated` and `anon`. All role changes now route through the admin-gated server endpoint using the service-role key. |
| **Data-table RLS v1** (Finding #1, the core isolation fix) | Row-Level Security policies have been replaced on the main data tables. The v1 scope is: **owner** (`created_by = current_user_id()`), **project member** (row's `project_id` in the caller's `client_assoc_user` memberships), **manager/QC** roles (read-only cross-project via `is_manager()` helper), and **admin** (full access via `is_admin()`). Tables covered: `lead_master`, `lead_report`, `lead_activity`, `contact_master`, `interaction`, `contact_project_status`, `company_project_status`, `meeting_master`, `meeting_schedule`, `wishlist`. Helper functions `current_user_id()` and `is_admin()` are `SECURITY DEFINER` so they cannot be spoofed from the client. |

### What remains to be done

| Priority | Item | Notes |
|----------|------|-------|
| **v1b — contact-detail column masking** | Sensitive columns on `contact_master` (email, mobile_no, alt_mobile_no, linkedin_url) should be masked for non-owner / non-admin roles at the database level using column-level security or a view with `CASE` expressions. Currently these fields are returned to any authenticated user who can see the row. | Ship before the next onboarding wave. |
| **v2 — configurable per-project view/edit dials** | Owner wants project-level toggles: which roles can see which columns, and which roles can edit which records. This requires a `project_rbac_config` table and a policy layer that reads it. The v1 policies use hard-coded role ids; v2 replaces them with dynamic lookups. | Post go-live. |
| **v2 — admin UI for view/edit dials** | The Admin panel needs a screen where an ADMIN can set per-project access levels without touching SQL. Depends on the `project_rbac_config` schema being finalised first. | Post go-live, ships with v2 schema. |
| **v2 — manager-edit dial** | Currently managers have read-only cross-project access. The decision on whether managers should be able to edit records they do not own (and under what conditions) has not been finalised. This is a configurable dial in v2. | Post go-live. |
| **Key rotation** | The Supabase service-role key and Gmail app password should be rotated now that the previously-open endpoints are locked. Until rotation the old key may still be in attacker logs (if the endpoints were ever hit). | Do before announcing the fix publicly. |
| **Security headers** (Finding #8) | `helmet()` + CSP + HSTS not yet added to the Express server. | Near-term hardening. |
| **Cookie-based session storage** (Finding #9) | Tokens still live in `localStorage`; XSS risk remains until migrated to httpOnly cookies (Supabase SSR). | Near-term hardening. |
| **`dropdown_option` write scope** (Finding #10) | INSERT / UPDATE / DELETE still open to any authenticated user; needs `is_admin()` policy. | Bundle with next RLS migration. |
| **`user_view_pref` policy** (Finding #11) | Policy is still `USING(true)`; should be `user_id = current_user_id()`. | Bundle with next RLS migration. |
| **Temp-password generator** (Finding #12) | Still uses `Math.random()`; replace with `crypto.randomBytes` or eliminate via invite-link flow. | Low urgency while password is only ever shown to a verified admin. |
| **CORS, body-size limit, rate limiting** (Findings #13–14) | `ALLOWED_ORIGIN` not yet set to the production origin; no body-size cap on `/api/*`; rate limiting only on `/notify`. | Near-term hardening. |
