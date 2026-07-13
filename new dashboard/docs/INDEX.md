# AltLeads CRM — Documentation Map (start here)

> **Plain-language map of every document in this project.** If you're new (or non-technical), read this first. It tells you which files matter most, what each one is for, and where the old/scratch files went.
>
> *Last cleaned up: 2026-06-23 (docs hygiene pass — scratch/temp files moved to [`archive/`](archive/), nothing deleted).*

---

## ⭐ Read these first (the source of truth)

These four are the most important. If you only open four files, open these.

| ⭐ | Document | What it is |
|---|---|---|
| ⭐ | [`../REBUILD_LOG.md`](../REBUILD_LOG.md) | **The running history and current state — read this first, every session.** Append-only; newest entries at the bottom. |
| ⭐ | [`AltLeads-Backlog-Tracker.xlsx`](AltLeads-Backlog-Tracker.xlsx) | The Jira-style backlog (every ALT-### ticket, status, priority). Open in Excel. **Regenerate after edits:** `node new-code/web/scripts/gen-backlog-tracker.cjs` |
| ⭐ | [`../CLAUDE.md`](../CLAUDE.md) | The operating guide — how we work, the standards, key facts, where things live. Auto-loads into every chat. |
| ⭐ | [`product/PRD.md`](product/PRD.md) | The Product Requirements — what the CRM must do, for whom, and why. The authoritative product spec. |

Other top-level entry points: [`../README.md`](../README.md) (repo intro) · [`../SUMMARY.md`](../SUMMARY.md) (one-page project snapshot).

---

## A. Product documents (`product/`)

The business-facing docs — what we're building and why. See [`product/INDEX.md`](product/INDEX.md) for the product-team's own focused index.

### North-star & launch
| Document | One-line description |
|---|---|
| [`product/VISION.md`](product/VISION.md) | The north-star: an ecosystem that captures everything and turns it into an AI advantage. |
| [`product/PRD.md`](product/PRD.md) | ⭐ Product Requirements — the authoritative product spec (all modules, status model, hosting). |
| [`product/PRODUCT-GUIDE.md`](product/PRODUCT-GUIDE.md) | Plain-language "what AltLeads is and how the team uses it." |
| [`product/ROADMAP.md`](product/ROADMAP.md) | Phase-by-phase timeline — what each phase delivers and where we are. |
| [`product/INTERNAL-LAUNCH-PLAN.md`](product/INTERNAL-LAUNCH-PLAN.md) | The plan to go live for the internal team (built & live; gated on decisions + hardening). |
| [`product/BACKLOG.md`](product/BACKLOG.md) | Narrative backlog by module (the .xlsx tracker is the live source; this is the prose version). |

### Decisions & open items
| Document | One-line description |
|---|---|
| [`product/DECISIONS.md`](product/DECISIONS.md) | Running record of architecture/product decisions (ADRs) — what we chose and why. |
| [`product/AMBIGUOUS-DECISIONS.md`](product/AMBIGUOUS-DECISIONS.md) | Undefined/contradictory decisions surfaced by the persona audit, awaiting owner calls. |
| [`product/OPEN-QUESTIONS.md`](product/OPEN-QUESTIONS.md) | Outstanding questions for the owner. |
| [`product/RISK-REGISTER.md`](product/RISK-REGISTER.md) | What could go wrong, likelihood/impact, mitigation, status. |

### Access, roles & data
| Document | One-line description |
|---|---|
| [`product/ROLES-AND-PERMISSIONS.md`](product/ROLES-AND-PERMISSIONS.md) | The six roles and a matrix of exactly what each can do (source for RLS rules). |
| [`product/ACCESS-CONTROL-MODEL.md`](product/ACCESS-CONTROL-MODEL.md) | Design for who can see/edit which records (masking, ownership). DESIGN ONLY. |
| [`product/DATA-DICTIONARY.md`](product/DATA-DICTIONARY.md) | Plain-language guide to the database tables/columns and how they connect. |
| [`product/GLOSSARY.md`](product/GLOSSARY.md) | Plain-language dictionary of the business/technical terms used across the docs. |

### Modules & UX
| Document | One-line description |
|---|---|
| [`product/COMPANIES-CONTACTS-BLUEPRINT.md`](product/COMPANIES-CONTACTS-BLUEPRINT.md) | Design blueprint for the Companies + Contacts modules. |
| [`product/SALES-PORTAL.md`](product/SALES-PORTAL.md) | The client-facing Sales Portal (separate login; client teams see only their projects). |
| [`product/CLIENT-PORTAL.md`](product/CLIENT-PORTAL.md) | Client Portal plan (Amplior-branded, web-only). Not built. |
| [`product/CLIENT-PORTAL-PHASE1.md`](product/CLIENT-PORTAL-PHASE1.md) | Client Portal Phase 1 plan (epic ALT-221). Not built. |
| [`product/TASK-MANAGER.md`](product/TASK-MANAGER.md) | Plan for in-CRM tasks/reminders (e.g. "call back tomorrow at 11"). |
| [`product/BULK-IMPORT-EXPORT.md`](product/BULK-IMPORT-EXPORT.md) | How admin keeps data current via Excel export/edit/re-import (no team data entry). |
| [`product/UX-REDESIGN.md`](product/UX-REDESIGN.md) | UX direction: optimize every screen for fast updates; hide creation from the team. |
| [`product/UX-AUDIT.md`](product/UX-AUDIT.md) | Full UX audit — recurring patterns, quick wins, owner TL;DR. |
| [`product/HIGH-IMPACT-UX-GAPS.md`](product/HIGH-IMPACT-UX-GAPS.md) | The highest-impact UX gaps still pending. |
| [`product/VIEWS-AND-PREVIEW-PLAN.md`](product/VIEWS-AND-PREVIEW-PLAN.md) | Plan for multiple views (Kanban/Grid/Table) + right-side preview on every module. |
| [`product/EMAIL-TEMPLATES.md`](product/EMAIL-TEMPLATES.md) | The system email templates. |

### Research & reference
| Document | One-line description |
|---|---|
| [`product/HUBSPOT-SALES-REFERENCE-PRD.md`](product/HUBSPOT-SALES-REFERENCE-PRD.md) | Reference: how HubSpot organises B2B sales, and how Amplior differs. |
| [`product/HUBSPOT-ZOHO-UX-RESEARCH.md`](product/HUBSPOT-ZOHO-UX-RESEARCH.md) | 2025–26 HubSpot/Zoho UX research (ALT-348) — what makes those tools easy. |
| [`product/PERSONA-AUDIT-2026-06.md`](product/PERSONA-AUDIT-2026-06.md) | Live-app audit from each user persona's point of view vs HubSpot/Zoho. |
| [`product/B2B-CRM-FEATURES.md`](product/B2B-CRM-FEATURES.md) | B2B CRM feature reference for our outreach-only model. |
| [`product/SITE-FEASIBILITY.md`](product/SITE-FEASIBILITY.md) | Where data-sourcing could get stuck (site/feasibility notes). |
| [`product/AI-PGVECTOR-PLAN.md`](product/AI-PGVECTOR-PLAN.md) | Plan for the AI/pgvector layer (roadmap item H — the last major item). |

### Leadership decks
| Document | One-line description |
|---|---|
| [`product/deck-product-guide.html`](product/deck-product-guide.html) | Product-guide slide deck (HTML). |
| [`product/deck-product-launch.html`](product/deck-product-launch.html) | Product-launch slide deck (HTML). |
| [`product/render-decks.cjs`](product/render-decks.cjs) | Generator that renders the decks to PDF. |

---

## B. Engineering references (`docs/*.md`)

Technical references for builders.

| Document | One-line description |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Plain-language explanation of the technical setup (Supabase, hosting, no servers to manage). |
| [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md) | Security audit findings and status. |
| [`QA-AUDIT.md`](QA-AUDIT.md) | The QA audit (originally 41 issues; resolved items kept for reference). |
| [`USER-STORIES-AND-FLOWS.md`](USER-STORIES-AND-FLOWS.md) | Authoritative step-by-step user journeys and screen flows. |
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | Palette, type, and components (extracted from the Figma "New UI" frames). |
| [`chrome-extension-rebuild/`](chrome-extension-rebuild/) | Plan to rebuild our Chrome extension(s) into one extension on Supabase. Start with its [`README.md`](chrome-extension-rebuild/README.md). |

### Live reference files (auto-generated / kept, not docs to edit by hand)
| File | One-line description |
|---|---|
| [`CONVERSATION-LOG.md`](CONVERSATION-LOG.md) | Auto-generated chat archive (every past message + reply). Local-only/gitignored. Regenerated by `node new-code/web/scripts/gen-conversation-log.cjs`. **Do not edit by hand.** |
| `amplior_backup.sql` | The original 47-table MySQL schema dump — kept as the reference for data migration. Gitignored. |

---

## C. Testing

| Document | One-line description |
|---|---|
| [`UAT-CHECKLIST.md`](UAT-CHECKLIST.md) | The go-live test checklist — test each item and record Pass/Fail. (Note: `product/UAT-CHECKLIST.md` is the older product-side copy.) |

---

## D. Archive (`archive/`) — old & scratch files, kept for safety

These were cluttering `docs/`. **Nothing was deleted** — they were moved here on 2026-06-23 so the priority docs are easy to find. All of these are untracked/local-only.

| Folder | What's inside | Why archived |
|---|---|---|
| [`archive/scratch-notes/`](archive/scratch-notes/) | `Debugging Leads UI.md`, `Rebuilding Amplior CRM.md` | Raw chat-transcript dumps from early sessions — superseded by REBUILD_LOG and CONVERSATION-LOG. |
| [`archive/figma-exports/`](archive/figma-exports/) | `figma-export/`, `figma-zip/` (SVGs), `figma-png/` (rasterized screens) | Bulky design-asset exports. Still useful as design reference, just moved out of the way. |
| [`archive/extracted-doc-contents/`](archive/extracted-doc-contents/) | `cr_doc_content/`, `cr_est_content/`, `temp_do_doc/`, `temp_docx_content/`, `temp_tech_arch/` | Unzipped internals of Office files — machine junk, not meant to be read directly. |
| [`archive/vendor-original-docs/`](archive/vendor-original-docs/) | Original vendor `.docx`/`.pdf`/`.zip`/`.xlsx` (FRS, DBD, ERD, CR quote/estimate, GitLab/MySQL/DigitalOcean guides) + early `.sql` seed scripts (`insert_dev_user.sql`, `populate_sample_data.sql`) | Historical vendor handover material — reference only; the rebuild has replaced it. |

---

*Maintainers: when you add a doc, list it here and (if it's a product doc) in [`product/INDEX.md`](product/INDEX.md). When something becomes scratch, move it to `archive/` (never delete) and note it in section D.*
