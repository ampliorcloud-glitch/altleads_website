# Companies & Contacts Modules — Blueprint (Internal CRM)

> A plan (not built yet) for turning the CRM into a HubSpot-style internal CRM with **Companies**
> and **Contacts** as first-class modules, **per-project ownership**, **deduplication**, and
> **masked visibility**. This is the deferred "CR Layer 2" direction. For owner review.
> *Drafted 2026-06-14.*

---

## 1. The core idea (in one picture)

A **Company** exists ONCE in the system (no duplicates). But it can be **pursued in several
projects**, and each project has its **own owner** for that company:

```
                COMPANY: Tata Motors  (one record, deduped by domain/CIN)
                 │
   ┌─────────────┼──────────────────────────────┐
   ▼ project: Hungerbox            ▼ project: AP Securitas
   owner = Adarsh                  owner = Ankit
   - sees Tata Motors' contact      - sees Tata Motors' contact
     details (phone/email)            details (phone/email)
   - works the deals in Hungerbox   - works the deals in AP Securitas

   EVERYONE ELSE in the org sees "Tata Motors exists, has 5 contacts in Pune"
   — names + city only, NO phone/email (so nobody poaches another owner's data).
   ADMIN / a manager sees full details for anyone in their DOWNLINE.
```

- **Companies & Contacts: deduped** (one true record each).
- **Deals (leads): can repeat** (many deals for the same company/contact).
- **Ownership is per (company × project)** — not global.
- **The owner works the record inside their project** — disposes calls, adds comments, logs every
  interaction. Super Admin sees all of it, and it's all **saved permanently for future AI use** (see §5b).

---

## 2. Deduplication rules

| Entity | No duplicate on (any of these match → it's the same record) | Already in DB? |
|---|---|---|
| **Company** | **Cleaned website domain** (strip `https://`, `www.`, path, lowercase → e.g. `tatamotors.com`) **OR `cin_number`** | `company_web_url`, `cin_number` exist ✅ |
| **Contact** | **Cleaned LinkedIn id** (the profile slug, e.g. `/in/john-doe`) **OR `email`** | new table needed |
| **Deal / Lead** | *Allowed to duplicate* | `lead_master` exists ✅ |

**How it's enforced (two layers):**
1. **At create time** — when an agent adds a company/contact, the system cleans the key and
   searches existing records first. If a match is found, it says *"This company already exists —
   open it / add yourself as owner in your project"* instead of creating a duplicate.
2. **At the database** — a unique index on cleaned-domain, on CIN, on cleaned-LinkedIn, on email
   (each "where not null") as a hard safety net.

---

## 3. Data model (what we add)

Reuse what exists; add three things.

**EXISTS (reuse):** `company_master` (525 cos; has cin_number, company_web_url, linkedin_url,
email, industry, city), `project`, `project_user` (users↔projects+role), `lead_master` (deals).

**ADD:**
- `contact_master` — contact_id, full_name, designation, email, mobile, linkedin_url,
  `linkedin_clean`, company_id→company_master, city_id, audit cols. (Migrate existing contacts
  out of lead_master into here, deduping as we go.)
- `company_project_owner` — (company_id, project_id, owner_user_id). **One owner per company per
  project.** This is the heart of the model. Contacts inherit their company's owner within a project
  (with optional per-contact override later).
- **User hierarchy** — add `manager_id` (reports-to) to `user_master` so "Admin sees his downline"
  works (a manager sees records owned by anyone below them in the tree). *(Needs your org chart.)*
- On `lead_master`: add `contact_id` so a deal links to a real contact.
- A derived `domain_clean` on company_master (for dedup + region grouping).
- `interaction` (NEW, append-only) — (id, record_type [company|contact|deal], record_id,
  **project_id**, owner_user_id, type [call/email/meeting/note/whatsapp…], disposition, note_text,
  occurred_at, created_at). Powers the activity timeline on every record (see §5b).

---

## 4. The two new modules (what you'll see)

### A) Companies module (like Leads/Meetings)
- A searchable, filterable, paginated **table of companies** (filters: industry, city/region,
  project, owner, has-contacts). A **Project selector at the top** (default = your assigned project)
  scopes ownership + deals to that project.
- Click a company → **Company record page (HubSpot-style):**
  - **Header:** name, domain, CIN, industry, and the **owner for the selected project** + a
    "Project ▾" selector (default = your project) to switch context.
  - **Contacts tab:** every contact at the company, **grouped by city/region**. Names + titles
    visible to all; **phone/email only if you're the owner** (or their manager).
  - **Deals tab:** all deals/leads for this company **within the selected project**.
  - **Activity / Meetings:** related history.
  - **Actions:** add contact (with dedup check), create deal, claim ownership in your project.

### B) Contacts module (like Leads) — for calling & disposition
- A searchable **table of contacts** (filters: company, city, owner, project) so agents work a
  call list in one place.
- Click a contact → **contact record:** details (if you own it), the company link, associated
  deals, and a **Call & Disposition panel** — log a call outcome (Connected / No answer /
  Call back / Not interested / Interested → create deal) with notes, in the same screen. This is
  the tele-calling flow your agents asked for.

---

## 5. Visibility rules (who sees what)

| Viewer | Company/contact NAME + city | Contact DETAILS (phone/email/LinkedIn) | Edit |
|---|---|---|---|
| Anyone in the org | ✅ visible (the universe) | ❌ hidden ("owned by …") | ❌ |
| The **owner** (company×project) | ✅ | ✅ | ✅ their project's data |
| Owner's **manager / Admin (downline)** | ✅ | ✅ (for their whole downline) | ✅ |

Enforced by database security rules (RLS) + UI masking — so even a bug can't leak another
owner's contact details.

---

## 5b. Interactions, dispositions & the AI-ready activity log

Every company and contact record has a **project-scoped activity timeline** — this is where the
owner actually works the account:

- **Disposition** — log a call/contact outcome (Connected · No answer · Call back · Not interested ·
  Interested → create deal · Wrong number …) with a timestamp.
- **Comments / notes** — free-text notes about the call or the account.
- **Interactions** — calls, emails, meetings, WhatsApp, etc. logged against the record.

**Rules:**
- Every entry is tied to **(record + project + owner)** — so Adarsh's Hungerbox notes on Tata Motors
  are kept separate from Ankit's AP-Securitas notes on the same company.
- **Super Admin (and the owner's managers up the chain) see ALL interactions** across everyone —
  full oversight, nothing hidden from leadership.
- **Append-only — nothing is ever deleted** (edits keep history). A permanent record of every touch.
- **Stored as clean, structured data designed for AI.** Each entry has a type, outcome, timestamp,
  owner, project, and the note text — deliberately the shape that lets us later add AI on top:
  auto-summaries of an account ("what's the story with Tata Motors?"), next-best-action suggestions,
  lead scoring, sentiment, and "show me everything my team did this week." We **capture it now** so
  the data exists when you want the AI layer — you can't run AI over data you never saved.

*Visibility recap: the timeline is fully visible to the owner and to Super Admin / managers in the
owner's upline; other agents see that activity exists but not the private notes/details.*

---

## 6. How it fits the current system
This is **additive** — it doesn't break today's FRS-parity app. Leads & Meetings stay; they just
get properly linked to a real Company + Contact. Think of it as a layer *under* the deal flow:
Company → Contacts → Deals (leads) → Meetings.

---

## 7. Decisions I need from you (the homework)
1. **Org chart / downline:** how is "downline" defined? Simplest is a `manager_id` per user — can
   you give me the reporting structure (who reports to whom)?
2. **Contact ownership:** inherit from the company's per-project owner (simplest), or can a contact
   have its own owner different from the company?
3. **Editing a shared company:** Tata Motors is owned by Adarsh (Hungerbox) AND Ankit (AP Securitas).
   Who can edit the company's *core* info (name/domain/CIN)? Suggest: core info is shared/global and
   editable by any owner or Admin; project-specific data (owner, deals) stays separate.
4. **Domain cleaning rules:** strip `www.`/protocol/path/lowercase — confirm. What about subdomains
   and `.co.in` vs `.com`? (We can normalize aggressively or conservatively.)
5. **Masked fields:** exactly which contact fields are hidden from non-owners — phone, email,
   LinkedIn? (Name + title + city stay visible.)
6. **Migration aggressiveness:** your 525 companies + 605 leads have duplicates to merge. How
   aggressive should auto-merge be vs. flag-for-review?
7. **Disposition outcomes:** what call-disposition options do your agents use?

## 8. Suggested build order (phased)
- **A. Data model + migration** — contact_master, company_project_owner, user hierarchy, dedup
  indexes; migrate/dedup existing companies & contacts.
- **B. Companies module** — list + record page (contacts + deals tabs, project selector).
- **C. Contacts module** — list + record + call/disposition.
- **D. Visibility (RLS)** — masked details + downline access.
- **E. Dedup enforcement** — create-flow checks + DB indexes.

*Rough effort: a meaningful chunk (several focused build sessions), but every piece reuses the
patterns we already built for Leads/Meetings. We'd do this AFTER the current web app goes live,
as the next major phase.*
