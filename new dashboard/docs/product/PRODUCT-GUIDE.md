# AltLeads CRM — How the Team Uses It
*A plain-language guide & user journey · for leadership approval and team onboarding · 2026-06-18*

> **What AltLeads is:** our own CRM (replacing the vendor's system) where the outreach team works through companies and contacts, **calls and emails** them, and **records what happened**. The data is already loaded — the team's job is **outreach + updates**, not data entry.

---

## 1. Who uses it, and what they can do

| Role | What they do in AltLeads |
|------|--------------------------|
| **Agent / Sales Person** | Work their assigned call-list. Call & email contacts. Log every call's outcome, set status, add notes, schedule meetings. **Update only — they don't create or delete companies/contacts.** |
| **Team Lead / Manager** | Everything an agent does, plus see their team's records, approve lead reports, and reassign work. |
| **QC** | Read everything for quality checks. |
| **Admin (you)** | Full control: add users, manage option lists & projects, maintain the company/contact data (including bulk updates), see everything. |

> **The golden rule of the product:** *the team's daily screen is about **updating**, not creating.* Create/import is an **admin** function.

---

## 2. The daily journey — "A day in AltLeads" (Agent)

**1. Log in.** `crm.altleads.com` → email + password (first login forces a password change).

**2. See your work.** Dashboard shows what's pending. The sidebar has **Leads, Companies, Contacts, Meetings, Wish List, Approvals, Notifications**.

**3. Open your call-list.** Go to **Contacts** (or **Companies**) and pick your **project** at the top — the list scopes to your work for that project.

**4. Call a contact.** Open the record → one click to **Call** (dials the number) or **Email** (opens a draft). *(click-to-call/email is part of the upcoming UX polish.)*

**5. Log what happened.** Right on the record: choose a **Call Disposition** (Connected / No Answer / Interested / …), set the **Contact Status** (Hot / Warm / Cold …), and type a **note**. Hit save — it's instantly added to the **Activity timeline** so the whole history is there.

**6. Move it forward.** Schedule a meeting, or submit the lead report for **approval**. The right people get an **email + in-app notification** automatically.

**7. Repeat down the list.** Everything you touch is timestamped and attributed to you.

> **Soon (post-launch upgrade):** edit status/notes/outcome **straight from the list** — like a spreadsheet — without opening each record. Faster for high-volume days.

---

## 3. The manager journey (Team Lead)

- See the team's pipeline across their projects.
- **Approvals queue** — approve or send back lead reports with feedback (the agent is notified).
- Reassign leads; reassignment notifies the new owner.
- Everything agents see, plus team-wide visibility.

---

## 4. The admin journey (you) — keeping data clean *without* burdening the team

This is the key design decision: **the team never does data entry.** You maintain the data:

- **Add/replace users & logins** — Admin → Users (add a user, or create/reset a login; share the temp password).
- **Manage the pick-lists** — Admin → Option Lists / Reference / Pre-Sales Questions (statuses, dispositions, domains, questions). Changes apply instantly app-wide.
- **Bulk-update companies (coming)** — **Export → edit in Excel → Import**: download the company list, fix many rows at once in a spreadsheet, re-upload, and the system **updates the existing records** (no duplicates), with a preview before anything is saved. This is how you keep 500+ companies current without anyone re-typing.
- **Per-project access** — control who sees/edits what, per project.

---

## 5. What every record holds

**Company record:** name, website, industry, city, CIN, owner, per-project **Account Status / Feasibility / Decision Power / description / comments**, its **Contacts** and its **Leads**, and full **Activity**.

**Contact record:** name, designation, company, masked contact details, per-project **Contact Status / description / comments**, **Log a Call**, associated **Leads** and **Colleagues**, and **Activity**.

**Lead record:** the full HubSpot-style workspace — info panel + Activity / Lead Report / Meeting tabs, stage progress, approvals.

> **Privacy by design (masking):** everyone can see a contact's **name, company, city, and notes**, but the **phone / email / LinkedIn** are visible only to the record's owner, their manager, and admin. People always know a detail is *locked* (not just empty).

---

## 6. Notifications — nobody misses a handoff

Automatic **email + in-app** alerts on: lead **assigned / reassigned**, meeting **scheduled / rescheduled / cancelled**, and lead-report **approval requested / approved / sent-back**. Each email is branded and links straight into the CRM.

---

## 7. Why this is better than the old system

- **Ours, not the vendor's** — we change it ourselves, same-day, no vendor dependency or fees.
- **One source of truth** — companies, contacts, leads, meetings, all linked (HubSpot-style associations).
- **Outreach-first** — the team spends time *talking to prospects and recording outcomes*, not doing data entry.
- **Clean data** — admin maintains it in bulk; the team just keeps statuses/notes current as they connect.
- **Visibility & control** — managers see their teams; access and privacy are enforced by the system.

---

## 8. Rollout

**Internal first** (this team), then client-facing later. Internal go-live needs only: logins for the team, the outreach-only screen posture, an access check, and email sign-off — see **INTERNAL-LAUNCH-PLAN.md**.
