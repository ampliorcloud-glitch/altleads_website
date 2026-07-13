# Risk Register — Amplior / Altleads CRM Rebuild

*Purpose: One place that lists everything that could go wrong with the rebuild, how likely and how damaging each is, what we are doing about it, who owns it, and where it stands today.*

*Last updated 2026-06-12*

---

## How to read this

- **Likelihood** and **Impact** are rated **H** (High), **M** (Medium), or **L** (Low).
- **Owner** = the person accountable for keeping that risk under control. "Owner (Mohit)" means the business owner; "Claude" means the AI build assistant handles it under the owner's direction.
- **Status**: *Open* (live concern), *Mitigating* (action in progress), *Watching* (parked but monitored), *Closed* (no longer a threat).
- Think of **Likelihood × Impact** as a rough priority. Anything **H × H** is a top concern and is called out under the table.

---

## Risk table

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|----|------|:---:|:---:|------------|-------|--------|
| R-01 | **Vendor withholds the Android signing keystore and/or Apple + Google Play access** because their final invoice is unpaid. Without the original Android key we cannot push an update to the *existing* Play Store listing under the same app. | M | H | Plan two tracks: (1) ask the vendor for the keystore + store access as part of settling the invoice; (2) if they ghost us, use **Google Play App Signing key reset** and **Apple/Google support recovery** routes. A brand-new Android signing key is fine for a fresh listing. Treat store access as a Phase 6 (mobile) blocker, not a web blocker — the web app ships regardless. | Owner (Mohit) | Open |
| R-02 | **iOS app build needs a Mac**, and the owner works on Windows. Apple's build/sign/upload tools only run on macOS. | M | M | Owner can **borrow a senior's 2020 MacBook**. Backup plan: build iOS in the cloud via a **GitHub Actions macOS runner** (no physical Mac needed). Only relevant in Phase 6; does not affect web. | Owner (Mohit) | Watching |
| R-03 | **Legacy system stored passwords in plain text** (old Java used `NoOpPasswordEncoder`; an AES key was hardcoded; a live DB password was committed to source). Anyone with old-code access could read user passwords. | L (now) | H | **Already fixed in design**: the new system uses **Supabase Auth** (bank-grade hashing) and old plaintext passwords are **NOT migrated**. At go-live each user gets a one-time email to set a fresh password. The one leaked DB credential belonged to a **deleted** forked cluster, so no rotation was needed on the live DB. | Claude | Mitigating |
| R-04 | **Data-quality gaps in the migrated data.** Many leads have empty `company_id` / `agent_id`; the real values live in different columns (`created_by`, `client_assoc_id`). If we read the wrong columns the app shows blank companies and "only 2 agents". | H | H | **Root cause found and fixed**: company = `client_association.client_name` via `client_assoc_id` (populated for all 605 leads); owner/agent = `created_by` (18 real salespeople), not `agent_id`. Lookups are paged with `.range()` to beat PostgREST's 1000-row cap. RLS ownership rule will use `created_by`. All new module code follows this mapping. | Claude | Mitigating |
| R-05 | **Undocumented business rules discovered late.** We have been reverse-engineering flows from messy old code rather than from authoritative user stories, so a rule (e.g. stage-change approval, meeting-creation workflow) can surface mid-build and force rework. | H | M | Switch to **authoritative sources**: draft a master spec from the **FRS V2.0 PDF** + old code + CR doc, then have the owner **review and answer the gaps** (rather than write from scratch). Output captured in `docs/USER-STORIES-AND-FLOWS.md` with tags for confirmed / inferred / gap. Build **depth-first** (finish Leads fully, get it judged) so rule-gaps surface on one module before they spread. | Claude + Owner | Mitigating |
| R-06 | **Fable AI model sunsets 2026-06-22.** The cheap, capable model used for the heavy build is only available until that date, compressing the schedule for migration, core build and mobile rewiring. | H | M | **Front-load all hard work** before 22 Jun (migration is already done; web core in progress). After the cutoff: **Opus 4.8** for hard parts, **Sonnet 4.6** as daily driver — so work continues, just at higher cost/slower cadence. Owner has already switched to Opus 4.8; sub-agents stay on Sonnet. | Owner (Mohit) | Mitigating |
| R-07 | **Forked-database (DB fork) billing.** To migrate without touching production we forked the DigitalOcean MySQL cluster; the fork bills hourly while it runs. | L | L | Fork firewall is locked to one PC. Originally planned to **delete the fork after migration is confirmed**. Owner has **~$19k DigitalOcean credits valid to November**, so cost is a non-issue — fork can stay running until cutover with no budget impact. | Owner (Mohit) | Watching |
| R-08 | **Row Level Security (RLS) is not yet applied** — tables currently have NO RLS, so the anonymous key has full read/write access. Safe locally, but **catastrophic if deployed as-is** (any user could see/edit everyone's data). | M | H | **Hard gate**: RLS **must** be applied in one comprehensive pre-deploy pass across all 65 tables **before any Netlify deploy**. Planned model: ADMIN sees all; managers (TEAM_LEAD / SALES_HEAD / QC) all-for-now then refined to team scope; AGENT / SALES_PERSON see only their own records (`created_by` = own user_id). No deploy happens until this is done and verified. | Claude | Open |
| R-09 | **Single-owner / key-person risk.** The whole rebuild depends on one non-technical owner plus the AI assistant. If the owner is unavailable, decisions, credentials and approvals stall. | M | H | Keep **all decisions, findings and "where we left off" in `REBUILD_LOG.md`** so any new session (or a future developer) can pick up cleanly. Store credentials in a single known vault (`.credentials/`, gitignored). Documents written in plain language so a non-specialist can act on them. Consider a trusted second contact for store/cloud accounts. | Owner (Mohit) | Watching |
| R-10 | **License / "paid-tier trap" landmines carried over from old code** — e.g. AG Grid Enterprise (paid) and other vendor choices that look free until they aren't, plus old code that can't even build (missing `environment_urls` file). Reusing old code risks importing hidden license costs. | L | M | **Rebuild clean, don't lift old code.** Deliberately chose **TanStack Table** (free) over **AG Grid Enterprise** (paid license). New web app is built fresh on an approved, license-clean stack. Old code is kept **read-only as reference only**, never compiled into the new product. | Claude | Closed |

---

## Top concerns right now (H × H)

These deserve the most attention because they are both likely and damaging:

1. **R-04 — Data-quality gaps.** Root cause is understood and fixed in the new code, but every new module must keep using the correct column mapping (`created_by` + `client_assoc_id`). Status: *Mitigating* — verify on each module as it's built.

2. **R-08 — RLS not yet applied** (High impact; Medium likelihood, but it is a *certain* blocker if forgotten). This is a **hard deploy gate**: nothing goes live until access rules are on. Status: *Open* — scheduled as a dedicated pre-deploy hardening pass.

---

## Notes

- Risks **R-03** (plaintext passwords) and **R-10** (license traps) are effectively handled by design decisions already made — see `DECISIONS.md`. They remain in the register for traceability.
- This register should be revisited at each phase boundary (see the Phase Checklist in `REBUILD_LOG.md`) and especially **before the first Netlify deploy** (Phase 5) and **before mobile work** (Phase 6).
- Anything marked **TBD** in source docs is not invented here. Where a number or fact wasn't confirmed, it is left out rather than guessed.
