# Multi-Client B2B Data Segregation — Odoo notes + how it maps to AltLeads

> Source: Ankit's research notes (2026-06-29) on how open-source CRMs handle the **multi-client lead-gen privacy problem**, captured here because "AI forgets, repo remembers." This is *inspiration*, not a port — translate patterns into our TS/React/Supabase stack. Companion to `reference/README.md` (the source trees) and `docs/product/ACCESS-CONTROL-MODEL.md`.

## 1. The core requirement (ours, restated)
- We run lead-gen for **multiple clients** (e.g. HungerBox, Client A, Client B) over a **shared pool of Companies & Contacts**.
- **Hard privacy constraint:** Client A's lead-gen team must NEVER see Client B's leads / conversations / outcomes. The *company/contact universe* is shared; the **lead/opportunity + conversation layer is segregated per client**.

## 2. How Odoo (Community) solves it
- **Multi-Company mode:** each client = a separate Odoo "Company" record.
- **Data segregation:**
  - **Contacts (`res.partner`):** leave the company field blank → contact is **Global** (shared across all clients).
  - **Leads/Opportunities (`crm.lead`):** assigned to a specific Company (Client A or B) → private to that client.
  - **Chatter / conversations (`mail.thread` / `mail.message`):** attached to the Lead record. Because the Lead is company-private, its conversation history is automatically hidden from other clients.
- **User access:** restrict each lead-gen team to their **Allowed Companies** only (Odoo `res.users.company_ids` + record rules).
- **Email routing (multi-tenant):**
  - Outgoing: SMTP **"FROM filtering"** routes mail through client-specific domains (`sales@clientA.com`).
  - Incoming: unique IMAP/POP server + alias **per company** for replies.
  - OCA module **`mail_multicompany`** for more robust per-company routing.

## 3. How this maps onto AltLeads (what we already have vs gaps)
Our **`project`** ≈ Odoo's per-client "Company". The architecture validates our existing model:

| Odoo concept | AltLeads equivalent | State |
|---|---|---|
| Global contact (company field blank) | `company_master` / `contact_master` are **project-agnostic** (shared pool) | ✅ have it |
| Lead private to a Company | `lead_report` / per-project status rows scoped by `project_id`; lead owner = `lead_report.user_id` (DEC-03) | ✅ have it |
| Chatter private to the Lead | `interaction` / activity rows carry `project_id` + record ref → scope per project | ✅ have it (scoping enforcement = RLS, see gap) |
| Allowed Companies per user | **project membership** + `STRICT_ROLE_GATING` RLS (`apply-access-control-rls.cjs`, staged) | 🟡 built, **not yet validated/activated** — this is the privacy lynchpin |
| Per-company email FROM-filtering + IMAP aliases | notify-service sender config; client-portal out' bound mail | 🔴 gap — single sender today; needed when we send on a client's behalf |

**Takeaway:** our project-scoped model is the right shape and matches how the most mature OSS CRM does multi-tenant lead-gen. The **single most important privacy task is finishing + validating the project-scoped RLS** (ALT-152 / access-control model) on throwaway logins before internal launch — that is what actually enforces "Client A can't see Client B." Per-client email identity is a later (client-portal / outbound) concern.

## 4. Open-source CRM/ERP references (corrected links)
All are genuinely open-source (unlike Zoho/HubSpot = proprietary SaaS). Trees go in gitignored `reference/` (see its README for the module→roadmap map).
| CRM | Stack / license | Website | Git |
|---|---|---|---|
| **Odoo** (Community) | Python + own ORM + OWL/QWeb, Postgres; LGPLv3 | https://www.odoo.com/app/crm | https://github.com/odoo/odoo |
| **SuiteCRM** | PHP (SugarCRM fork); AGPLv3; no user limits | https://suitecrm.com | https://github.com/salesagility/SuiteCRM |
| **ERPNext / Frappe** | Python + Frappe, MariaDB; GPLv3; strong India GST/TDS + Custom-Field/DocType | https://erpnext.com | https://github.com/frappe/erpnext |
| **EspoCRM** | PHP; flexible layouts + reporting | https://www.espocrm.com | https://github.com/espocrm/espocrm |
| **Vtiger CRM** | PHP | https://www.vtiger.com | https://code.vtiger.com/vtiger/vtigercrm |

## 5. Self-host vs SaaS (why we self-host)
- **Why:** total data ownership, unlimited customization, no per-user fees, absolute privacy control — exactly the multi-client isolation requirement above.
- **Docker sizing:** min 2-vCPU / 4 GB; production 4-vCPU / 8–16 GB. (We already run a self-hosted **Dokploy PaaS on a DigitalOcean droplet** — see `docs/deploy-platform/`. The CRM itself is our own app, not Odoo; these refs are for *studying patterns*.)
- **Cost:** requires our own DevOps for maintenance/hardening/backups — already covered by the Dokploy box.

## 6. Action items (tomorrow / backlog)
- [ ] **Validate + activate project-scoped RLS** (ALT-152 / access-control) on throwaway logins — the real privacy enforcement (highest priority, pre-launch).
- [ ] Mine `reference/odoo/addons/{mail,crm,sales_team}` + ERPNext permissions for the segregation + record-rule patterns once the trees are pasted.
- [ ] Per-client **outbound email identity** (FROM-filtering / per-project sender) — design when we send on a client's behalf (client portal / outreach-as-client). New backlog item.
- [ ] Note: we are NOT adopting Odoo's "multi-company" literally — our `project` already is the tenant boundary; we borrow the *record-rule + global-vs-scoped* pattern only.
