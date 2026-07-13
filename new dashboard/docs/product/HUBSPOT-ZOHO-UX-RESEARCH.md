# HubSpot & Zoho — Feature & UX Research (for AltLeads)

> **ALT-348 · 2026-06-23.** Two research agents studied current (2025–26) HubSpot Sales Hub and Zoho CRM, through one lens: **what makes the user's life easier** (the UX), not just feature names. Each "ADOPT" is mapped to our backlog. Use this to prioritise the HubSpot-parity epics Ankit asked for (associations, merge, collaborators, multi-contact-details) + the dashboard.

---

## Top "steal first" — where HubSpot + Zoho agree (do these)

| Pattern | Why it's easy for the user | Our ticket |
|---|---|---|
| **Merge that loses NOTHING** — pick a master, resolve conflicts field-by-field (radio/click), all activities + associations re-parent to the survivor; dupe-suggestion queue | Reps merge freely instead of hoarding duplicates; no data anxiety | **ALT-340** (+ ALT-293). Add a soft-delete/snapshot of the loser since neither tool offers true unmerge |
| **Assignment = access** (RLS keyed to the assigned user; manager hierarchy rolls up) | The assigned rep can edit without a separate "share" step; managers see downline automatically | **ALT-152 / ALT-346 / ALT-347** — directly resolves our created_by-vs-assigned write-path blocker |
| **Associations sidebar** — "Add existing (search) / Create new" tabs on every record; a **Primary** company flag; a few **role labels** (Decision-maker, Champion, Gatekeeper) | Link records without leaving the page; "primary" drives attribution; labels add meaning you can filter | **ALT-341** (epic). Keep labels tight (~5), don't ship HubSpot's 50 |
| **Multiple phones/emails with a Primary flag** + one-click "Make primary" (old one auto-demotes) | A calling team constantly finds a better number; logic keys off primary so reporting stays sane | **ALT-342** |
| **Collaborators / per-record share** — give specific users read or edit on one record; **free view-only seats** for execs; **@mention** comments that land in the record's notes | Leadership lives in the CRM at zero cost; collaboration stays attached to the data, not in Slack | **ALT-343** |
| **Inline-edit table + bulk status/owner + right-panel peek + kanban grouped by ANY property** | The outreach team's whole day is "update outcome + status across a list" without opening records | **ALT-331/332/333/337/338** (shipped) — keep extending inline edit |
| **Log call + structured disposition feeding ONE activity timeline**, and "schedule next follow-up" in the same modal; one log writes to all associated records | Captures the outcome as structured data (the source of every metric) and the next action in one step | **ALT-335/337** (shipped) + **ALT-303/C1** (one canonical logger) |
| **Exec dashboard: KPI-vs-target + funnel + speedometer/dial** (red-amber-green to goal) + per-rep activity leaderboard | At-a-glance "are we hitting the meeting target?" without reading numbers | **ALT-336/344** — matches the HungerBox deck funnel exactly |
| **Undo on bulk actions** (a few-second "Undo" toast) | Cheap insurance against a fat-finger mass-update; both tools are weak here → a real differentiator | *new — add to ALT-332/291 follow-up* |
| **⌘K command palette** + global search (HubSpot itself still lacks a true palette) | Power users stay on the keyboard; jump/act fast. **Keep create admin-gated** per our outreach-only model | we have Cmd-K (ALT-188); extend to actions |

---

## HubSpot — notable specifics
- **Associations**: right-sidebar card, "Add existing" search + checkbox, then a Next step to set the **label** + **primary**. Parent/child companies roll activity upward (P3 unless multi-entity orgs).
- **Merge**: Actions → Merge → the record you started from is the survivor; click conflicting values to choose; **all activities + associations carry over**; emails stack (primary stays); **cannot unmerge**; Duplicate Management tool surfaces fuzzy pairs for bulk merge.
- **Access**: single Owner; "Users with access" tab shows *who can edit and why*; **free unlimited view-only seats**; @mention notifies even view-only users and deep-links them.
- **Multi-email**: Primary + Additional; "Make primary" auto-demotes the old; **filters/lists/workflows use the primary only**; secondaries survive bounces.
- **Board view (2025)** extended to Deals/Tasks/Leads/Contacts; group by any property; bulk-select cards to bulk-edit.
- **Calling**: disposition-on-log (Connected/Busy/Voicemail/No-answer/Wrong-number + custom); a task logged once posts to **all** associated records.
- **Dashboards**: funnel with conversion % + **time-in-stage** + stage-skips; goal-vs-actual; activity-by-rep leaderboard; prebuilt templates (good for a non-technical owner).
- Sources: HubSpot KB — associate-records, association-labels, merge-records, deduplicate, user-permissions, view-record-access, multiple-email-addresses, updated board view, saved views, custom call outcomes, custom funnel reports, sales analytics.

## Zoho — notable specifics
- **Related lists** with inline "+ Add" and **"Associate"** (search existing); parent-account **hierarchy roll-up** view.
- **Find & Merge Duplicates**: up to 6 match fields (ALL/ANY), merge up to 3 at once, nominate a **master**, **field-by-field radio** conflict resolution; related data (notes/activities/deals) re-parents to the master; created-time/by reflect the **oldest** record; auto-merge exact dupes; per-module de-dupe rules at create/import.
- **Sharing**: org-wide Data-Sharing rules via **role hierarchy** (rolls up to managers) + **per-record Share** (read / read-write / full, to up to 10 users / 5 roles / 5 groups) + a user-lookup field with **"Allow Record Accessibility"** (assignment auto-grants access). **Feeds** @mentions sync into Notes.
- **Multi-value**: native multiple emails/phones with primary; **multi-select lookup** (true many-to-many) and **subforms** (a mini-spreadsheet of repeatable rows inside a record — e.g. call attempts/stakeholders; 2025 added per-subform permissions + pinned columns).
- **Views**: inline edit in list view; **Kanban "Categorize by" (group) + "Aggregate by"**; right-side preview; **mass update / change owner / mass convert**.
- **Calling**: Log Call captures direction/duration/**purpose+result (disposition)** and **prompts the next follow-up** in the same dialog; cadences branch on prospect behavior (autoresponders retired Sep 2025).
- **Dashboards**: KPI single-number **vs-target**, **Target Meters** (% to goal), **Dial/Speedometer charts** (conditional red-amber-green), funnels.
- **UX delighters**: **Ctrl+Enter = save & start next**, Quick Create, global search — the whole product optimises for **staying on one screen**.
- Sources: Zoho CRM Help — merge-duplicate-record, share-records, data-sharing-rules, types-of-fields (multi-select/subforms), kanban-views, log-calls, cadences FAQ, feeds, keyboard-shortcuts; Zoho Analytics KPI widgets / dial charts.

---

## Recommended adoption order (synthesised)
1. **Merge + assignment-as-access** — unblocks the launch (data was bulk-migrated; dupes certain) → ALT-340 + ALT-152/346.
2. **Associations + multiple phones/emails** — account-centric calling context → ALT-341 + ALT-342.
3. **Collaborators + exec view-only seats + @mention notes** → ALT-343.
4. **Funnel/leaderboard dashboards (KPI-vs-target + speedometer)** per the HungerBox deck → ALT-344.
5. **Undo on bulk actions** + keep extending inline-edit/peek/group-by (mostly shipped).

_All of the above marked in the backlog tracker; the DB/RLS items (merge, associations, multi-detail, collaborators, masking) are owner-gated and need throwaway-login validation before prod._
