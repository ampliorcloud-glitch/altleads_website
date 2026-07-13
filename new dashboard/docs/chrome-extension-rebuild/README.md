# Chrome Extension Rebuild — Index & Overview

> **Read this first.** This folder plans the rebuild of our Chrome extension(s) into ONE new extension that talks to our existing AltLeads CRM. This page is the map; the deeper docs are linked in the table of contents below. Written to be skimmable for a non-technical owner.

---

## Mission (one paragraph)

We are merging two old Firebase-based Chrome extensions and one half-finished web tool into **one new browser extension that plugs straight into our existing AltLeads CRM** (the same Supabase database the web app uses — not a separate "prospects" database). The goal: when a salesperson is looking at someone's **LinkedIn profile**, the extension checks "do we already have this person in our CRM?" and, if so, shows their details and history in the **browser's built-in side panel** (a separate panel beside the page, NOT injected into LinkedIn) — and later, lets the user update them without leaving the browser. Everything it writes is recorded **exactly as if it were typed into the CRM web app** (same audit trail, same permissions).

> **Critical compliance rule (locked 2026-06-22):** The extension **never injects anything into the LinkedIn page and never reads the LinkedIn page content (DOM)**. LinkedIn has **banned our users' personal accounts** over injection in the past — so the ONLY thing we read from LinkedIn is the **address-bar URL of the active browser tab** (to pull out the `/in/<slug>` and look the person up in our own CRM). No content script on LinkedIn, no reading its page, no on-page panel.

---

## The product vision (what it does, in plain words)

1. **You open a LinkedIn profile** (e.g. `linkedin.com/in/john-doe`).
2. The extension reads **only the browser tab's address bar** (not the page itself) and **looks the person up in our CRM** by their LinkedIn link (using a safe, built-in lookup that does not leak hidden data).
3. **If we have them AND you own the company,** the **side panel** shows their **contact details and associated records** — leads/deals, current status for the active project, meetings, tasks, and the recent activity feed — for the **project you've selected** in the panel. It also links back to the full CRM page.
4. **If we have them but you do NOT own the company,** the side panel shows a **limited card** — contact name + company + **company status (including DNC, which must always be visible)** + last update/activity date + the current owner's name (within the project) — plus a **"Request this company" button** that sends a request to your **Team Lead** (the same way lead-report / meeting approvals already work). On TL approval the company is assigned to you and the full contact details become revealable.
5. **Later (Phase 2):** the side panel becomes a **mini-CRM** — you can edit the contact and log calls / update status from the panel, and it **syncs both ways** with the CRM through the exact same save path the web app uses.

**Read-only first, edit-in-place later.** Phase 1 (just showing details + the non-owned request flow) is **planned first and not yet coded**. Phase 2 (editing) is deliberately held back until a known CRM permissions fix lands (see Blockers).

---

## Scope (what's in, what's a reference, what's out)

| Source | What we do with it |
| --- | --- |
| **AltLeads 4.1.0** (old prospect-viewer extension) | **Rebuild.** Keep its clean panel/launch patterns and the project selector idea; drop its Firebase + AI internals. |
| **Data ResearchExt** (old fulfillment/research extension) | **Rebuild for data/API patterns ONLY.** Its in-page injection pattern is now **forbidden** (see compliance rule) — do NOT reuse it. Drop its research-queue and Firebase internals. |
| **AL Prospect Finder** (web app — its "detect a LinkedIn profile" idea was never finished) | **Learn from, do NOT copy.** Take the LinkedIn-detection intent only — and detect from the **tab URL**, not the page. |
| Their AI / pitch-writing / lead-scoring | **Out of scope. Dropped.** |
| Their credits / billing / plans subsystem | **Out of scope. Dropped.** |
| Their research-request queue & separate Firestore prospects database | **Out of scope. Dropped** — we use our own CRM tables. |
| **Any LinkedIn page injection / content script / DOM reading** | **Out of scope. Forbidden** — LinkedIn banned our users' accounts over injection. URL-only reading via the side panel. |

**One-line principle:** *Keep the panel pattern, the project selector, and the LinkedIn-detection idea; throw away Firebase, AI, credits, the separate database, and ALL page injection. Read only the tab URL; talk only to our own CRM.*

---

## Architecture (one line)

A **Chrome MV3 extension** = a **`side_panel` UI** (the panel beside the browser, where everything is shown) + a **background service worker** that watches the **active tab's URL** via Chrome's tab APIs (`chrome.tabs` — `onUpdated` / `onActivated` / `query`) to spot a LinkedIn profile. **No content script on linkedin.com, no host permission to read its DOM, no on-page panel, no MutationObserver.**

---

## Table of contents (the sibling docs)

| Doc | What's inside |
| --- | --- |
| [01-CURRENT-STATE-ANALYSIS.md](./01-CURRENT-STATE-ANALYSIS.md) | What the old extensions actually do today; what's reusable vs. what's dead weight. |
| [02-MIGRATION-BLUEPRINT.md](./02-MIGRATION-BLUEPRINT.md) | The technical plan: new extension architecture, Firebase→Supabase mapping, auth, and the phased build plan. |
| [03-LINKEDIN-MINI-CRM-FLOW.md](./03-LINKEDIN-MINI-CRM-FLOW.md) | The end-to-end flow: detect profile (from tab URL) → match by LinkedIn URL → show details (owned) or limited card + "Request this company" (not owned) → (Phase 2) edit & two-way sync. |
| [04-PHASE-1-BUILD-PLAN.md](./04-PHASE-1-BUILD-PLAN.md) | The step-by-step Phase 1 build plan (planned first, not yet coded): side-panel UI, URL-watching service worker, project selector, owned vs. non-owned views, and the "Request this company" → Team Lead approval flow. |
| [CRM-HANDOFF-FOR-CRM-OPUS.md](./CRM-HANDOFF-FOR-CRM-OPUS.md) | The asks for the CRM side (e.g. the ALT-152 write fix, the new "Request this company" TL-approval workflow, the CRM-top-panel project selector, shared normalization code, optional read RPC) so the CRM and extension stay in lockstep. |

---

## Current status

- **Phase 1 is being planned first; nothing built yet.** This folder is the blueprint; the step-by-step Phase 1 plan lives in [04-PHASE-1-BUILD-PLAN.md](./04-PHASE-1-BUILD-PLAN.md).
- **Architecture locked (2026-06-22): side panel only, URL-only reading.** Chrome MV3 `side_panel` + a service worker watching the active tab's URL. **No injection, no content script, no DOM reading on LinkedIn** (compliance — LinkedIn banned our users' accounts over injection).
- **Verdict from review: FEASIBLE WITH CORRECTIONS.**
  - **Phase 1 (read-only: match a LinkedIn profile and show the contact) is shippable** once built. The CRM pieces it relies on already exist and are confirmed in the code (the safe lookup, the stored LinkedIn key, the masked data view, and the login/permissions model). The **non-owned "Request this company" → Team Lead approval** flow and the **shared project selector** are **new CRM work** to engineer alongside it.
  - **Phase 2 (edit-in-place / two-way sync) is correctly held back** until the CRM write-permissions fix (ALT-152) lands and is tested with a real (non-admin) agent login.
- **One correction to bake in before Phase 1:** the LinkedIn web address must be normalized to **lowercase**, with the query/`#` part removed and only the first path segment kept, so it matches the stored key exactly. (The existing web helper does not lowercase on its own — copying it literally would miss mixed-case profiles.)
- **Security posture locked:** the extension uses the **public key + the user's own login + the CRM's row-level security** — never the all-powerful server key. So the extension can only ever do what that user could do in the web app.

---

## Top open questions & blockers

**Hard blocker (Phase 2 only):**

- **ALT-152 — the CRM write/ownership blocker.** All CRM "edit" permissions check *"did you create this record?"*, but our data was bulk-imported, so a normal agent is denied (error `42501`) on most records. Phase-2 editing **cannot work for those records** until the CRM moves to an *"edit records assigned to you"* model. Review also found this blocker is **bigger than first thought**: it hits **three separate places** — editing the contact, updating its status, *and* even writing the audit/activity row — and each has slightly different rules. The fix must align **all three** together, and be validated with a real agent login. **Phase 1 (read-only) is not affected and can proceed.**

**Locked decisions (2026-06-22) — these settle earlier open questions:**

1. **No injection, side panel only, URL-only reading.** The extension reads only the active tab's address-bar URL and shows everything in the Chrome **side panel**. No content script, no DOM reading, no on-page launcher. (Settles the old "panel style" and "LinkedIn ToS / visibility" questions — driven by the account-ban risk.)
2. **Non-owned contact → "Request this company" to the Team Lead.** Instead of just masking, a not-owned match shows name + company + **company status (DNC visible)** + last update date + owner name, with a **"Request this company"** button that routes to the agent's TL (mirroring the existing lead-report / meeting approval flow); on approval the company is assigned and details become revealable. (Settles the old "masking vs. usefulness" question — and is **new CRM workflow to engineer**.)
3. **Project selector in both places.** The extension top panel has a **project selector**, and the **same selector is added to the CRM's top panel**. Default = the project in the user's CRM personal settings (or their only project); the extension reflects/shares that selection. (Settles the old "which project?" question.)

**Still-open questions for the owner to decide:**

- **Timing of Phase 2** — is the ALT-152 fix scheduled before we want the edit feature, or do we ship Phase 1 now and treat Phase 2 as a later milestone?
- **Single sign-on** — is it OK for the extension to reuse the login session from an open `crm.altleads.com` tab, or should it always ask for **email/password in the extension** instead?
- **"Add to CRM" on no-match** — keep strictly **admin/data-team only** (matches our outreach-only rule), or allow it per-project like our other create-rights decision?

---

*Last updated: 2026-06-22. Keep this index current as the docs and decisions evolve.*
