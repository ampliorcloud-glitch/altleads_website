# AltLeads CRM — UX Redesign Spec (outreach-first)
*Engineering spec · 2026-06-18 · derived from the multi-agent design analysis*

North-star: the team **updates** records during outreach; it does not create data. Optimize every screen for *fast updates*, hide creation from the team, surface the next action.

---

## A. Role posture (WS1 · P0 · ship first)

Single source of truth in `web/src/contexts/AuthContext.tsx` built off `profile.role`:
- `canCreate` = role ∈ {ADMIN, TEAM_LEAD}. AGENT / SALES_PERSON / QC = update-only (QC effectively read-only).
- `isAdmin` = role === ADMIN.

Apply:
- **Hide** create buttons when `!canCreate`: `LeadsPage` "＋ New Lead", `ContactsPage` "New Contact", `CompaniesPage` "New Company", and the "Add new contact / ＋ New Lead" actions on `CompanyDetailPage` & `ContactDetailPage`.
- **Guard routes** in `web/src/App.tsx` with a `RoleProtectedRoute` (redirect unauthorized): `/leads/new`, `/contacts/new`, `/companies/new`, `/leads/:id/edit` (need `canCreate`); **`/admin`** and consider `/approvals` (need `isAdmin` / manager). *(Critic note: today `/admin` only checks `session` — every authenticated user can load it. Route-gating is the real control; button-hiding is cosmetic. Server endpoints already enforce `requireAdmin`.)*
- Hide the inline "new company" affordance on `LeadFormPage` for update-only roles (also sidesteps the placeholder NOT-NULL caveat).

---

## B. Record UX pass — Company & Contact detail (WS5 · R2 · P1)

Unify both pages on **one 3-zone layout**: **Identity header → persistent Action Bar → Tabs**.

1. **OutreachActionBar.tsx** (new, between header and tabs, both pages): primary actions **Call** (`tel:`), **Email** (`mailto:`), **Log call** (opens `DispositionForm` in a popover — one click from any tab), **Add note**. Right side: a read-only **"Last touch"** chip (newest interaction's date + disposition).
2. **ContactMethods.tsx** (new): renders email→`mailto:`, phone/alt→`tel:`, LinkedIn→external. When a value is masked for a non-owner, show a **lock icon + "Hidden — owned by another rep"**, never a blank em-dash. Needs `owner_user_id`/`can_view_details` on the contact shape to compare against `profile`.
3. **ProjectStatusPanel.tsx** (new, shared): replaces the always-in-edit `AccountPanel` and the Contact "Project Status" card. **Read-first** (badges + text + "Updated by X · 2d ago") with an explicit **"Edit status"** toggle. Fixes the fake "has data" label by showing real `updated_by`/`updated_date`.
4. **Company Contacts tab:** remove the 4-toggle "Show per row" clutter; default each contact row to name·designation·status + ContactMethods + a compact status select; heavy fields behind the expand chevron (mini-tabs: Status | Log call | Notes).
5. **Activity:** add a per-row project chip and an optional "this project only" filter so switching projects never makes history look empty. Add `fetchLastInteraction` in `data/projectStatus.ts` for the Last-touch chip.

No schema change. Reuses `DispositionForm`, `ActivityTimeline`, `StatusBadge`, `ProjectSelect`, `SectionCard`.

**Owner inputs:** how reps actually dial (tel: handler / softphone / separate dialer); masking wording ("Hidden — owned by <rep>" vs generic "Restricted"); confirm disposition/status option lists are final; company activity = all-projects or project-scoped; which roles count as "can see all details".

---

## C. Lead form reorg + autopopulate (WS5 · R3 · P1)

`web/src/pages/LeadFormPage.tsx` + `web/src/lib/leadsApi.ts`:
1. **"Deal Setup" section at TOP:** Client, Source, Project (currently near the bottom). Then Company → Contact Info → Assignment (Agent, City) → Business Details. **Pure markup move**; handlers/validation unchanged.
2. **Enrich the company lookup** in `fetchLookups`: return `city_id, industry_id, email, linkedin_url, company_web_url, cin_number, company_size` + a `companiesById` map.
3. **Autopopulate on company-select:** set `city_id` from the company **only when blank**; fill `email`/`linkedin` only when blank; show industry / domain / CIN / size **read-only** (context, never saved — `lead_master` has no such columns). Add a "city prefilled from company (editable)" hint.
4. **Precedence:** picking an existing **contact** wins person fields (and may set company); **company-select** owns city/industry context and fills only blanks.
5. New-company-by-name stays manual (no row to copy from); hidden for update-only roles per §A.

---

## D. Inline grid editing (WS6 · R1 · P2 · post-launch)

Today only `ContactsPage` (hand-rolled table) has a working inline status cell (`InlineStatusCell`); Companies/Leads/Meetings/Wishlist (TanStack) are read-only. The update data-layer already exists (`upsertContactStatus`, `upsertCompanyStatus`, `logDisposition`).

1. **Extract `web/src/components/ui/EditableCell.tsx`:**
   - `EditableSelectCell` — badge → `<select>` on click (status / disposition / decision_power / feasibility); props `options, current, onSave, disabledReason`.
   - `EditableTextCell` — text → input/textarea; save on Enter/blur, cancel on Esc (notes / comments / next-step).
   - Both `stopPropagation()` so row-nav doesn't fire; surface upsert `{error}` (e.g. 42501 ownership) to the user; disable until a project is selected.
2. **Contacts:** make description/comments cells inline via `upsertContactStatus({description}|{comments})`; patch `statusMap` optimistically. *(No data-layer work.)*
3. **Companies:** make Account Status (+ optional Feasibility/Decision Power) inline via `upsertCompanyStatus`; respect the per-page lazy status cache on save.
4. **Per-row "Last Disposition"** cell → `logDisposition(...)` (keeps the append-only audit timeline); optionally also store a `last_disposition` column.
5. Verify behavior inside TanStack `flexRender` cells (the proven prototype lives in the non-TanStack Contacts page).
6. **Leads list:** read-only today (no write path, stage not project-scoped). Making it editable = a separate decision (would need `updateLeadStage` in `realLeads.ts`).

**Owner inputs:** v1 inline fields = status + notes/comments + disposition (low-effort) — OK to defer **owner + next-step** (need a migration + user-picker, WS7) to a 2nd pass? Should the Leads list stay read-only?

---

## E. Owner / next-step (WS7 · P2 · needs migration)
Add `next_step text` + `next_step_date date` (and optional `last_disposition`) to `contact_project_status` & `company_project_status`; extend the patch types + upsert builders in `data/projectStatus.ts`; add `setStatusOwner` (writes existing `owner_user_id`) + a user-options fetch. Gated on the **ownership-model decision**.

---

*Note: file paths corrected to `web/src/data/*` (not `web/src/lib/*`); re-grep line numbers before editing — anchors in the raw analysis may be stale.*
