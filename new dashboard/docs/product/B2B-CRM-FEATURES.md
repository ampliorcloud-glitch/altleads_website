# B2B CRM feature map — what we have vs. the standard set (ALT-271)

*Researched 2026-06-21 (owner #7, "do a websearch, find all basic B2B CRM features; ignore sales features but still list them — invoice etc."). Grounded in 2026 feature comparisons of HubSpot / Zoho / Salesforce / Pipedrive (sources at the bottom).*

We are an **outreach-only** CRM (the team updates records — calls, meetings, statuses, feedback — they don't run a full sales pipeline). So **Section A** (core, non-sales) is our real roadmap; **Section B** (sales-cycle features like invoicing) is captured but intentionally **out of scope for now**.

Legend: ✅ have · 🟡 partial · ⬜ gap.

## Section A — Core B2B CRM features (our roadmap)

### 1. Records & data model
- ✅ **Contact management** (contacts module + per-project status)
- ✅ **Company / Account management** (companies module + per-project account status)
- ✅ **Lead management** (leads module, stages)
- ✅ **Meeting records** (+ the new mobile-ditto record view for sales/portal)
- ✅ **Wishlist / prospect capture** (ALT-276)
- 🟡 **Custom fields** — fixed schema today; no admin "add a field" yet → ⬜ user-defined custom fields/objects
- 🟡 **Duplicate management** — bulk-import dedups; no in-app "merge duplicates" UI → ⬜ merge tool

### 2. Activity & communication tracking
- ✅ **Activity history per record** (interaction log: status changes + logged calls)
- ✅ **Admin all-projects activity timeline** (ALT-268)
- ✅ **Call logging** (ALT-269 call_log + dispositions) + **transcript/audio seam** for a future calling tool
- ✅ **Meeting feedback / dispositions**
- 🟡 **Email integration** — we SEND transactional email (notify-service); ⬜ two-way email sync (log inbound/outbound Gmail/Outlook against a contact), ⬜ email open/click tracking, ⬜ tracked send from inside the CRM
- ⬜ **Notes with @mentions**, ⬜ **file attachments** on records

### 3. Pipeline & process
- ✅ **Stages** (lead_report stages; meeting statuses)
- 🟡 **Visual pipeline / kanban board** — list + stage badges today; ⬜ drag-between-stages board
- ✅ **Tasks + reminders** (Task Manager: per-task email reminder + opt-in daily digest)
- ⬜ **Workflow automation** (rules: "when stage → X, do Y", auto-assign, sequences) — biggest standard gap
- ⬜ **Lead routing / assignment rules** (manual reassignment exists; no rules engine)

### 4. Productivity & UX
- ✅ **Global search** — now **grouped** (Leads/Companies/Contacts/Tasks/Meetings), Zoho-style (ALT-272)
- ✅ **Project scope selector** (pre-filter by project, ALT-273)
- ✅ **Per-field multi-select filters** on Leads/Meetings (🟡 ALT-270 — extend to Contacts/Companies/Tasks)
- ✅ **Saved column layouts / column customizer**
- ✅ **Bulk import / export** (xlsx/csv)
- ✅ **Dashboard** (totals, stage breakdown, meetings, calls-today; project-scoped)
- 🟡 **Custom/saved report builder** — fixed dashboard today; ⬜ build-your-own reports + saved views
- ⬜ **Mobile app / responsive parity** (a mobile record view exists; no full mobile app — the old one is the reference)

### 5. Admin, security, trust
- ✅ **Roles & permissions** (ADMIN/TEAM_LEAD/AGENT/QC/SALES_HEAD/SALES_PERSON)
- ✅ **RLS data scoping** (own/managed/admin) + **field masking** (partial + click-reveal)
- ✅ **Audit fields** (created/updated by + interaction log)
- 🟡 **Full audit trail** (who-changed-what across all fields) — partial via interaction log; ⬜ comprehensive
- ✅ **Self-service password reset**, **bulk user provisioning**
- ⬜ **2FA / SSO**

### 6. AI (north-star, later)
- ⬜ **AI search / "ask your CRM"** (pgvector plan exists — AI-PGVECTOR-PLAN.md)
- ⬜ **AI call summarization / next-best-action** (the call transcript seam feeds this)
- ⬜ **Forecasting / scoring** (sales-side; see Section B)

### Top non-sales gaps worth prioritising (post-launch)
1. **Workflow automation** (rules/sequences) — the single most-cited "standard" feature we lack.
2. **Two-way email sync + tracking** (log the actual conversation, not just our sends).
3. **Saved/custom report builder** beyond the fixed dashboard.
4. **Kanban pipeline board** + **merge-duplicates** + **user-defined custom fields**.

## Section B — Sales-cycle features we are IGNORING for now (captured per owner)

Out of scope because we're outreach-only, but listed so we don't lose them:
- **Quotes / CPQ** (configure-price-quote, quote PDFs)
- **Invoicing & billing** (the owner's "invoice etc.")
- **Product catalog / price books**
- **Orders, contracts & e-signature**
- **Subscriptions / renewals / recurring revenue**
- **Revenue forecasting & quota/target tracking**
- **Sales commissions / incentive comp**
- **Territory & quota management**
- **Deal/opportunity amount, probability & close-date pipeline value**
- **Marketing automation** (campaigns, email marketing, landing pages, forms, lead nurturing)
- **Lead scoring** (predictive/behavioural)
- **Customer support / ticketing / helpdesk & SLAs**
- **Partner / channel management (PRM)**
- **Website live chat / chatbots**

## Sources
- [Salesflare — Best B2B CRM + feature comparison 2026](https://blog.salesflare.com/best-b2b-crm)
- [OnePageCRM — 33 CRM features your business needs in 2026](https://www.onepagecrm.com/blog/crm-features/)
- [AlphonsoLabs — 15 essential CRM features checklist 2026](https://www.alphonsolabs.com/crm-essential-features-checklist-2026/)
- [Zoho vs HubSpot feature comparison](https://www.zoho.com/crm/compare/hubspot.html)
- [monday.com — What is a B2B CRM (2026)](https://monday.com/blog/crm-and-sales/b2b-crm/)
