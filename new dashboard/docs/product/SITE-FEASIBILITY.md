# Site Feasibility + Per-Site Employee Size — pre-production data layer for calling agents

*Captured 2026-06-21 (owner). Status: REQUIREMENT — to build AFTER the mobile-ditto Sales/Portal record view (ALT-275/276) and BEFORE handing live data to real calling agents for production.*

> Owner's words: "we need to check where all we can get stuck if we start providing data to the team. Any sites of many companies are not feasible for HungerBox & many other projects. I already have primary market-researched data per company, per site/city — we can mark feasible / non-feasible there, so the agent saves time. He will see employee size per site. We grouped prospects city-wise — we'll use that group to show employee size per group/site."

## The problem (why agents get stuck)
For a given **project** (e.g. HungerBox), not every **site/city** of a target **company** is a viable prospect. An agent who calls into a non-feasible site wastes time. Today nothing tells the agent which company-sites are worth pursuing for the active project, or how big each site is.

## What the owner already has
**Primary market-research data**, per **company × site/city**, that says:
- **Feasible / Non-feasible** for the project (a curated judgement, not derived).
- **Employee size at that site** (drives prioritisation — bigger site = bigger opportunity).

This is authoritative input data the owner will provide (import), NOT something we compute.

## The leverage we already have
Prospects/contacts are **grouped city-wise per company** (see `COMPANIES-CONTACTS-BLUEPRINT.md`). That existing **city/site grouping is the unit** we attach feasibility + employee-size to. So per company, each city/site group shows:
- **Employee size** for that site/group.
- **Feasible / Non-feasible** flag for the active project.

## What to build (design TBD — owner unsure of exact UX; options below)
1. **Data model:** a per-(company, city/site, project) feasibility record:
   - `company_id`, `city_id` (or the existing site/group key), `project_id`
   - `feasible` (boolean / enum: feasible | non-feasible | unknown)
   - `site_employee_size` (int or band)
   - `source` = 'primary-research', optional notes, `updated_by`, `updated_date`
   - Likely a new table (e.g. `company_site_feasibility`) keyed to the existing grouping; confirm against the real grouping key before modelling.
2. **Import path:** bulk-import the owner's primary-research sheet (per company, per site/city, feasible + employee size) — reuse the bulk-import machinery (`BULK-IMPORT-EXPORT.md`).
3. **Surface to the agent:** in the city-wise grouped company/prospect view, show **employee size per site/group** + a **feasible/non-feasible badge** for the selected project. Non-feasible sites are visually de-emphasised (or filterable out) so the agent spends time only where it counts. The active **project scope** (owner #8 selector) drives which project's feasibility shows.
4. **Pre-production "where do agents get stuck" readiness audit (ALT-278):** before real calling agents get live data, walk the agent's actual path and list every place they can stall — missing feasibility, missing employee size, non-feasible sites not flagged, ambiguous ownership, masked contact info they need, etc. Output a go/no-go checklist.

## Open questions (resolve before building)
- Exact key for "site/group" — is it `city_id` per company, or a dedicated group id? (Confirm against the live grouping in `COMPANIES-CONTACTS-BLUEPRINT.md` / the data.)
- Employee size: exact number vs band (e.g. <50 / 50–200 / 200+)?
- Is feasibility **per project** (HungerBox vs others differ) — almost certainly YES per the owner — so the record must be project-scoped.
- Format of the owner's primary-research sheet (columns) → defines the importer.

## Sequencing
After ALT-275 (mobile-ditto record view) + ALT-276 (wishlist). This is a **production-readiness gate** for the internal calling team, so it lands before live-data handoff. Tickets: **ALT-277** (feasibility + per-site employee-size data layer + UI) and **ALT-278** (pre-production agent "stuck points" readiness audit).
