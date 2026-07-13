# Precise CRM-side requests for the Chrome-extension rebuild

> **For: the CRM-side Opus** (works in `new-code/web`, `new-code/notify-service`, `new-code/migration`).
> **From: the extension-side Opus.** These are the exact, **non-breaking** changes the two extensions need.
> **Owner posture: manual deploy.** Apply nothing to production until Mohit says so. Everything below is written to be **idempotent, transaction-wrapped, and reversible.**
>
> ⚠️ **Before applying anything:** the column/function names below come from code + migration analysis (see [01-CURRENT-STATE-ANALYSIS](./01-CURRENT-STATE-ANALYSIS.md) and [CRM-HANDOFF-FOR-CRM-OPUS](./CRM-HANDOFF-FOR-CRM-OPUS.md)). **Verify each against the live schema first** (a one-line `\d contact_master` etc.). If a name differs, adjust — do not force.

---

## REQUEST 1 — Lowercase fix for LinkedIn matching (ALT-287) · **low risk, do first**

**Why:** the extension matches a LinkedIn profile by `linkedin_clean` using an **exact `=`**. The migration stored `linkedin_clean = lower(...)`, but the web app's `deriveLinkedinClean()` (in `new-code/web/src/data/contacts.ts`, ~lines 47-54) does **not** lowercase. So any contact whose `linkedin_clean` was written by the app with mixed case will **silently never match**. Fix both sides.

**1a. App code change** (`src/data/contacts.ts`) — make `deriveLinkedinClean()` produce the canonical slug:
```
input → trim → lowercase
      → strip leading "https://" or "http://"
      → strip leading "www."
      → strip leading "linkedin.com/in/"
      → cut at the first "?" or "#" (drop query/fragment)
      → split on "/" and keep ONLY the first segment   // .../in/john-doe/details → john-doe
      → strip any trailing "/"
```
Result must equal what `find_contact_dup` compares against. (The extension will use this **exact** algorithm too.)

**1b. One-time data backfill** — idempotent, only touches rows that differ:
```sql
BEGIN;
-- preview first (should be the count you expect to change):
SELECT count(*) FROM public.contact_master
 WHERE linkedin_clean IS NOT NULL AND linkedin_clean <> lower(linkedin_clean);
-- apply:
UPDATE public.contact_master
   SET linkedin_clean = lower(linkedin_clean)
 WHERE linkedin_clean IS NOT NULL AND linkedin_clean <> lower(linkedin_clean);
COMMIT;
```
**Acceptance:** re-running the preview returns 0. **Rollback:** none needed (lowercasing is safe + idempotent); if paranoid, snapshot `contact_id, linkedin_clean` before.

---

## REQUEST 2 — `find_contact_for_panel` RPC (ALT-282) · **the non-owned card**

**Why:** `find_contact_dup` only returns `contact_id, full_name, company_id, company_name`. The non-owned panel card must also show **company status (incl. DNC), last activity date, and owner name** — without leaking PII (email/phone/linkedin) to a non-owner. Because this is `SECURITY DEFINER`, **the function itself must enforce masking.**

**Signature & behaviour (adjust column names to live schema):**
```
find_contact_for_panel(p_linkedin text, p_project_id bigint)
  RETURNS one row:
    contact_id        bigint
    full_name         text
    company_id        bigint
    company_name      text
    company_status    text   -- company_project_status.account_status for (company_id, p_project_id)
    contact_status    text   -- contact_project_status.contact_status for (contact_id, p_project_id); 'do_not_contact' = DNC
    last_activity_at  timestamptz  -- max(occurred_at) from interaction where record_type='contact' and record_id=contact_id
    owner_user_id     text   -- contact_master.created_by (the numeric user_id-as-text)
    owner_name        text   -- resolve owner_user_id -> user_master/profiles display name
    can_view_details  boolean -- = can_see_contact_details(created_by) for the CALLING user (auth.uid())
    email             text   -- ONLY if can_view_details, else NULL
    mobile_no         text   -- ONLY if can_view_details, else NULL
    linkedin_url      text   -- ONLY if can_view_details, else NULL
```
**Match clause:** `WHERE cm.linkedin_clean = p_linkedin AND cm.deleted_date IS NULL AND cm.is_demo = false`.
**Security:** `SECURITY DEFINER`, `STABLE`; `GRANT EXECUTE ... TO authenticated` only. Inside, compute `can_view_details` via the existing `can_see_contact_details(created_by)` helper and **NULL the three PII columns** when false. **Do not** return PII any other way.

**Acceptance (must test before granting broadly):**
- As the **owner** of a contact → full row incl. email/phone/linkedin.
- As a **non-owner authenticated** user → name, company, company_status, contact_status, last_activity_at, owner_name present; **email/mobile/linkedin = NULL**; `can_view_details=false`.
- As **anon** → no execute.

**Rollback:** `DROP FUNCTION find_contact_for_panel(text, bigint);` (additive — nothing else depends on it).

---

## REQUEST 3 — `contact_research_request` table (Extension 2 fulfillment queue) · **new, additive**

**Why:** Extension 2 (Data Research) is the research team's queue: *who requested, when, the target person/company, what fields are needed, status*. The old system used a Firestore `contactRequests` collection — we recreate a minimal Supabase table. **Verify nothing similarly-named already exists** before creating.

**Proposed DDL (idempotent):**
```sql
CREATE TABLE IF NOT EXISTS public.contact_research_request (
  request_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id     bigint REFERENCES public.contact_master(contact_id),  -- nullable: may be a brand-new person
  company_id     bigint REFERENCES public.company_master(company_id),  -- nullable
  linkedin_url   text,
  linkedin_clean text,                 -- normalized slug (same algorithm as Request 1)
  project_id     bigint,
  fields_needed  text,                 -- e.g. 'email,mobile,designation'
  status         text NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | not_found
  notes          text,
  requested_by   text,                 -- numeric user_id-as-text of the requester
  requested_at   timestamptz NOT NULL DEFAULT now(),
  fulfilled_by   text,
  fulfilled_at   timestamptz,
  created_by     text,
  created_date   timestamptz DEFAULT now(),
  updated_by     text,
  updated_date   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_crr_status         ON public.contact_research_request(status);
CREATE INDEX IF NOT EXISTS idx_crr_linkedin_clean ON public.contact_research_request(linkedin_clean);
CREATE INDEX IF NOT EXISTS idx_crr_project        ON public.contact_research_request(project_id);
```
**RLS:** enable RLS, wired to the now-approved `RESEARCH` role (REQUEST 5): **SELECT + UPDATE** for `RESEARCH` + `ADMIN` (work the queue); **INSERT** for any authenticated user (so an Ext-1 agent can raise/re-request — REQUEST 6).
**Acceptance:** a research user can list pending requests and mark one done; an outreach agent can insert a request. **Rollback:** `DROP TABLE public.contact_research_request;` (additive).

> Note: "is the info already there to edit?" is **computed by the extension** at open time (it reads the contact's current `email`/`mobile_no`/`linkedin_url` and shows what's filled vs. missing) — no extra column needed.

---

## REQUEST 4 — Test logins for Mohit to verify (provisioned by you, returned to Mohit)

Mohit will test with the **admin** account `mohit@amplior.com` (sees everything). To verify **masking** (non-owner sees name+company only) and **Extension 2**, please provision:

1. **Test AGENT (non-admin), Extension 1:** create via the existing `POST /api/users/create` (ALT-059) — e.g. `test.agent@amplior.com`, role **AGENT**. Then **set ownership** so it owns **≥2 contacts that have a non-null `linkedin_url`/`linkedin_clean`** (set those contacts' `created_by` to this user's `user_id`), and confirm **≥1 other contact with a `linkedin_url` is NOT owned by it**. Return the temp password to Mohit + list the 3 LinkedIn URLs to open while testing (2 owned → should show full detail; 1 not-owned → should show the masked card).
2. **Test RESEARCH user, Extension 2:** e.g. `test.research@amplior.com`, separate password, in whatever role the Request-5 decision lands on. Return the temp password to Mohit.

**Safety:** these are real prod auth users — create them clearly labelled as test accounts; they can be disabled after verification.

---

## REQUEST 5 — Add a `RESEARCH` role · **OWNER APPROVED 2026-06-22**

Owner approved option (a): **add a `RESEARCH` role.** Extension 2's users are the research/back-office team, distinct from outreach agents, with their **own logins**.
- **Add to `role_master`: id `7`, name `RESEARCH`.** Set `is_web=true` (they sign into a web-based extension).
- **RLS on `contact_research_request`:** `RESEARCH` role + `ADMIN` → SELECT + UPDATE (work the queue: pending→in_progress→done/not_found). Any authenticated user → INSERT (so an Ext-1 agent can raise a request — see REQUEST 6).
- **Fill-the-contact write:** a `RESEARCH` user must be able to **UPDATE `contact_master` PII columns** (`email`, `mobile_no`, `alt_mobile_no`, `linkedin_url`, `designation`, and re-derive `linkedin_clean`) for the contact they're fulfilling — **regardless of `created_by`**. This intersects **ALT-152**: implement it as part of the assignment-write model (grant `RESEARCH` a project-scoped PII-update path even though it doesn't own the row). **Validate with a throwaway RESEARCH login before prod** (this is exactly the kind of cross-role RLS change that has bitten before).

---

## REQUEST 6 — Ext 1 raises / re-requests research (INSERT + re-open contract) · ties to R3/R5

Extension 1 now lets an outreach agent **Request** (and **Re-request**) contact details for a matched contact. This is the feed for the Extension-2 queue (without it, R3's queue is empty).
- **Request** → INSERT a `contact_research_request`: `status='pending'`, `requested_by` = the agent's `profiles.user_id` as text, `fields_needed` = the missing fields (e.g. `'email,mobile'`), `contact_id`/`company_id`/`linkedin_url`/`linkedin_clean`/`project_id` set.
- **Re-request** → re-open the existing open row: `status='pending'`, bump `requested_at=now()`, append a note (`updated_by`/`updated_date`). If none open, insert fresh.
- **RLS:** INSERT for any authenticated user; UPDATE-to-re-open allowed for the original `requested_by` (or any authenticated — low risk).
- **Acceptance:** an AGENT in Ext 1 inserts + re-requests; the row shows up in the RESEARCH queue (Ext 2). Until R3 lands, the extension catches `42P01` and shows "research backend not ready" — no crash.

---

## Summary checklist for the CRM Opus
- [ ] R1a: patch `deriveLinkedinClean()` (lowercase + query/fragment + first-segment). 
- [ ] R1b: run the idempotent lowercase backfill (preview → apply → preview=0).
- [ ] R2: create `find_contact_for_panel` RPC; **test masking with a non-owner login before granting**.
- [ ] R3: create `contact_research_request` (after checking none exists) + RLS.
- [ ] R4: provision + return the 2 test logins (+ the 3 test LinkedIn URLs).
- [ ] R5: **ADD `RESEARCH` role** (`role_master` id 7, `is_web=true`) + wire its RLS (owner APPROVED 2026-06-22; validate with a throwaway RESEARCH login, esp. the `contact_master` PII-update path that ties to ALT-152).
- [ ] R6: confirm INSERT/re-open RLS so Ext-1 agents can Request + Re-request research (feeds the R3 queue).

Nothing here deletes or alters existing data except the safe lowercasing in R1b. Apply in a transaction; keep the previews.
