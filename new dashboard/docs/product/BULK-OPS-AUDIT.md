# Bulk Operations Audit — the Data-Admin Persona

> **Persona:** the CRM admin / data-operations user who **bulk-uploads and bulk-edits**
> Companies, Contacts, and Leads. This is NOT the outreach agent (who only updates
> records they're assigned). Our north-star is "outreach-only": the team updates,
> **admins maintain the data in bulk** — so this persona's tooling is foundational.
>
> Audited 2026-06-27 against the live codebase (verified file:line, not assumed).
> Companion doc: [CRM-PARITY-HUBSPOT-ZOHO.md](./CRM-PARITY-HUBSPOT-ZOHO.md) (feature parity).
> Spec this measures against: [BULK-IMPORT-EXPORT.md](./BULK-IMPORT-EXPORT.md).

## TL;DR — what a data-admin literally CANNOT do today
1. **Import or bulk-update from a CSV/Excel file** — the headline workflow
   (export → edit many rows → re-import) is **entirely unbuilt**: no import UI, no
   service-role bulk endpoint. *(Export now carries a Record-ID so the round-trip is at least possible — shipped 2026-06-27.)*
2. **Delete or archive records** in bulk (or even one) from the UI — **no delete capability exists at all.**
3. **Merge duplicate companies/contacts** — the code exists but is **never wired into any screen** (dead code).
4. **Bulk-edit any field except per-project status** (and Leads can't even do that) — no bulk City/Industry/Size/Name/Email, no spreadsheet paste, no fill-down.
5. **Trust large bulk runs** — actions are per-row browser writes under RLS with no progress bar, no confirm on status changes, no undo; **non-owned rows fail silently** (the ownership/RLS launch-blocker).

## Capability matrix

| Capability | Status | Where (file:line) | Top gap |
|---|---|---|---|
| **A. Bulk IMPORT from file** | ❌ Missing | spec only (`BULK-IMPORT-EXPORT.md`); no import code, no `/api/*/bulk-update` endpoint | Whole export→edit→re-import loop unbuilt |
| **B. Bulk INLINE grid edit** | 🟡 Partial | `EditableGrid.tsx:106` | One cell at a time; no paste-from-spreadsheet, no fill-down, no arrow/Tab grid nav |
| **C. Bulk FIELD update on selected** | 🟡 Partial | `bulkActions.ts:64` (status only); `SelectAllMatchingBar.tsx` | Only per-project **status**; no City/Industry/Size/Name; Leads have none; no progress; no confirm |
| **D. Bulk ASSIGN / reassign owner** | ✅ Full | `assignment.ts:270/492/517/541` | Sequential loop, no progress/cancel; company reassign auto-cascades to all contacts with no warning |
| **E. Bulk DELETE / archive** | ❌ Missing | none | No delete/archive anywhere — not even single-record |
| **F. Bulk EXPORT** | ✅ Full | `ExportButton.tsx` | ~~No Record-ID column~~ **fixed 2026-06-27**; still: no PII gating on export |
| **G. DEDUP / MERGE duplicates** | 🟡 Dead code | `merge.ts:169/223` + `MergeDuplicatesModal.tsx` | Modal never mounted in any page → unreachable; not atomic; no duplicate-finder |
| **H. UNDO + audit trail** | 🟡 Partial | `updated_by` stamped per row; status → `interaction` | No undo; no "batch X changed N rows" receipt; merge has no rollback |
| **I. Permissions / RLS** | 🟡 Partial | `AuthContext.tsx:177` (`canReassign`, `canCreateData=admin`) | Bulk writes run in-browser under RLS → non-owned rows silently fail. The import spec itself says imports MUST use a service-role endpoint — which doesn't exist yet. |

## Prioritized issues + solutions (how HubSpot/Zoho solve each)

| # | Issue | Sev | Proposed solution | Effort | Blocks on ownership/RLS? | Ticket |
|---|---|---|---|---|---|---|
| 1 | **No bulk import / re-import at all** | P0 | Service-role `/api/<entity>/bulk-update` (`requireAdmin`, chunked, dry-run diff, per-row 207 report) + `BulkImportWizard` (column-map → validate → preview → commit) per spec | L | **Yes** (service-role is the chosen way around RLS — also *resolves* the admin path) | ALT-376 |
| 2 | **Export had no stable Record-ID** | P0 | ✅ **DONE** — `ExportButton` now prepends "Company/Contact/Lead ID" so the export = the import template (HubSpot "Record ID" / Zoho "<Module> Id") | S | No | ALT-377 |
| 3 | **No bulk delete/archive** | P1 | Admin-only **soft-delete** (`deleted_by`/`deleted_date`) as a bulk toolbar action with a typed confirm + recycle-bin view | M | Partial (delete of non-owned rows needs service-role) | ALT-378 |
| 4 | **Merge feature is dead code** | P1 | Wire `MergeDuplicatesModal` into Companies/Contacts; add a "potential duplicates" finder; move re-point into a `SECURITY DEFINER` RPC for atomicity | M | Yes (RPC is the fix) | ALT-379 |
| 5 | **Bulk field-edit = status only; none on Leads** | P1 | Generalize `setStatus` into a "bulk edit field" picker over a safe whitelist; add to Leads | M | Partial | ALT-380 |
| 6 | **No progress / cancel on bulk loops** | P2 | `onProgress(done,total)` + progress bar + chunking; surface partial-failure list (HubSpot runs it as a background job w/ completion email) | S/M | No | ALT-381 |
| 7 | **No confirm on bulk set-status / add-to-project** | P2 | Count-confirmation step ("This changes N records") | S | No | ALT-382 |
| 8 | **Export ignores PII masking** | P2 | Gate full-value PII export behind admin/reveal-permission; export masked for others (or log it) — **needs Ankit's call** (exporting contact details IS the calling workflow) | S | No | ALT-383 (decision) |
| 9 | **No bulk-action audit receipt / undo** | P2 | Write a bulk-action log row; offer "undo last bulk action" | M | No | ALT-384 |
| 10 | **"Select all matching" is page-set only** | P2 | Today fine (pages load full set); move to server-side filter selection when import/large-data lands | M | No | ALT-385 |

## What I shipped without needing a decision (2026-06-27)
- **#2 Record-ID in every export** (ALT-377) — centralized in `ExportButton` (one change → all 5 modules: Companies, Contacts, Leads, Meetings, Wishlist). Build green. This is the single prerequisite that makes a file round-trip possible, and it's pure export (no RLS coupling, zero risk).

## What needs Ankit's decision before building
- **#1 (the import engine)** is the big one and is **coupled to DEC-03 (ownership/RLS)** — the service-role endpoint is *both* the import mechanism and the way around the RLS blocker. Best built together with the ownership fix.
- **#8 (PII export gating)** — product call: do we let outreach roles export raw phone/email (it's their calling workflow) or gate it? Logged as a Review-Hub decision.
