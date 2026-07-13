# 03 — LinkedIn Mini-CRM Flow (CORE PRODUCT SPEC)

> Part of the **Chrome Extension Rebuild** doc set. This is the spec for the single highest-value feature: while a user is on a LinkedIn profile, the extension shows — and (later) edits — the matching contact in **our existing Supabase-backed AltLeads CRM**.
>
> **One backend only:** Supabase (the same project the web app uses, ref `puvozfhypqbwbmbhrhcr`). No Firebase. No separate prospects DB. No AI, credits, or research queue.
>
> **HARD CONSTRAINT — NO PAGE INJECTION, NO DOM READING (owner decision, 2026-06-22):** LinkedIn **banned the owner's users' personal accounts** for injection. Therefore the extension **MUST NOT inject anything into the LinkedIn page** and **MUST NOT read the LinkedIn page DOM/content**. The **only** input we take from LinkedIn is the **active tab's address-bar URL** (`tab.url`). All rendering happens in a **Chrome MV3 side panel** (`side_panel`), never an in-page panel. There is **no content script**, no shadow-DOM host, no `MutationObserver` on the page, and no DOM selector detection of any kind.
>
> **Two phases, hard-separated:**
> - **PHASE 1 — read-only (planned & built first).** A background service worker reads the active tab's URL → normalizes it to a slug → matches a CRM contact → the **side panel** shows the contact + associated records "in short". For a contact you **don't own**, the panel shows a **limited card + a "Request this company" button**. **Shippable now** (display); the request button is wired once the CRM TL-approval workflow exists.
> - **PHASE 2 — mini-CRM edit-in-place (LATER).** Edit fields / change status / log a call from the side panel, written back so it is **indistinguishable from a web-app edit** (same rows, same audit trail, same RLS). **Hard-gated on ALT-152** (the write-path / ownership blocker).

---

## 0. TL;DR for the owner (plain language)

- **We do NOT touch the LinkedIn page itself.** LinkedIn banned some of our people's personal accounts for putting things on the page, so the rebuilt extension is deliberately hands-off: it reads **only the web address** of the profile you're looking at — nothing on the page. Everything we show appears in Chrome's own **side panel** (the strip that opens on the right when you click the extension), not on top of LinkedIn. This is the safe posture that keeps accounts from being flagged.
- When you open someone's LinkedIn profile, the side panel checks our CRM by that profile's web address. If that person is already in our CRM **and the company is yours**, it shows their details and a short summary of their leads, meetings, tasks, and activity. If they're **in the CRM but owned by a teammate**, you see a small card (name, company, the company's status including any "Do Not Contact" flag, last activity, and who owns it) plus a **"Request this company"** button. If they're not in the CRM at all, it says so. That's **Phase 1** and we can build the display today.
- **Requesting a company:** the request goes to your **Team Lead** for approval (the same way lead/meeting approvals already work in the CRM). Once your TL approves, the company is assigned to you and you can see the full details. The request button only turns on after we build that approval step in the CRM (it doesn't exist yet).
- At the top of the panel there's a **project picker** (like the old extension). Everything you see — the company's status, meetings, contact status — is for the project you've selected.
- **Later (Phase 2)** the same panel lets the team update status, log a call, and fix details right there from LinkedIn — and the CRM records it exactly as if they'd typed it into the website. We **cannot** turn that on until we fix the known "you can only edit records you own" blocker (ALT-152), because the team's records were bulk-imported under the old owner.
- We never put any secret/admin key in the extension. It logs in as the real user, so it can only do what that user can do in the website. Safe by design.

---

## 1. Architectural ground rules (apply to both phases)

| Rule | Why |
|---|---|
| **NO page injection. NO page DOM/content read. The ONLY LinkedIn input is the active tab's URL** (`tab.url`), read in a background service worker. | LinkedIn **banned the owner's users' personal accounts** for injecting into the page (owner decision, 2026-06-22). Reading only the address bar is detection-safe and ToS-safe. No content script, no shadow-DOM, no `MutationObserver`, no selector/login-wall detection. |
| **All UI renders in a Chrome MV3 `side_panel`,** never an in-page/injected panel. | The side panel is a separate Chrome surface that does not touch the LinkedIn document, so it cannot trip injection detection. |
| **Anon key + the user's real Supabase JWT + RLS (Option A).** Never the service-role key. | The extension is indistinguishable from the web app to PostgREST/RPC, and inherits the exact same RLS + masking. Service-role would bypass all security and must stay server-only in notify-service. |
| **Match only by URL slug.** No DOM scraping of name/title/company (and now: no DOM read at all). | We only need the profile URL slug from `tab.url`. All contact detail comes from Supabase. Deterministic and detection-safe. |
| **Reads go through the masked view + existing data-layer query shapes.** | `contact_master_masked` NULLs the 5 detail columns for non-owners. Reusing the web app's query functions keeps behavior identical. |
| **Matching goes through the `find_contact_dup` RPC.** | `linkedin_url` / `linkedin_clean` are column-REVOKEd on the base table and NULLed in the masked view, so a plain `SELECT … WHERE linkedin_clean = ?` would see nothing for a non-owner. The SECURITY DEFINER RPC is the **only** masking-safe match path. |
| **Writes (Phase 2) route through the IDENTICAL data-layer mutation path** the web app uses (`projectStatus.ts` etc.), not raw `update()`. | So the audit trail, side effects, and RLS behavior are byte-for-byte the same as a web edit. |
| **Identity for writes = `profiles.user_id` as TEXT** (e.g. `"42"`), not the auth uuid. | The CRM stores `created_by`/`updated_by` as the numeric user_id-as-text. RLS owner checks compare `created_by = current_user_id()::text`. |

---

## 2. PHASE 1 — Read-only "show the contact in short"

### 2.1 The end-to-end sequence

> **All detection happens in the background service worker from `tab.url` only. Nothing runs on the LinkedIn page.** The side panel is the only UI.

```
USER on a LinkedIn tab (we never read the page — only its URL)
   │
 (1) DETECT  ── background service worker (chrome.tabs.onUpdated / onActivated)
   │            reads tab.url; is it a "linkedin.com/in/<slug>" profile URL?
   │
 (2) EXTRACT + NORMALIZE  ── tab.url ──► linkedin_clean slug (must match stored value byte-for-byte)
   │            ► service worker posts the normalized slug to the side panel
   │
 (3) MATCH  ── supabase.rpc('find_contact_dup', { p_email:null, p_linkedin:<slug>, p_mobile:null })
   │            ► returns { contact_id, full_name, company_id, company_name } OR empty
   │
 (4a) MATCH + OWNED      ──► LOAD detail + associated records (masked view + existing query shapes) ──► render FULL "in short"
 (4b) MATCH + NOT OWNED  ──► LOAD limited card via richer masking-safe RPC ──► render LIMITED card + "Request this company"
 (4c) NO MATCH           ──► clean "Not in CRM" empty state (read-only; we do NOT create data)
   │
 (5) URL CHANGE (LinkedIn is a SPA)  ── chrome.tabs.onUpdated fires again on the in-app URL change
   │            ── service worker re-runs steps 1–4 with the new tab.url (NO page MutationObserver)
```

### 2.2 Step 1 — Detect a profile page (background service worker, URL-only)

> **There is no content script and no page read.** Detection is done entirely in the background service worker by inspecting `tab.url`. This is the load-bearing consequence of the no-injection decision.

1. **Listen for tab/URL events in the service worker:**
   - `chrome.tabs.onUpdated` — fires with `changeInfo.url` (or on `status:'complete'`) when the active tab navigates **or** when LinkedIn's SPA changes the address bar without a full reload. Use this as the primary signal.
   - `chrome.tabs.onActivated` — fires when the user switches to a different tab; read that tab's `tab.url` via `chrome.tabs.get(tabId)`.
   - (Optional) on side-panel open, do an initial `chrome.tabs.query({ active:true, currentWindow:true })` to seed the first match.
2. **Cheap is-profile test:** the tab's URL contains the substring `linkedin.com/in/`. (Same matcher the old code used, now applied to `tab.url`, not `window.location`.) If it does not match, post a passive "open a person's LinkedIn profile" state to the panel and stop.
3. **No login-wall detection.** We cannot read the page, so we cannot (and must not) inspect `authWall` / `feedNav` selectors — **drop that entirely**. We simply normalize whatever slug the URL yields and try to match it; if there is no slug, we show the passive/empty state. (A guest/auth-wall URL either has no `/in/<slug>` or yields a slug that won't match — handled the same as any no-match.)
4. Only if the is-profile test passes do we proceed to extract.

### 2.3 Step 2 — Extract + normalize the URL → `linkedin_clean`

This is the **load-bearing** step. `find_contact_dup` does an **exact** `cm.linkedin_clean = p_linkedin` (no on-the-fly normalization), and the stored value was produced by the migration with `lower(...)`. **The extension's output must equal the stored value byte-for-byte, or the match silently fails.**

> **Input source changed (no-injection decision):** the URL comes from `tab.url` (read by the background service worker via `chrome.tabs` events), **not** from `window.location.href` on the page. The normalization algorithm is otherwise unchanged and remains canonical.

#### Normalization algorithm (canonical — implement exactly this)

| # | Operation | Input → Output (example) |
|---|---|---|
| 1 | Take the active tab's URL (`tab.url`) | `https://www.LinkedIn.com/in/John-Doe/details/experience/?utm=x#about` |
| 2 | **Lowercase the whole string** | `https://www.linkedin.com/in/john-doe/details/experience/?utm=x#about` |
| 3 | Strip leading `https://` or `http://` | `www.linkedin.com/in/john-doe/details/experience/?utm=x#about` |
| 4 | Strip leading `www.` | `linkedin.com/in/john-doe/details/experience/?utm=x#about` |
| 5 | Strip leading `linkedin.com/in/` | `john-doe/details/experience/?utm=x#about` |
| 6 | **Cut at first `?` (query) and first `#` (fragment)** | `john-doe/details/experience/` |
| 7 | **Split on `/`, keep ONLY the first non-empty segment** (the slug) | `john-doe` |
| 8 | Strip a trailing `/` if any remains (defensive) | `john-doe` |
| 9 | Trim whitespace; if empty → `null` (no match) | `john-doe` |

Result: `john-doe`. This is what we pass as `p_linkedin`.

> **CRITICAL correction vs. naïve reuse:** the CRM's `deriveLinkedinClean()` (in `new-code/web/src/data/contacts.ts`, lines 47–54) does **NOT lowercase** and does **NOT cut a path after the slug** — it only strips the `^https?://(www\.)?linkedin\.com/in/` prefix and a trailing `/`. The migration, however, used `lower(regexp_replace(...))`, so **stored `linkedin_clean` is lowercase and slug-only**. Copying `deriveLinkedinClean()` verbatim would therefore **fail on any mixed-case slug and on any deep-link/sub-path URL**. The extension MUST apply the full table above (lowercase + query/fragment trim + first-segment-after-`/in/`). The clean fix is to extend the shared `deriveLinkedinClean()` to lowercase + trim path/query so the web app and extension are byte-identical; until that lands, the extension implements steps 1–9 itself.

#### Normalization reference (canonical regex-style pseudocode)

```js
// `href` here is tab.url from the background service worker (NOT window.location).
function linkedinSlugFromUrl(href) {
  if (!href) return null;
  let s = href.toLowerCase();                 // (2)
  s = s.replace(/^https?:\/\//, '');          // (3)
  s = s.replace(/^www\./, '');                // (4)
  s = s.replace(/^linkedin\.com\/in\//, '');  // (5)
  s = s.split('?')[0].split('#')[0];          // (6)
  s = s.split('/')[0];                        // (7) first segment = the slug
  s = s.replace(/\/$/, '').trim();            // (8)(9)
  return s || null;
}
```

#### Normalization edge cases

| Raw URL on the page | Normalized slug | Notes |
|---|---|---|
| `https://www.linkedin.com/in/john-doe/` | `john-doe` | The baseline case. |
| `https://www.LinkedIn.com/in/John-Doe` | `john-doe` | **Lowercasing is mandatory** — the no.1 silent-miss bug. |
| `https://linkedin.com/in/john-doe/details/experience/` | `john-doe` | Deep-link sub-path trimmed (step 7). |
| `https://www.linkedin.com/in/john-doe/?miniProfileUrn=…` | `john-doe` | Query string dropped (step 6). |
| `https://www.linkedin.com/in/john-doe#experience` | `john-doe` | Fragment dropped (step 6). |
| `https://in.linkedin.com/in/john-doe` (country subdomain) | `john-doe` | `^www\.` doesn't strip `in.`; but step 5 strips from `linkedin.com/in/` and `in.linkedin.com/in/john-doe` lowercases to … note: step 3–4 leave `in.linkedin.com/in/john-doe`; step 5's `^linkedin\.com/in/` will NOT match because of the `in.` prefix. **Edge case to handle:** also strip a leading `[a-z]{2}\.` country subdomain before step 5, OR change step 5 to match `linkedin\.com/in/` anywhere-leading. Stored data is from `lead_master` which rarely had country subdomains, so this is low-frequency but should be handled to avoid a false no-match. |
| `https://www.linkedin.com/in/josé-garcía-12345` (unicode / percent-encoded) | `josé-garcía-12345` (or its percent-encoded form) | **Open risk:** the browser may present the slug percent-encoded (`%c3%a9`) while the stored value is decoded (or vice-versa). Decide one canonical form (recommend: leave as the browser presents it, lowercased) and ensure the migration/app side matches. Flag mismatches as a no-match, never a wrong-match. |
| `https://www.linkedin.com/in/` (no slug) | `null` | No match; render the "not a complete profile" / empty state. |
| `https://www.linkedin.com/company/acme/` | `null` (not `/in/`) | This is a **company** page, not a person. Phase 1 person-match does not fire. (`company_master.linkedin_url` is the company page and has no cleaned/indexed variant; company matching is out of Phase-1 scope.) |
| `https://www.linkedin.com/in/john-doe-ab12cd34` | `john-doe-ab12cd34` | LinkedIn vanity slugs include a hash suffix; keep it verbatim — it is part of the stored slug. |
| Trailing whitespace / stray casing from copy | trimmed + lowercased | Step 8–9. |

> **Data-quality reality:** `linkedin_clean` is NULL for many of the ~607 migrated contacts (LinkedIn was sparsely populated in the source outreach data), and app-written rows historically were **not lowercased** (the `deriveLinkedinClean` bug). So expect a **higher no-match / hidden rate** than a naïve estimate. The "not in CRM" state must look intentional, not broken.

### 2.4 Step 3 — Match against the CRM

1. Call the SECURITY DEFINER RPC:
   ```js
   const { data, error } = await supabase.rpc('find_contact_dup', {
     p_email: null,
     p_linkedin: slug,   // the normalized slug from step 2
     p_mobile: null,
   });
   ```
2. The RPC returns **only** `{ contact_id, full_name, company_id, company_name }` for a contact that is **live** (`deleted_date IS NULL`), **non-demo** (`is_demo = false`), and whose `linkedin_clean = slug`. No detail leak; this is the masking-safe path.
3. **Do NOT** port the old extension's 12-URL-variation brute-force loop. That existed only because the old stored URLs were un-normalized. Our data is pre-normalized and indexed (`idx_contact_master_linkedin_clean`), so this is **one** indexed lookup.
4. `company_name` comes back flat from the RPC, so the panel **header needs no second masked-view round-trip** for the matched contact.
5. **Branch on ownership.** After the match, the panel must decide which of the three display states (§2.6 / §2.9a) to render. `find_contact_dup` alone does **not** tell us whether the agent owns the contact/company or expose the company status/owner name — so for the **non-owned** path we call the richer masking-safe RPC described in §2.9a (`find_contact_card`) to get `company_status`, `last_activity`, and `owner_name` within the **selected project** (§2.10). Ownership is determined by whether `contact_master_masked` returns the detail columns (owner) vs. NULLs them (non-owner).

### 2.5 Step 4a — Load detail + associated records (mirror `ContactDetailPage.tsx`)

Use the contact_id from step 3 and the **same data-layer functions the web app already uses**. All reads are RLS/masking-governed exactly like the web app.

| # | What | Source | Web data-layer fn | Key / join |
|---|---|---|---|---|
| 1 | Contact detail | view `contact_master_masked` | `fetchContactById(contact_id)` | detail cols (email/mobile/alt/linkedin) NULL unless `can_see_contact_details(created_by)` |
| 2 | Per-project status | `contact_project_status` | `getContactStatus(contact_id, project_id)` | UNIQUE (`contact_id`, `project_id`); honors global project selector |
| 3 | Leads / deals | `lead_master` | `fetchContactLeads(contact_id, source_lead_id)` | ORs `contact_id.eq` + `lead_id.eq.<source_lead_id>` |
| 4 | Activity feed | `interaction` | `fetchActivity('contact', contact_id)` | `record_type='contact' AND record_id=contact_id` (polymorphic, NOT a real FK) |
| 5 | Tasks | `task` | (data/tasks.ts) | `task.contact_id = contact_id` (index `task_contact_id_idx`) |
| 6 | Meetings | `meeting_master` | (chain query) | **no direct contact_id** → `contact_id → lead_master.lead_id → lead_report.report_id → meeting_schedule → meeting_master` |
| 7 | Colleagues (optional) | `contact_master_masked` | `fetchCompanyContacts(company_id)` | same company; defer / collapse in v1 |

### 2.6 Panel display — "in short" (READ-ONLY, OWNED contact)

> This is the **owned = full** display state. For the **non-owned = limited card** state see §2.9a; for **no match = empty** see §2.7. The three states are mutually exclusive and must never be conflated.

| Region | Shows | Source |
|---|---|---|
| **Header** | `full_name` · `designation` · `company_name` + an **"in CRM"** badge; a **"details hidden"** badge when masking applies | `find_contact_dup` (name/company) + masked view (designation) |
| **Contact card** | `email`, `mobile_no`, `alt_mobile_no`, `linkedin_url` — **partial mask + click-to-reveal** (reuse `maskEmail`/`maskPhone` UX; matches the launch decision: partial masking + click-reveal) | `contact_master_masked` |
| **Per-project status** | `contact_status` + short `description`/`comments` snippet for the current project | `contact_project_status` |
| **Leads/deals** | count + latest stage; link out to the web CRM lead page | `lead_master` |
| **Meetings** | next / most-recent only | meeting chain |
| **Tasks** | open count + nearest `due_at` | `task` |
| **Activity** | last 3 entries (`type` · `disposition` · `note_text` · `occurred_at`) | `interaction` |

**Three-state rule for every detail field (never conflate):**

| State | Condition | Render |
|---|---|---|
| **Present** | masked view returned a value | masked text, click-to-reveal |
| **Hidden** | masked view returned NULL because `can_see_contact_details(created_by)` is false (not your record) | "details hidden — not your record" |
| **Empty** | the column is genuinely empty in the CRM | "—" / "none on file" |

Every item links back to the corresponding `crm.altleads.com` page. The panel is a **fast preview, not a replacement**. **No edit controls in Phase 1.**

### 2.7 The three display states (decision tree — never conflate)

Every match resolves to exactly one of three side-panel states:

| State | Condition | Render | Section |
|---|---|---|---|
| **OWNED = full** | `find_contact_dup` matched **and** the agent owns the contact/company (masked view returns detail columns) | full "in short" card: header, contact card (partial-mask + click-reveal), per-project status, leads, meetings, tasks, activity | §2.6 |
| **NON-OWNED = limited card + request** | `find_contact_dup` matched **but** the agent does **not** own it (masked view NULLs the detail columns) | limited card: name + company + **company status (DNC must be visible)** + last activity date + owner name (within selected project) + **"Request this company"** button | §2.9a |
| **NO MATCH = empty** | `find_contact_dup` returned empty, **or** the slug normalized to `null` | clean "Not in CRM" / "open a person's profile" empty state; **no create affordance** (outreach-only north-star) | below |

### 2.7.1 No-match / error states

| Situation | Render |
|---|---|
| `find_contact_dup` returns empty | **"No CRM contact for this LinkedIn profile."** Stop. (Read-only; we do NOT create data — outreach-only north-star.) |
| Slug normalized to `null` (incomplete/company URL) | Passive "open a person's profile" state; no RPC call. |
| RPC `error` (network/JWT expired) | "Couldn't reach the CRM — showing last good data / try again." Never throw to the UI (offline principle: serve last-good, never crash). |

> Note: "Match exists but you can't see the details" is **no longer** an error/edge state — it is the **non-owned limited card** first-class state in §2.9a, which now gives the agent something actionable (the request flow) instead of a dead "details hidden" message.

> **(Phase 2, admin/data-team only, behind a flag):** an "Add to CRM" affordance on the no-match state, **hidden for outreach roles** (creation defaults to ADMIN per the launch-access decision).

### 2.8 Step 5 — SPA navigation (LinkedIn is a single-page app), URL-only

> **No page `MutationObserver`** (we cannot and must not touch the page). SPA URL changes are detected from the browser side instead.

1. LinkedIn changes the address bar without a full reload when you click profile → profile. Chrome reports this to the **background service worker** via `chrome.tabs.onUpdated` (it fires with `changeInfo.url` on SPA history/`pushState` URL changes), and via `chrome.tabs.onActivated` when the user switches tabs.
2. On each such event, the service worker reads the new `tab.url`, re-runs the is-profile test + normalization (steps 1–2), and — if the slug changed since the last match — re-runs the match (steps 3–4) and posts the new state to the side panel. **Debounce ~300–500 ms** to coalesce the burst of `onUpdated` events LinkedIn fires per navigation.
3. This makes profile → profile navigation re-match without a reload and without any page-side observer.

### 2.9 Phase-1 surface / permissions (side panel, no injection)

- **UI surface (locked):** a Chrome **MV3 `side_panel`**. There is **no injected panel, no shadow-DOM host, no floating launcher** on the LinkedIn page. The panel opens from the extension action icon (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`) and stays docked while the user browses profiles; the background service worker pushes match results into it.
- **No content script.** All LinkedIn-side work is `tab.url` inspection in the service worker. (This is the direct consequence of the LinkedIn-ban / no-injection decision.)
- **Permissions:**
  - `"sidePanel"` — to render the panel.
  - `"tabs"` — to read `tab.url` on `onUpdated` / `onActivated` / `tabs.get` / `tabs.query`. (We need the URL field, which requires either `"tabs"` or a matching host permission; with the LinkedIn host permission below, `activeTab` is insufficient for background `onUpdated` URL reads, so `"tabs"` is the clean choice.)
  - **Drop** `"content_scripts"` and `"scripting"` entirely — there is nothing to inject.
- `host_permissions`: `https://*.linkedin.com/*`, `https://linkedin.com/*` (so the service worker can read LinkedIn tab URLs), `https://puvozfhypqbwbmbhrhcr.supabase.co/*` (Supabase reads/writes) (+ `https://crm.altleads.com/*` only for the optional A2 SSO session-lift).
- **Install-warning note:** `"tabs"` triggers a "read your browsing history" warning. This is the unavoidable cost of URL-only detection without a content script; it is the deliberate trade for not being able to (and not wanting to) touch the page.

### 2.9a Step 4b — NON-OWNED contact: limited card + "Request this company" (NEW — owner decision 2026-06-22)

When `find_contact_dup` matches but the agent does **not** own the contact/company, the panel must **not** dead-end on "details hidden." Instead it shows a **limited, masking-safe card** plus a path to gain access — the **"Request this company"** flow, which mirrors the CRM's existing lead-report / meeting **approval-to-Team-Lead** pattern.

#### What the limited card shows

| Field | Why it's shown | Source |
|---|---|---|
| Contact **name** | identify who you're looking at | `find_contact_dup.full_name` |
| **Company** name | identify the account | `find_contact_dup.company_name` |
| **Company status** (incl. **DNC / Do-Not-Contact**) | **MUST be visible** so the agent does **not** request a Do-Not-Contact company (or otherwise waste a TL approval on a dead account) | new RPC `find_contact_card` (see below), scoped to the selected `project_id` |
| **Last update / activity date** | signal whether the account is active or stale | `find_contact_card` (latest `interaction.occurred_at` for the company/contact in the project) |
| **Owner name** (within the selected project) | so the agent knows whose account it is / who the TL will reassign from | `find_contact_card` (resolve `created_by`/assignment → profile display name) |
| **"Request this company"** button | the action: ask the TL to assign this company to me | wired to the new CRM approval workflow (see dependency) |

> Contact **detail columns** (email / mobile / alt / linkedin_url) stay **hidden** in this state — they only become revealable after approval. The limited card is intentionally masking-safe: it exposes account-level metadata an agent legitimately needs to decide whether to request, never the gated PII.

#### Why `find_contact_dup` is not enough (new RPC dependency)

`find_contact_dup` returns only `{ contact_id, full_name, company_id, company_name }` and deliberately leaks no status/owner/activity. The limited card needs `company_status`, `last_activity`, and `owner_name` **within the selected project**. So Phase 1 needs a **new richer masking-safe RPC** (working name **`find_contact_card`**, SECURITY DEFINER, scoped to the caller's identity + a `p_project_id` argument) that returns:

```
{ contact_id, full_name, company_id, company_name,
  company_status,            -- per selected project; includes DNC flag/value
  last_activity,             -- latest interaction timestamp for the company/contact in the project
  owner_name,                -- display name of the current owner within the project
  is_owned_by_caller }       -- so the panel can pick the owned-vs-limited state without guessing from NULLs
```

This RPC is **masking-safe** (it returns account-level metadata only, never the gated PII columns) and is a **Phase-1 build item**. It does not exist yet (dependency — track as an ALT-### ticket).

#### The request → TL approval workflow (NEW CRM workflow — a dependency, NOT built yet)

1. Agent clicks **"Request this company"** on the limited card.
2. The extension submits a request **using the same data-layer path the CRM already uses for lead-report / meeting approvals** (so it lands in the TL's existing approval queue, with the same audit/notify behavior — never a bespoke side channel). The request carries `{ company_id, contact_id, requesting_user_id, project_id }`.
3. The request goes to the **agent's Team Lead** for approval (TL is resolved from the CRM hierarchy, same as the meeting/lead-report approval routing).
4. **On TL approval:** the company is **assigned to the agent** (the assignment re-points ownership for that project — the same mechanism ALT-152 / ADR-21 uses for "edit records assigned to you"). Once assigned, `contact_master_masked` returns the detail columns to the agent, so the panel flips to the **owned = full** state (§2.6) on the next match/refresh; contact details become **revealable** (partial-mask + click-reveal).
5. **On TL rejection / pending:** the panel keeps showing the limited card; surface "Requested — pending TL approval" if a request is already open (so the agent doesn't double-request).

> **This approval workflow does not exist in the CRM today.** It must be built as a **NEW CRM workflow** (mirroring lead-report/meeting approvals): a request record + TL approval queue UI + an assignment-on-approve action that re-points company ownership for the project. **Track it as a dependency** (ALT-### ticket); the **"Request this company" button is wired only once this workflow ships** (see §2.9b sequencing). Until then, Phase 1 renders the limited card with the request button **disabled / "coming soon"**.

> **DNC emphasis:** because company status (including Do-Not-Contact) is shown on the limited card, an agent can see at a glance not to request a DNC account. Make the DNC state visually prominent (e.g. a red "Do Not Contact" badge), and consider disabling the request button when the company is DNC.

### 2.9b Phase-1 build sequencing (owner decision 2026-06-22)

**Phase 1 is planned and built first (read-only).** Within Phase 1:

1. **First:** URL-only detection (service worker) + normalization + match + the **three display states' rendering** — owned full card, **non-owned limited card** (with `find_contact_card`), and no-match empty. The limited card's **display** (name/company/status/DNC/last-activity/owner) is a **Phase-1 display item** and ships with Phase 1.
2. **Then:** the **"Request this company" button is wired** once the new CRM TL-approval workflow exists (§2.9a). It is the only part of the limited card gated on a not-yet-built CRM dependency; everything else in the card renders from `find_contact_card` immediately.

So the limited **card** is Phase 1; the request **action** turns on when its CRM workflow lands.

### 2.10 Project selector (top of the side panel) — owner decision 2026-06-22

The side panel has a **project selector at the top** (like the old extension). All per-project data is scoped to the selected `project_id`.

1. **Population:** the selector lists the projects the user has access to (same source the web app uses for its project selector — the user's project memberships).
2. **Default:** the user's **CRM personal-settings project** (their saved default project). If the user has access to only **one** project, that project is selected with no choice to make.
3. **What it scopes (everything per-project):**
   - `contact_project_status` — the per-project contact status shown on the owned card.
   - **Company status** (incl. **DNC**) — shown on both the owned card and the non-owned limited card; comes from the per-project company status.
   - **Meetings** — the meeting chain is filtered to the selected project.
   - `find_contact_card` — called with `p_project_id` = selected project (so `company_status` / `last_activity` / `owner_name` are the values **for that project**).
4. **Changing the project re-loads the panel:** when the user picks a different project, the panel **re-runs the per-project loads (steps 3–4)** for the **currently matched contact** using the new `project_id` — the LinkedIn URL/slug does **not** change, so we do **not** re-detect; we only re-query the project-scoped data and re-render (status, company status/DNC, meetings, owner name, and the owned-vs-limited state, since ownership/assignment is per-project). Persist the last-selected project in `chrome.storage` so it survives panel reopen.
5. **Ownership is per-project:** because assignment/ownership can differ by project, the **owned-vs-non-owned display state is recomputed when the project changes** (the same contact may be owned in project A and non-owned in project B).

---

## 3. PHASE 2 — Mini-CRM edit-in-place (LATER, ALT-152-gated)

> **GOAL (product #4):** an edit made in the LinkedIn panel must be recorded **EXACTLY** as if it were made in the CRM web app — same DB rows, same audit trail, same RLS, same notifications. Achieved by routing every write through the **same data-layer functions** (`projectStatus.ts` etc.), never raw `update()` + `lastUpdated` (the old extensions' bare-write-no-audit anti-pattern, explicitly rejected).

### 3.1 What is editable in the panel

| Editable control | Target table | Re-derive / side effect |
|---|---|---|
| **Contact status** (per project) | UPSERT `contact_project_status` on (`contact_id`, `project_id`) | append `status_change` to `interaction` + mirror onto company feed (`logCompanyContactActivity`) |
| **Status notes / comments** | same UPSERT | same `status_change` interaction |
| **Disposition** (Accurate / Wrong / Unverified — UX blueprint only) | `interaction.disposition` + status | `logDisposition()` shape |
| **Log a call** | append `call` row to `interaction` | (no status change required) |
| **Contact fields** (email / mobile / alt mobile / designation / linkedin_url) | UPDATE `contact_master` | **re-derive `linkedin_clean` via `deriveLinkedinClean()`** so the match key stays valid; set `updated_date` |
| **Lead-scoped comment** | `lead_activity` via `addActivityComment()` (human) / `logSystemActivity()` (`is_generated=true`) | per-lead trail |

> **Edit-form blueprint:** reuse the old Edit-Form "existing record found" pre-fill panel + the partial-mask / click-to-reveal pattern as the UX model (matches the CRM masking + click-reveal launch decision).

### 3.2 The write recipe (must mirror the web data layer exactly)

| # | Step | Detail |
|---|---|---|
| 1 | **Identity** | Stamp `created_by` / `updated_by` = acting user's **numeric `user_id` as TEXT** (e.g. `"42"`) from `profiles.user_id` (exposed by AuthContext) — **NOT** the auth uuid. Always set `*_date` to an ISO timestamp. **Never** supply IDENTITY PK columns. |
| 2 | **Status change** | UPSERT `contact_project_status` on (`contact_id`,`project_id`) with new `contact_status`/`description`/`comments` + `updated_by`/`updated_date` (and `created_by`/`created_date` on first write) **AND** append a `status_change` row to `interaction` (`record_type='contact'`, `record_id=contact_id`, `project_id`, `owner_user_id`, `type`, `disposition`, `note_text` from `describeChange()` e.g. `"contact_status: hot; comments updated"`, `occurred_at`, `created_by`). Mirror onto the company feed via `logCompanyContactActivity()`. |
| 3 | **Log a call** | append a `call` `interaction` row (same shape). |
| 4 | **Edit contact fields** | UPDATE `contact_master`; **re-derive `linkedin_clean`** so the match key stays correct; set `updated_date`. |
| 5 | **Lead-scoped events** | `lead_activity` via `addActivityComment()` / `logSystemActivity()`. |
| 6 | **Notifications (optional, to fully match web)** | `notifyInApp()` writes `in_app_notification` (bell feed) + `notify()` POSTs `/notify` on notify-service (Bearer JWT) for the fire-and-forget email. |

**Why "identical to a CRM change":** the CRM's real audit surfaces are `interaction` (per-contact/company/lead feed), `lead_activity` (per-lead), and `in_app_notification` (bell). Writing the **same rows with the same conventions** (user_id-as-text, ISO dates, no identity PKs, `describeChange()` notes) means nothing in the CRM can tell a LinkedIn edit from a web edit.

### 3.3 Atomicity

- The old ResearchExt's best idea — write the record **and** flip status in **one** Firestore batch — maps to a **Supabase RPC (SECURITY-INVOKER, so RLS still applies)** doing the UPSERT + interaction-append in **one transaction**.
- Preferred over multiple round-trips so a status change and its audit row never half-commit.
- **We do NOT use SECURITY DEFINER to bypass RLS for edits.** SECURITY-INVOKER keeps the user's RLS in force.

### 3.4 Optimistic UI + concurrency

| Concern | Approach |
|---|---|
| Snappy panel | **Optimistic UI:** reflect the change immediately, reconcile on the server response; roll back + toast on error (incl. 42501). |
| Two editors clobbering each other | The old code is last-write-wins with no guard. Add an **`updated_date` (version) check** on `UPDATE contact_master` / status UPSERT — reject/merge if `updated_date` moved since load. |
| Audit conflicts | `interaction` is **append-only**, so the audit trail is naturally conflict-free. |

### 3.5 How it survives RLS / the write-path ownership blocker (ALT-152) — the hard dependency

Every Phase-2 write is RLS-gated. **The extension inherits the CRM's RLS identically — it does not, and must not, work around it.**

| Write target | RLS write predicate (from `access-rls-v1.sql`) | Consequence on bulk-migrated rows |
|---|---|---|
| `contact_master` (field edits) | admin **OR** `created_by = current_user_id()::text` — **owner-only, no manager/assignment fallback** (lines ~209–218) | A real agent gets **Postgres 42501** on most records (migrated `created_by` = legacy/internal owner). |
| `contact_project_status` (status UPSERT) | admin **OR** record owner **OR** `manages_project(project_id)` | Manager can pass this even when they can't edit the contact itself. |
| `interaction` on `record_type='contact'` (audit append) | admin **OR** record owner — **owner-only, no manager branch for contacts** (lines ~307–314) | The **audit append itself** fails 42501 on migrated contacts. The "recorded exactly as in CRM" goal is **also** ALT-152-blocked, not just the status row. |

**Three independent corrections the blueprint must respect:**

1. **The audit append is a second, independent blocker.** Fixing only `contact_project_status` is insufficient — the contact-typed `interaction` INSERT is its own owner-only gate. On a migrated contact, even logging the `status_change`/`call` audit row 42501s.
2. **Three tables, three different predicates.** `contact_master` (owner-only) ≠ `contact_project_status` (owner-or-manager) ≠ `interaction`-on-contact (owner-only). A **manager** can set status but fail the contact edit and the audit append. The ALT-152 fix must **align all three write gates** under one "edit records assigned to you" rule (ADR-21), or Phase-2 edits will be half-working.
3. **An atomic SECURITY-INVOKER RPC is necessary but not sufficient** — bundling the writes in one transaction doesn't help if the three underlying predicates still disagree; the transaction just fails atomically instead of partially. The predicates must be reconciled first.

**Behavioral contract for the extension:**

- Surface the **same friendly 42501 message** the web app already uses: *"You can only edit records you own (ask an admin or the owner's manager)."*
- **Do NOT** embed the service-role key to bypass RLS. There is **no record-edit service endpoint** today (only `/notify` + admin user-management). The **only** sanctioned unblock is **ALT-152** (ADR-21: assignment-based write — edit records ASSIGNED to you via `lead_report.user_id` / a re-pointed owner), validated with a **real non-admin agent login** before any inline edit ships.
- Until ALT-152 lands and is validated, the extension stays **read-only**, exactly like the safe slice of the web app.

### 3.6 Phase-2 gate checklist (do not start edit writes until ALL are true)

1. ☐ ADR-21 assignment-based write model is implemented and **aligns `contact_master` + `contact_project_status` + `interaction`-on-contact** write gates.
2. ☐ Validated with a **real non-admin agent login** that a migrated record can be edited + status-changed + audited without 42501.
3. ☐ Atomic SECURITY-INVOKER RPC (UPSERT + interaction-append) added to the migration set and tested under RLS.
4. ☐ Optimistic UI + `updated_date` concurrency guard wired.
5. ☐ "Add to CRM" on no-match remains admin/data-team only (or per-project config per the create-rights decision).

---

## 4. Firestore → real CRM table mapping (we map onto EXISTING tables; we do NOT recreate the old schema)

| Old Firestore | Real CRM target | Notes |
|---|---|---|
| `prospects` | `contact_master` (base, RLS-write) read via `contact_master_masked` | match key `personalLinkedin` → `linkedin_clean` (indexed) |
| `prospects.firstName/lastName/fullName` | `contact_master.full_name` | |
| `prospects.workEmail / contactNumber1/2` | `email` / `mobile_no` / `alt_mobile_no` | |
| disposition enum (Accurate/Wrong/Unverified) | `interaction.disposition` + `contact_project_status.contact_status` | per-field enum is a **UI blueprint only**; CRM models verification on the feed, not per-column |
| `contactRequests` (research queue) | **DROP** | we match an existing contact; no fulfillment queue |
| `users` (keyed by Firebase uid) | `profiles` (`id`=auth.uid, `user_id` bigint, `role`) + `user_role` × `role_master` | auth = Supabase Auth |
| `teams` + `teamId` isolation | numeric `project_id` scoping + RLS (`manages_project()`/`project_user`) | **not** a client-side `.where(teamId)` |
| `credits`, `products`, `personas`, `aiModels` | **DROP** | out of scope (no metering, no AI) |
| `activityLogs` | `interaction` + `lead_activity` + `in_app_notification` | **this** is the hook for "recorded exactly as in the CRM" |
| `cloudSync.js` TTL/settingsVersion cache | **DROP** | keep only the principle: serve last-good data, never throw to UI |
| 12-URL brute-force match | `supabase.rpc('find_contact_dup', { p_linkedin: slug })` | one indexed, masking-safe lookup |
| Firebase uid stamped on writes | `profiles.user_id`-as-text on `created_by`/`updated_by` | |

---

## 5. Auth (shared by both phases)

- **Option A — anon key + the user's real Supabase JWT + RLS.** The extension runs its own `@supabase/supabase-js` singleton built from the URL + **public anon key** (already shipped in the web bundle — safe). Every read/write carries the user's JWT, so PostgREST + RPC + RLS govern the extension exactly like the web app.
  - **A1 (ship first):** popup prompts email/password → `signInWithPassword` → own session JWT (persisted in `chrome.storage`). Mirror AuthContext: load `profiles` (`id`, `user_id`, `role`) + `user_role` × `role_master` so we have `profiles.user_id` for write stamping.
  - **A2 (SSO upgrade):** with `host_permission` for `crm.altleads.com`, lift the persisted Supabase session from the CRM tab's localStorage → `setSession`. Single sign-on with the open CRM tab.
- **AVOID** the Client/Sales portal session path (`portal.client_portal_user`) — a RESTRICTIVE deny-policy locks portal sessions out of every CRM base table. Use the normal authenticated path.
- **NEVER** embed the service-role key (bypasses all RLS — stays server-only in notify-service). Strip every dev "skip login" backdoor from the old code.

---

## 6. What we keep vs. drop (for this feature)

**KEEP (port the pattern, not the Firebase code):**
1. **Project selector** at the top of the panel (port the old extension's project-picker UX; default to the user's personal-settings project — §2.10).
2. SPA handling — **but moved off the page:** detect URL changes via `chrome.tabs.onUpdated` / `onActivated` in the background service worker (debounced), **not** a page `MutationObserver` (§2.8).
3. LinkedIn URL primitives only: `/linkedin\.com\/in\/([^/?#]+)/i`, the `linkedin.com/in/` is-profile test — applied to `tab.url`. **DROP the authWall/feedNav login-wall selector detection** (we can't read the page).
4. The normalization **spec** (mirrored to the migration byte-for-byte, plus query/fragment trim + first-segment-after-`/in/`) — fed from `tab.url`.
5. UX blueprints: disposition verification model, partial mask + click-to-reveal, "existing record found" pre-fill panel.
6. Atomic batch-write idea → mapped to a Supabase SECURITY-INVOKER RPC transaction.
7. Offline principle only: serve last-good data, never throw.

**DROP:** **ALL page injection — shadow-DOM hosts, in-page panel, floating launcher, content script** (LinkedIn banned personal accounts for injection — owner decision 2026-06-22); **ALL page DOM/content reading**, including the authWall/feedNav login-wall detection and any field-scraping; the page `MutationObserver`; entire Firebase SDK + Firebase Auth + hardcoded config (treat the shared key as compromised); all AI/LLM code + AI `host_permissions`; credits/plans; `products`/`personas`/`aiModels`; `cloudSync` TTL cache; the research-fulfillment queue; the 12-URL brute-force loop; dev "Skip Sign In" backdoors; client-side `teamId` isolation / client-side role gates as the security boundary (RLS is the boundary); raw `update()`+`lastUpdated` writes with no audit.

---

## 7. Source-of-truth references (absolute paths)

| What | File |
|---|---|
| `Contact` interface + `deriveLinkedinClean()` (the normalization-bug source) | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/data/contacts.ts` (lines 47–54) |
| Contact load flow to mirror | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/pages/ContactDetailPage.tsx` |
| Status/interaction write path (`appendInteraction`, `describeChange`, `logDisposition`) | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/data/projectStatus.ts` |
| Tasks data layer | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/data/tasks.ts` |
| Companies data layer | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/web/src/data/companies.ts` |
| `contact_master` + `linkedin_clean` migration (`lower(regexp_replace(...))`) | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/companies-contacts.sql` |
| `contact_master_masked` view + `find_contact_dup` RPC | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/access-masking-v1b.sql` |
| RLS write policies (ALT-152 owner-only gates) | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/access-rls-v1.sql` |
| `company_master`, `lead_master`, `meeting_master`, `meeting_schedule` | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/schema.sql` |
| `contact_project_status` / `company_project_status` | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/feature-status-schema.sql` |
| `task` table | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/new-code/migration/apply-create-task-table.cjs` |
| Design doc | `c:/Users/pc/OneDrive - Amplior/Desktop/AL/docs/product/COMPANIES-CONTACTS-BLUEPRINT.md` |

---

## 8. Open questions (decide before/with build)

1. **ALT-152 timing** — Phase-2 inline edit is hard-blocked until ADR-21 assignment-based write lands and is validated with a real agent login. Is that fix scheduled before we want the edit feature, or does Phase 2 ship as a separate later milestone?
2. ~~**Masking vs. usefulness**~~ — **DECIDED 2026-06-22:** for a non-owned matched contact, build the new masking-safe **`find_contact_card`** RPC (name + company + company status/DNC + last activity + owner name, per project) and a **"Request this company" → TL approval** flow (§2.9a). Open sub-question: exact name/shape of the request record and approval-queue reuse.
3. ~~**Side panel vs. injected shadow-DOM**~~ — **DECIDED 2026-06-22:** **MV3 `side_panel`, no injection, no page DOM read** (LinkedIn banned personal accounts for injection). Closed.
4. ~~**Project scoping**~~ — **DECIDED 2026-06-22:** **project selector at the top of the panel** (default = user's personal-settings project / the only project); all per-project data scoped to it (§2.10). Closed.
5. **SSO (Option A2)** — reading the Supabase session from `crm.altleads.com` localStorage via host permission: acceptable posture, or restrict to A1 (explicit popup login)?
6. **Atomic-write RPC** — OK to add a new SECURITY-INVOKER RPC (UPSERT + interaction-append) to the migration set, or sequential calls like the current web data layer?
7. **"Add to CRM" on no-match** — strictly admin/data-team only, or behind a per-project config like create-rights?
8. ~~**LinkedIn ToS / detection**~~ — **DECIDED 2026-06-22:** no page injection at all; action-icon-only side panel; URL-only reading. The `"tabs"` permission's "read browsing history" install warning is the accepted trade-off (§2.9). Closed.
9. **Request-flow CRM dependency** — the "Request this company" → TL-approval workflow is a **new CRM workflow** that does not exist yet (§2.9a). When is it scheduled? The request button stays disabled until it ships.

---

## 9. Verdict

**FEASIBLE WITH CORRECTIONS.**
- **Phase 1 (read-only match + display) is shippable today, in the no-injection / URL-only posture.** Primitives confirmed in source: `find_contact_dup` (SECURITY DEFINER, exact `linkedin_clean` match), `linkedin_clean` + its index, the masked view, Option-A auth. Detection is **service-worker `tab.url` only** (no content script, no page DOM read — LinkedIn banned personal accounts for injection); UI is a **`side_panel`** with a **project selector** at the top. **Must apply the normalization correction** (lowercase + query/fragment trim + first-segment-after-`/in/`) or matches silently miss.
- **Two new Phase-1 dependencies from the 2026-06-22 decisions:** (a) a **`find_contact_card`** masking-safe RPC (name + company + company status/DNC + last activity + owner name, per project) powering the **non-owned limited card**; and (b) the **"Request this company" → Team-Lead approval** workflow, a **new CRM workflow** (mirroring lead-report/meeting approvals + assignment-on-approve). The limited **card displays** in Phase 1; the request **button is wired only when (b) ships**.
- **Phase 2 (edit-in-place) is hard-blocked on ALT-152**, and the blocker surface is **wider** than first stated: the contact-field edit **and** the contact-typed `interaction` audit append are **independently owner-only-gated**, and the three write tables have **three different predicates**. Approve Phase 2 only after an ALT-152 fix that **aligns** `contact_master` + `contact_project_status` + `interaction` write gates, validated with a real non-admin agent login.
