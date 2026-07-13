# Chrome Extension Rebuild — 01. Current-State Analysis

> **Purpose of this doc:** Faithfully document the THREE existing pieces of code we analyzed (AltLeads Chrome Ext 4.1.0, Data ResearchExt, AL Prospect Finder Web App) before we rebuild a LinkedIn-overlay mini-CRM on top of Supabase + the live AltLeads CRM. This is a *current-state inventory and reference*, not a build plan. Nothing here is invented — every claim traces to the analyzed source.
>
> **TL;DR for the owner (plain language):** We have three old apps built on Google's "Firebase". One is the salesperson extension that shows a contact's CRM details when you open their LinkedIn (this is the one we copy the *idea* from). The second is a back-office "research team" extension that fills in missing phone/email and pushes it back. The third is an older web app + a near-empty extension that never actually read LinkedIn at all. All three share ONE Firebase project and have hardcoded keys we should treat as exposed. For the rebuild we keep the *concepts* (match a LinkedIn URL to a CRM contact, show a panel, verify fields) and throw away all the Firebase/AI/credits machinery, enforcing security with Supabase RLS instead.
>
> ⚠️ **SUPERSEDED — read before reusing anything below (locked 2026-06-22):** This doc describes the OLD code as-is, including its **content scripts, shadow-DOM injection, on-page floating launcher, and page `MutationObserver`**. Those are **historical analysis only.** The rebuild **FORBIDS all LinkedIn-page injection and DOM reading** — LinkedIn banned the owner's users' personal accounts over injection. So **ignore every "port it / reuse directly / reuse the injection pattern" suggestion in this file.** The rebuild is a Chrome **side panel** that reads **only the active tab's address-bar URL**; SPA navigation is detected via `chrome.tabs.onUpdated` (off-page), never a page observer. The authoritative forward design is in [02-MIGRATION-BLUEPRINT](./02-MIGRATION-BLUEPRINT.md), [03-LINKEDIN-MINI-CRM-FLOW](./03-LINKEDIN-MINI-CRM-FLOW.md), and [04-PHASE-1-BUILD-PLAN](./04-PHASE-1-BUILD-PLAN.md). The ONLY reusable primitive is the `/in/<slug>` URL parse — not any injection/DOM code.

---

## 0. Components at a glance

| # | Component | Type | Version | Firebase project | LinkedIn detection in code? | Rebuild role |
|---|-----------|------|---------|------------------|-----------------------------|--------------|
| 1 | **AltLeads Chrome Ext 4.1.0** — "AltLeads - B2B Sales Intelligence" | MV3 side-panel extension | 4.1.0 (content script self-labels v4.6.0) | `altleads-prospect-finder` | **Yes** (content script) | **PRIMARY rebuild target** |
| 2 | **Data ResearchExt** — "AltLeads Research - Contact Fulfillment" (a.k.a. "RightReach/RR Research") | MV3 in-page injected panel extension | 2.1.0 (cloudSync says 3.0.0, popup says 2.0.0) | `altleads-prospect-finder` (same) | **Yes** (content script, URL-slug only) | Secondary rebuild target (research/fulfillment side) |
| 3 | **AL Prospect Finder Web App** — "altleads-prospect-intelligence" | React 19 + Vite SPA + near-empty companion MV3 extension | Web app (no version); extension "1.0" | `altleads-prospect-finder` (same) | **No** (zero detection code) | Reference for data model + intent only |

All three are clients of **one shared Firestore database**. The web app is the admin/management console; the two extensions are the field clients.

---

# Part A — AltLeads Chrome Ext 4.1.0 (PRIMARY target)

**Path:** `c:/Users/pc/OneDrive - Amplior/Desktop/AL/Chrome Extension EcoSystem/AltLeads Chrome Ext 4.1.0`

## A.1 Purpose

A Chrome **side-panel** extension that runs on LinkedIn profile pages. It:

1. Reads the open LinkedIn profile (page text + experience).
2. Matches the profile URL against an existing prospect record in Firestore, showing that contact's CRM details (designation, masked email/phones with verification "disposition", company, remark) in a **Contact** tab.
3. Layers AI features on top: AI profile extraction, prospect scoring vs a selected product/persona, deep web research, and 4 generated outreach pitches.
4. Meters everything with a **credit** system.

**What we rebuild against Supabase = exactly the CRM-lookup-on-LinkedIn slice (steps 1–2 + Contact tab).** The AI scoring/pitch layer (step 3) and the credits system (step 4) are **NOT in our target scope and can be discarded.**

> **Version provenance note:** the content script's internal comment says `v4.6.0 (Ghost Mode Hardened)`, but the manifest/release is **4.1.0**. Provenance is muddy (see Risks).

## A.2 Manifest & permissions (MV3)

| Field | Value |
|-------|-------|
| `manifest_version` | 3 |
| `name` | "AltLeads - B2B Sales Intelligence" |
| `short_name` | "AltLeads" |
| `version` | 4.1.0 |
| `permissions` | `storage`, `activeTab`, `scripting`, `sidePanel`, `tabs` |
| `host_permissions` | `https://www.linkedin.com/*`, `https://*.linkedin.com/*`, `https://firestore.googleapis.com/*`, **plus AI hosts** `https://inference.do-ai.run/*`, `https://api.groq.com/*`, `https://generativelanguage.googleapis.com/*`, `https://openrouter.ai/*` |
| `background` | service worker `background.js` (NOT `type: module`) |
| `content_scripts` | matches `https://*.linkedin.com/*` + `https://linkedin.com/*`; js = `content/linkedinScraper.js`; `run_at: document_idle` |
| `side_panel.default_path` | `sidepanel/panel.html` |
| `action` | `default_icon` only — opens side panel via `chrome.action.onClicked` + `setPanelBehavior({ openPanelOnActionClick: true })` |
| `content_security_policy.extension_pages` | `script-src 'self'; object-src 'self'` |

**Diff vs 4.0.0 manifest:** ONLY the version string (`4.0.0` → `4.1.0`). Permissions / matches / host_permissions are identical.

## A.3 Files

| File | Role | Diff vs 4.0.0 |
|------|------|---------------|
| `manifest.json` | MV3 manifest (above) | Version only |
| `firebase-config.js` | Hardcoded Firebase project config + `FIRESTORE_CONFIG = {collection:'prospects', linkedinField:'personalLinkedin'}` | Identical |
| `content/linkedinScraper.js` | **Manifest-loaded content script.** LinkedIn profile detection, slug/URL handling, SPA URL observer, DOM text+experience extraction, dormant Ghost-Mode floating icon. **Most important file for rebuild's detection/extraction.** | Identical |
| `content/reader.js` | On-demand injected fallback reader (same extraction as scraper + passive no-scroll `waitForSections`) | Identical |
| `sidepanel/panel.js` | **CRITICAL.** Side-panel logic: `lookupContact()` LinkedIn→prospects match (slug regex + 12 URL variations), `renderContactSummary` masking/disposition writes, `contactRequests`, credits transactions, AI orchestration | Adds deep-research render card, token-usage display, locked-disposition badge |
| `sidepanel/panel.html` | Side-panel markup; loads firebase compat SDKs + cloudSync + firebase-config + panel.js. Info/Contact tabs | — |
| `popup/popup.js` | Firebase Auth email/password login, role/status gate, Firestore `users`/`teams`/`products`/`personas`/`aiModels` load + local cache | Adds local-only Core Knowledge + personal API-key UI |
| `lib/cloudSync.js` | Config sync (team/products/personas/models) into `chrome.storage.local` with TTL cache + user>team resolve helpers; `logActivity`/`logProfileView` (unused) | Identical |
| `background.js` | MV3 service worker: AI provider routing (Groq/Gemini/OpenRouter/DO Gradient), extract/score/pitch/research handlers, side-panel open. **OUT OF SCOPE.** | Adds marketing-brain imports + DO Gradient + personal-key routing |
| `extension_schema.md` | Authoritative `prospects` + `contactRequests` + `credits` schema and the correct dedup/normalization spec. **Best single reference for the Supabase contact model.** | — |
| `FIRESTORE_UPDATES_PHASE7.md` | Backend change-request doc: credits schema, costs, lazy reset, security rules; **leaks a real-looking DO Gradient key** | — |
| `../AltLeads Chrome Ext 4.0.0` | Sibling prior release. `content`/`reader`/`cloudSync`/`firebase-config` identical; manifest differs only in version; `panel.js`/`popup.js`/`background.js` are 4.1.0 minus the additive features above. **Not a separate rebuild target.** | — |

## A.4 LinkedIn detection & scraping logic (the reusable core)

| Concern | Implementation found |
|---------|----------------------|
| **Is-profile test** | substring `'linkedin.com/in/'` |
| **Slug regex** | `/linkedin\.com\/in\/([^/?#]+)/i` |
| **SPA navigation** | MutationObserver URL-change pattern in `content/linkedinScraper.js` (LinkedIn is an SPA) |
| **Match against CRM** | `panel.js` `lookupContact()` queries `prospects` by `personalLinkedin` against **12 guessed URL variations** of the current slug |
| **Normalization spec** | Documented in `extension_schema.md`: strip `https`/`http`/`www`/trailing-slash |
| **Login-wall detection** | selectors `authWall` / `feedNav` — distinguishes logged-in LinkedIn from a public/guest page |
| **Structured field scraping** | minimal & LLM-dependent (page text → LLM); not relied on for matching |

> **Key reusables (port directly):** the slug regex, the `'linkedin.com/in/'` is-profile test, and the SPA MutationObserver pattern. **Do NOT copy** the 12-URL-variation brute-force loop — it only exists because stored URLs were un-normalized. Fix the data instead (normalize once, index, single lookup).

## A.5 Firebase / Firestore usage

- **SDK:** Firebase compat SDKs loaded in `panel.html`; `panel.js` calls `firebase.firestore()` directly.
- **Reads:** `prospects` by `personalLinkedin`; team/user config from Firestore (cached in `chrome.storage.local` via `cloudSync.js`); credits balance.
- **Writes:**
  - `prospects` disposition updates — bare `update()` with the field + `lastUpdated` (last-write-wins, no real audit trail).
  - `contactRequests` inserts (on "Request Info").
  - `credits` transactions (spend) via Firestore `runTransaction` — the **only** concurrency guard anywhere.
- **AI artifacts** are cached locally only.
- Full collection shapes are consolidated in **Part D**.

## A.6 cloudSync logic (`lib/cloudSync.js`)

- **Identical in 4.0.0 & 4.1.0.**
- `CACHE_TTL_DAYS = 0` — a **TESTING override** (comment says set to 5 for prod), so `isCacheValid()` is effectively always false → refreshes whenever called, degrades gracefully to cache on error.
- `syncFromCloud(db, forceRefresh)`: requires `rrUser.teamId`; cache-busts by comparing `teams/{teamId}.settingsVersion` to cached `cachedSettingsVersion`; then fetches the team doc, then `products`/`personas` by `documentId` `in` `team.productIds`/`personaIds` (sliced to 30), all `aiModels` where `isActive == true`, and `users/{uid}`. Writes `cachedTeam` / `cachedProducts` / `cachedPersonas` / `cachedModels` / `cachedUserPrefs` / `lastSyncTime` / `cachedSettingsVersion`.
- Resolution helpers `resolve()` / `resolveApiKey()` / `resolveModel()` / `resolveTemplate()` / `resolvePrompt()` / `resolveSystemPrompt()` implement **user-value-overrides-team-default** fallback.
- `logActivity()` / `logProfileView()` exist (write `activityLogs` / `profileViews`) but are **NOT invoked anywhere in 4.1.0** (dead code).
- **Conflict handling:** essentially none — writes are last-write-wins single-field `update()`s on `prospects`/`credits`; only concurrency guard is the credit-spend `runTransaction`.
- **Offline:** serve last cached config from `chrome.storage.local`. Profile/score/pitch/research results cached per `profileUrl` in `chrome.storage.local` (`profileCache` 24h, `pitchCache`, `deepResearch`, `unlockedContacts` permanent).
- **Important:** the panel (`panel.js`) does its **own** Firestore fetches (lookupContact, credits, disposition writes) directly via `firebase.firestore()` and does NOT route through `cloudSync.js`. cloudSync is **only** used for config sync.

## A.7 Data flows (summary)

- **Reads:** `prospects` by `personalLinkedin`; page DOM via content-script messaging; team/user config from Firestore cached in `chrome.storage.local`.
- **Writes:** `prospects` disposition updates (immediate `update()` + `lastUpdated`); `contactRequests` inserts; `credits` transaction spends.
- AI artifacts cached locally only. Cache TTL = 0 days (testing) in `cloudSync.js`.

## A.8 UI surfaces (three)

1. **POPUP** (`popup/popup.html`+`js`) — opened on the toolbar icon (small window) AND as a Settings window from the side panel.
   - Login view (email/password).
   - Main view tabs: **Products**, **Personas**, **Settings** (API keys, per-task AI model pickers, pitch templates, system prompt, user profile, personal local-only Groq/Gemini keys, Core Knowledge brand-kit/problem-solutions text, active product).
   - Products/Personas are **READ-ONLY for agents** (managed in the web app).
2. **SIDE PANEL** (`sidepanel/panel.html`+`js`) — the **main working surface**.
   - Header: product switcher + credits badge + refresh + settings.
   - **"Info" tab:** AI score badge, AI Analysis summary, Company Research card, 4-pitch tabs (Formal / Casual / Discover / Direct) with Copy, Scout / Generate buttons.
   - **"Contact" tab** (the CRM record): name/company, designation, location, masked `workEmail` + up to 3 phones + reception, **each with a colored disposition select**, company industry/size/website, remark, **Reveal-Contact (10 credits)** button, Request / Re-Request Contact Info.
3. **CONTENT SCRIPT** — injects **NO UI**. "**Ghost Mode**" is ON (`GHOST_MODE = true`), so the floating LinkedIn icon (`createFloatingIcon`) is deliberately disabled/commented out. The content script only extracts data and can request `OPEN_SIDE_PANEL`. The shadow-DOM floating icon + drag code exists but is **dormant**.

## A.9 What is reusable as reference

**KEEP AS REFERENCE:**

1. LinkedIn slug regex `/linkedin\.com\/in\/([^/?#]+)/i` + the `'linkedin.com/in/'` is-profile test + the SPA MutationObserver URL-change pattern (`content/linkedinScraper.js`) — **reuse directly.**
2. The normalization+dedup spec in `extension_schema.md` (`amplior_id` > normalized `personalLinkedin` > fuzzy `fullName`+`companyName`). For Supabase: store a canonical `linkedin_url` on contacts, do **ONE indexed lookup**. Do NOT copy the 12-URL-variation brute-force loop.
3. Login-wall detection selectors (`authWall` / `feedNav`) — tell "logged-in LinkedIn" from a public/guest page.
4. The **"Contact tab" UX as the product blueprint:** disposition (Accurate / Wrong / Unverified) verification model, partial masking + click-to-reveal of email/phone, Request-Contact escalation. Maps cleanly onto the CRM's masking/click-reveal decision (per launch-access decisions). `renderContactSummary()` / `maskEmail()` / `maskPhone()` / disposition-dropdown wiring are good UI references.
5. Side-panel architecture (MV3 `side_panel` + content-script-only-extracts + background message router) — a clean, low-detection pattern to mirror.

**THROW AWAY:** all AI/LLM code (`background.js` `callGroq`/`Gemini`/`OpenRouter`/`DOGradient`, `extractProfileWithAI`, `scoreProfile`, `generatePitches`, `performDeepResearch`); the credits system; `products`/`personas`/`aiModels`/marketing-brain/core-knowledge; the entire Firebase SDK + Firebase Auth (replace with Supabase Auth); `lib/cloudSync.js` config-sync (the CRM already has config). The selector-based DOM scraping for structured fields is minimal/LLM-dependent — for matching we only need the URL.

## A.10 Risks

1. **SECRETS IN CLIENT.** Firebase web `apiKey` + DO Gradient/Groq keys were hardcoded in source (`firebase-config.js` committed; `background.js` has commented-out real-looking Groq/Gemini/OpenRouter keys; `FIRESTORE_UPDATES_PHASE7.md` pastes a real-looking DO key `sk-do-...`). **Treat as compromised / rotate.** Do NOT carry this pattern into the Supabase build — use the anon key + RLS; keep service keys server-side in notify-service.
2. **WEAK ACCESS CONTROL.** Client-side role gate (`ALLOWED_ROLES` Agent/Admin) and credits enforcement are trivially bypassable; security depends entirely on Firestore rules. `prospects` read/write rules are not in-repo — unknown blast radius. The Supabase rebuild must enforce via **RLS**, not client checks.
3. **FRAGILE MATCHING.** Exact-string match on `personalLinkedin` across 12 guessed URL variants = up to 12 Firestore round-trips per profile and still misses any format not enumerated (locale subdomains, `/pub/`, vanity vs numeric ids). Normalize-once-and-index is the fix.
4. **LINKEDIN ToS / DETECTION.** Scraping profile DOM + the (currently disabled) injected icon risk LinkedIn account flags; the code already leans on "Ghost Mode" + no-scroll waiting to reduce this. Shipping up to 8000 chars of page text to third-party LLMs is also a data-leak/compliance concern (we are dropping it anyway).
5. **NO AUDIT TRAIL ON WRITES.** Disposition updates are bare `update()`s with only `lastUpdated`; the north-star ("recorded EXACTLY as if changed inside the CRM, same side effects, same audit trail") is **NOT met**. The rebuild must route writes through the CRM's real mutation paths / activity logging, not raw row updates.
6. **DEAD / INCONSISTENT CODE.** `logActivity`/`logProfileView` never called; `CACHE_TTL_DAYS = 0` and `DEFAULT_*_KEY = ""` are testing values left in; content script self-labels v4.6.0 while manifest is 4.1.0.

---

# Part B — Data ResearchExt (Contact Fulfillment)

**Component:** "AltLeads Research - Contact Fulfillment" (MV3, v2.1.0; internal code calls it "RightReach/RR Research"). The **supply side** of the request-fulfillment loop.

## B.1 Purpose

A back-office **data research / fulfillment** extension — NOT a salesperson-facing prospect viewer. It is the supply side of a request-fulfillment loop:

- The main AltLeads extension creates "contact requests" (someone needs a person's email/phone found).
- The research/data team opens this extension on the matching LinkedIn profile, finds the contact details (manually or via AI autofill that scrapes the page), and **"Push to DB"** writes a finished prospect record back + marks the request **Fulfilled**.

So its core LinkedIn behavior: **match the open profile against a queue of pending requests**, surface the one for "this page", let a researcher fill found contact data with per-field accuracy dispositions, and atomically promote it into the `prospects` collection. Access is gated to roles **'Data Team'** and **'Admin'** only.

**For our rebuild,** the directly reusable concept is the LinkedIn-URL ↔ CRM-contact match + the in-page edit panel + write-back. The request-queue / AI-autofill machinery is largely **out of scope**.

## B.2 Manifest & permissions (MV3)

| Field | Value |
|-------|-------|
| `manifest_version` | 3 |
| `name` | "AltLeads Research - Contact Fulfillment" |
| `version` | 2.1.0 |
| `permissions` | `["storage", "activeTab"]` — **NO `scripting`, NO `tabs`** (popup uses `chrome.tabs.query` via `activeTab`); NO broad `<all_urls>` |
| `host_permissions` | `https://*.linkedin.com/*`, `https://firestore.googleapis.com/*`, `https://api.groq.com/*`, `https://openrouter.ai/*` — **note: `inference.do-ai.run` is USED (DO Gradient AI) but NOT declared — a gap** |
| `background` | service worker `background.js` (only toggles the panel on action click) |
| `content_scripts` | one entry; matches `https://*.linkedin.com/*` + `https://linkedin.com/*`; `run_at: document_idle`; js load order: `firebase-app-compat`, `firebase-auth-compat`, `firebase-firestore-compat`, `lib/cloudSync.js`, `firebase-config.js`, `content/researchPanel.js` |
| `action.default_popup` | `popup/popup.html` |
| `web_accessible_resources` | `icons/*` to the LinkedIn matches |
| CSP / externally_connectable | none |

## B.3 Firebase / Firestore usage

- **SDK:** Firebase JS SDK v9 compat (`firebase-app`/`auth`/`firestore-compat`, vendored in `lib/`, loaded as content-script + popup scripts).
- **Config:** HARDCODED in `firebase-config.js` (see Part D for the full shared object). Deliberately the **SAME Firebase project** as the main AltLeads extension (shares Firestore data + `chrome.storage.local` keys).
- **Auth:** Firebase Auth email/password via `signInWithEmailAndPassword(email, password)` in **`popup.js` ONLY**. After auth it queries `users` where `email == <email>` `limit 1`, validates `userData.status === 'Active'` and `role ∈ {'Data Team','Admin'}`, then persists a slimmed user object to `chrome.storage.local` under key `rrUser = {uid,email,name,role,status}`. A `DEV_MODE` skip-login path (currently `DEV_MODE = false`) fakes an Admin `dev-user`.
- **Content-script auth:** the content script does **NOT** authenticate — it only reads `rrUser` from `chrome.storage.local` (`checkAuth`) and re-inits a Firestore client from the hardcoded config. All Firestore reads/writes from LinkedIn pages happen under whatever Firestore rules allow for that **anonymous-from-page** client (it calls `firebase.firestore()` without re-running signIn in the content context).
- `firebase-config.js` also defines `COLLECTIONS = {CONTACT_REQUESTS:'contactRequests', PROSPECTS:'prospects'}` and a `DISPOSITION_COLORS` map: Accurate → green `#22c55e`, Wrong → red `#ef4444`, Unverified → blue `#3b82f6`.

**Collections & doc shapes used:**

- **`contactRequests`** (the work queue) — fields read: `status` (`Pending`|`In Progress`|`Fulfilled`|`Rejected`), `createdAt` (Timestamp), `updatedAt`, `prospectName`, `companyName`, `title`/`prospectTitle`, `linkedinUrl`, `sourceHint`, `requestedBy` (object `{name,email}` OR string), `prospectId`, `originalProspectId`, `teamId`, and the **"found" working fields**: `foundFirstName`, `foundLastName`, `foundDesignation`, `foundEmail`, `foundPhone`, `foundPhone2`, `foundPhone3`, `foundCity`, `workEmailDisposition`, `phone1Disposition`, `phone2Disposition`, `phone3Disposition`.
  - On **save-draft**: `.update()`s those `found*`/disposition/status fields + `updatedAt = serverTimestamp()`.
  - On **fulfill**: `.update()`s `{status:'Fulfilled', fulfilledBy:{uid,email,name}, fulfilledAt:serverTimestamp(), prospectId, prospectName, updatedAt:serverTimestamp()}`.
- **`prospects`** (the destination record) — written via a **batch** on "Push to DB": `firstName`, `lastName`, `fullName`, `designation`, `companyName`, `workEmail`, `contactNumber1`, `contactNumber2`, `contactNumber3`, `city`, `personalLinkedin` (= `request.linkedinUrl`), `workEmailDisposition`, `contactNumber1Disposition`, `contactNumber2Disposition`, `contactNumber3Disposition`, `teamId`, `lastUpdated = serverTimestamp()`, `updatedBy = {uid,email,name}`; on CREATE also `createdAt = serverTimestamp()`. **Updates** existing doc if `currentRequest.prospectId`/`originalProspectId` present, else **creates** a new `doc()`. Read back on edit-form open to show the "existing record" panel.
- **Referenced ONLY by `cloudSync.js`** (dormant/legacy in this ext): `teams/{teamId}` (`settingsVersion`, `defaultApiKeys`, `defaultModelConfig`, `defaultTemplates`, `defaultPrompts`, `defaultSystemPrompt`), `products` (where `teamId ==`, `isActive == true`), `personas` (where `teamId ==`), `aiModels` (where `isActive == true`), `users/{uid}` (`apiKeys`, `modelConfig`, `templates`, `prompts`, `systemPrompt`), `activityLogs.add({userId,userEmail,userName,teamId,action,targetId,targetType,details,timestamp,source:'extension',extensionVersion})`, `profileViews.add({agentId,prospectId,teamId,linkedinUrl,prospectName,timestamp})`.

## B.4 Data flows

**READS:**

1. `chrome.storage.local['rrUser']` for auth/role gate.
2. `chrome.storage.local` API keys **shared from the main AltLeads ext**: `groqApiKey`, `openrouterApiKey`, `dogradientApiKey`, `researchAIProvider`, `researchAIModel`.
3. Firestore `contactRequests` — content script fetches **ALL** docs (`.limit(100)`, **NO where-clause** to dodge composite-index requirements), then filters client-side to status Pending/In Progress and sorts by `createdAt` desc; **popup** uses a server-side `.where('status','in',['Pending','In Progress']).limit(50)`.
4. Firestore `prospects/{id}` to show prior data on re-requests.
5. `document.body.innerText` (first **4000** chars) scraped for AI autofill.

**WRITES:**

1. `contactRequests/{id}.update()` on Save Draft (`found*` + dispositions + status) and on Push-to-DB fulfill (status/fulfilledBy/fulfilledAt/prospectId/prospectName).
2. `prospects` create-or-update via `firestoreDb.batch()` committed **atomically together** with the `contactRequests` fulfill update.
3. `chrome.storage.local` for settings (`researchAIProvider`/`Model`) and `rrUser` on login/logout.
4. External AI HTTP POST to Groq (`api.groq.com/openai/v1/chat/completions`), DO Gradient (`inference.do-ai.run/v1/chat/completions`), or OpenRouter (`openrouter.ai/api/v1/chat/completions`) with the scraped page text — returns JSON `{firstName,lastName,designation,city}` to prefill the form (**only fills empty fields**).

**WHEN:** on panel open/refresh (fetch queue); on profile navigation (re-sort queue so current page floats to top); on user clicking Accept → edit, Save Draft, AI Fill, Push to DB. **No realtime listeners** — everything is one-shot `.get()` with manual Refresh.

## B.5 LinkedIn detection / matching logic (the heart to re-implement)

| Concern | Implementation found |
|---------|----------------------|
| **Page match** | manifest `content_scripts` matches `https://*.linkedin.com/*` + `https://linkedin.com/*` (`document_idle`); `background.js` also gates the toolbar toggle on `tab.url.includes('linkedin.com')` |
| **Current-profile username** | `getCurrentPageUsername()` = `window.location.href.match(/linkedin\.com\/in\/([^\/\?]+)/i)[1].toLowerCase()` — the **only** "which profile am I on" signal; parses the public `/in/<vanity>` slug, lowercased |
| **Match against queue** | for each request, extract the slug from `req.linkedinUrl` via the **same regex** (`.match(/linkedin\.com\/in\/([^\/\?]+)/i)[1].toLowerCase()`) and compare equality to the current page slug. Matches get an `isCurrentProfile` flag → green "📍 CURRENT PAGE" badge, a highlighted `.current-profile` card, and sort to the top |
| **Matching weakness** | by **vanity-slug string equality**, NOT full-URL normalization — brittle if URLs differ (trailing params, locale subpaths, numeric member IDs) |
| **Field extraction** | **NOT** done from the DOM by selectors — there is essentially **no DOM scraping of structured LinkedIn fields**. Identity/company come from the `contactRequests` doc (`prospectName`, `companyName`, `title`). The only "extraction" is AI-based: `document.body.innerText.substring(0,4000)` (raw page text, no selectors) → LLM → `{firstName,lastName,designation,city}` |
| **SPA navigation** | MutationObserver on `document.body` re-runs `init()` (debounced 1s) when location changes and the floating icon is gone, plus an initial **2.5s** delayed init |

> **Reusable LinkedIn primitive here = ONLY the `/in/<slug>` URL regex.** There are **NO reusable CSS selectors/regex for name/title/company/email** in this extension. For our rebuild we should normalize the URL (strip protocol/www/trailing slash/query, canonicalize `/in/<slug>`) and match against `contacts.linkedin_url` in Supabase rather than slug-equality.

## B.6 cloudSync logic (`lib/cloudSync.js`)

- A generic **5-day-TTL** cache layer (`CACHE_TTL_DAYS = 5`) but **LEGACY / DORMANT in THIS extension**: it is loaded by the manifest and exports `window.CloudSync`, but `researchPanel.js` never calls `syncFromCloud`/`logActivity`/`logProfileView` — it talks to Firestore directly. (Clearly copied from the main AltLeads ext.)
- `getLocalCache()`/`setLocalCache()` wrap `chrome.storage.local` for keys `rrUser`, `cachedTeam`, `cachedProducts`, `cachedPersonas`, `cachedModels`, `cachedUserPrefs`, `lastSyncTime`, `cachedSettingsVersion`.
- `syncFromCloud(db, forceRefresh)`: if cache age < 5 days it still does a cheap `teams/{teamId}.get()` and compares `team.settingsVersion` to cached version (version-based invalidation); on miss/forceRefresh it parallel-fetches teams doc + products(active,teamId) + personas(teamId) + aiModels(active) + `users/{uid}` via `Promise.all`, rewrites the cache, and **on any error RETURNS STALE CACHE** (offline-tolerant, never throws to UI).
- Resolution helpers do user→team fallback (`resolve`, `resolveApiKey`, `resolveModel`, `resolveTemplate`, `resolvePrompt`, `resolveSystemPrompt`); `resetToDefault` writes `null` to a user field so the team default wins.
- **Conflict handling:** none beyond last-write-wins — no merge, no version vector on records; the only concurrency safety in the whole ext is the `prospects`+`contactRequests` `batch.commit()` (atomic-together but still last-writer-wins against other editors).
- **Push/pull:** pull = one-shot `.get()` (no `onSnapshot` realtime anywhere); push = direct `.update()`/`.set()`/batch with `serverTimestamp()`.

> For the Supabase rebuild this TTL/version-bump cache is **not needed** (we have Realtime/Postgres). Keep only the principle: **tolerate offline by serving last-good data + never throw to UI.**

## B.7 UI surfaces (two)

1. **POPUP** (`popup/popup.html` + `popup.js`, 360px) — login view (email/password + hidden dev "Skip Sign In") + main view with 3 tabs:
   - **Requests** — server-side query of Pending/In Progress; read-only list with "Open Profile" links.
   - **Settings** — read-only masked Groq/OpenRouter keys pulled from AltLeads storage + provider/model pickers for AI autofill; Save / Test Connection.
   - **Status** — Firebase connection + live pending/in-progress counts fetched from the content script via `GET_STATUS`.
   - "Open Panel ↗" sends `TOGGLE_PANEL` to the active LinkedIn tab.
2. **INJECTED IN-PAGE PANEL** (`content/researchPanel.js`) — a draggable round floating icon (🔬, fixed left, vertical-drag, click = toggle) + a left-edge slide-in panel. **BOTH** injected as separate host `<div>`s attached to `document.body` with `attachShadow({mode:'closed'})` so all CSS is encapsulated inside shadow DOM (no LinkedIn style bleed; "Ghost Mode"). `z-index` 2147483647 on the icon, 9999 on the panel. Green gradient header (🔬 Research Panel, refresh ↻, minimize −) and two nav tabs:
   - **"Pending Requests"** — request cards (name, requester chip, title, 🏢 company, source hint, time-ago, status pill, LinkedIn-open button, Accept button); current-page request highlighted/sorted first.
   - **"Edit Form"** — the **mini-CRM**: First/Last/Designation, Work Email + 3 phones each with an accuracy disposition `<select>` (Unverified/Accurate/Wrong, color-coded), City, Status, and actions 🤖 AI Fill / Save Draft / Push to DB; on open can show an amber "Existing Record Found (Re-request)" box rendered from the `prospects` doc.

> This injected edit panel is the **closest existing analog to our target "mini-CRM inside LinkedIn"** and is the part most worth studying for the rebuild's UI.

## B.8 What is reusable as reference

**KEEP AS REFERENCE:**

1. **Shadow-DOM injection pattern** — two separate `document.body` host `<div>`s with `attachShadow({mode:'closed'})`, a draggable floating launcher + a slide-in panel, all CSS scoped inside the shadow root, `z-index` 2147483647. This is exactly the overlay mechanism our LinkedIn mini-CRM needs; **port it almost verbatim** (swap the request-queue contents for our matched-contact card).
2. **SPA-navigation handling** — initial delayed init + `MutationObserver(document.body, childList+subtree)` that re-runs init on URL change (debounced). LinkedIn is an SPA so this is required; reuse it.
3. **Edit Form UX** — per-field value + accuracy "disposition" (Unverified/Accurate/Wrong, color-coded) + the amber "existing record found" pre-fill panel — a good model for our "edit the contact + its leads/meetings/tasks inline and write back with audit".
4. **Atomic batch write pattern** — write the record + flip the source request status in ONE commit → maps to a Supabase transaction/RPC so the contact update + activity-log/audit row happen together.

**THROW AWAY / REPLACE:** hardcoded Firebase config + compat SDK → Supabase JS client with the CRM's existing auth/session (do NOT trust a bare `chrome.storage` flag; use a real token); the `contactRequests`/`prospects` request-fulfillment queue (not our model — we match an existing CRM contact); the `/in/<slug>` string-equality match → normalized `linkedin_url` lookup; the cloudSync 5-day TTL/settingsVersion cache; the LLM-scrape autofill (privacy/ToS liability); the `COLLECTIONS`/`DISPOSITION_COLORS` globals; the dev skip-login backdoor. **None of the structured LinkedIn field selectors exist here to reuse** — the rebuild only needs the URL regex + the panel shell; all contact details come from Supabase.

## B.9 Risks

- **SECRETS / SECURITY.** Firebase web `apiKey` + full project config hardcoded in repo/bundle. The content script runs Firestore reads/writes from arbitrary LinkedIn pages **WITHOUT an interactive auth session** (it just trusts `chrome.storage.local['rrUser']`), so the effective boundary is entirely Firestore Security Rules. `fetchPendingRequests` pulls **ALL** `contactRequests` (`.limit(100)`, no filter) client-side — the whole request queue (names, companies, requester emails, LinkedIn URLs) is readable by anyone the rules allow; real risk the rules are permissive.
- **DEV BACKDOOR.** "Skip Sign In (Admin)" path (currently `DEV_MODE = false`) present in shipped code.
- **BROKEN ATTRIBUTION (bug).** Push-to-DB attribution reads `window._rrCurrentUser` (`popup.js`/`researchPanel.js` never set this global; only a module-scoped `_currentUser` is set), so `updatedBy`/`fulfilledBy` almost always fall back to the `{uid:'unknown', name:'Research Team'}` placeholder — attribution/audit is effectively broken.
- **MATCH brittleness.** Bare `/in/<slug>` string equality, no URL normalization.
- **SCRAPING.** AI autofill ships LinkedIn page `innerText` to third-party LLM endpoints — data-exfil + ToS concern. `inference.do-ai.run` not in `host_permissions`.
- **NO realtime sync** (manual refresh). `cloudSync.js` is dead weight loaded on every LinkedIn page.
- **Version inconsistency:** manifest 2.1.0, cloudSync '3.0.0', popup '2.0.0'.

---

# Part C — AL Prospect Finder Web App

**Component:** "altleads-prospect-intelligence" — React 19 + Vite SPA on Firebase/Firestore, with a **bundled but near-empty** Chrome MV3 companion extension.
**Path:** `c:/Users/pc/OneDrive - Amplior/Desktop/AL/Chrome Extension EcoSystem/AL Prospect Finder Web App`

## C.1 Purpose

Internal "prospect intelligence" CRM for AltLeads agents + data team. Agents browse/search a master list of prospects (contacts at companies), mark each contact field (email/phones) **Accurate/Wrong/Unverified** ("disposition validation"), leave remarks/comments, and raise "contact requests" when data is missing/stale. The Data Team works a request **workbench**, researches missing fields into a draft, then "pushes to DB" (create or update the prospect). It layers an AI prospecting toolkit (lead scoring, pitch generation, deep research) gated by a per-user credit/plan system.

> This is a **SEPARATE product** from the main AltLeads CRM — essentially a Firebase prototype of the same idea the rebuild targets. **Reference for data model + extension intent, NOT a schema to copy.**

## C.2 Manifest & permissions (the companion extension)

| Field | Value |
|-------|-------|
| `manifest_version` | 3 |
| `name` | "Amplior Prospect Intelligence Extension" |
| `version` | "1.0" |
| `permissions` | `["storage"]` only |
| `host_permissions` | **NONE** |
| `content_scripts` | **NONE** |
| `chrome.tabs`/`scripting`/`identity` | **NONE** |
| `action.default_popup` | `extension/popup.html` |
| `background.service_worker` | `extension/background.js` (MV3 SW — **only logs on `onInstalled`**) |

> **As shipped it cannot read any page, cannot detect LinkedIn, and cannot inject an overlay — it is a standalone popup app.** (The web SPA itself is not an extension; its `metadata.json` is just AI-Studio app metadata.)

## C.3 Files

| File | Role |
|------|------|
| `lib/firebase.ts` | Firebase init + HARDCODED `firebaseConfig` (project `altleads-prospect-finder`). The connection layer to replace with Supabase |
| `context/DataContext.tsx` | **Most important for data-flow + matching.** All Firestore reads (8 `onSnapshot` listeners) + writes/CRUD + `normalizeUrl()` and the 3-tier dedup/match-by-LinkedIn logic + lazy credit reset |
| `context/AuthContext.tsx` | Firebase email/password auth, `users/{uid}` profile hydration, admin user creation via secondary app, password reset/override Cloud Function |
| `types.ts` | Full data model: `Prospect`, `ContactRequest`, `ProfileView`, `User`, `Team`, `Credits`, `Product`, `Persona`, `AIModel`, `Disposition`/`Role`/`RequestStatus` enums, `PLAN_CONFIG`/`ACTION_COSTS` |
| `manifest.json` | MV3 manifest — storage-only, popup + empty background SW; **proves no LinkedIn detection exists** |
| `extension/popup.tsx` | The entire shipped extension UI: manual-search popup, **UNAUTHENTICATED direct Firestore read/write**, validate fields, "Request Data Update" |
| `extension/background.js` | MV3 SW — only logs on install; the planned `onSnapshot`→`chrome.storage.local` cache **never implemented** |
| `extension_schema.md` | Written integration spec: dedup hierarchy, `prospects`/`contactRequests`/`credits` schemas, lazy-reset + transactional-spend pseudocode. **Best single doc of intent.** |
| `pages/ContactRequestsPage.tsx` | Request lifecycle: create → accept → research workbench draft (`found*` fields) → "Push to DB" smart-merge resolve with duplicate detection |
| `pages/ProspectDetailsPage.tsx` | Per-field disposition validation UI (`ValidatedField`), edit modal, agent `profileView` logging |
| `pages/AdminDatabasePage.tsx` | 21-column CSV bulk import/export driving `addProspectsBulk`; documents the LinkedIn-normalized dedup as primary key |
| `lib/ai.ts` | Client-side LLM calls (Groq/OpenRouter/Gemini) with user/team API keys — out of scope, key-leak risk |
| `migrated_prompt_history/prompt_2026-01-04T08_23_24.567Z.json` | Build history; contains the **only** statement of the intended "browse LinkedIn → read URL → match → edit/add" extension architecture (never coded) |
| `constants.tsx` | Role-gated nav config (Admin / Data Team) |

## C.4 Firebase / Firestore usage

- **SDK:** Firebase JS SDK v12 (modular), Firestore + Firebase Auth + Cloud Functions.
- **Config:** HARDCODED in `lib/firebase.ts` (no env) — see Part D.
- **Auth:** Firebase email/password (`signInWithEmailAndPassword`); profile in `users/{auth.uid}`; `onAuthStateChanged` hydrates it and **auto-creates a PENDING-role user doc if missing**; `Inactive` status force-signs-out. Admin "create user" uses a **secondary Firebase app instance** so the admin's own session is preserved; admin password override calls Cloud Function `httpsCallable('adminSetUserPassword')`; password reset via `sendPasswordResetEmail`.
- **Collections** (defined in `types.ts`, written in `context/DataContext.tsx`) — consolidated in Part D. Highlights:
  - `prospects/{autoId}` — loaded via `onSnapshot` ordered `lastUpdated desc`, `limit 1500`; `personalLinkedin` (normalized) is the dedup key; embedded `comments[]`.
  - `contactRequests/{autoId}` — `prospectId` optional (links to existing prospect so push updates not duplicates); parallel `found*` draft fields; `limit 500`.
  - `profileViews/{autoId}` — logged when an AGENT opens a prospect; `limit 500`.
  - `users/{auth.uid}` — `role` enum `Admin`|`Agent`|`Data Team`|`Pending`; per-user `apiKeys`, `modelConfig`, `preferences{autoOpenOnLinkedIn, selectedProductId}`.
  - `credits/{userId}` — lazy monthly auto-reset (on every snapshot, if >30 days since `lastReset`, refill `balance` to `monthlyAllocation`).
  - `teams/{autoId}` — `settingsVersion` (bumped to `Date.now()` for "extension cache busting").
  - `products`/`personas`/`aiModels` (AI scoring/pitch features).

> **No Firestore security rules file is in this folder; `popup.tsx` writes unauthenticated, so the deployed rules are effectively open for `prospects`/`contactRequests` writes** — a security risk NOT to carry into the Supabase rebuild.

## C.5 LinkedIn logic — IMPORTANT FINDING: essentially NONE in code

Confirmed by grepping the whole tree: **no content script, no `chrome.tabs`/`chrome.scripting`/`executeScript`, no `host_permissions`, no `window.location` parsing.** `manifest.json` declares only `permissions:['storage']`, a `default_popup`, and a near-empty background SW. The popup (`extension/popup.tsx`) is a manual search box: it opens Firestore directly with **NO auth**, `onSnapshot`s the `prospects` collection, lets the user type a name/company to find a record, validate fields, edit remark, and click "Request Data Update" (writes a `contactRequests` doc with `sourceHint:'Chrome Extension'`, `requestedBy:'Extension User'` hardcoded).

**What LinkedIn logic DOES exist (the real value):**

1. **`personalLinkedin` is the designated PRIMARY dedup/match key** throughout (`types.ts`, `extension_schema.md`, DataContext dedup). The normalizer `normalizeUrl` turns `https://www.linkedin.com/in/john-doe/` → `linkedin.com/in/john-doe`; matching queries compare on this normalized form. `extension_schema.md` §2 spells out the exact 3-tier hierarchy: (1) known id, (2) normalized LinkedIn URL == `personalLinkedin`, (3) fuzzy `fullName`+`companyName` case-insensitive.
2. A user preference `preferences.autoOpenOnLinkedIn` exists ("Auto-open extension on LinkedIn profiles") — **declared intent, never wired** to any detection code.
3. The **INTENDED architecture** is captured only as written guidance in `migrated_prompt_history/prompt_2026-01-04T08_23_24.567Z.json` ("Extension Integration Plan"): browse LinkedIn → extension reads URL → checks `chrome.storage.local` for a match → if match show "Edit Prospect", else "Add to Amplior"; background SW keeps a realtime `onSnapshot` of prospects mirrored into `chrome.storage.local`; extension shares the EXACT same `firebaseConfig` and authenticates with the same credentials so rules (`auth.uid`) apply. **None of this was implemented.**

> **For the Supabase rebuild:** there is **NO existing reusable LinkedIn-detection or scraping code to port** — the content script that reads `window.location` / the `/in/{slug}` URL must be **built fresh**. What you CAN reuse conceptually is the **normalization + 3-tier match-by-linkedin_url** logic and the **field/disposition data model**.

## C.6 cloudSync logic

There is **no dedicated `cloudSync.js` module**. "Cloud sync" is just Firestore realtime: the web app (and intended extension) rely on `onSnapshot` listeners for push updates; writes go straight to Firestore with no offline queue/conflict resolution. The only offline cache is the **PLANNED (not implemented)** `background.js` → `chrome.storage.local` mirror.

- **Conflict handling:** naive last-write-wins via `lastUpdated: new Date()` on every `updateDoc`. The only explicit conflict UX is in the request-resolution path (`ContactRequestsPage.handleResolveAndSave`): when no `prospectId` link exists, it finds a name+company duplicate and `window.confirm()`s whether to UPDATE existing vs create a NEW duplicate.
- **Credits:** `extension_schema.md` prescribes `runTransaction` for `spendCredits` (read balance, throw if <0, decrement + bump usage), though the web app itself only does the lazy >30-day reset, not transactional spend.
- `settingsVersion` on the team doc (bumped to `Date.now()`) was designed as an extension cache-bust signal.
- **Push vs pull:** everything is push (`onSnapshot`); no manual pull/refresh except a full `window.location.reload()` error-boundary button in `Layout.tsx`.

## C.7 UI surfaces (two)

1. **Web SPA** (`index.tsx` → `App.tsx`, HashRouter, Tailwind via CDN, recharts): pages = Dashboard, Prospects list (`ProspectsListPage`, search by name/company/LinkedIn, column toggles), Prospect details (`ProspectDetailsPage` — contact card with per-field `ValidatedField` disposition controls, company card, remarks, edit modal via `ProspectForm`; logs a `profileView` for agents), Contact Requests (request table + "Research Workbench" draft modal + "Push to DB" resolve modal), Analytics, History, Settings (My Extension Preferences incl. credits/usage, API keys, model picks; Admin user directory with bulk CSV provisioning; Admin global data + V5 migration), and admin pages Database (21-col CSV import/export table editor), Team & AI, AI Models, Products, Personas. Role-gated nav in `constants.tsx` (Database/Team/Models = Admin; Products/Personas = Admin+Data Team).
2. **Extension popup** (`extension/popup.tsx`, 400px wide): list view (search + colored email/phone disposition dots) + details view (validate fields, edit remark on blur, "Request Data Update"). **No injected/in-page panel or sidepanel anywhere.**

> **CRITICAL gap vs the rebuild goal:** there is **no overlay-on-LinkedIn surface at all**; the target product's in-LinkedIn panel must be built from scratch.

## C.8 What is reusable as reference

**KEEP AS REFERENCE (port the idea, not the Firebase code):**

- `normalizeUrl()` + the **3-tier dedup/match hierarchy** (id → normalized `personalLinkedin` → `fullName`+`companyName`) in `DataContext.addProspectsBulk` and `extension_schema.md` §§2–4. This is exactly the "match this LinkedIn profile to a CRM contact" core; reimplement as a Supabase query on a normalized `linkedin_url` column (store normalized; consider a generated/indexed column).
- The **field+disposition data model** (each contact field paired with Accurate/Wrong/Unverified) + the `markValidation` single-field-update pattern — good model for "agent verifies a field" with an audit entry.
- The **contact-request workflow** + `found*` draft/staging fields + smart-merge-on-resolve (request Pending→In Progress→Fulfilled, `prospectId` link to avoid duplicates).
- The "Extension Integration Plan" text in `migrated_prompt_history/...json` as a written spec of the intended LinkedIn detect→match→edit/add flow and background-`onSnapshot`→`chrome.storage.local` caching idea (translate `onSnapshot` → Supabase Realtime/polling; translate Firebase-auth-shared-with-extension → a Supabase session/JWT shared with the extension).

**THROW AWAY / DO NOT COPY:**

- All Firebase wiring (`lib/firebase.ts` hardcoded config, firestore/auth usage, Cloud Function `adminSetUserPassword`, secondary-app admin user creation) — replaced by Supabase + the existing CRM tables/RLS.
- The unauthenticated direct-Firestore writes in `popup.tsx` and the apparently-open Firestore rules.
- The bundled extension's popup-only, manual-search UX and its empty `background.js`.
- The credits/plans/AI-model/persona/product subsystem and client-side LLM calls in `lib/ai.ts`.
- Its prospect schema field names — the rebuild maps to the existing CRM's `contacts`/`leads`/`meetings`/`tasks`/`activities`, not to this `prospects` shape.

## C.9 Risks

1. The shipped extension has **ZERO LinkedIn handling** — no content script, no URL read, no overlay. It must be written from scratch. Only the normalize+match-key concept and a never-implemented written plan exist.
2. **Security:** hardcoded Firebase config in source; `popup.tsx` reads/writes Firestore **WITH NO AUTH** (a comment even says "check if database allows public writes") — implying open Firestore rules. Do not replicate; enforce RLS.
3. **Client-side LLM keys** (`lib/ai.ts`, per-user `apiKeys`, team `defaultApiKeys`) exposed in the browser — key-leak risk; if AI is kept, move to server.
4. **No real conflict handling:** last-write-wins on `lastUpdated`; only the request-resolve path has a manual duplicate confirm.
5. **Different product/schema** (`prospects`/`contactRequests`/`credits`/`teams`) from the live AltLeads CRM (`lead_report`/`profiles`/`role_master`). Treat field names/collections as inspiration only; map LinkedIn matches onto the existing CRM's contact/lead/meeting/task/activity tables.
6. Bundled extension uses CDN imports (aistudiocdn, gstatic) + Tailwind CDN — not a production build pipeline; not reusable as-is.

---

# Part D — Consolidated Firebase data model (all three apps)

## D.1 Shared Firebase config — ⚠️ SECRET-HANDLING NOTE

> **⚠️ SECURITY FLAG.** All three apps share **ONE Firebase project**, with a **byte-identical, hardcoded** config object committed in `firebase-config.js` (AltLeads Ext 4.1.0 + 4.0.0), `firebase-config.js` (Data ResearchExt), and `lib/firebase.ts` (AL Prospect Finder Web App). The ResearchExt file even comments "MUST use same Firebase project as AltLeads". A Firebase web `apiKey` is not a secret per se, **but** combined with **unauthenticated client writes** and **app-layer-only access control** it is a real exposure. Separately, **real-looking LLM provider keys** (DO Gradient `sk-do-...`, Groq, Gemini, OpenRouter) appear hardcoded/commented in `background.js` and pasted in `FIRESTORE_UPDATES_PHASE7.md` — **treat all of these as compromised and rotate them.** Do NOT carry any of this pattern into the Supabase build: use the **anon key + RLS**, and keep service/provider keys **server-side** in notify-service.

**The shared config object (identical across all three):**

| Key | Value |
|-----|-------|
| `projectId` | `altleads-prospect-finder` |
| `apiKey` | `AIzaSyDsh-cNjKh8-KtyVEUpjZXUNPwvtYxSPVw` |
| `authDomain` | `altleads-prospect-finder.firebaseapp.com` |
| `storageBucket` | `altleads-prospect-finder.firebasestorage.app` |
| `messagingSenderId` | `308314268907` |
| `appId` | `1:308314268907:web:8d934badb16f6142694aae` |
| `measurementId` | `G-YJ28EHF5XC` |

**Per-app collection-name constants:**

- AltLeads Ext: `FIRESTORE_CONFIG = {collection:'prospects', linkedinField:'personalLinkedin'}`.
- ResearchExt: `COLLECTIONS = {CONTACT_REQUESTS:'contactRequests', PROSPECTS:'prospects'}` + `DISPOSITION_COLORS` (Accurate green `#22c55e`, Wrong red `#ef4444`, Unverified blue `#3b82f6`).
- Web app: additionally wires `getFunctions()` (Cloud Function `adminSetUserPassword`) and uses `initializeApp(config, 'SecondaryApp_...')` to create users without logging the admin out.

## D.2 Auth model (consolidated)

| Aspect | Web App | Both Extensions |
|--------|---------|-----------------|
| Mechanism | Firebase Auth `signInWithEmailAndPassword` | Firebase Auth `signInWithEmailAndPassword` (in **popup only**) |
| Identity → Firestore | keys `users` doc by `firebaseUser.uid` (doc ID = UID); read in `onAuthStateChanged` | query `users WHERE email == <login email>`, cache resolved user in `chrome.storage.local` under `rrUser` (`uid,email,name,role,status,teamId`) |
| Write attribution | from hydrated `users/{uid}` | from cached `rrUser` — stamped onto `prospects.updatedBy`, `contactRequests.requestedBy`, `credits` doc id, `activityLogs.userId`, `profileViews.agentId` |
| Content-script auth | n/a | content script does **NOT** sign in — it trusts the cached `rrUser` flag and re-inits Firestore from hardcoded config |
| Access gate | app-side `status === 'Active'` + Role enum (Admin/Agent/Data Team/Pending) | app-side `status === 'Active'` + `ALLOWED_ROLES` (ResearchExt: Data Team/Admin) |
| **Row-level security** | **NONE visible** — isolation is the app-layer `teamId` field + client-side `.where('teamId','==',...)` → effectively **trust-the-client** | same — **NONE** |
| Dev backdoor | — | both ship a "skip login" path fabricating a fake admin (`uid 'dev-user'`/`'dev-user-admin'`) — **must be stripped** |

> **Rebuild implication:** authorization is currently trust-the-client. Replace with **Supabase RLS** scoped by project/role; do NOT trust a bare `chrome.storage` flag — use a real Supabase session/JWT shared with the extension.

## D.3 cloudSync across apps

`cloudSync.js` is shared (near-identical) **only between the two Chrome extensions**; the web app has no cloudSync (it uses live Firestore `onSnapshot` directly).

- **Pattern:** read a settings bundle from Firestore into `chrome.storage.local` with a TTL cache (`lastSyncTime` + `cachedSettingsVersion`), busted when `teams/{teamId}.settingsVersion` increases.
- **Syncs:** the team doc; products (4.1.0 by `team.productIds` via `documentId 'in'` [max 30]; ResearchExt by `where teamId ==`); personas (same); aiModels (`where isActive == true`); the user's own `users/{uid}` prefs.
- **Config resolution:** user-override-then-team-default for `apiKeys`/`modelConfig`/`templates`/`prompts`/`systemPrompt`.
- **Core prospect lookup/CRUD is NOT in cloudSync** — it is direct live Firestore in `panel.js` (4.1.0) / `researchPanel.js` (ResearchExt) / `DataContext.tsx` (web).
- **CACHE FOOTGUN:** 4.1.0 ships `CACHE_TTL_DAYS = 0` (cache disabled, "TESTING") vs ResearchExt's intended 5 days.

> **Supabase equivalent:** replace the `chrome.storage` cache with a lightweight settings fetch or Supabase Realtime; for the LinkedIn-match core flow, a **single Supabase query on a normalized `linkedin_url`** beats the whole sync layer.

## D.4 Collections & doc shapes

> Auto `docId` unless noted. Disposition enum throughout = `Accurate | Wrong | Unverified` (default `Unverified`).

### `prospects`

| Group | Fields |
|-------|--------|
| identity | `firstName`, `lastName`, `fullName`, `designation` |
| company | `companyName`, `companyIndustry`, `companySubIndustry?`, `companyEmployeeSize?`, `companyCIN?`, `website?`, `companyLinkedin?` |
| location | `city`, `state?` |
| **match key** | `personalLinkedin` — stored **normalized**; dedup priority 2 (after known `amplior_id`), fallback fuzzy `fullName`+`companyName` |
| contacts + dispositions | `workEmail`/`workEmailDisposition`, `contactNumber1..3`/`contactNumber{1..3}Disposition`, `receptionNumber`/`receptionNumberDisposition` |
| notes | `remark`, `comments[] {id,userId,userName,text,timestamp}` |
| tracking | `teamId`, `createdBy`/`updatedBy {uid,email,name}`, `createdAt`, `lastUpdated` (serverTimestamp) |

- **Read by:** Web app (live `onSnapshot`, `lastUpdated desc`, `limit 1500`); AltLeads ext `panel.js` (lookup by `personalLinkedin ==` one of 12 URL variations → masked summary).
- **Written by:** Web app DataContext (add/update/delete + disposition + comments); AltLeads ext (disposition `update()` only — `{field}` + `lastUpdated`); Data ResearchExt `researchPanel.js` (batch CREATE new doc or UPDATE existing `prospectId`; sets `updatedBy`/`createdAt`, atomically with `contactRequests` fulfill).

### `contactRequests`

`prospectId?` (set when updating existing), `prospectName`, `companyName?`, `linkedinUrl?`, `sourceHint?` (`Extension`|provider|`Re-request`); **draft `found*` fields** (`foundFirstName`/`foundLastName`/`foundDesignation`/`foundEmail`/`foundPhone[1-3]`/`foundReceptionPhone`/`foundCompanyIndustry`/`foundCompanySubIndustry`/`foundCompanyEmployeeSize`/`foundCompanyCIN`/`foundWebsite`/`foundCompanyLinkedin`/`foundPersonalLinkedin`/`foundCity`/`foundState`/`foundRemark`); `requestedBy {uid,name,email}`; `status` enum `Pending|In Progress|Fulfilled|Rejected` (init `Pending`); `fulfilledBy {uid,email,name}`, `fulfilledAt`; `isReRequest?`, `originalProspectId?`, `responseNotes?`; `teamId`; `createdAt`, `updatedAt`.

- **Read by:** Web app (`onSnapshot` `createdAt desc` `limit 500`); Data ResearchExt (fetches all `limit 100`, filters client-side to Pending/In Progress, sorts `createdAt`).
- **Written by:** AltLeads ext `panel.js` (`.add` new request on "Request Info"); web app (add/update/delete); Data ResearchExt (`.update` status→Fulfilled + fulfilledBy/fulfilledAt/prospectId in fulfil batch).

### `users` (docId = Firebase Auth UID)

`id`, `name`, `email`, `role` (`Admin|Agent|Data Team|Pending`), `status` (`Active|Inactive`), `teamId`; user overrides `apiKeys{groq,openrouter,gemini}`, `modelConfig{extraction,scoring,research,pitches}`, `templates{}`, `prompts{}`, `systemPrompt`, `preferences{autoOpenOnLinkedIn,selectedProductId}`; `createdAt`, `lastLogin?`.

- **Read by:** Web app (`onAuthStateChanged getDoc` by uid; admin `onSnapshot` all users); both extensions (query by `email ==` login at login; cloudSync `getDoc users/{uid}` for prefs).
- **Written by:** Web app (signup / `createUserByAdmin` via secondary app, `updateUserByAdmin`; auto-creates Pending user doc on first login); extensions `popup.js` (`.set`/`.update` prefs); `cloudSync.resetToDefault` (`.update` field → null).

### `teams`

`name`, `description?`, `createdBy`, `createdAt`, `updatedAt`, `settingsVersion` (number, bumped to `Date.now()` on update for ext cache-busting); `defaultApiKeys{groq,openrouter,gemini,dogradient}`, `defaultModelConfig{extraction,scoring,research,pitches}`, `defaultTemplates{}`, `defaultPrompts{}`, `defaultSystemPrompt`; `productIds[]`, `personaIds[]`.

- **Read by:** Web app (`onSnapshot` all teams); both extensions cloudSync (`getDoc teams/{teamId}` — settingsVersion check + productIds/personaIds + default keys).
- **Written by:** Web app DataContext only (`addTeam` sets `settingsVersion:1`; `updateTeam` bumps it).

### `credits` (docId = Auth UID)

`balance` (number), `plan` (`free|starter|pro|enterprise`), `monthlyAllocation` (number), `lastReset` (timestamp), `teamId`, `usage{scoring,pitches,research,contacts}`, `createdAt`. **Costs:** scoring 1, pitch 2, research 5, contact-reveal 10.

- **Read by:** AltLeads ext `panel.js` (balance, `hasCredits` check, display); web app (`onSnapshot` all credits).
- **Written by:** AltLeads ext `panel.js` (lazy monthly auto-reset if >30 days; `runTransaction` to decrement balance + increment usage on spend); web app DataContext.

### `profileViews`

`prospectId?`, `agentId` (= user.uid), `teamId`, `linkedinUrl`, `prospectName`, `timestamp` (serverTimestamp).

- **Read by:** Web app (`onSnapshot` `timestamp desc` `limit 500`).
- **Written by:** Both extensions `cloudSync.logProfileView` (`.add`) — **note: never invoked in AltLeads 4.1.0**; web app `logProfileView`.

### `activityLogs`

`userId`, `userEmail`, `userName`, `teamId`, `action` (e.g. `create_request`/`login`), `targetId?`, `targetType?` (`contactRequest|prospect|user`), `details` (map), `timestamp` (serverTimestamp), `source` (`extension`|`web_app`), `extensionVersion` (`'3.0.0'` hardcoded).

- **Read by:** web admin/analytics (write-mostly audit trail).
- **Written by:** Both extensions `cloudSync.logActivity` (`.add`) — **note: never invoked in AltLeads 4.1.0**.

### `products` (AI pitch/scoring config — not needed for match MVP)

`id`, `teamId` (+`teamIds[]` multi-team), `name`, `tagline`, `painPoints[]`, `cta`, `icon?`, `companyName?`, `scale?`, `clients[]?`, `competitors[]?`, `customSystemPrompt?`, `customPitchNotes?`, `isActive`, `createdBy`, `createdAt`, `updatedAt`.

- **Read by:** Web app (`onSnapshot`); extensions cloudSync (by `team.productIds` `documentId 'in'` max30, or `where teamId == & isActive`).
- **Written by:** Web app DataContext only.

### `personas` (targeting/scoring config)

`id`, `teamId` (+`teamIds[]`), `name`, `titles[]`, `keywords[]`, `scoreBoost`, `linkedProductIds[]?`, `createdBy`, `createdAt`.

- **Read by:** Web app (`onSnapshot`); extensions cloudSync (by `team.personaIds`, or `where teamId ==`).
- **Written by:** Web app DataContext only.

### `aiModels` (global model registry, not team-scoped)

`id` (docId), `provider` (`groq|openrouter|gemini|dogradient`), `modelId` (API string), `displayName`, `categories[]` (`extraction|scoring|research|pitches`), `isDefault`, `isActive`, `createdAt`, `updatedAt`.

- **Read by:** Web app (`onSnapshot`); extensions cloudSync (`where isActive == true`).
- **Written by:** Web app DataContext only (set/batch upsert by id).

## D.5 First-pass Firestore → Supabase mapping (for context; full plan in a later doc)

| Firestore collection | Supabase/Postgres target | Notes |
|----------------------|--------------------------|-------|
| `prospects` | reuse the CRM's existing **contacts** table | Add/standardize a `linkedin_url` column, store **NORMALIZED** (`linkedin.com/in/<slug>`, no scheme/www/trailing slash) and **index** it — THE match key. Replace the 12-variation loop with one normalized-equality lookup (ideally a generated/normalized column + unique index) |
| Disposition enums | Postgres enum or text+check on per-field columns | Accurate/Wrong/Unverified |
| `contactRequests` | a `contact_enrichment_requests` (or "data requests") table | FK `contact_id`, status enum, `requested_by`/`fulfilled_by` FK profiles, `source_hint`, timestamps; fulfil flow = UPDATE contact + status transition in **one transaction** |
| `users` | existing CRM `profiles` (auth.uid) | role/status/teamId already modeled |
| `teams` | existing project/org scoping | CRM uses numeric `project_id` |
| `credits` | a `usage_credits` table keyed by profile id | balance/plan/monthly_allocation/last_reset/usage jsonb — **likely DEFER for v1** |
| `activityLogs` | existing CRM activity/audit log | **the hook for "record changes EXACTLY as if changed in the CRM"** |
| `profileViews` | a `profile_views`/touch-log table | contact_id, agent profile id, ts |
| `products`/`personas`/`aiModels` | AI-pitch config tables | **DEFER, not needed for the read/match MVP** |
| user→team API-key/model-config fan-out | **drop entirely** | server-side keys in CRM instead |
| client-side `.where(teamId)` isolation | real **Supabase RLS** scoped by project/role | the CRM's existing posture |

---

## Appendix — Cross-cutting findings (carry into the rebuild)

1. **The reusable LinkedIn primitive is just the URL.** Across all three apps the only dependable signal is the `/in/<slug>` URL regex (`/linkedin\.com\/in\/([^/?#]+)/i`). There are **no reusable structured-field CSS selectors** for name/title/company/email anywhere — structured extraction was either LLM-based or absent. The rebuild matches on a **normalized `linkedin_url`** and pulls all contact details from Supabase.
2. **Best overlay reference = ResearchExt's shadow-DOM injected panel** (`content/researchPanel.js`). Best CRM-card UX reference = AltLeads 4.1.0's **Contact tab** (`renderContactSummary`, masking, disposition dropdowns). Best **data-model/dedup** reference = `extension_schema.md` + web app `DataContext.normalizeUrl`.
3. **Security must invert:** today auth is trust-the-client (cached flags, app-layer `teamId`, open-ish Firestore rules, hardcoded keys, dev backdoors). The rebuild enforces with **Supabase RLS + a real session/JWT**, anon key on the client, provider/service keys server-side in notify-service.
4. **Audit trail is the north-star gap.** Existing writes are bare last-write-wins `update()`s with broken/placeholder attribution (ResearchExt `window._rrCurrentUser` bug). The rebuild must route writes through the CRM's **real mutation paths + activity logging** so changes are recorded exactly as if made inside the CRM.
5. **Drop AI/credits entirely for v1** — out of scope and a key-leak vector. Keep the disposition/verification + request-fulfillment **concepts** only.
