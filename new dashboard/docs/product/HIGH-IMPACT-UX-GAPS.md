# High-Impact UX Gaps — prioritized build order (Tier 1 → 2 → 3)

> **Source:** Ankit asked (2026-06-22) "what are the highly impactful things in terms of UX that are pending?" — leading example: **changing/reassigning owner** of a company / lead / meeting is **not possible today**, internal *or* sales side.
> **Status note:** this is the durable version of that answer. Each item is cross-linked to its backlog ticket. Build order is **Tier 1 → Tier 2 → Tier 3** (owner's instruction). Reassignment is being designed by workflow `wa2g8qboi`.

---

## 🔴 Tier 1 — blocks the core daily job

### 1. Reassign / change owner — **the owner's #1 named gap** · `ALT-288` (epic), `ALT-289`, `ALT-290`
There is **no UI** to reassign a lead, company, contact, or meeting to another person — internal **or** sales side. Today:
- **Wishlist** has assignment (`assignWishlist` + `AssignModal`) — the only one.
- **Leads** only have a *request-to-claim* approval flow.
- **Companies / contacts / meetings** have nothing.

A team lead cannot say "give these 50 leads to Ravi." Daily-operations critical.
- **Phase A (buildable now, `ALT-289`):** lead + meeting. Assignment = `lead_report.user_id` (NOT `created_by`); a meeting's owner derives from its lead. Reuse the AssignModal pattern → RLS-checked write → `lead_reassigned` email/notify.
- **Phase B (`ALT-290`):** company + contact. Ownership is **per-project** (`company_project_status` / `contact_project_status`). **OPEN DECISION** — dedicated `owner_user_id` column vs derived-via-lead. *Recommended:* explicit `owner_user_id` per-project (mirrors `lead_report.user_id`). Lock in `DECISIONS.md` before building.

### 2. Assignment-based **write model** (the thing that makes #1 work) · `ALT-152` *(existing blocker)*
Records are RLS-locked to their **original** owner (`created_by` from the bulk migration), not the person **assigned** now — so even an "assigned" user hits *"you can only edit records you own."* **Reassignment is literally the fix:** assignment is how a record becomes editable. These ship **together**. The extension verifier confirmed the contact lock is actually **three** gates (`contact_master` + `contact_project_status` + `interaction`-on-contact) — the fix must align all three, validated with a real non-admin login.

### 3. Sales portal shows **all** leads, not just yours · `ALT-167` *(existing)*
A salesperson at `/sales` currently sees every lead, not their own/downline (RLS scoping not applied yet). Until that lands the portal isn't usable as "my work."

---

## 🟠 Tier 2 — speed multipliers for a calling team

### 4. Bulk-action toolbar · `ALT-291` *(new)*
Lists already have multi-select + Excel export. Add **bulk reassign / bulk status-change / bulk add-to-project** on the same selection. The difference between minutes and hours for list processing. (Distinct from `ALT-159` export→edit→import.)

### 5. Inline / quick edit from the list · `ALT-157`, `ALT-213` *(existing)*
Change status / owner / disposition right in the row — no opening the record. The whole job is *updating* records; opening each one is a friction tax on every action.

### 6. Advanced per-field filters everywhere · `ALT-270` *(partial)*
Multi-select filters live on Leads + Meetings; extend to Contacts / Companies / Tasks.

---

## 🟡 Tier 3 — "feels like a real CRM" polish

| # | Gap | Ticket |
|---|-----|--------|
| 7 | **Kanban pipeline board** — drag leads across stages | `ALT-292` *(new)* |
| 8 | **Saved filter presets / named views** ("my hot Mumbai leads") — *column* views exist (`ALT-035/044/050/081`); named filter presets are the gap | (folds into saved-views work) |
| 9 | **Merge duplicate** companies / contacts (dedup exists on *create* only) | `ALT-293` *(new)* |
| 10 | **Always-visible search bar** — grouped search exists behind Cmd-K (`ALT-272/188`); an always-open bar with inline dropdown is the last 20% | `ALT-213` |

---

## Recommendation
**Reassignment (`ALT-288`) + write-model (`ALT-152`) + sales scoping (`ALT-167`) are one connected workstream** and the right thing to do **before** the team gets live data — without it agents can't edit their assigned records and leads can't be distributed. This same fix also unblocks the **Chrome extension's edit phase** (`ALT-285`). Tier 2 (bulk + inline edit) is the highest *speed* ROI right after. Tier 3 is post-launch polish.
