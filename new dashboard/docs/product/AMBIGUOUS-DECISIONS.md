# Ambiguous / Confusing Decisions — the conflict list

> **For Ankit + Mohit.** These are the undefined or contradictory decisions surfaced by the 2026-06-22 persona audit (4 parallel research agents) plus earlier work. Each will cause a conflict or rework if left unresolved. Format: the question → where it bites today → options → **my recommendation**. Resolve the **🔴 launch-blocking** ones before the team gets live data.
>
> Decide in this doc (write your pick next to each), and I'll fold the answers into `DECISIONS.md` as ADRs and into the build.

---

## A. Access & hierarchy (the biggest cluster — these gate the launch)

**A1. 🔴 What does a TEAM LEAD / SALES HEAD see and control outside their own people?**
Today: nothing is team-scoped — `canReassign` is a flat boolean, the reassign target list is unscoped (`fetchAssignableUsers(null)`), the Approvals queue is org-wide, and a Sales Person on `/sales` would see *every* lead (no `lead_report.user_id` scoping). There is no "who reports to whom" link in the DB yet. 
- Options: (a) **downline-scoped** via a `manager_id` / `sales_head_user_id` reporting line (managers see + act on their people only); (b) project-scoped (you see everyone on your projects); (c) stay org-wide (then "Team Lead/Sales Head" ≈ admin-lite).
- **Recommend (a)** — it's the standard CRM model and what SALES-PORTAL.md already assumes. This single decision unblocks team reassign, team dashboards, scoped approvals, and the whole sales portal. (Tickets ALT-167, ALT-301; RLS ALT-152.)
- ✅ **ANKIT RULED 2026-06-22:** a Team Lead (and admin) must ALSO see **UNASSIGNED** records (companies/leads/contacts) — that's the pool they assign from to their callers. So manager visibility = (their downline's records) **+ (all unassigned records)**. Build "My records" / team scoping (ALT-305, ALT-296) and the assignment RLS so the unassigned pool is visible to managers, not hidden. Still open: exact downline mechanism (manager_id) for "their team."

=> Ankit response: first of all Sales person should not see any leads which are not assigned to him (unless he is not just sales person but sales head too)
TL should see only those records which are assigned to him & his team (his downline) & same with other managers/admins too, they should see their respective downline's & other managers/admins records who have not assigned their records to any other TL or Saleshead etc. .... **(this logic should be same for all modules of outreach: Companies, Leads, Contacts, etc)**
**IMPORTANT: this will also ensure that "Unassigned" bucket in the module list is visible to managers/admins and not hidden from them.**

Quick update: This all is to be set in project setting- where admin decide for which project - which module is to be public view (read all or read all safe only (means sensitive info hidden like call logs, contact details, )) or private view (only the user can see his own records only (contact details still hidden- only visible in reveal (stay revealed untill tab refreshed))) or public edit (read all & edit all- but still contact details hidden)

---

**A2. 🔴 Who may reassign / change owner, and across what boundary?**
Today: Admin + any Team Lead + any Sales Head can reassign *anything* (UI-gated; RLS not yet applied). You already confirmed "upline can edit + reassign their people."
- Options: (a) admin anywhere + manager **within their downline only**; (b) any manager anywhere; (c) admin-only cross-team, managers within-team.
- **Recommend (a)** — pairs with A1. Enforced in the staged RLS (`apply-assignment-rls.cjs`) once the downline link exists.

=> Ankit response: All managers/TL can assign or reassign only their downline's data & unassigned data of project under them (not anyone else's)
For sales head- they can only assign/reassign leads (above meeting schedule - all after meeting schedule like successful, drop, cancel, reschedule etc) & he can only do for his sales team only not of any Amplior user. i hope you have understood but if not, then ask.


**A3. Is "create data" truly admin-only — forever, and for Team Leads too?**
Today: `canCreateData = isAdmin` (hardcoded); the code itself notes the per-role create setting (ALT-174) isn't built. Outreach-only north-star says the team updates, doesn't create.
- Options: (a) admin-only (current); (b) admin + Team Lead (one-off creates); (c) per-project/per-role configurable (ALT-174).
- **Recommend (a) now, (c) later** via the project access modes (ALT-295).

=> Ankit response: right now only admin & yes i am planning to open for TL & agent level as well but very precautious becasue of maintaining CRM hygiene. Because company & contacts are sensitive data's for us & i dont want anyone not mature to create them. Maybe later i can allow so keep functionality but dont give anyoen access bydefault. but i can allow anyone to create lead/meeting/task/call from existing company/contacts. I hopw that make sense to you, if not pls ask. So answer to you is "(a) now, (c) later"

---

**A4. The per-project access modes (ALT-295) — confirm the 4 modes + who sets them.**
You specced: Owner-scoped / Public-Edit / Public-View-only / Public-Limited-view (sensitive fields masked). Open: (i) who can set a project's mode — admin-only, or also that project's TL/Sales Head? (ii) does "Limited view" hide exactly contact email+phone, or a broader list?
- **Recommend:** admin sets it (managers request); "Limited view" masks contact email + phone + any field flagged sensitive, shows status/designation/linkedin/company. Lock the sensitive-field list in DECISIONS.

=> Ankit response: Admin should decide this for project setting- whether project will be public view, limited view, private or editable.

Public view: anyone can view anything but can't edit anything, contact details etc- only visible in reveal (stay revealed untill tab refreshed)
Limited view: anyone can view but can't edit anything (sensitive info hidden like call logs, contact details etc- not visible & wont reveal at all(only non sensitive data is visible)) - if needed let project setting (admin) decide which project field is sensitive & which is not. 
Private view: only the user can see his own records only (edit view)(contact details still hidden- only visible in reveal (stay revealed untill tab refreshed))
Public edit: anyone can view & edit anything (contact details still hidden- only visible in reveal (stay revealed untill tab refreshed))(with a toogle for admin to yes or no to reveal all sensitive info by default or not)


Also create 1 option to select owner always & set owner to self(logged in uder bydefault unless TL/manager/admin this way for those who can see public records , they will be able to distinguished between their own & others.)

Also create save view option from advance filters.

---
**A5. Should the Approvals queue be team-scoped?**
Today every Team Lead sees every pending report org-wide.
- **Recommend:** downline-scoped (follows A1); admin sees all.

=> Ankit response: yes Admin see all, but its actually work of TL/manager & QC(can view all & also approve/reject or request changes in user's report after checking) both are working same work- but QC can be assigned any manager/TL too, they will be able to check all users report and their status in that project.
So a lead approval request will got to TL/manager & QC first(with email notification) (as asignee's downline) and if they reject then owner/user can edit & request again(highlighted changes)- after this if approved or rejected(rejecting lead report will require comment by TL/QC -mandatory)- email notification will go to proceed if approved or edit & request again if rejected.


---

## B. Roles' purpose & defaults

**B1. 🔴 What does QC (role 6) actually DO?**
Today: QC is a label with no screen, no route, and is excluded from the only review queue (Approvals). A QC login has nothing to do.
- Options: (a) QC = a 2nd approver on lead reports alongside TL/Admin; (b) QC = call/disposition **quality auditor** with a sampling queue + scorecard; (c) both.
- **Recommend:** decide before issuing any QC login. Likely (a) for launch, (b) later. (ALT-304.)

=> Ankit response: First of all QC is per project (can be 1 for all projects but admin to decide) & can view all & approve/reject or edit changes in user's report after checking. Notification will go to owner regardless. & QC will be working like TL/manager but QC can be assigned any TL/manager too, they will be able to check all users report and their status in that project.


**B2. 🔴 Should lists default to "my assigned records" for agents — and keyed on which field?**
Today: lists return everything; the "Agent" facet keys off `created_by` (internal owner) while the real assignment is `lead_report.user_id`. So an agent can't easily see their own book, and the facet can be wrong.
- **Recommend:** a "Mine" default (ON for agents) scoping by `lead_report.user_id`; pick that as the canonical assignment field for display everywhere. (ALT-305.)

=> Ankit response: Yes, it should default to "my assigned records" for agents, and the "Mine" default should be ON for agents, scoping by `lead_report.user_id`.

---

## C. Calls & dispositions

**C1. 🔴 What is the CANONICAL disposition vocabulary, and which is the ONE call logger?**
Today: two live loggers with **different** vocabularies on the same Contact page — `LogCallModal`→`call_log` (UPPER enum: CONNECTED, CALLBACK_REQUESTED, LEFT_VOICEMAIL…) and `DispositionForm`→interactions (lowercase: connected, call_back, switched_off…). They write different tables/histories.
- Options: (a) standardize on the `call_log` enum, migrate the dropdown; (b) drive `call_log` from an **admin-editable** `dropdown_option` list (one source, tunable).
- **Recommend (b)** — matches the "admin maintains data" posture; retire the second logger. (ALT-303.)

=> Ankit response: We will be using only one call logger (DispositionForm) and one vocabulary (the one used in DispositionForm - lowercase) - which will be editable by admin from project settings (dropdown_option table) and will be called Call Disposition. 
**One important thing is that these 2 vocabularies `LogCallModal`→`call_log` are same means `LogCallModal` is just a module version of `call_log`- just like Task manager for Tasks - its just a design thing (i wonder why did we create 2 when this is already comon sense)** anyway keep this in mind these 2 are same things, means all call logs will be visible in Call module & scheduled calls too (so all call logs will be visible to related records like conatct/company/leads/meeting as well like activity but will also be visible as record itself in call module so to get easily tracked by Manager/TL/admin ) the UI will be similar to Task manager(but we can change it if you want)
so new call is logged with all associated records (conatct/copany/leads/meeting/wishlist etc) prefilled when try to logg or schedule from record itself- it will save time- else if created from call module- user will have otpion to select & associate all records (contact/company/leads/meeting/wishlist etc) (company & conatct are mandatory)

& Dispositions can be edited by admin as per project (i.e. company & contacts). 

---

## D. Meetings & feedback

**D1. Can an agent self-schedule a meeting, or is TL/Admin approval always required?**
Today: booking needs ~10 fields + a TL/Admin approval round-trip; the report locks Pending. Intentional per DECISIONS, but it's heavy at call volume.
- **Recommend:** keep approval for the qualified pipeline; add a lightweight "log a quick/confirmed meeting" path for simple cases. Confirm.

=> Ankit response: Yes approval is required by either QC or TL (admin also but he wont be able to do all anyway- but still admin had athority)
Also wait i am thinking of removing meeting module all together from all screens- is it even necessary? you suggest? its just leads module with a simple filter only... unless we really integrate calendar & email & use it like Zoho use it.



**D2. 🔴 Which feedback model wins — and is feedback editable after submit?**
Today: the spec wants server-driven `feedback_question_master` Yes/No + Successful/Reschedule/Cancel; the Client Portal already ships a *different* free-text-remark + 3-option model; the Sales Portal feedback page is a "Coming soon" stub. Edit-after-submit is specced "locked" but the client form silently resets with no lock/read-back.
- **Recommend:** ONE structured feedback model everywhere (it powers the HubSpot monthly remarks report); after submit show it read-only; edits by owner until the meeting closes, then locked. (ALT-168, ALT-311.)

=> Please explain this like i am 6th standard student, i am not technical & getting confused. although this is ditto copy of mobile app but i had given some insights or changes on client portal-maybe thats why i am confused. bring them back & explain.

**D3. One meeting-record component or two?**
Today: `MobileMeetingRecord` (mobile-ditto, sales) vs `PortalMeetingDetailPage` (flat grid, client) — two implementations of the same screen, drifting. ALT-275 says the mobile-ditto view is *the* record for both.
- **Recommend:** render one `MobileMeetingRecord` for both (client fed by snapshot data). (ALT-311.)

-=> give preview of both but main is mobile version- what is portalmeetingdetailpage?

**D4. What does the CLIENT see — all meetings, or only some statuses? Recordings ever?**
Today: client meeting list shows all statuses; recordings are gated to internal + Sales Head ("a future client does not").
- **Recommend:** client sees all their meetings (with a status filter) but **never** call recordings / internal images. Confirm whether cancelled/dropped are hidden.

=> client sees all their meetings (with a status filter) but **never** call recordings (unless selected in [project setting] , so we will have power to control which client will see call recording, for lead wise, make it off bydefault- same with images)/ internal images. cancelled/dropped/postpone/reschedule are visible.
whatever is in Mobile + what i asked, ask if any question.

**D5. Once the mobile app is retired, what is the source of truth for the record layout?**
SALES-PORTAL.md names the archived `old-code` mobile screen as authoritative.
- **Recommend:** make `MobileMeetingRecord.tsx` the canonical spec after retirement, so future changes don't require diffing dead code.

=> i didnt undertand this, pls explain but that mobile meeting record is the same thing which is in Leads module (but only once meeting is scheduled- means all meeting schedule, successful, drop/cancel, postpone/reschedule etc are visible but only to sales team manner- they dont need to view our CRM operation- its data sensitive - they dont pay for data, they pay for meeting so we will only show what is till meeting - pls check if we are showing extra)

---

## E. Data display

**E1. Should inline status edit require a selected project?**
Today: Contacts inline status edit is disabled unless a project is selected ("Select a project first") — agents on a single project hit this constantly.
- **Recommend:** auto-resolve when a record has exactly one project; only require a pick when genuinely ambiguous.

=> auto-resolve when a record has exactly one project; when project is already selected from global select (next to global search..) then it will not ask for project selection(& use selected project from above).


**E2. Is "due today" tasks-only, or tasks + meetings + stale leads?**
Drives whether we build one unified queue (ALT-306) or keep three screens.
- **Recommend:** unified (tasks due + today's meetings + untouched assigned leads).

=> very good question , i havent thought about it. I am already thinkng of removing meeting module entirely & when leads created for meeting schedule then a task type is linked to it. so it will be a task for agent as well so they can attend or followup on that too. & meeting once schedule (successufl/drop/reshe) then lead stage will remind that as task so it will solve this issue too. Just a thought but need engineering here.
Also i like the idea of single queue but include call logs (i have explained earlier that calls are also when logges into records are noted in call module & if scheduled as task then call will be scheduled in call moduel) & so the queue will be unified as they all follow similar role (but not same screen- they have different modules for them..)


---

## F. Design system (resolve once to stop visual drift)

**F1. Canonical authoring mode: Tailwind vs inline-style vs CSS-var?** All three coexist today. **Recommend:** Tailwind utilities mapped to the existing tokens; inline allowed only with `var(--*)`, never raw hex. (ALT-314.)

=> i have no idea about this- pls explain & find solution- i am not expert in designing.

**F2. One Button component or many?** Three primitive sets + inline buttons today. **Recommend:** one `ui/Button` with variants; ban raw `<button style>`. (ALT-315.)

=> same, i dont know, not an expert unless you show me in UI.

**F3. Who owns the status-color map?** Defined 3× (badges, status badges, charts) with different colors. **Recommend:** one `statusColor(category,value)` seeded from `dropdown_option`, used by badges AND charts. (ALT-321.)

=> i dont know much about dropdown option seeding, will need to learn more about it & check with you. can you explain what is dropdown option seeding is? anyway you find solution with options & show me difference in real time..

**F4. Row density & table engine standard?** Heights vary 40–48px; Contacts uses a different engine. **Recommend:** one density token + one shared `DataTable` (TanStack) for all lists. (ALT-316.)

**F5. Hover/focus: JS or CSS?** 42 files mutate styles on mouse events. **Recommend:** standardize on CSS `:hover` + the existing `:focus-visible`. (ALT-322.)

**F6. Empty-state philosophy + role-aware copy?** **Recommend:** illustrated icon + CTA, role-aware ("ask admin to import" vs "no records assigned to you"). (ALT-320.)


=> So i am not expert when it comes to design, so you find solution & show me in UI like image button or components or animation or using css/tailwind utilities & then show me difference in real time.. & i will approve once i like it.
---

_Created 2026-06-22 from the persona audit. Full findings: `PERSONA-AUDIT-2026-06.md`. Resolve the 🔴 items first — they gate the internal launch._

---

## ENGINEERED RULINGS — 2026-07-02 (Claude, per Ankit's "engineer solutions yourself, then ask")

These were OPEN engineering calls (not product calls). Ruled by engineering; Ankit can veto any.

- **D1 (Ankit's back-question: remove the Meetings module?):** KEEP the meeting DATA MODEL — it powers the reschedule journal, feedback, approvals, the client portal snapshot, and the entire notification matrix you ruled in Q5; a "leads filter" cannot carry that lifecycle. But your instinct is right about the UI: post-beta, fold meeting VIEWS into the Leads module (tab + calendar) and retire the separate nav item. For beta: leave as-is (zero risk). 
- **D3 (one meeting component or two):** ONE shared meeting-record component, rendered in both contexts. Duplicate views drift; drift = the D2 conflict.
- **D5 (source of truth once mobile retires):** the CRM web app + Supabase, full stop. The mobile app's field set remains only as the portal column whitelist (already LOCKED).
- **E1 (inline status edit needs a project?):** if the record has exactly ONE live project context → default to it silently; if multiple → require explicit selection in the editor. Correctness without friction.
- **E2 ("due today" scope):** tasks due today + meetings scheduled today + overdue follow-ups (3 buckets, labeled). Matches HubSpot/Pipedrive "My day" convention.
- **F1 (styling authoring mode):** inline-style objects + the design-token constants = canonical (that's what 90% of the codebase does); Tailwind allowed only for layout utilities in new files; no new CSS files. Stops the drift without a rewrite.
- **F2 (Button):** adopt ONE Button primitive for NEW code immediately; migrate old callsites opportunistically when a file is touched anyway. No big-bang refactor.
- **F3 (status-color map):** single `lib/statusColors.ts` map consumed by badges + kanban + charts. Any new color = added there or it doesn't exist. — ✅ IMPLEMENTED 2026-07-03 (lib/statusColors.ts created; Badge.tsx stage pills + DashboardPage chart bars now consume it — the two duplicate maps deleted)
- **F4 (table density):** 44px rows, 13px cell text, sticky header — the standard for all list tables; Contacts' variant conforms next time it's touched.
- **F5 (hover/focus):** CSS classes (or :hover in a shared stylesheet) for new code; stop adding JS mouse-event style mutation. Existing 42 files migrate opportunistically.
- **F6 (empty states):** every list/section empty state = 1 line of role-aware copy + the ONE next action as a button (filtered-empty ≠ truly-empty). No illustrations for internal tools.

**STILL GENUINELY OWNER-LEVEL (asked 2026-07-02):** D2 (one feedback model), D4 (client-visible meeting scope + recordings).
