# Email Notifications — current wordings + v2 plan
*Source of truth for copy: `new-code/notify-service/email-templates.js`. Edit wording here for review, then I apply it to the code. `{curly}` = filled in automatically.*

Every email shares:
- **Header band:** `AltLeads | Amplior CRM`
- **Greeting:** `Hi {firstName},` (falls back to `Hi there,`)
- **Footer:** *"You're receiving this because you're part of the team on AltLeads CRM. This is an automated message — please don't reply to this email."*
- **Button** links to the record in the CRM (`https://crm.altleads.com`, or a deep link when we pass one).

---

## CURRENT (live) — the 8 templates

### 1. Lead Assigned → the salesperson
- **Subject:** `[AltLeads] New lead assigned to you: {leadName}`
- **Headline:** A new lead is yours
- **Body:** "{assignedBy} has assigned a new lead in AltLeads. Here are the details:" → **Lead / Company / Assigned By** → badge *New Assignment*
- **Button:** Open lead in AltLeads
- **Closing:** *"Give them a call or drop an email to start the conversation — you can log your first call straight from the lead."*

### 2. Lead Reassigned → the new salesperson
- **Subject:** `[AltLeads] A lead was moved to you: {leadName}`
- **Headline:** A lead has been moved to you
- **Body:** "This lead has been reassigned to you by {reassignedBy}. It's now in your pipeline:" → **Lead / Company / Reassigned By** → badge *Reassigned*
- **Button:** Open lead in AltLeads
- **Closing:** *"Review the history so far, then pick up the outreach from where it stands."*

### 3. Meeting Scheduled → the salesperson
- **Subject:** `[AltLeads] Meeting confirmed: {leadName}`
- **Headline:** Your meeting is confirmed
- **Body:** "A meeting has been scheduled. Here are the details:" → **Lead / Date / Time / Mode** → badge *Meeting Scheduled*
- **Button:** View meeting details
- **Closing:** *"Add it to your calendar and prepare your talking points ahead of time."*

### 4. Meeting Rescheduled → the salesperson
- **Subject:** `[AltLeads] Meeting time changed: {leadName}`
- **Headline:** Your meeting has moved
- **Body:** "The meeting time has changed. Please note the new slot:" → **Lead / Was {old} (struck through) / Now {new} (bold) / Mode / Rescheduled By / Reason** → badge *Rescheduled*
- **Button:** View meeting details
- **Closing:** *"Update your calendar with the new time so nothing slips."*

### 5. Meeting Cancelled / Dropped → the salesperson
- **Subject:** `[AltLeads] Meeting cancelled: {leadName}`
- **Headline:** A meeting has been cancelled
- **Body:** "The following meeting has been cancelled:" → **Lead / Was scheduled for {date·time} / Mode / Cancelled By / Reason** → badge *Cancelled*
- **Button:** Open lead in AltLeads
- **Closing:** *"Follow up with the contact to find a new time when you can."*

### 6. Approval Requested → the Team Lead / approver
- **Subject:** `[AltLeads] Approval needed: {leadName}`
- **Headline:** A lead report needs your approval
- **Body:** "{agent} has submitted a report for your review." → **Lead (+number) / Submitted By** → badge *Pending Approval*
- **Button:** Review & approve
- **Closing:** *"Please review and approve or send it back with feedback at your earliest convenience."*

### 7. Approval Approved → the agent
- **Subject:** `[AltLeads] Approved — meeting scheduled: {leadName}`
- **Headline:** Your report was approved 🎉
- **Body:** "Good news — your lead report has been approved by {approver} and the meeting is scheduled." → **Lead (+number) / Approved By** → badge *Approved — Meeting Scheduled*
- **Button:** View lead
- **Closing:** *"Nice work. Prepare for the meeting and keep the momentum going."*

### 8. Approval Rejected (changes requested) → the agent
- **Subject:** `[AltLeads] Changes requested on your report: {leadName}`
- **Headline:** Your report needs a few changes
- **Body:** "Your lead report was sent back by {reviewer} with feedback. Please update it and resubmit." → **Lead (+number) / Reviewed By / What to fix: {reason}** → badge *Changes Requested*
- **Button:** Edit & resubmit
- **Closing:** *"Address the feedback above and resubmit — you've got this."*

> **What's done vs not:** the copy above is the *improved* baseline (warmer wording + working buttons). It is **not** re-engineered per-event and has **no attachments/PDF** yet — that's v2 below.

---

## PLANNED — Email v2 (ALT-175, not built)

**Goal:** richer, per-event emails with **attachments** where useful.

1. **Per-event layouts** — instead of one shared shell, tailor each event (e.g. the meeting emails get a prominent date/time block + a "join" button for online meetings).
2. **Attachments / PDF reports** (the main ask):
   - **Meeting Scheduled → a "Meeting Brief" PDF** attached: company + lead details, pre-sales Q&A, agenda/notes, date/time/mode, join link, owner. Generated with the same HTML→PDF (Playwright) method used for the leadership decks (`render-decks.cjs`).
   - **Approval Approved → optional "Lead Report" PDF** (the full report snapshot).
   - (Decide which other events warrant a PDF.)
3. **Calendar invite (.ics)** on Meeting Scheduled/Rescheduled so it drops into Outlook/Google Calendar in one click.
4. **Real deep-links** — buttons open the *exact* record/meeting (`crm.altleads.com/leads/{id}` etc.), not just the home page.
5. **Sender/deliverability** — confirm recipient logic + (later) move off the gmail.com sender to a domain sender (SPF/DKIM) so corporate inboxes don't spam-filter.

**Open decisions for v2:** which events get a PDF, what each PDF contains, and the recipient matrix (see OPEN-QUESTIONS.md Q5).

---
*To change any wording: edit the lines above (or tell me), and I'll update `email-templates.js` and redeploy on your go.*
