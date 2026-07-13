# Data-Ops Launch Blockers — grounded census (2026-06-28)

> From a 6-agent research+audit wave (Apollo via MCP, HubSpot/Salesforce via web, a code-grounded data-admin census, a UI-customization review, a fresh UX review, and a Collaborator/Association design spec). This doc is the **launch lens**: the data-administration gaps and BUGS that would make the team distrust or abandon the CRM on day one with ~110 users on 100%-bulk-migrated data. Companion to `CRM-CAPABILITY-CENSUS.md`. Effort: S<1d · M 1–3d · L 1wk+. "Now" = buildable without an owner call; "Decision" = needs sign-off.

## A. The launch-blocker shortlist (fix before/with internal launch)
Grounded in code — these cause data loss, corruption, or "the tool is lying to me":

1. **No in-app bulk IMPORT** (now partly addressed — Import Wizard FE shipped ALT-399; the server-side write endpoint is still gated, DEC-14). The admin still cannot actually load/fix data at scale without a developer. **#1 adoption killer.**
2. **Merge is non-atomic AND the modal falsely promises the loser is "recoverable by an admin" — no restore path exists anywhere in the app.** Two compounding lies on the main dedup tool for migrated dupes. → ALT-416 (atomic RPC) + ALT-400 (recycle bin) + ALT-432 (remove the false promise NOW).
3. **Meetings list silently capped at 2000 rows**; the `truncated` flag is computed but never shown — past 2000, meetings vanish from list/search/filter/export/Cmd-K and the "X of Y" counter, with zero warning. → ALT-428.
4. **Companies' per-project Status & Owner load for the current page only** — so sort/group/filter/**export** of those columns are blank/wrong for unvisited pages. The export meant to be the re-import template ships blank status. → ALT-429. — ✅ IMPLEMENTED (ALT-429 / 2026-06-28): CompaniesPage now loads statuses for the full `filteredData` set (all ids, chunked in 200) whenever project or filtered set changes, matching ContactsPage's existing approach. `pageCompanyIds` retained only for the AMBIG E1 no-project loader. Export path simplified (statusMap already complete). Build clean.
5. **Two writers fight over lead ownership** — reassign writes `lead_report.user_id`; the Edit-Lead form rewrites `lead_master.created_by`. A reassignment is silently reverted by an edit through the other path. This IS the central launch blocker. → DEC-03 (decision) + ALT-433.
6. **All writes trust client-supplied `created_by`/`updated_by`/actor and have no server-side validation** — audit fields are forgeable; malformed emails/phones/enums write freely; the only choke point is RLS. → ALT-431 (decision: needs a write API/RPC layer) + ALT-421 (validation).
7. **No concurrent-edit / lost-update protection anywhere** — every update is last-writer-wins, no version/`updated_date` precondition. Two people on the same migrated account silently clobber each other. → ALT-430. — ✅ IMPLEMENTED (ALT-430 / 2026-06-29): Optimistic-concurrency guard shipped behind `CONCURRENCY_GUARD` flag (default `false`, ships dark). When ON: each core update adds `.eq('updated_date', originalDate)` as a WHERE precondition; zero rows returned = `ConflictResult { kind:'conflict' }`; UI shows "This record changed since you opened it — reload to see the latest, then re-apply your change." with user's typed values preserved. Tables guarded (using existing `updated_date` column, set in app code): `lead_master` (updateLead), `lead_report` (updateLeadStage, meeting reschedule/cancel/confirm writes), `meeting_master` (updateMeetingStatus, confirmMeeting, editMeetingDetails), `contact_master` (updateContactCompany), `wishlist` (assignWishlist, updateWishlistStatus). SKIPPED: `contact_project_status` / `company_project_status` — upsert-by-composite-PK pattern, lower lost-update risk, no form-load timestamp available. `MeetingDetail` / `MeetingRow` do not currently expose `updated_date` — meeting confirm/reschedule/cancel guard wires in `undefined` (= no precondition) until a follow-up adds the field to those detail types. Flag lives in `new-code/web/src/lib/concurrency.ts`. Build clean.
8. **Magic-FK corruption at the source** — `createLead` writes `address_id ?? 1`; `createClient` borrows another client's `address_id`. Fallback records get a wrong hard-coded address, polluting city reporting. → ALT-434.

## B. Quick, decision-free trust fixes (mostly S — surface what's hidden, stop lying)
Batchable on the list pages; high trust payoff for low effort:
- Surface every silently-swallowed truncation: Meetings 2000-cap (L1), Contacts 50000-cap (L2), `.limit(5000)` facet/option/user caps (L23/O2), Cmd-K capped index (L19). Show a "showing N of M — refine to see the rest" banner. → ALT-428.
- Stop rendering load failures as "no data": `catch → return []` across contacts/companies/globalSearch/leadsApi (L18) and per-chunk `continue` that paints blank status (L24/H3). Distinguish empty vs error + Retry. → ALT-435. — ✅ IMPLEMENTED (ALT-435 / 2026-06-28): All 5 list pages already have `loadError` state + AlertCircle + Retry button in the table tbody (Companies, Contacts, Leads, Meetings, Wishlist). `fetchCompanies`/`fetchAllContacts`/`fetchLeadsFallback`/`fetchMeetings` all propagate error strings up via `{ error }`. The `catch → return []` instances in `data/companies.ts` (fetchCompanyContacts/fetchCompanyDeals/fetchProjects), `data/contacts.ts` (fetchContactLeads/fetchContactInteractions/fetchCompanyOptions) are detail-panel helpers — not list-page load paths — and do not affect the list page error/empty distinction. Build clean.
- Clear row-selection on filter change in Contacts (other pages do; Contacts doesn't → bulk action hits now-hidden rows) (L9). → ALT-436.
- "Select all N matching" on Meetings selects only the capped set (L8); off-screen selections persist with no max guard (L10). → ALT-436.
- Tell the user WHY bulk buttons are hidden when no project is selected (L20). → ALT-435. — ✅ IMPLEMENTED (ALT-435 / 2026-06-28): CompaniesPage and ContactsPage both show disabled buttons with explanatory titles ("Select a project to enable bulk reassign" / "Select a project to enable bulk set-status") when projectId == null, rather than hiding them. Build clean.
- Sort bugs: Contacts string-compare sorts numbers as text/nulls clump (L11); grid date columns sort lexically not chronologically (L12). → ALT-437.

## C. The capability gaps every competitor has and we lack (from Apollo + HubSpot/SF)
Consensus across both researchers — the data-admin table-stakes (most already ticketed in CRM-CAPABILITY-CENSUS §3):
- Import: history + rollback/undo a batch (ALT-417), error/skipped-row file (ALT-418 ✓ in wizard), upsert-by-key + create/update modes, mapping reuse/templates (ALT-419), dedup-choice on import.
- Recycle bin + **point-in-time rollback** ("restore CRM changes" within N days, by user/import/workflow) — HubSpot's safety net we completely lack. → ALT-400 + ALT-438.
- Duplicate-management queue (fuzzy, cross-table) + atomic merge with field-winner choice (ALT-416; D4/D5 fuzzy = ALT-439).
- Field-level history with change source + single-value undo (ALT-407).
- Active vs static **saved lists/segments** (ALT-404) + shareable saved views with default sort (ALT-440).
- Required + conditional/dependent properties + validation rules (ALT-421/422).
- Data-quality command center: formatting auto-fix, fill-rate, dup-volume alerts, unused-property cleanup (ALT-408).
- **Collaborators / secondary owners** + per-record share (design spec done — ALT-441) and **associations** across modules (design spec done — ALT-442).
- Do-Not-Call / suppression list + unsubscribe handling, auto-remove from sequences (ALT-425/409).
- Bulk-assign owner across a selection + "max per company" distribution cap + departure-reassignment — ✅ IMPLEMENTED (ALT-443): BulkReassignModal (multi-owner checkbox + optional cap input) wired into Leads/Meetings/Companies/Contacts bulk-reassign bars; distributeRecords() round-robin via bulkActions.ts; DepartingUserReassignTab in AdminPage → "Departing User" nav item; countOwnedRecords + fetchOwnedLeadIds/CompanyRows/ContactRows helpers added to assignment.ts.
- Scheduled/ongoing enrichment + job-change tracking + data-health dashboard (post-launch; ALT-444).

## D. Customization gaps (UI review) — what users can't tailor but should
Have today: per-user column show/hide/reorder + persist, Table/Grid/Kanban toggle, density, multi-facet filters (localStorage), bulk actions, project scope. Missing (buildable now unless noted):
- **Saved filter segments** (named, multiple) — only one ad-hoc set today (M; decision: how many). ALT-404.
- **Default sort per view** (always resets on refresh) — S, no decision. ALT-440.
- **Pinned/frozen columns** (user-selectable; TanStack `columnPinning`) — S/M. ALT-440.
- **Per-view column sets** ("Sales view" vs "Ops view") — M (decision: count). ALT-445.
- **Dashboard tile customization + date-range** (5 fixed tiles, all-time, same for all roles) — M (decision: per-user vs per-role). ALT-446.
- **Reorderable detail sections** — M. ALT-447.
- **Missing-but-wanted fields** on lists: last-contacted / days-since-touch / next-step (needs interaction rollup or new field — decision) — ALT-448; meeting time + lead stage (data exists, just not shown — S) — ALT-437.

## E. Fresh UX issues not in UX-AUDIT.md (polish; mostly S)
Most of UX-AUDIT's themes have since shipped (toast, confirm, focus ring, density, chips, Cmd-K, error boundary, dirty-guards). New finds: EditableGrid saves give no success toast (silent in dense grid); modal focus-restore can fail if opener unmounts; bulk modals don't block backdrop-close mid-progress; LogCall duration validates only on submit; forms validate on submit not blur; "no data" vs "no filter match" not distinguished; WishlistPage lacks preview-panel + bulk reassign parity. → folded into ALT-435/436/449.

## F. What's actually solid (so we don't over-correct)
notify-service endpoints are admin-gated and derive the actor from the verified JWT; lead/contacts/companies reads page to completion via `.range()` (the cap problem is concentrated in Meetings + per-page Company status); merge soft-deletes the loser last and stops at first error; CSV formula-injection is neutralized; the recently-shipped UX systems (toast/confirm/focus/keyboard/density/chips/progress) are wired consistently across the 5 lists.

## G. Build order (decision-free first, per the owner's "don't stop" directive)
1. **Trust fixes** (ALT-428/435/436/437) — surface truncation, stop swallowing errors, fix selection-on-filter + sort bugs. All S/now. *(Touch the 5 list pages — build as one coordinated pass.)*
2. **Atomic merge** (ALT-416) — SECURITY DEFINER RPC + client rewire; staged migration, validate on throwaway login before prod apply. + remove the false-restore promise (ALT-432).
3. **Recycle bin read+restore** (ALT-400) — list soft-deleted + restore (restore write validated on throwaway login).
4. **Default sort + pinned columns** (ALT-440) — customization, no decision.
5. Then decision-gated: collaborators/associations (specs ready, ALT-441/442), point-in-time rollback (ALT-438), server-side write/validation layer (ALT-431/421), per-view columns + dashboard tiles + freshness fields.
