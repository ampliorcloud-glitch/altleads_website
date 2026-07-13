# Chrome Extension Rebuild — 02 · Migration Blueprint (Firebase → Supabase)

> **Status:** Phase 1 (read-only) approved to build now. Phase 2 (edit-in-place) is **gated on ALT-152** (see Risks & Blockers).
> **Owner:** Mohit (non-technical). **Verdict:** *Feasible with corrections* — corrections are folded into this doc.
> **HARD CONSTRAINT (locked 2026-06-22):** **NO page injection and NO LinkedIn-page reading.** LinkedIn **banned the owner's users' personal accounts** because of injection. The extension MUST NOT inject anything into the LinkedIn page and MUST NOT read the LinkedIn page DOM/content. The **only** input from LinkedIn is the **active tab's address-bar URL** (to extract `/in/<slug>`). The UI is a **Chrome MV3 side panel** (`sidePanel` API); there is **no content script**. This constraint overrides every "shadow-DOM injection" / "MutationObserver-on-page" pattern described in earlier drafts.
> **Companion docs:** `docs/chrome-extension-rebuild/01-*` (audit of the old code), `docs/product/DECISIONS.md` (ADR-21), `REBUILD_LOG.md`, `docs/product/COMPANIES-CONTACTS-BLUEPRINT.md`.

---

## 0. TL;DR (read this if you read nothing else)

We are replacing **three** Firebase/Firestore clients —
1. **AltLeads Chrome Ext 4.1.0** (the prospect viewer / LinkedIn side panel),
2. **Data ResearchExt** (the data-team fulfilment tool), and
3. the never-finished "detect a LinkedIn profile" intent baked into the **AL Prospect Finder web app**

— with **ONE new Manifest V3 extension** that talks to **our existing Supabase-backed AltLeads CRM**, not to a separate prospects database.

We **do not** copy their Firestore schema, their credits/AI/pitch subsystems, or their research-request queue. We map a tiny slice of their *ideas* onto our **real CRM tables** (`contact_master`, `lead_master`, `contact_project_status`, `interaction`, `task`, …).

The product is two phases:

- **Phase 1 — Read-only "show me this person in our CRM."** When the active tab's **URL** is a LinkedIn `/in/<slug>` page, a **background service worker** (watching `chrome.tabs.onUpdated` / `chrome.tabs.onActivated`) reads `tab.url`, normalizes the slug the way the CRM does, and posts it to the **MV3 side panel**. The side panel calls the existing `find_contact_dup` RPC to get a `contact_id` (no detail leak), then loads the contact + leads + per-project status + meetings + tasks + activity feed through the **same data-layer query shapes the web `ContactDetailPage` already uses**, and shows them "in short." **All input from LinkedIn is the URL only — nothing is injected into or read from the page.** **Shippable today.**

- **Phase 2 — Mini-CRM edit-in-place.** The side panel lets the user edit the contact / change status / log a call; every write routes through the **identical CRM mutation path** (UPSERT `contact_project_status` + append `interaction` + optional `lead_activity` + `in_app_notification` + email), so a LinkedIn-side-panel edit is indistinguishable from a web edit. **Blocked on ALT-152** (the write-path/ownership blocker) — do not start until that fix lands and is validated with a real non-admin agent login.

**Two primitives carry the whole product:** the **URL-only detection pattern** (a background service worker reads `tab.url`, parses `/in/<slug>`, and detects SPA navigation via `chrome.tabs.onUpdated` — **no content script, no page injection, no DOM read**) and the **`find_contact_dup` RPC** (our masking-safe match path). Everything Firebase / AI / credits / queue is **dropped**.

**Security stance, non-negotiable:** the extension uses the **public anon key + the user's real Supabase JWT + RLS** (Option A). The **service-role key is never shipped in the extension** — it stays server-only in notify-service.

---

## 1. Why a rebuild (not a port)

The old stack is three clients on **one shared Firebase project** (`altleads-prospect-finder`), with a **hardcoded, shared API key** in every bundle (`AIzaSyDsh-…SPVw` — treat as compromised), **no row-level security** (isolation is a client-side `.where('teamId','==',…)` filter — trust-the-client), and **dev "skip login" backdoors** that fabricate a fake admin. It also carries an entire AI/credits/research-queue surface we do not want.

Our CRM already has: Supabase Auth + `profiles`, real **RLS**, **column masking**, a purpose-built **masking-safe match RPC**, and the **audit trail** (`interaction` / `lead_activity` / `in_app_notification`) that makes "record changes exactly as if changed in the CRM" possible. So the right move is to **rebuild a focused extension against the CRM**, reusing only a couple of UI/infra patterns from the old code.

---

## 2. Target architecture

**Manifest V3. Supabase is the only backend. No Firebase SDK. No AI host permissions. No content script. No page injection. No LinkedIn-page DOM reading.**

> **Why this shape (locked 2026-06-22):** LinkedIn **banned the owner's users' personal accounts** for injecting into the page. So the extension is built as a **side panel that reads only the active tab's URL**. It never touches the LinkedIn DOM. The single input from LinkedIn is `tab.url`, which is available via the **`"tabs"` permission** — **no `linkedin.com` host permission is requested** (host access would only be needed to read/inject page content, which we deliberately do not do).

### 2.1 `manifest.json`

```jsonc
{
  "manifest_version": 3,
  "name": "AltLeads CRM on LinkedIn",
  "version": "1.0.0",
  "permissions": ["sidePanel", "tabs", "storage"],
  // ^ "sidePanel" = the UI surface (MV3 side panel).
  //   "tabs"      = read the active tab's URL (tab.url) to detect /in/<slug>.
  //                 This does NOT grant page content/DOM access.
  //   "storage"   = persist the Supabase session + selected project.
  //   NO "scripting" / "activeTab" / content-injection permissions — we never inject.
  "host_permissions": [
    "https://puvozfhypqbwbmbhrhcr.supabase.co/*",   // the Supabase project (PostgREST + RPC + Auth)
    "https://crm.altleads.com/*"                     // ONLY if Option-A2 SSO session-lift is used
    // NO linkedin.com host permission — we read tab.url, we do not read the LinkedIn page.
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "side_panel": { "default_path": "sidepanel.html" },
  // NO "content_scripts" — the extension never runs code on the LinkedIn page.
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "action": { "default_title": "AltLeads CRM" }
}
```

**Dropped from the old manifests:** every AI host (`inference.do-ai.run`, `api.groq.com`, `generativelanguage.googleapis.com`, `openrouter.ai`), the Firebase auth/storage hosts, the entire `content_scripts` block, and **all `linkedin.com` host permissions** (no page access is needed or wanted).

### 2.2 Components

| Component | Responsibility |
|---|---|
| `background.js` (service worker) | The **only** LinkedIn-facing code. Listens to `chrome.tabs.onUpdated` (catches SPA URL changes — replaces the old on-page MutationObserver) and `chrome.tabs.onActivated`, plus `chrome.tabs.query({active:true})` on open. Reads **`tab.url`** (never page content), tests for `"linkedin.com/in/"`, normalizes the slug, and posts the normalized slug to the side panel (`chrome.runtime.sendMessage` / a port). Also `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so clicking the action icon opens the panel. **No LLM. No DOM read. No injection.** |
| `sidepanel.html` + `sidepanel.ts` (MV3 side panel) | The whole UI: project selector (top), auth state, matched-contact card, owned vs non-owned views, "Request this company" action. Receives the normalized slug from the background worker, runs `find_contact_dup`, and renders matched-contact data. |
| `popup` (optional) | Auth convenience (email/password) + login state; auth can also live in the side panel itself. |
| `lib/supabase.ts` | Single `@supabase/supabase-js` client built from `VITE_SUPABASE_URL` + the **public anon key**. |
| Shared module (`@altleads/crm-core`) | Extracted from the web app: `deriveLinkedinClean()` **(with the lowercase fix, see §4)** + the read query functions, imported by both web app and extension so normalization/queries match **byte-for-byte**. |

### 2.3 UI surface — DECIDED (no longer an open question)

Ship the **Chrome MV3 `side_panel`** (`sidePanel` API). The background worker calls `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`, so clicking the toolbar action icon opens/closes the panel. The panel renders the matched-contact mini-CRM alongside (not inside) the LinkedIn tab.

**There is NO injected shadow-DOM panel and NO floating in-page launcher.** That earlier recommendation is **withdrawn** — in-page injection is exactly what got accounts banned. The side panel is now the **only** UI surface, not a fallback.

### 2.4 Data access — how the extension reaches Supabase

```
background.js  ──reads tab.url──►  parse /in/<slug>  ──postMessage──►  side panel
sidepanel.ts
      │  @supabase/supabase-js (anon key + user JWT)
      ▼
Supabase PostgREST  ──►  contact_master_masked (view)        [reads, masked]
                    ──►  lead_master / contact_project_status / task / interaction
Supabase RPC        ──►  find_contact_dup(...)               [match, SECURITY DEFINER]
                    ──►  (Phase 1) find_contact_for_panel(...) [proposed richer masking-safe read, see §8/§10]
                    ──►  (Phase 2) edit_contact_status(...)    [proposed SECURITY-INVOKER tx]
                    ──►  (Phase 1/2) request_company_assignment(...) [new request→TL approval, see §6/§8]
notify-service      ──►  POST /notify  (Bearer JWT)           [email only, optional]
```

- **The only LinkedIn input is `tab.url`**, read by the background worker — never the page DOM.
- **Every read/write carries the user's JWT**, so PostgREST + RPC + RLS govern the extension **exactly** like the web app. The extension is, to the server, indistinguishable from the web app.
- **Reads** go through the masked view `contact_master_masked` and the existing query shapes (`contacts.ts` / `companies.ts` / `projectStatus.ts` / `tasks.ts`).
- **Matching** goes through `find_contact_dup` — the **only** masking-safe lookup by `linkedin_clean`, because `linkedin_url`/`linkedin_clean` are column-REVOKEd on the base table and NULLed in the masked view for non-owners.
- **No new server is required** for Phase 1, nor for Phase-2 writes that respect RLS. notify-service is reused **only** for the existing `/notify` email endpoint when an edit should fire an email. There is **no record-edit service endpoint** and we **do not add one** unless we deliberately choose to bypass RLS for migrated rows (discouraged — fix ALT-152 instead). **CRM dependencies introduced by the 2026-06-22 decisions:** a richer masking-safe read RPC (`find_contact_for_panel`) and a company-assignment request/approval workflow (`request_company_assignment`) — see §6, §8, §10.

---

## 3. Auth plan for the extension

**Option A (recommended): anon key + the user's real Supabase JWT + RLS.** The extension runs its own `@supabase/supabase-js` client (the anon key is public — it already ships in the web bundle). Every call carries the user's JWT, so the extension inherits **identical RLS + masking**. Good for consistency; the consequence is that Phase-2 edits inherit the **ALT-152 write-blocker** too (acceptable — same as the web app).

Two sub-paths — **ship A1, offer A2 as an SSO upgrade:**

- **A1 — explicit login in the side panel (or popup).** Prompt email/password → `supabase.auth.signInWithPassword` → the extension's own session JWT, persisted in `chrome.storage`. Then **mirror the web `AuthContext`**: load `profiles` (`id` = `auth.uid`, `user_id` bigint, `role` text) + the full role set from `user_role × role_master`, so we have **`profiles.user_id`** for write stamping later. A1 is the **default** and needs **no `linkedin.com` and no `crm.altleads.com` host permission**.
- **A2 — SSO with the open CRM tab.** With `host_permission` for `crm.altleads.com` **only** (still no LinkedIn host permission), the extension **lifts the persisted Supabase session from the CRM tab** (e.g. a one-off `chrome.scripting`-free read against our own domain, or a message from the CRM web app) and calls `supabase.auth.setSession(...)` — single sign-on with the already-logged-in CRM tab. This touches **our own** domain only, never LinkedIn. (Posture confirmation is an open question — see §11.)

**Identity in RLS:** `auth.uid()` → `profiles` → `current_user_id()` (bigint) drives `is_admin()` / `is_qc()` / `manages_project()` / `can_see_contact_details()`. The extension's JWT resolves the same way as the web app's.

**Hard rules:**
- **NEVER** embed the **service-role** key in the extension (it bypasses all RLS — stays server-only in notify-service, forever).
- **AVOID** the Client/Sales-Portal session path (`portal.client_portal_user`): a **RESTRICTIVE deny-policy** locks portal sessions out of every CRM base table. The extension must use the normal `authenticated` path.
- **Strip every dev "skip login" backdoor** from the old code (`DEV_MODE`, `dev-user`, `dev-user-admin`, `window._rrCurrentUser`). None of it ships.

---

## 4. The match-by-LinkedIn flow (Phase 1 core)

> **Match key alignment is byte-for-byte critical.** `find_contact_dup` does an **exact** `cm.linkedin_clean = p_linkedin` (confirmed in `access-masking-v1b.sql` line 192) — **no normalization happens server-side.** So the extension's normalization must produce **exactly** the stored value.

### Step 1 — Detect a profile page (URL only, in the background worker)
`is-profile` test = the **active tab's `tab.url`** contains `"linkedin.com/in/"` (the cheap substring test the old code used) — read by the background service worker from `chrome.tabs.onUpdated` / `chrome.tabs.onActivated` / `chrome.tabs.query`. **We do NOT read the LinkedIn DOM**, so the old `authWall` / `feedNav` guest/auth-wall selector detection is **dropped** (it required page access). If the URL is not a `/in/` profile, the panel simply shows its idle/empty state.

### Step 2 — Extract + normalize the slug ⚠️ CORRECTED

Take the active tab's **`tab.url`** (from the background worker — not `window.location`, which would require running on the page) and produce the clean slug. **The CRM's `deriveLinkedinClean()` is NOT enough on its own — it does not lowercase** (confirmed: `contacts.ts` lines 49–53 only strip the `https?://(www.)?linkedin.com/in/` prefix + a trailing `/` + `.trim()`). The **migration** populated `linkedin_clean` with `lower(regexp_replace(...))`, so stored values are **lowercase**. Copying `deriveLinkedinClean` literally **fails on mixed-case slugs**.

The extension's normalization must do **all** of:

1. **lowercase** the whole URL  ⚠️ *(the fix — must be added; not in `deriveLinkedinClean`)*
2. strip `^https?://`
3. strip leading `www.`
4. strip leading `linkedin.com/in/`
5. **drop any query string / fragment** — split on `?` and `#`, keep the left side
6. **split the remainder on `/` and keep only the FIRST segment** — so `…/in/john-doe/details/experience/` → `john-doe`, and locale/numeric sub-paths don't break the match
7. strip any trailing `/` and `.trim()`

> **Action:** fix `deriveLinkedinClean()` in the **shared module** to lowercase + trim path/query/fragment, and have **both** the web app and the extension import it. This also corrects the web app's own app-written rows (today they are not lowercased — a latent match-coverage bug).

**Do NOT** port 4.1.0's brute-force loop over **12 URL variations** — it only existed because the old stored URLs were un-normalized. Our data is pre-normalized **and indexed** (`idx_contact_master_linkedin_clean`), so this is **one** lookup.

### Step 3 — Query the CRM

```js
const { data } = await supabase.rpc('find_contact_dup', {
  p_email: null,
  p_linkedin: slug,   // the byte-exact normalized slug from Step 2
  p_mobile: null,
});
```

`find_contact_dup` is **SECURITY DEFINER, STABLE, `EXECUTE` granted to `authenticated` only**. It returns **only** `{ contact_id, full_name, company_id, company_name }` for a **live** (`deleted_date IS NULL`), **non-demo** contact whose `linkedin_clean` equals the slug. This is the **only** masking-safe match path.

### Step 4 — Load detail + associated records (mirror `ContactDetailPage.tsx`)

| Surface | Query | Source |
|---|---|---|
| Contact detail | `fetchContactById(contact_id)` | view `contact_master_masked` (detail cols may be NULL — that's masking, not "missing") |
| Leads / deals | `fetchContactLeads(contact_id, source_lead_id)` | `lead_master` (ORs `contact_id.eq` + `lead_id.eq.<source_lead_id>`) |
| Per-project status | `getContactStatus(contact_id, project_id)` | `contact_project_status` (UNIQUE `contact_id`,`project_id`) |
| Activity feed | `fetchActivity('contact', contact_id)` | `interaction` (`record_type='contact' AND record_id=contact_id`) |
| Tasks | `task WHERE contact_id` | `task` (index `task_contact_id_idx`) |
| Meetings | chain — **no direct `contact_id` on meetings** | `contact_id → lead_master.lead_id → lead_report.report_id → meeting_schedule → meeting_master` |

> **Optimization (verifier):** `find_contact_dup` already returns `company_name` flat, so the **panel header needs no second masked-view round-trip** for the matched contact.

### Step 5 — Handle no-match and masked-detail cleanly

- **No match** (`find_contact_dup` empty) → clean **"No contact in CRM for this profile"** empty state. Phase 1 **stops here** (read-only — outreach-only north-star; we do not create data).
- **Masked match** (a match exists but detail cols are NULL because the caller isn't owner/manager/admin/qc) → show **name + company** + a **"details hidden (not your record)"** note. **Never conflate "hidden" with "empty."** Render three states per detail field: *present (masked, click-reveals)*, *hidden (not your record)*, *genuinely empty*.
- **Add to CRM** (Phase 2, admin/data-team only, behind a flag) → inserts a `contact_master` row with `linkedin_url` + derived `linkedin_clean`. Creation is **ADMIN-default** per launch-access-decisions, so **hide it from outreach roles**.

### SPA note
LinkedIn is an SPA, so profile → profile navigation does **not** trigger a full page load. We detect it **off-page** in the background worker via **`chrome.tabs.onUpdated`** (which fires on the SPA's `history.pushState` URL change with `changeInfo.url`), plus `chrome.tabs.onActivated` for tab switches and `chrome.tabs.query` on panel open. On each new `/in/<slug>` URL, the worker re-normalizes and re-posts the slug to the side panel, which re-runs Steps 2–4. **No on-page `MutationObserver` and no injected init** — that pattern is dropped (it required injecting into the page).

---

## 5. Firestore → real CRM mapping

> We map onto **EXISTING** CRM tables. We **do not** recreate their schema. Firestore field names are **inspiration only**.

| Firestore (old) | Real CRM target | Notes |
|---|---|---|
| `prospects` (collection) | **`public.contact_master`** (base, RLS-write); read via **`public.contact_master_masked`** (view) | The contact. |
| `prospects.personalLinkedin` (12-variation match) | **`contact_master.linkedin_clean`** (normalized, indexed) | **THE match key.** Match via `find_contact_dup`, not a `.where`. |
| raw LinkedIn URL | `contact_master.linkedin_url` | Raw; `linkedin_clean` is the derived match column. |
| `firstName` / `lastName` / `fullName` | `contact_master.full_name` | Single column in CRM. |
| `designation` | `contact_master.designation` | |
| `workEmail` | `contact_master.email` | Masked for non-owners. |
| `contactNumber1` / `contactNumber2` | `contact_master.mobile_no` / `alt_mobile_no` | Masked for non-owners. |
| `companyName` / `companyIndustry` / `website` / … | JOINed **`company_master`** (`company_id`) | `company_master.linkedin_url` is the **company page**, not a person — **ignore for matching**. |
| `*Disposition` enums (Accurate / Wrong / Unverified) | `interaction.disposition` + `contact_project_status.contact_status` | CRM models verification on the **interaction/status feed**, not per-column enums. The colored disposition dropdown is a **UI reference only**. |
| `contactRequests` (research queue) | **DROP** | We match an existing contact; we don't run a fulfilment queue. (If ever needed: a `contact_enrichment_requests` table — out of scope.) |
| `users` (keyed by auth uid) | **`public.profiles`** (`id`=`auth.uid`, `user_id` bigint, `role`) + `user_role × role_master` | Auth = Supabase Auth (replaces Firebase Auth entirely). |
| `teams` + `teamId` isolation | numeric **`project_id`** scoping (global project selector) + RLS via `manages_project()` / `project_user` | **NOT** a client-side `.where(teamId)`. Drop `settingsVersion`. |
| `credits` (balance/plan/usage) | **DROP** (v1) | No credit metering in target. If revived: a `usage_credits` table. |
| `profileViews` | optional: append a `'view'` `interaction`, or a small touch-log | Defer. |
| `activityLogs` | **`interaction`** + **`lead_activity`** + **`in_app_notification`** | The **real audit surfaces** — the hook for "recorded exactly as in the CRM." |
| `products` / `personas` / `aiModels` | **DROP** | AI pitch/scoring config — out of scope. |
| `cloudSync.js` TTL / `settingsVersion` cache | **DROP** | Postgres/Realtime makes it moot. **Keep only the principle:** *tolerate offline by serving last-good data, never throw to UI.* |

**Identity on writes:** Firebase `uid` stamped on writes → **`profiles.user_id`-as-text** stamped on `created_by` / `updated_by` (e.g. `"42"` — the numeric `user_id`, **not** the auth uuid).

---

## 6. Edit / two-way-sync design (Phase 2 — gated)

> **Goal (product #4):** an edit in the LinkedIn side panel must be recorded **exactly** as a web-app edit — same DB rows, same audit trail, same RLS, same notifications. We achieve this by routing **every** write through the **same data-layer functions** the web app uses (`projectStatus.ts`, etc.), **not** raw row updates (the old extensions' bare `update()` + `lastUpdated` is the anti-pattern we reject).

> **Related write path — "Request this company" (NOT an edit; can ship in Phase 1).** The non-owned-contact card's "Request this company" button (§8.2) writes an **assignment request to the agent's TL** (mirroring the existing lead-report/meeting approval flow), not a contact/status edit. On approval the company is assigned to the agent and details become revealable. **CRM dependency:** a new **company-assignment request/approval workflow** (request row + TL approve/reject + on-approve assignment) must exist on the CRM side; the extension only calls it. This is separate from — and not blocked by — ALT-152.

### Write recipe (mirror the web data layer exactly)

1. **Identity.** Stamp `created_by` / `updated_by` as the acting user's **numeric `user_id` as text** (from `profiles.user_id`, exposed by `AuthContext`) — **not** the auth uuid. Always set `*_date` to an ISO timestamp. **Never** supply IDENTITY PK columns.
2. **Status change on a contact.** UPSERT `contact_project_status` on (`contact_id`, `project_id`) with the new `contact_status` / `description` / `comments` + `updated_by` / `updated_date` (and `created_by` / `created_date` on first write) **AND** append a `status_change` row to `interaction` (`record_type='contact'`, `record_id=contact_id`, `project_id`, `owner_user_id`, `type`, `disposition`, `note_text` built by `describeChange()` e.g. `"contact_status: hot; comments updated"`, `occurred_at`, `created_by`). Mirror onto the company feed via `logCompanyContactActivity()` like the web app.
3. **Log a call.** Append a `'call'` `interaction` row (same shape).
4. **Edit contact fields** (email / phone / linkedin / designation). UPDATE `contact_master` **and re-derive `linkedin_clean`** via the fixed `deriveLinkedinClean()` so the match key stays correct; set `updated_date`.
5. **Lead-scoped comments/events.** `lead_activity` via `addActivityComment()` (human) / `logSystemActivity()` (`is_generated=true`).
6. **Notifications (optional, to fully match web behavior).** `notifyInApp()` writes `in_app_notification` (bell feed) + `notify()` POSTs `/notify` on notify-service (Bearer JWT) for the fire-and-forget email.

### Atomicity
The old ResearchExt's best idea — write the record + flip status in **one** batch — maps to a **Supabase RPC (SECURITY *INVOKER*, so RLS still applies)** that does the UPSERT + `interaction` append in **one transaction**. Preferred over multiple round-trips so a status change and its audit row never half-commit. **We do NOT use SECURITY DEFINER to bypass RLS for edits.**

> ⚠️ **Necessary-but-insufficient (verifier).** An atomic RPC does **not** fix RLS — the three write tables have **different** predicates (see §7). A *manager*, for example, can pass the `contact_project_status` UPSERT but fail the `contact_master` edit **and** the `interaction` audit append. The atomic RPC only guarantees all-or-nothing; ALT-152's fix must **align all three tables' write gates**.

### Concurrency
Old code is last-write-wins with no guard. For a multi-writer LinkedIn panel, add **optimistic UI + an `updated_date` version check** on UPDATE (reject/merge if `updated_date` moved) so two editors don't silently clobber. `interaction` is append-only, so the audit trail is naturally conflict-free.

### Hard dependency — ALT-152
Every write above is RLS-gated on `created_by = current_user_id()`; on bulk-migrated rows a real agent gets **`42501`** ("You can only edit records you own"). So Phase-2 inline edit **cannot** work for migrated records until the assignment-based write model (ADR-21) lands and is **validated with a real non-admin agent login**. The extension inherits this **identically** to the web app — surface the **same friendly 42501 message**. Do **not** work around it by embedding service-role; either wait for ALT-152 or build an explicit admin-gated server edit endpoint (none exists today; discouraged).

---

## 7. What we KEEP as reference vs DROP

### KEEP — port the *idea/pattern*, not the Firebase code

1. **The `/in/<slug>` URL parse ONLY.** Keep the `/in/<slug>` regex `/linkedin\.com\/in\/([^/?#]+)/i` and the `"linkedin.com/in/"` is-profile substring test — applied to **`tab.url`** in the background worker. This URL parse is the **single thing** we keep from the old LinkedIn-facing code. **Do NOT keep the `authWall` / `feedNav` selectors** — they require reading the page DOM, which is banned.
2. **SPA navigation handling — via `chrome.tabs.onUpdated` (off-page).** Detect the SPA's URL change in the **background worker** from `chrome.tabs.onUpdated` (`changeInfo.url`), not from an on-page `MutationObserver`. The on-page observer is **dropped** (it required injection).
3. **Normalization SPEC** — must **mirror the (fixed) `deriveLinkedinClean`** byte-for-byte, **plus** lowercase + query/fragment trim + first-segment-after-`/in/` (see §4).
4. **UX blueprints.** The Contact-tab disposition (Accurate/Wrong/Unverified) verification model, **partial masking + click-to-reveal**, and the Edit-Form "existing record found" pre-fill panel — good models for our masking/click-reveal + inline edit (matches the launch masking decision).
5. **Atomic batch-write idea** (write record + flip status together) → map to a Supabase **SECURITY-INVOKER** RPC transaction.
6. **Offline principle only** — serve last-good data, never throw to UI.

### DROP / REPLACE — do not carry over

- **Entire Firebase SDK + Firebase Auth + hardcoded `firebase-config`** (shared key `AIzaSy…Vw` — **treat as compromised**) → Supabase client + Supabase Auth + **public anon key**.
- **All AI/LLM code:** `callGroq`/Gemini/OpenRouter/DOGradient, `extractProfileWithAI`, `scoreProfile`, `generatePitches`, `performDeepResearch`, marketing-brain/core-knowledge, the page-`innerText`→LLM autofill (privacy/ToS liability + out of scope). Drop **all** AI `host_permissions`.
- **Credits/plans subsystem** + the `runTransaction` credit spend.
- **`products` / `personas` / `aiModels`** config + `cloudSync.js` TTL / `settingsVersion` cache.
- **The `contactRequests` / `prospects` research-fulfilment QUEUE** (not our model).
- **The 12-URL-variation brute-force match loop** (replaced by one indexed `find_contact_dup` call).
- **DOM field-scraping** for name/title/company (we get all detail from Supabase; we only need the URL).
- **Dev "Skip Sign In (Admin)" backdoors** (`DEV_MODE`) and the broken `window._rrCurrentUser` attribution.
- **Client-side `teamId` `.where()` isolation** and **any** client-side role gate as the security boundary (**RLS is the boundary**).
- **Raw `update()` + `lastUpdated` writes with no audit** (replaced by the CRM's `interaction` / `lead_activity` / `in_app_notification` audit path).
- **Firebase `prospects`/`contactRequests`/`credits`/`teams` FIELD NAMES** — inspiration only.
- **DROP: any content script / page DOM reading / page injection (LinkedIn ban risk).** No `content_scripts`, no shadow-DOM host `<div>`s, no floating launcher, no on-page `MutationObserver`, no `window.location`/`document` access on the LinkedIn page. **This is the constraint that got accounts banned — it does not ship in any form.** The only LinkedIn input is `tab.url` read off-page by the background worker.
- **`scripting` / `activeTab` content-injection permissions** and **all `linkedin.com` host permissions** — not requested (we never inject or read the page). Permissions are trimmed to `["sidePanel","tabs","storage"]` (see §2.1).

---

## 8. Read-display design (Phase 1 side panel — read-only)

The whole UI is the **MV3 side panel** (`sidepanel.html`). It mirrors `ContactDetailPage.tsx`, condensed "in short." It never reads the LinkedIn page; it only receives the normalized slug from the background worker.

### 8.0 Top bar — PROJECT SELECTOR (decided 2026-06-22, both places)
- The side panel's **top bar carries a project selector**. **Default = the user's personal-settings selected project** (or, if the user has exactly one project, that one). The selection persists in `chrome.storage`.
- **The CRM web app gets the SAME selector in its own top panel.** The extension **reflects/shares** that selection: status and meetings are stored **per `project_id`**, so the panel's per-project data is scoped to the currently-selected project. Changing the project (in either place) re-scopes the panel.
- **CRM dependency:** the same top-panel project selector must be added to the web app (it should read/write the user's personal-settings selected project), and the extension reads that selection (via the lifted session/settings, or its own stored mirror).

### 8.1 OWNED contact — full mini-CRM card
When the matched contact is **owned by the agent** (or the agent is manager/admin/qc):
- **Header:** `full_name` + `designation` + `company_name` (flat from `find_contact_dup`). A small **"in CRM"** confirmation badge; a **"details hidden"** badge when masking applies.
- **Contact card:** `email`, `mobile_no`, `alt_mobile_no`, `linkedin_url` — **partial masking + click-to-reveal** (reuse `maskEmail`/`maskPhone` UX). These come from `contact_master_masked` and are **NULL unless `can_see_contact_details(created_by)`** (owner/manager/admin/qc). Render **three states per field**: *present (masked, click-reveals)*, *hidden ("not your record")*, *genuinely empty* — **never conflate hidden with empty.**
- **Per-project status:** from `contact_project_status` on (`contact_id`, **selected `project_id`** from the top-bar selector) — `contact_status` + a short description/comments snippet.
- **Associated records "in short"** (counts + top item, expandable), all scoped to the selected project where applicable:
  - **Leads/deals:** `fetchContactLeads` — stage + latest, link out to the web CRM lead page.
  - **Meetings:** via the `meeting_schedule` chain — next/most-recent meeting only.
  - **Tasks:** `task WHERE contact_id` — open-tasks count + nearest `due_at`.
  - **Activity feed:** `fetchActivity('contact', contact_id)` — last 3 entries (`type` + `disposition` + `note_text` + `occurred_at`).

### 8.2 NON-OWNED contact — limited view + REQUEST-TO-TL (decided 2026-06-22)
When the matched contact is **NOT owned by the agent**, the masked view NULLs the detail columns, so the panel shows a **deliberate limited card** (NOT the full contact details):
- **Contact name** + **company name**
- **Company status** (this **may be DNC — and DNC MUST be shown**, so the agent does not pursue a do-not-contact company)
- **Last activity date** (most-recent `interaction.occurred_at` for the company/contact)
- **Owner name** (the colleague who currently owns the company, **within the project**)
- A **"Request this company"** button → files a request to the **agent's Team Lead** for approval. This **mirrors the existing lead-report / meeting approval flow** (request → TL → approve/reject). **On approval, the company is assigned to the agent** and the contact's details become revealable (the panel re-renders as the §8.1 owned card on next match).
- **CRM dependencies (new):**
  1. A **richer masking-safe read RPC** (call it `find_contact_for_panel`) that returns the non-owned summary fields above — name, company, **company status (incl. DNC)**, last-activity date, owner name — **without leaking masked PII**. `find_contact_dup` is insufficient (it returns only `{ contact_id, full_name, company_id, company_name }`).
  2. A **new company-assignment request/approval workflow** on the CRM side (request row + TL approval + on-approve assignment), modeled on the existing lead-report/meeting approval flow. Until both exist, §8.2 shows only name + company (the `find_contact_dup` fields) and the "Request this company" button is disabled/"coming soon."

### 8.3 Empty / no-match and links
- **Empty/no-match:** "No CRM contact for this LinkedIn profile" with (Phase 2, admin only) an "Add to CRM" affordance, hidden for outreach roles.
- **Everything links back** to the corresponding `crm.altleads.com` page — the panel is a fast preview, not a replacement. **No edit controls in Phase 1.**

---

## 9. Phased plan

### Phase 0 — Foundations (no LinkedIn yet)
Scaffold **MV3 + Vite** as a **side-panel extension (no content script)**; bundle `@supabase/supabase-js`; ship Supabase auth (**A1**: email/password → `signInWithPassword`, in the side panel or popup) with **A2** (lift the persisted session from `crm.altleads.com` via the open CRM tab → `setSession`) as the SSO upgrade. Wire `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` and the background `chrome.tabs.onUpdated`/`onActivated` URL listener. Load `profiles` + roles (mirror `AuthContext`) so we have `profiles.user_id` for later writes. Add the **top-bar project selector** (default = personal-settings selected project). **Extract `deriveLinkedinClean()` (with the lowercase fix) + the read query functions into a shared module** imported by both web app and extension.
**Acceptance:** extension logs in, holds a real JWT, can call `find_contact_dup`; background worker reports the active tab's `/in/<slug>` URL to the panel.

### Phase 1 — Read-only "show details" (SHIPPABLE NOW, no ALT-152 dependency)
The **background worker** detects `/in/<slug>` from **`tab.url`** (via `chrome.tabs.onUpdated`/`onActivated`/`query` — **no content script, no page read**), normalizes (fixed `deriveLinkedinClean` + lowercase + path/query trim + first-segment-after-`/in/`), and posts the slug to the **side panel**. The side panel calls `find_contact_dup`, and on match loads contact + leads + per-project status (scoped to the selected project) + tasks + meetings (via the `meeting_schedule` chain) + `interaction` feed through the masked view / existing query shapes, rendering them "in short." For **owned** contacts show the full mini-CRM card (§8.1); for **non-owned** contacts show the limited card — name + company + **company status (incl. DNC)** + last-activity + owner name + a **"Request this company"** → TL approval action (§8.2; needs the richer read RPC + the company-assignment approval workflow on the CRM side). Handle no-match and masked-detail states cleanly. **Strictly READ-ONLY** for contact data — no contact/status writes (outreach-only north-star); the "Request this company" approval request is the only write and mirrors the existing lead-report/meeting approval flow. **This is the first real deliverable and the core of the product.**

### Phase 2 — Mini-CRM edit-in-place (GATED on ALT-152)
Add edit / status / log-call controls. Each write routes through the shared data-layer functions = UPSERT `contact_project_status` + append `interaction` (status_change/call) + re-derive `linkedin_clean` on field edits + optional `lead_activity` + `in_app_notification` + `notify` email; identity stamped as `user_id`-as-text; wrap status+audit in a **SECURITY-INVOKER RPC transaction** for atomicity; optimistic UI + `updated_date` concurrency guard. Surface the **same friendly 42501** message on RLS denial. Reuse the Contact-tab disposition + partial-mask + click-to-reveal UX. Optional admin-only "Add to CRM" for no-match. **Do NOT start Phase-2 writes until the assignment-based write model (ADR-21 / ALT-152) is validated with a real non-admin agent login**, and the fix **aligns `contact_master` + `contact_project_status` + `interaction` write gates together** (see §10).

### Cross-cutting
Never ship service-role; **anon key + JWT + RLS only.** Strip every dev "skip login" backdoor. **No content script, no page injection, no LinkedIn-DOM read — `tab.url` only (LinkedIn ban risk, locked 2026-06-22).** **No LLM / page-text exfil** (privacy/ToS). Keep the audit **identical** to web so nothing in the CRM can tell a LinkedIn-side-panel edit from a web edit.

---

## 10. Risks & Blockers

> Verifier verdict: **FEASIBLE WITH CORRECTIONS.** Phase 1 ships now with the normalization fix. Phase 2 is correctly self-identified as hard-blocked on ALT-152 — and the **blocker surface is larger than first described** (three write tables, three different predicates). Approve Phase 2 only after a fix that aligns all three, validated with a real non-admin agent login.

### Corrections folded into this doc
1. **Normalization bug (confirmed in source).** `deriveLinkedinClean()` (`contacts.ts` 47–54) does **not lowercase** — it only strips the `https?://(www.)?linkedin.com/in/` prefix + trailing `/` + `.trim()`. The migration stored `linkedin_clean` via `lower(regexp_replace(...))`, so stored values are lowercase. **The extension MUST lowercase + strip query/fragment + take the first path segment after `/in/`.** Copying `deriveLinkedinClean` literally **fails on mixed-case slugs**. → Folded into §4; fix the shared `deriveLinkedinClean`.
2. **The `interaction` audit append is its OWN independent blocker.** A contact-typed `interaction` INSERT gates on `record_owner_id('contact', record_id) = current_user_id()` with **no manager branch for contacts** (`access-rls-v1.sql` 307–314). On migrated contacts, even the `status_change`/`call` **audit row fails 42501** — so "recorded exactly as in the CRM" is ALT-152-blocked too, **not just the status row.**
3. **The atomic SECURITY-INVOKER RPC is necessary but insufficient.** The three Phase-2 write tables have **different** RLS predicates (`contact_master` owner/admin only; `contact_project_status` owner/admin/manager; `interaction`-on-contact owner/admin only). A *manager* can pass the status UPSERT but **fail** the contact edit and the audit append. **ALT-152's fix must align all three tables.**
4. **Minor:** `find_contact_dup` already returns `company_name` flat — no second masked-view round-trip for the matched header.
5. **Architecture locked (2026-06-22): side-panel + URL-only.** Earlier drafts proposed an injected shadow-DOM panel; that is **withdrawn** because LinkedIn **banned the owner's users' accounts for injection**. The extension is now a **side panel** that reads **only `tab.url`** (via the `"tabs"` permission). Permissions trim to `["sidePanel","tabs","storage"]`; **no `content_scripts`, no `scripting`/`activeTab`, and no `linkedin.com` host permission** (see §2.1, §7).

### CRM blockers
- **ALT-152 (launch-stopper, NOT yet fixed).** `contact_master` INSERT/UPDATE is owner-only on `created_by = current_user_id()::text`, with no assignment/manager fallback (`access-rls-v1.sql` 209–218). Data was bulk-migrated so `created_by` = the legacy/internal owner, not the agent now responsible → a real agent gets **42501** on most records. **Phase-2 contact edits are blocked** until ADR-21 (assignment-based write) lands and is validated with a real agent login.
- **`interaction` (contact audit) write is a SECOND independent owner-only gate** (307–314). Fixing `contact_project_status` alone is insufficient — the audit append is itself 42501-blocked on migrated contacts.
- **Non-uniform write RLS** (`contact_master` owner-only / `contact_project_status` owner-or-manager / `interaction`-on-contact owner-only) → a manager can set status but **not** edit the contact or write its audit. The assignment fix must **align all three.**
- **Masking limits Phase-1 usefulness — now addressed by decision (2026-06-22).** The masked view NULLs `email`/`mobile`/`linkedin` for non-owner/non-manager. The decision is that a non-owned match shows a **limited card**: name + company + **company status (incl. DNC, which MUST be shown)** + last-activity date + owner name + a **"Request this company" → TL approval** action (§8.2). **CRM dependency:** this needs (a) a **richer masking-safe read RPC** (`find_contact_for_panel`) beyond `find_contact_dup` (which returns only `id/name/company`), and (b) a **new company-assignment request/approval workflow** mirroring the lead-report/meeting approval flow. Until both land, the non-owned card falls back to name + company only and the request button is disabled.
- **Match coverage is limited.** `linkedin_clean` is **NULL** for many migrated contacts that had no source LinkedIn, **and** app-written rows are not lowercased today → a **higher no-match/hidden rate** than implied. (Fixing `deriveLinkedinClean` to lowercase removes the second cause going forward.)
- **No record-edit service endpoint exists** (only `/notify` + admin user-mgmt). There is **no sanctioned RLS bypass** for edits — the only correct unblock is **ALT-152**. Service-role in the extension is correctly ruled out.

### Platform / ToS
- **No page injection — by hard constraint (2026-06-22).** LinkedIn **banned the owner's users' personal accounts** for injecting into the page, so **`content_scripts` / DOM reads / on-page launchers are removed entirely.** The extension is a **side panel** that reads **only the active tab's URL** (`tab.url`, via the `"tabs"` permission — not host/page access). This is the lowest-detection posture: nothing is added to or read from the LinkedIn page, so there is no on-page footprint for LinkedIn to detect.
- **No `linkedin.com` host permission is requested** (we never read or inject the page) — only the Supabase project URL (and `crm.altleads.com` if A2 SSO is used). Permissions trimmed to `["sidePanel","tabs","storage"]`.
- **Residual ToS note:** reading `tab.url` is normal browser-extension behavior and does not interact with LinkedIn; the previously-noted "visible injected launcher" risk is **eliminated** by dropping injection.
- **Risk level:** Phase 1 = **low** (no hard blocker; remaining risks are the normalization fix, a higher-than-stated no-match rate, and the two new CRM dependencies for the non-owned card). Phase 2 = **medium-to-high**, correctly ALT-152-gated. **Validate with a real non-admin agent login before any inline edit ships.**

---

## 11. Open questions (for the owner)

1. **ALT-152 timing.** Phase-2 inline edit is hard-blocked until ADR-21 lands and is validated with a real agent login. Is that fix scheduled before we want the edit feature, or does Phase 2 ship later as a separate milestone?
2. **Masking vs. usefulness — DECIDED (2026-06-22).** Non-owned matches show name + company + **company status (incl. DNC)** + last-activity + owner name + "Request this company" → TL approval (§8.2). Remaining sub-question: confirm scope/fields of the new **`find_contact_for_panel`** read RPC and the **company-assignment approval** workflow on the CRM side.
3. **UI surface — DECIDED (2026-06-22): MV3 side panel, no injection.** LinkedIn banned accounts for page injection, so the shadow-DOM/injected option is **withdrawn**. Side panel + `tab.url`-only is the only architecture. (Closed.)
4. **Project scoping — DECIDED (2026-06-22): top-bar project selector in BOTH the extension and the CRM web app.** Default = the user's personal-settings selected project (or the only project); the extension reflects/shares that selection; data is scoped to the selected `project_id` (§8.0). Remaining sub-question: confirm the web app's new top-panel selector implementation.
5. **SSO (Option A2).** Lifting the Supabase session from the **`crm.altleads.com`** tab (our own domain — never LinkedIn) — acceptable security posture, or restrict to A1 (explicit login)?
6. **Atomic-write RPC.** OK to add a new **SECURITY-INVOKER** RPC (RLS still applies) to the migration set for status-UPSERT + interaction-append in one transaction, or should the extension do sequential calls like the current web data layer?
7. **"Add to CRM" on no-match.** Strictly admin/data-team only (outreach-only north-star), or allowed behind a per-project config like the create-rights decision?

---

## 12. Source-of-truth references (absolute paths)

- Match RPC + masked view + column REVOKE: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/access-masking-v1b.sql` (RPC at lines 166–201; exact `linkedin_clean = p_linkedin` at 192; `authenticated`-only EXECUTE at 199–201)
- Contacts table + `linkedin_clean` derivation: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/companies-contacts.sql`
- RLS write policies (ALT-152): `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/access-rls-v1.sql` (contact_master 209–218; interaction-on-contact 307–314)
- Project status schema: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/feature-status-schema.sql`
- Task table: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/apply-create-task-table.cjs`
- FK chains (meetings, leads): `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/foreign_keys.sql`, `.../schema.sql`
- Web data layer to mirror: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/data/contacts.ts` (`deriveLinkedinClean` 47–54 — **the un-lowercased version to fix**), `.../data/companies.ts`, `.../data/projectStatus.ts`, `.../data/tasks.ts`
- Contact-load flow to mirror: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/pages/ContactDetailPage.tsx`
- Auth/identity: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/lib/supabase.ts`, `.../contexts/AuthContext.tsx`
- Email/admin endpoints: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/notify-service/server.js` (`/notify`, `/api/users/*`)
- Decisions / ADR-21: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/docs/product/DECISIONS.md`
- Companies/contacts design: `c:/Users/pc/OneDrive - Amplior/Desktop/AL/docs/product/COMPANIES-CONTACTS-BLUEPRINT.md`
