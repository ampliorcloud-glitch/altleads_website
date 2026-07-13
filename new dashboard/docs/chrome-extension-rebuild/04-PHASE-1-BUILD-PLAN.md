# 04 — Phase 1 Build Plan: "Show the CRM contact on a LinkedIn profile" (read-only)

> **Status: PLAN ONLY** — owner asked to plan Phase 1 first; nothing is coded yet.
> **Owner decisions locked 2026-06-22.** Companion docs in this folder:
> [README](./README.md) · [01-CURRENT-STATE-ANALYSIS](./01-CURRENT-STATE-ANALYSIS.md) · [02-MIGRATION-BLUEPRINT](./02-MIGRATION-BLUEPRINT.md) · [03-LINKEDIN-MINI-CRM-FLOW](./03-LINKEDIN-MINI-CRM-FLOW.md) · [CRM-HANDOFF-FOR-CRM-OPUS](./CRM-HANDOFF-FOR-CRM-OPUS.md)
> Backlog: epic **ALT-279**, children **ALT-280..287**.

---

## 0. The four locked decisions (these shape everything below)

1. **NO INJECTION. Side panel only. URL-only.** The extension must **not** inject anything into the LinkedIn page and must **not** read the LinkedIn page content/DOM. LinkedIn has **banned the owner's users' personal accounts** because of injection. The **only** thing we read from LinkedIn is the **active browser tab's address-bar URL** (to get the `/in/<slug>`). Everything else comes from our Supabase CRM.
2. **Non-owned contact view + request-to-TL.** If the matched contact isn't owned by the agent, show a limited card (name + company + company status incl. **DNC** + last activity + owner name) and a **"Request this company"** button that goes to the agent's Team Lead, mirroring the existing lead/meeting approval flow. On approval the company is assigned and details unlock.
3. **Project selector in both places.** The extension's top selector mirrors the CRM's global project selector (**ALT-273, already shipped**); default = the user's CRM personal-settings project (or the only project).
4. **Plan first** (this document), then build on approval.

---

## 1. What Phase 1 delivers

A Chrome **side panel** that, while the user browses LinkedIn, shows the matching CRM contact (if any) for the profile currently open — **read-only**. No editing, no data creation.

| In scope (Phase 1) | Out of scope (later) |
|---|---|
| MV3 extension + side-panel UI | Editing contacts / status / logging calls → **Phase 2 (ALT-285, blocked on ALT-152)** |
| Login to Supabase (email/password) | SSO session-lift from the CRM tab → polish (A2) |
| Detect the active tab's LinkedIn URL (address bar only) | Reading anything from the LinkedIn page DOM → **never** (ban risk) |
| Match a contact via `find_contact_dup` | Creating a contact on no-match → admin-only, later |
| Show contact + leads/meetings/tasks/activity "in short" (owned) | — |
| Non-owned **limited card** (name, company, **company status/DNC**, last activity, owner) | The **"Request company"** button's backend → **ALT-283** (wired when ready) |
| Project selector synced to the CRM selection | — |

---

## 2. Architecture (no injection, URL-only)

```
┌─ Chrome side panel (React/Vite) ─────────────┐        ┌─ Supabase (our CRM) ─────────┐
│  • project selector (synced to CRM)          │  RPC   │ find_contact_dup(p_linkedin) │
│  • contact card / limited card / no-match    │◄──────►│ contact_master_masked (view) │
│  • associated records "in short"             │ +REST  │ lead_master / contact_project │
│  • login (email + password)                  │ +JWT   │ _status / interaction / task  │
└───────────────▲──────────────────────────────┘        └──────────────────────────────┘
                │ message: {slug, url}
┌───────────────┴──────────────────────────────┐
│  Background service worker                    │   reads ONLY tab.url — never the page
│  • chrome.tabs.onUpdated / onActivated        │
│  • test url contains "linkedin.com/in/"       │   NO content script. NO DOM read. NO inject.
│  • normalize → slug → post to side panel      │
└───────────────────────────────────────────────┘
```

**manifest.json (shape):**
```jsonc
{
  "manifest_version": 3,
  "name": "AltLeads CRM on LinkedIn",
  "permissions": ["sidePanel", "tabs", "storage"],
  "host_permissions": [
    "https://puvozfhypqbwbmbhrhcr.supabase.co/*"
    // + "https://crm.altleads.com/*" ONLY if/when SSO session-lift (A2) is added
  ],
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "panel.html" },
  "action": { "default_title": "AltLeads CRM" }
  // NOTE: NO "content_scripts", NO "scripting", NO linkedin.com host permission.
  // Reading tab.url uses the "tabs" permission, not page access.
}
```

Key point: **we never touch the LinkedIn page.** `tabs` permission lets the background worker read `tab.url`; that URL is the entire LinkedIn input. SPA navigation (profile → profile) is caught by `chrome.tabs.onUpdated`, not a page observer.

---

## 3. Build milestones (each independently demoable)

| # | Milestone | Acceptance criteria | CRM dependency |
|---|---|---|---|
| **M0** | MV3 scaffold + Vite build + side panel opens | Loads unpacked; panel opens on icon click; build reproducible | none |
| **M1** | Supabase auth (A1 email/password) + load `profiles.user_id` + roles | User logs in, holds a real JWT, role known | none |
| **M2** | Tab-URL watcher + normalization | Navigating to `/in/<slug>` posts the correct normalized slug to the panel; non-profile pages show idle state; **no** page access requested | **ALT-287** (normalization must match) |
| **M3** | Match + load (owned) | `find_contact_dup` returns the contact; panel shows details + leads + per-project status + tasks + meetings + last 3 activities "in short" | works today |
| **M4** | Non-owned limited card + no-match/masked states | Non-owner sees name + company + company status (DNC visible) + last activity + owner + (disabled-until-ALT-283) Request button; clean no-match empty state | **ALT-282 RPC** (`find_contact_for_panel`) |
| **M5** | Project selector synced to CRM selection | Changing project re-scopes status/company-status/meetings; defaults to personal-settings project | **ALT-284 / ALT-273 bridge** |

---

## 4. CRM-side dependencies (for the CRM Opus — see the handoff doc)

| Need | Ticket | Blocks |
|---|---|---|
| `deriveLinkedinClean()` lowercase fix + backfill | **ALT-287** | reliable matching (M2/M3) |
| `find_contact_for_panel(p_linkedin, p_project_id)` masking-safe RPC | **ALT-282** (CRM TODO-A) | non-owned card (M4) |
| Company-assignment request → TL approval workflow | **ALT-283** (CRM TODO-B) | the "Request company" button |
| Expose the selected project to the extension | **ALT-284** (CRM TODO-C; builds on ALT-273) | selector sync (M5) |
| Assignment-based write fix (three write gates) | **ALT-152** | **Phase 2 only** (ALT-285) — not Phase 1 |

---

## 5. Sequencing — what can start immediately vs. waits

- **Start now, zero CRM dependency:** M0, M1 (the whole extension shell + auth).
- **Start now, works with existing CRM:** M2/M3 for **owned** contacts (`find_contact_dup` + masked view already exist) — but land **ALT-287** to avoid silent mixed-case misses.
- **Needs a small CRM addition:** M4 non-owned card needs the **ALT-282** RPC.
- **Needs the new workflow:** the **Request-company button** lights up only when **ALT-283** ships. Until then the limited card shows the info and a disabled/"coming soon" button.
- **Phase 2 (editing) does not start** until **ALT-152** is fixed and validated with a real non-admin agent login.

So Phase 1 can begin **today** on the extension side; the only hard pre-req for a trustworthy match is the cheap **ALT-287** fix.

---

## 6. Explicitly NOT in Phase 1
- Any editing / status change / call logging (that's Phase 2, **ALT-285**, blocked on ALT-152).
- Any reading of the LinkedIn page (names, titles, etc.) — **banned**; we only use the URL.
- Creating a CRM contact on no-match (admin-only, later).
- The service-role key in the extension — **never**.

---

## 7. Risks
- **Match coverage:** many of the ~607 migrated contacts have **no LinkedIn saved** → they won't match (clean "not in CRM" state). A LinkedIn-backfill/data-cleanup pass would raise hit-rate.
- **Masking:** for a non-owned contact, the agent sees the limited card only — by design; the request-to-TL flow (ALT-283) is the unlock path.
- **LinkedIn ToS:** even with no injection, confirm tolerance for an extension that reacts to the address-bar URL (this is the safe posture that avoids the prior account bans).

---

## 8. Open questions for the owner
1. **Auth:** ship A1 (explicit email/password login in the extension) first, add A2 (auto-SSO from an open CRM tab) later — OK?
2. **Request-company button before ALT-283:** show it disabled with "request flow coming soon", or hide it until the workflow ships?
3. **No-match "Add to CRM":** keep strictly admin/data-team only (outreach-only north-star), or allow per-project like the create-rights decision?
4. **DNC handling:** when a non-owned company is DNC, should the Request button be blocked outright (can't request a do-not-contact company)?
