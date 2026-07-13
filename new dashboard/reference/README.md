# Open-source CRM/ERP study references (READ-ONLY)

> **Location: the source trees live OFF-REPO at `E:\reference code for crm\`** (NOT inside this repo — kept off C:/OneDrive/git to save ~2 GB of disk and avoid OneDrive sync). Read/Grep them by absolute path, e.g. `E:\reference code for crm\odoo\addons\mail`. This in-repo `reference/` folder is just the tracked pointer/README.

These are **open-source codebases we study for inspiration** while building our own CRM. They are third-party and **not part of our product**. We read them for **data models, workflow engines, and feature breadth** — we do **NOT** copy code (different stacks; respect their licenses).

Cloned as **shallow** (`git clone --depth 1`, latest snapshot, no history) since we only ever read current source.

> Why open-source refs: unlike closed HubSpot/Zoho (which we can only reverse-engineer from behavior), here we can read the actual implementation. Cheaper + deeper than web research — **research subagents should grep these first** before going to the web.

## The trees (under `E:\reference code for crm\`)
- `odoo/` — **Odoo** (Python + own ORM + OWL/QWeb JS, Postgres). LGPLv3 Community.
- `suitecrm/` — **SuiteCRM** (PHP, fork of SugarCRM). AGPLv3.
- `erpnext/` — **ERPNext / Frappe** (Python + Frappe framework, MariaDB). GPLv3.
- `espocrm/` — **EspoCRM** (PHP; flexible layouts + reporting). GPLv3.
- `vtigercrm/` — **Vtiger CRM** (PHP). VPL/Vtiger Public License.

## What to mine in each (map to our roadmap)
| We're building | Best reference |
|---|---|
| In-record activity hub + task auto-complete + cadence (ALT-466/467) | **Odoo `addons/mail`** (chatter/activities), SuiteCRM Activities, ERPNext Communication/ToDo |
| Lead/pipeline/stages, Deals (DEC-11), Blueprint engine (ALT-426) | **Odoo `addons/crm`**, SuiteCRM Opportunities, ERPNext CRM (Lead→Opportunity) |
| Companies/Contacts model, associations (ALT-442), DNC/feasibility | **Odoo `res.partner`** (`addons/base`), SuiteCRM Accounts/Contacts, ERPNext Customer/Contact/Address |
| Custom fields / metadata (DEC-12) | **Odoo Studio / `ir.model.fields`**, SuiteCRM Studio, **ERPNext Custom Field / DocType** (esp. strong here) |
| Automation / workflow (event-spine) | **Odoo automated actions / server actions**, SuiteCRM Workflow, ERPNext Notification/Server Script |
| Role/team access + downline (ACCESS-CONTROL-MODEL) | **Odoo `sales_team` + record rules**, SuiteCRM Security Groups/Roles, ERPNext Role Permission Manager + User Permissions |
| Import + dedup (DEC-14) | Odoo base_import, ERPNext Data Import |

## Rules for anyone (incl. subagents) using these
1. **Read-only.** Never edit, never import into our build, never copy verbatim. Translate *patterns* into our TS/React/Supabase stack.
2. **License hygiene.** AGPL/GPL/LGPL — studying is fine; copying source into our product is not. Cite the idea, write our own code.
3. Prefer **grepping the mapped modules above** over reading whole trees (these repos are huge / mostly irrelevant to CRM).
4. When a reference informs a decision, capture the *takeaway* in the relevant `docs/product/` doc — not a copy of their code.
