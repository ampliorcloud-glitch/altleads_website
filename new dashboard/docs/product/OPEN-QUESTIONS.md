# Open Questions — ambiguities & conflicts to resolve
*2026-06-19 · these are intersections/contradictions across what we've decided. Owner to decide; then fold answers into DECISIONS.md and remove here.*

> ✅ **CONVERTED TO TICKETS 2026-07-03 (ALT-502 done):** Q1→ALT-517 · Q2→ALT-513 · Q3→ALT-516 · Q4→ALT-515 · Q5→ALT-514 · Q6=process rule (push after 6pm/weekends) · Q7→ALT-175 notes · minor→ALT-518. Do not re-derive here — the tracker rows are the source of truth now.

---

## Q1 — What does "the team can't CREATE" actually cover? (outreach-only vs the exceptions)
**Conflict:** North-star = outreach team **updates only, never creates data**. But we've also said: Sales Head can **add Sales Persons**; Sales Head can **assign/reassign** leads; create rights are **grantable to Team Leads** per project; and the vendor sales app's one create flow was **Wishlist** (capture a prospect).
**Resolution needed:** define "no create" precisely. **Recommendation:** "no create" = **AGENT and SALES_PERSON cannot create the core data entities** (Company, Contact, Lead). The following are NOT "data creation" and stay allowed for the right role: **user provisioning** (Sales Head adds Sales Persons; Admin adds users), **lead assignment** (Sales Head), and **Wishlist capture** (a deliberate, separate "suggest a prospect" flow — decide: allow Sales/Agents to add Wishlist prospects at v1, yes/no?).
**Decide:** (a) Confirm the entity list agents/SPs can't create. (b) Wishlist capture allowed for sales at v1? 

=> Ankit response: very good question- Sales head can only assign lead to Sales people not agents- listen to me very carefully as Sales team consists of company admin, sales head & sales person- sales head can assign this meeting (lead) scheduled by amplior to sales person who will take this meeting forward- means its sales process- not lead gen (so Amplior user/agent no neeed to worry- but it will be reflected in their records as well as its part of the data- but TL/project manager can still change change/reassign SP because its anyway also part of team- with a optional remark that why he reassigned- only for TL not sales head)

---

## Q2 — Is the "Sales Portal" one thing, or two? (operational sales team vs the client's read-only view)
**Conflict:** You described two different client-facing needs: (1) the **sales team** (Sales Head/Person) who *do outreach* — see leads, record feedback; and (2) **"the client part where the client sees only what's scheduled/successful + a dashboard"** — a *read-only results view*. These are different audiences (a sales rep vs a client executive).
**Resolution needed:** Are Sales Head/Person the only client-side roles, or is there a separate **"Client Viewer/Exec"** role (read-only: scheduled/successful meetings + dashboard, no lead operations)?
**Recommendation:** Treat as **two surfaces in the sales portal**: the **operational** view (Sales Head/Person — leads + feedback) and a **read-only client dashboard** (a Client-Exec role, or the Sales Head's dashboard). **Decide:** is there a distinct read-only "Client" login separate from Sales Head/Person?

=> Ankit response: very good question again. To clarify- Sales team do not outreach, they just attend meeting that we as agent/user scheduled for them- so sales person will be seeing his meeting list & company admin & sales head is just for their organisation viewing pipeline & meetings. In Amplior client portal or sales screen - there will be three dashboards (1). Agent dashboard (2). Sales dashboard (3). TL dashboard.there are 3 roles from client side (for both Amplior client portal or sales screen)- Client' Company Admin, Sales Head & Sales person. Roles edit/view can be decided by our crm super admin in project/client setting- Company admin can edit all & view all but by default view only, sales head can assign & reassign or take meeting to himself & view all but edit only his & sales person can. Sales person can see his own meeting (cant assign /reasign ) & request for cancel or reschedule (these 2 are also for sales head & company admin as well) & give feedback (once given cant be edited by sales person anymore- only sales head can edit on his behalf- but sales head can also give feedback).whatever access sales person had- sales head also have thoose too. Company admin is admin for his own company. & can add more sales person or sales head to their company (ofcourse approved by our CRM super Admin - so re-engiener this too)

---

## Q3 — "Agents edit records ASSIGNED to them" — assigned by WHICH field? (the launch blocker)
**Conflict / gap:** For LEADS we have two owners — internal **`created_by`** (the lead-gen agent) and **`lead_report.user_id`** (the client salesperson). For **Contacts/Companies there is NO assignment field at all** today, and writes currently gate on `created_by` (which is NULL/wrong for migrated data). So "assigned to them" is undefined for contacts/companies.
**Resolution needed:** which field defines "this internal agent is assigned to this contact/company/lead" so they can update it?
**Recommendation:** add an explicit **`owner_user_id` (assignee)** on contact/company project-status (and use `created_by`→reassign or `lead_report.user_id` for leads), then bulk-set it for migrated rows from the real assignments. **This is the #1 launch blocker — needs a concrete answer before role-based editing works.**
**Decide:** how do we know which agent "owns" each migrated contact/company? (Is there a source list of who-works-what, or do we derive it from existing data?)

=> Ankit response: i didnt quite Understood about this problem, but what I can see is that. You are asking me if Which fields are to be edited So We will only do safe edits. For exampl- Company -  company Status, contact status, description, comments. And the client says stream will not be able to edit any of these things(apart fro feedback only or request reschedule or cancel). And for those record, Which do not have any Owner- They can be Edited by team leader. Or If reassigned or assigned to any agent, they will still be able to edit them. & leave blanks as of now- all unassigned wont be edited by anyone but by TL/admin so its safe- any one changes anything will be captured with this person with role edited/changed this. also i didnt get why do we need source- pls explain

---

## Q4 — Masking: who can click-to-reveal, and who sees nothing? 
**Conflict:** ADR-22 says permitted viewers see **partial mask + click-to-reveal**; non-permitted see **hidden always**. But Contacts/Companies are **row-public** today (everyone sees the row; only phone/email columns are masked). So: can **any** logged-in user reveal **any** contact's number, or only the **owner + their manager + admin** (everyone else fully hidden)?
**Recommendation:** **Only owner + manager/Sales-Head + admin** get the partial-mask+reveal; **everyone else = fully hidden** (matches "all public contact details hidden always"). The reveal is a UI layer on values the DB already lets that user fetch.
**Decide:** confirm reveal is limited to owner+manager+admin (not every logged-in user). Also: exact **email mask pattern** (e.g. `ab••••@domain.com`?).


=> Ankit response: no, so no one will be able to see any sensitive details directly, they will have to reveal everytime(revealed can stay till tab refresh) & its decided by project setting who can reveal contact details- as of now make this default - contact/company owner & all their uplines can reveal. Sales head/SP will have sales screen & their contact details can be unhidden by default but same rule- their SP cant see other SP's records but their upline can see all.
& no pls do not let user fetch data- anyone can hack this with simple knowledge- make it from DB level if possible if high efforyts job & may take time- put in backlogs (not urgent but important). Yes  this is fine e.g. ab••••@domain.com with 999****999) is ok

---

## Q5 — Notification recipients per event (internal agent vs client salesperson vs both)
**Conflict:** A lead has an internal agent (`created_by`) AND a client salesperson (`lead_report.user_id`). Today notifications go to "the salesperson (TODO)". With the sales portal live, who gets each email — meeting scheduled/rescheduled/cancelled, assignment, approval?
**Recommendation:** define per-event: e.g. **assignment → the assignee**; **meeting changes → the salesperson + the internal agent**; **approvals → the manager/agent**. **Decide:** the recipient matrix (I'll draft it for sign-off).


=> Ankit response: no wait, its not right- lead scheduled notification should go to lead owner/assigned agent for lead not created_by agent - this step is wrong in itself - who created this rule? & same with who is currently assigned sales person/sales head.
Sales team is a separate team - our client - so they will only receive meeting schedule, feedback, reschedule, cancel only, later you can suggest on which all action they must receive. First schedule must also go to sales head as well if sales person is directly assigned (unless he is sales head himself or only assigned to sales head). 

For TL, they will receive notification for all downline's & own meeting schedule, successful (if feedback provided by SP or Marked by agent /tl with comment (mandatory)) & cancel/drop(difference between cancel & drop is is meeting is canceled by contcat of company (prospect) then cancel- if asked to dropped by SP/SH then dropped because sales team dont want to pursue.) & reschedule/postponed. 

For reschedule/cancel request by SP/SH it will go to team leader & AGent of taht meeting & then they can ask prospect (contact of company) to rescedule & if they agree then they can update meeting accordingly.

For task manager- there will be notifiaction for pending/scheduled task & daily summary which is toggeled by personal setting.

also suggest if i am missing.

---

## Q6 — "Manual deploys during launch week" vs Hostinger auto-deploy-on-push
**Conflict:** We agreed **manual deploys**, but Hostinger **auto-deploys on every push to `main`**. So any push (even accidental) goes live. "Manual" today = we control *when we push*.
**Recommendation:** for true safety during launch week, **temporarily turn OFF Hostinger git auto-deploy** (deploy on demand) — or keep the discipline of "only push on owner go." **Decide:** turn auto-deploy off for launch week, or rely on push-discipline?


=> this is not an issue, we can deploy on evening after 6pm & /or weekends.

---

## Q7 — Email templates v2 (planned, ALT-175)
Not a conflict — a scope expansion. Current emails = improved copy + working buttons. **v2** = re-engineered per-event layouts + **attachments** (e.g. meeting-schedule **PDF report**). Plan: reuse the HTML→PDF (Playwright) method. **Decide later:** which events get a PDF, and what the PDF contains.

=> i think playwright is ok, but if not urgent then html for testing & for somemore time in live, i can give UI for template which i need... if tahts ok else use mobile app screen data. 


---
### Minor / lower-stakes
- "Senior viewer" sharing — who can grant it (only Sales Heads, or Admin too)? scope = team vs whole project? => we can create lite/team users similar to zoho or hubspot who can only view details for review purpose not edit - this is for senior leader/stakeholders only.
- Do **internal** users actually need to log into `/sales` (they see leads internally anyway), or is `/sales` for sales users only? => yeah i mean no need though as they can access so leave it as of now(but admin can still access like me).
- Mobile app — still in scope eventually (least priority), or dropped? => it is not dropped, it is in backlog. 
