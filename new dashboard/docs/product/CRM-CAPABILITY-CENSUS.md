# CRM Capability Census & Gap Delta (2026-06-28)

> **Why this exists.** Ankit's correction: PLATFORM-DISCOVERY.md was treated as a finished inventory when it wasn't. This census re-derives capabilities from the *actual platforms* (HubSpot via live MCP against portal 9264506; Zoho/Salesforce/Pipedrive/Close/Apollo/Outreach from product knowledge), grounds them against *what our product actually has today* (read-only code audit), then diffs against the discovery doc. It exists to catch what I missed and to RE-RATE what I under-weighted. Read this ALONGSIDE `PLATFORM-DISCOVERY.md` — where they disagree, this doc is newer.

## 0. The honest headline
The 26-domain discovery map is directionally right but had three classes of error:
1. **Under-rating** — Import/data-ops rated MEDIUM-HIGH and parked in Phase 3, when for a CRM whose data is 100% bulk-migrated it is table-stakes (re-import is a daily admin need). **Re-rated CRITICAL / near-term.**
2. **Factual error** — the doc lists **record-merge as MISSING**. It EXISTS (`merge.ts` / `MergeDuplicatesModal.tsx`, ALT-293) — and is **non-atomic** (client-side sequence of Supabase calls; a crash mid-merge leaves records half-merged with no rollback). That's a live data-integrity risk, not a missing feature.
3. **Omission** — ~12 table-stakes capabilities were never named as line items (listed in §3).

## 1. What the census CONFIRMED our product already has (grounded, with files)
- Export: client-side CSV/XLSX, respects selection + columns, Record-ID round-trip, formula-injection sanitised (`ExportButton.tsx`).
- Dedup **detection** (read-only, exact-ish on name/email/phone/site) — `findDuplicates.ts` / `DuplicatesButton.tsx`.
- Record **merge** (admin-only, type-to-confirm) — `merge.ts` / `MergeDuplicatesModal.tsx`. **NON-ATOMIC — risk, see §2.**
- Bulk ops: add-to-project, set-status, reassign (single+bulk, cascade company→contacts), now with **progress bar + cancel** (ALT-401) — `bulkActions.ts` / `assignment.ts`.
- Global search: two surfaces (Cmd-K palette + top-bar), all-terms-AND, title-weighted ranking, lazy index — `globalSearch.ts`. NOT fuzzy, NOT full-text.
- Saved **column** views + column customiser (per-user) — `views.ts` / `ColumnCustomizer.tsx`. (Saved *filter segments* still NONE.)
- Tasks (type/priority/status/reminders/digest) + activity timeline + call logging w/ dispositions (manual, no dialer).
- RLS framework + audit columns + soft-delete columns (no restore UI). No public API, no automation, no AI.

## 2. CORRECTIONS to PLATFORM-DISCOVERY.md (apply on next regen)
| Doc claim | Reality | Action |
|---|---|---|
| §13/Part E: "no record-merge / bulk merge UI" (MISSING) | Admin merge EXISTS (ALT-293) but **non-atomic** | Re-label PARTIAL + raise a **data-integrity RISK** ticket → move merge into a `SECURITY DEFINER` Postgres RPC (one transaction). **ALT-416.** |
| §13: Import rated MEDIUM-HIGH, Phase 3 | Table-stakes for a bulk-migrated CRM | Re-rate **CRITICAL / near-term**. FE wizard (ALT-399) pulled forward. |
| §3 bulk: "only a spinner, no progress/cancel" | Progress + cancel now SHIPPED (ALT-401) | Mark HAVE. |
| §16: "in-memory keyword global search" | Correct, but TWO surfaces + title-weighted ranking | Minor: note ranking + GlobalSearchBar. |

## 3. NEW gaps the discovery doc never named as items (the misses)
Table-stakes a competitor would mock us for lacking — now ticketed (ALT-416..427):

| # | Capability | Who has it | Severity |
|---|---|---|---|
| ALT-416 | **Atomic merge** (SECURITY DEFINER RPC, one transaction + audit) — fixes the non-atomic risk | All | **CRITICAL (risk)** |
| ALT-417 | **Import history + rollback/undo** an import (delete records a batch created) | HubSpot, Zoho (30d), SF | HIGH |
| ALT-418 | **Skipped-row / error file** on import (per-row reason), not just a count | All | HIGH |
| ALT-419 | **Saved/reusable import field-mapping templates** | Zoho, SF Data Loader | MEDIUM |
| ALT-420 | **Scheduled / recurring imports** (FTP/cloud/URL) | Zoho, Ops Hub | LOW-MED |
| ALT-421 | **Validation-rules engine** (block save: required-when, regex, cross-field) | SF, Zoho | HIGH |
| ALT-422 | **Dependent/cascading picklists** + reusable global picklist sets | SF, Zoho | MEDIUM |
| ALT-423 | **Record types / layout+picklist per segment** | SF, Zoho | MEDIUM |
| ALT-424 | **Tags / labels** with filter-by-tag | Pipedrive, Zoho | MEDIUM |
| ALT-425 | **Suppression / Do-Not-Contact lists** as first-class (excl. from calls/exports) — extends ALT-409 | All outreach | HIGH |
| ALT-426 | **Approval / Blueprint engine** (guided stage transitions, mandatory fields) — generalises Approvals page | Zoho Blueprint, SF | MEDIUM |
| ALT-427 | **Background bulk-job queue + "email me when done"** (beyond in-tab progress) | SF, Zoho | MEDIUM |

Plus still-true-from-the-doc, just reconfirmed CRITICAL by every competitor: in-app **import wizard** (ALT-399, buildable now, pulled to near-term), **field-level history** (ALT-407), **recycle bin/restore** (ALT-400), **saved filter segments** (ALT-404), **report builder** (ALT-405).

## 4. Re-prioritised near-term data-ops order (no owner decision needed to START the FE)
1. **ALT-416 atomic merge RPC** — closes a live integrity risk (validate RLS on throwaway login first).
2. **ALT-399 import wizard (FE)** — parse → auto-map → validate → 3-row preview → skipped-row surfacing; write submits to a later service-role endpoint (DEC-14). The FE is safe to build now.
3. **ALT-400 recycle bin** (read+restore), **ALT-404 saved segments**, **ALT-407 field history render**, **ALT-418 error file**.

## 5. Method note (so this isn't trusted blindly either)
- HubSpot rows marked [LIVE] were confirmed against portal 9264506 (STANDARD tier; workflows un-enumerable — token lacked `automation` scope). Everything else is product knowledge and may drift with vendor releases.
- This census did NOT re-verify every competitor claim against live tenants; treat severities as a starting prioritisation, not gospel. The product-state column IS code-grounded (file refs in §1).
