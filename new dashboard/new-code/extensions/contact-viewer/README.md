# AltLeads CRM on LinkedIn — Contact Viewer Extension

**Phase 1 (read-only).** When the user browses a LinkedIn `/in/<slug>` profile, this extension shows the matching AltLeads CRM contact in a Chrome side panel.  No page injection, no content script, no LinkedIn DOM reading.

---

## How to load in Chrome

1. `npm install && npm run build` (in this folder)
2. Open `chrome://extensions/` → enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder inside this directory
4. Click the AltLeads puzzle-piece icon in the Chrome toolbar → the side panel opens
5. Sign in with your AltLeads CRM email + password

---

## Environment setup

The `.env` file at `contact-viewer/.env` already contains the live Supabase URL and anon key (copied from `new-code/web/.env.local`).  The anon key is **public** — it is safe to ship in the extension bundle.

If you need to point at a different Supabase project, edit `.env` and rebuild.

**Never put the Supabase service-role key here.**

---

## Build

```bash
npm install          # one-time
npm run build        # outputs dist/
npm run dev          # watch mode (rebuilds on file save)
npm run typecheck    # tsc type-check without building
```

The build uses **plain Vite 5 (no @crxjs)** with a manual multi-entry config:
- `src/background.ts`  → `dist/background.js`  (MV3 service worker)
- `src/sidepanel.ts`   → `dist/sidepanel.js`
- `src/sidepanel.html` → `dist/sidepanel.html`
- `manifest.json`      → `dist/manifest.json`  (copied by Vite plugin)

Shared code from `../shared/` is aliased as `@shared/*` and bundled in.

---

## Architecture

- **No content script.** No injection into any page.
- The background service worker (`background.ts`) reads only `tab.url` via `chrome.tabs.onUpdated` / `chrome.tabs.onActivated` — never the LinkedIn page DOM.
- The side panel (`sidepanel.ts`) receives the normalized slug from the background worker, calls `find_contact_for_panel` (or falls back to `find_contact_dup`), and renders the contact card.
- Auth: Supabase email/password (`signInWithPassword`). Session persisted in `chrome.storage.local`.
- Permissions: `["sidePanel","tabs","storage"]`. Host: Supabase URL only.

---

## Request / Re-request contact details (Phase 1.5)

On the **owned contact card**, below the contact detail fields, a "Research request" section now appears:

- **Missing fields detected:** the section computes which of `email`, `mobile`, `LinkedIn URL`, and `designation` are absent and shows them (e.g. "Missing: email, mobile").
- **No open request → "Request contact details" button:** clicking it creates a `contact_research_request` row with `status='pending'`, `requested_by` = the logged-in user's `profiles.user_id`, and `fields_needed` set to the missing fields. On success, the section shows "Requested ✓ — pending with research team". If nothing is missing, the button reads "Request re-verification" and requests all detail fields.
- **Open request exists → "Requested X ago · pending/in progress"** + a secondary **"Re-request"** button that re-opens the row (`status='pending'`, `requested_at=now()`).
- **Degraded states** (never crash):
  - *Backend not ready* (Postgres 42P01 — table not yet created): "Research queue not set up yet."
  - *Permission error* (RLS 42501): "Permission denied — cannot submit request."
  - *Network / other error*: "Request failed — please try again."

The only write this extension performs is to `contact_research_request`. It never writes to `contact_master`.

## Known TODOs

- **find_contact_for_panel RPC (ALT-282):** The non-owned card's enriched fields (company status, last activity, owner name) require this RPC on the CRM side. Until it is deployed, the extension falls back to `find_contact_dup` and shows name + company only.
- **Meetings:** the `meeting_schedule` chain is complex; a "TODO: meetings" placeholder renders instead of real data. Implement once the chain is confirmed.
- **Icons:** placeholder icon files are not included. Add `icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` to the extension folder before the Chrome Web Store submission.
- **Project selector sync with CRM web app (ALT-284):** the project selector currently loads projects from Supabase and persists locally. Full two-way sync with the CRM web app's top-bar selector requires ALT-273/ALT-284.
- **Phase 2 (editing) is blocked on ALT-152.** Do not add write controls until the assignment-based write model is validated with a real non-admin agent login.
