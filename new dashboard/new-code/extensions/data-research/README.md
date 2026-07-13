# AltLeads Data Research Extension

The research / back-office team's Chrome side-panel tool.  Separate from the
outreach `contact-viewer` — different logins, different purpose.

## What it does

**Queue view** (default)
- Lists open `contact_research_request` rows (pending + in_progress), newest first.
- Each row shows: requester name, when requested, target (LinkedIn slug / Contact #id),
  fields needed, status.
- Click any row to open the **detail view** for that contact.

**Detail view** (per request / per contact)
- Shows the linked contact's 6 detail fields with clear **PRESENT** / **MISSING** status:
  `full_name`, `designation`, `email`, `mobile_no`, `alt_mobile_no`, `linkedin_url`.
- Inline fill / edit form for all 6 fields.  Pre-filled with current values.
- **Save (& mark done)** — writes filled values to `contact_master`
  (re-derives `linkedin_clean` from the URL) and stamps the request `done` with
  `fulfilled_by` + `fulfilled_at`.
- **Mark not found** — stamps the request `not_found`.
- 42501 (permission denied) errors show a friendly "RESEARCH role / RLS not enabled yet"
  message; never crash.
- No associated-records UI (leads / tasks / activity feed / per-project status) —
  research team only fills contact details, not outreach state.

**Profile banner** (when active tab is a LinkedIn `/in/` URL)
- The background service worker detects the URL via `chrome.tabs.onUpdated` /
  `onActivated` — **NO page injection / DOM reading** (compliance).
- The panel shows a banner: normalized slug + matching CRM contact (if any).
- Clicking **Open details** opens the detail view to fill that contact directly
  while viewing the LinkedIn profile.

---

## How to load in Chrome

1. Run `npm install && npm run build` from **this folder**
   (`new-code/extensions/data-research/`).
2. Open `chrome://extensions/` → enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select the `dist/` folder inside this directory.
4. Click the AltLeads Research toolbar icon → side panel opens.
5. Sign in with a research-team CRM account.

---

## Environment setup

`.env` in this folder already contains the live Supabase URL and public anon key
(copied from `new-code/web/.env.local`).  The anon key is safe to ship — it is
already in the web bundle.  **Never** put the service-role key here.

```
VITE_SUPABASE_URL=https://puvozfhypqbwbmbhrhcr.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from new-code/web/.env.local>
```
Rebuild after any `.env` change.

---

## Build

```bash
cd new-code/extensions/data-research
npm install          # first time only
npm run build        # outputs dist/  (the loadable extension)
npm run dev          # watch mode (rebuilds on file change)
npm run typecheck    # type-check only
```

Same Vite 5 manual multi-entry pattern as `contact-viewer/`.  No `@crxjs`.
See `vite.config.ts` and `new-code/extensions/BUILD-CONVENTIONS.md`.

**TypeScript note:** `npm run typecheck` reports one expected error:
> `Cannot find module '@supabase/supabase-js'` in `shared/supabaseClient.ts`

This is a known limitation: `tsc` cannot resolve `@supabase/supabase-js` when
the importing file lives in `../shared/` (outside this extension's `node_modules`).
Vite handles it correctly via `resolve.dedupe`.  The build is fully green; the
typecheck error is cosmetic.

---

## Hard compliance rules (non-negotiable)

- **NO content scripts.  NO page injection.  NO DOM reading.**  The only LinkedIn
  input is the active tab's URL, read off-page via `chrome.tabs.onUpdated` /
  `onActivated`.
- **NO `linkedin.com` host permission** requested.
- **NO service-role key** — anon key + user JWT + RLS only.
- Permissions: `["sidePanel", "tabs", "storage"]`.  Host permission: Supabase URL only.
- All UI renders in a Chrome MV3 `side_panel`.

---

## Shared helpers added

New helpers in `shared/researchRequests.ts` (used by this extension):

| Helper | Purpose |
|--------|---------|
| `listOpenRequests(limit?)` | Fetch pending + in_progress queue rows |
| `fulfillRequest(requestId, fulfilledBy)` | Mark request `done` |
| `markNotFound(requestId, fulfilledBy)` | Mark request `not_found` |
| `updateContactDetails(contactId, fields, updatedBy)` | Write filled fields to `contact_master`, re-derive `linkedin_clean` |

All four degrade gracefully: 42P01 → `backend_not_ready`, 42501 → `forbidden`.

---

## Known TODOs / CRM dependencies

- **`contact_research_request` table (ALT-282 R3):** Queue, save, not-found all
  require this table. Until deployed, a friendly "backend not ready" message is shown.
- **Research role + RLS (REQUEST 5 / DECISIONS.md):** Writes to `contact_master` and
  `contact_research_request` require the RESEARCH role and its RLS policies. Until
  deployed, saves surface a 42501 → friendly permission error.
- **Write path (ALT-152):** Filling contact fields via `contact_master` UPDATE requires
  the assignment-based write model to be applied.
- **Icons:** Add `icons/icon16/32/48/128.png` before Chrome Web Store submission.
