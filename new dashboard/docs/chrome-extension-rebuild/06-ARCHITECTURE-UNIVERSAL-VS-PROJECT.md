# 06 — Architecture: "Same house, many doors" + Universal vs Project data

> **Decision driver (owner, 2026-06-22):** The Chrome extension is **not a separate product** — it's another **door to the same house** (the database/CRM). It must match the CRM on everything: auth, data, fields, behavior. Plus a forward goal: a **"Universal vs Project" switch** — some data (e.g. a corrected phone number) is universal and must reflect to **all** users/projects; other data (status, owner, notes) is per-project. The owner wants this designed **now** ("easy now, hard later").
>
> **Status: RECOMMENDATION — awaiting owner go-ahead before building.** Research is read-only and complete.

---

## 1. Key finding: the universal/project split ALREADY exists in the schema

The CRM already separates the two layers structurally (it's implicit today, not an explicit toggle):

| Layer | Table | Key | Scope | Write path (web) |
|---|---|---|---|---|
| **Universal record** | `contact_master` | `contact_id` | Shared across ALL projects | `ContactDetailPage.saveEdit()` → `update contact_master` |
| **Project overlay** | `contact_project_status` | `(contact_id, project_id)` | Per project | `projectStatus.ts:upsertContactStatus()` |
| Per-project **owner** | `contact_project_status.owner_user_id` | `(contact_id, project_id)` | Per project | `assignment.ts:reassignContact()` |
| Companies — same split | `company_master` / `company_project_status` | `company_id` / `(company_id, project_id)` | Universal / per-project | `createCompany()` / `upsertCompanyStatus()` |
| Activity / calls | `interaction` | `(record_id, project_id)` | Record is universal; row tagged with project_id (nullable) | `logDisposition()` / `appendInteraction()` |
| Leads, Colleagues | `lead_master`, `contact_master_masked` | `contact_id`, `company_id` | **Universal** (no project filter) | read-only here |

**So "Universal vs Project" = the existing model.** Universal fields (name, email, mobile, alt_mobile, designation, linkedin, company, city) live on `contact_master` — edit once, reflects everywhere. Project fields (status, owner, description, comments) live on `*_project_status`. The global project selector already gates the project overlay (a specific project = overlay shown + editable; "All projects" = overlay hidden, universal record still fully editable).

**The "switch" to expose:** make the selector's modes explicit — **Universal (record)** vs **a specific project** — in both the CRM and the extension, backed by the tables above. No schema change needed; it's a UI/logic surfacing of what already exists.

---

## 2. The three ways to make the extension "the same house"

### ❌ A. Embed the live CRM page (iframe) — RULED OUT
- **Framing is blocked:** `notify-service/server.js` sets `Content-Security-Policy: frame-ancestors 'none'` (line ~628) **and** `X-Frame-Options: DENY` (line ~637) on every response.
- **Session is isolated:** the web CRM stores its Supabase session in `localStorage` (crm.altleads.com origin); the extension stores its own in `chrome.storage.local` (`altleads_sb_session`). An iframe would **not** be logged in → login wall inside the panel.
- Even if both were fixed, a wide 2-column CRM page is a poor fit for a ~400px side panel. **Not the path.**

### ❌ B. Replicate the CRM sections by copy — RULED OUT
- Full control of the panel layout, but it's a **parallel copy** of the universal/project logic. Building the Universal/Project switch (and every future CRM change) **twice** is precisely the "hard in future" the owner wants to avoid. Guaranteed drift.

### ✅ C. Shared logic core (one codebase, two doors) — RECOMMENDED
- Extract the data + rules layer (what's universal vs project, how reads/writes route, the LinkedIn match, activity) into a **shared package** imported by **both** the web CRM and the extension.
- The extension keeps its **lightweight vanilla-TS, LinkedIn-tailored panel UI** (deliberate, for speed/size); only the *logic* is shared — so the Universal/Project switch is written **once** and both doors inherit it.
- **It's already half-done:** `new-code/extensions/shared/` (contactData.ts, rpc.ts, auth.ts, types.ts…) already mirrors the web `src/data/` layer. Consolidating now (while it's small) is cheap; later it's a big refactor. **This is the "easy now" window.**
- Small refactor required: shared data functions take a `SupabaseClient` parameter (web passes its localStorage client; extension passes its chrome.storage client); align the TS target.
- Sharing React **UI components** is **not** recommended (extension is intentionally framework-free; the shareable bits are tiny). Share **logic**, not pixels.

> **"Match everything" means same data + same edit-rules + same single source of truth — rendered in a panel-appropriate layout.** Not a pixel copy of the wide CRM page.

---

## 3. Foundational prerequisite: DEDUPLICATION (do not skip)

The screenshot comparison proved a **duplicate** "Ankit Sundriyal" (same phone + LinkedIn, different email + city). **The universal "fix once → reflects everywhere" promise breaks the instant a person has two `contact_master` rows.** So:
- **Merge duplicate contacts/companies** (ticket **ALT-293**) becomes top-priority — it's a prerequisite for the universal model, not a nice-to-have.
- Add a **uniqueness guard** so one real person = one row: e.g. a unique (partial) index on `linkedin_clean` (and/or normalized `mobile_no`) so future imports/edits can't recreate duplicates. (CRM-side; coordinate with the CRM Opus.)
- The LinkedIn match (`find_contact_dup`) must resolve to the **single canonical** row. Until dedupe lands, it should at least prefer the row with the most data / most recent activity, and ideally surface "N possible duplicates" rather than silently picking one.

---

## 4. Access nuance the owner must decide (ties to ALT-152 + ALT-295)

If an agent can **correct a universal field** (phone/email) and it reflects to everyone, then universal edits need **broader write access** than project-scoped edits — but `contact_master` writes are currently RLS-gated to owner/admin (the ALT-152 blocker). Two different questions:
- **Who may edit UNIVERSAL fields?** (Correcting a wrong number helps everyone — arguably any agent should be able to, with an audit trail.) This maps onto **ALT-295 access modes** (Owner-scoped / Public-Edit / Public-View / Public-Limited).
- **Who may edit PROJECT fields (status/owner)?** Stays ownership/assignment-gated (ALT-152 assignment model).

Recommendation: treat **universal-field correction as a lightly-gated, fully-audited action** (every change logged to `interaction`/audit) distinct from project-status edits. Final call is the owner's; it's an access-model decision for the CRM Opus to implement.

---

## 5. Recommended plan (in order)

1. **Lock the principle** (this doc): universal = `contact_master` (one row, edit from any door reflects everywhere); project = `*_project_status` (per project). One source of truth.
2. **Dedupe first** (ALT-293 + uniqueness guard) — the universal guarantee depends on it. Fixes the screenshot mismatch too.
3. **Consolidate to a shared logic core** (Option C) — extract the universal/project read/write rules into one package consumed by web + extension.
4. **Surface the Universal/Project switch** explicitly in both doors (selector modes), backed by the existing tables.
5. **Extension reaches data/edit parity** via the shared core (panel-appropriate layout): full contact record + project status + leads + colleagues + log-call + activity — same functions as the CRM.
6. Per-door access for universal vs project edits per §4 (owner decision; CRM Opus implements with ALT-152/ALT-295).

---

## 6. Open decisions for the owner
- **Approve Option C** (shared logic core) over embed/replicate? (Recommended.)
- **Prioritize dedupe (ALT-293) + a uniqueness guard now?** (Recommended — it's the foundation.)
- **Who may edit universal fields** (any agent w/ audit, vs owner/admin only)? → ALT-295 access mode.
- Is the extension meant to be a **full editing CRM surface** (Phase 2), or **read + raise-requests** until ALT-152 lands? (Universal-field correction is the first editing use-case worth enabling.)
