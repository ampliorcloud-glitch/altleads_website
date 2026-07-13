# AltLeads CRM — Bulk Export → Edit → Import (Update) Spec
*Engineering spec · 2026-06-18 · companies first, contacts in phase 2 · admin-only*

---

## ALT-490 — Import Dedup QC Preview ✅ IMPLEMENTED (2026-06-29)

**Match-key selector** added to Step 2 of ImportWizard (below the column mapping table).
Dropdown populated from `ENTITY_MATCH_KEYS[entityKey]` (lib/importDedup.ts); sensible
default via `defaultMatchKey()` (email for contacts/leads, record_id for companies).
Resets when the entity changes.

**Dedup computation** triggers on entering Step 3 (clicking "Next" from Step 2):
- Calls `fetchExistingKeys(entityKey, matchKey, rawValues)` — chunked READ-ONLY `.in()`
  SELECT via the anon Supabase client; safe even when write gateway is off.
- Calls `classifyRows(validRows, matchKey, entityKey, existingNorms)` (pure fn, no DB).
- If the DB query fails, a soft amber warning is shown — wizard never blocked.

**Preview UI (Step 3)** adds three new stat pills next to the existing valid/skipped pills:
- **N new** — rows with no match in the DB (blue pill).
- **M will update existing (matched by «key»)** — rows that matched a DB record (purple pill).
- **K in-file duplicates** — second-or-later occurrence of the same key within the file (amber pill).
Each pill is clickable and expands to a scrollable list capped at 200 rows, showing row
number + key value. A one-liner "Records are matched on: «key»" appears above the pills
(mirrors HubSpot/Zoho UX).

**Files changed:** `src/components/import/ImportWizard.tsx` (wiring + UI).
**Files read-only (helpers, not changed):** `src/lib/importDedup.ts`, `src/data/importDedup.ts`.

---

Goal: keep 500+ companies current **without the team doing data entry**. Admin exports to Excel, edits many rows, re-imports, and the system **updates existing records** (never creates duplicates), with a preview before anything saves. Modeled on HubSpot & Zoho.

---

## How HubSpot / Zoho do it (best-practice we adopt)

1. **The export IS the import template.** Export carries a stable, immutable **Record ID** column (HubSpot "Record ID", Zoho "<module> Id").
2. **Match by that ID first** — it supersedes any other key. Fallback keys (domain / CIN / email) only when ID is absent.
3. **Mode toggle:** **Update-only** (default — ignore/flag rows that don't match an existing record) vs "create *and* update." We ship **update-only** in v1.
4. **"Don't overwrite with blanks"** option (default ON) — an empty cell never wipes existing data.
5. **Column mapping** — auto-map by header against a known field whitelist; let admin re-map.
6. **Dry-run / preview** — show exactly what will change (old → new) before applying.
7. **Per-row report** — success / skipped / error (with reason), downloadable.

---

## Our design (companies, v1)

### 1. Prerequisite — add the match key to the export
In `CompaniesPage.tsx`, prepend to `EXPORT_COLUMNS`: `{ key: 'id', header: 'Company ID' }` (first column; `Company.id` = `String(company_id)`). Add a "Do not edit the Company ID column" note. **No schema change.**

### 2. Writes go through a NEW service-role endpoint (not the browser)
**Why:** browser writes run as the logged-in user and RLS would silently update **0 rows** for companies they don't own; and there's no unique constraint for an arbitrary-key upsert. So:

`POST /api/companies/bulk-update` in `new-code/notify-service/server.js`:
- Behind existing **`requireAdmin`** (JWT + `profiles.role==='ADMIN'`), using **`getSupabaseAdmin()`** (service-role bypasses RLS → can update any row).
- Raise `express.json` limit for this route (~5 MB); keep it under `apiLimiter`; **chunk ≤ 200 rows/call**.
- Body: `{ dryRun, matchKey: 'company_id'|'domain'|'cin', updateOnly, skipBlanks, rows: [{ rowNum, key, fields:{...} }] }`.
- Logic:
  - Match by `company_id` (default) / `domain_clean` / `cin_number`. Reuse `createCompany`'s dedup semantics (`is_demo=false`, `deleted_date is null`, `.or(domain_clean.eq, cin_number.eq)`) so matcher and create-dedup agree.
  - **Never INSERT** in v1 (`updateOnly` hardcoded true for first ship).
  - **Ambiguous match** (domain/CIN hits >1 row) → error row "resolve by Company ID", never guess.
  - Resolve `industry`/`city` **names → ids**; if unmatched, **report it, never null the field**.
  - `skipBlanks` ON → empty cells are ignored.
  - Stamp `updated_by` (from token) + `updated_date`.
  - Return per-row report; **HTTP 207** on partial success.
- `dryRun:true` → compute & return the diff **without writing**.

### 3. Admin-only import wizard (web)
`web/src/components/companies/ImportCompaniesModal.tsx` (admin-gated):
1. **Upload** `.xlsx/.csv` → parse with `XLSX.read` + `sheet_to_json` (SheetJS already a dependency).
2. **Match-key** selector: Company ID (default) / Domain / CIN.
3. **Column mapping** — auto-map headers to the editable whitelist; manual override.
4. **Options** — Update-only (locked v1), Don't-overwrite-with-blanks (default ON).
5. **Dry-run diff preview** — table of rows × changed fields (old → new), plus skipped/error rows.
6. **Apply** → calls the endpoint in chunks → shows results.
7. **Download annotated report CSV** (status + reason per row).

Client wrapper `bulkUpdateCompanies()` in `data/companies.ts` (POST with bearer token; reuse `cleanDomain`, `resolveLookupId`).

### 4. Editable field whitelist (companies v1)
`company_name`, `company_web_url` (+ recompute `domain_clean`), `cin_number`, `email`, `linkedin_url`, `company_size`, `industry_id` (by name), `city_id` (by name). *(Confirm with owner — e.g. add `description`?)*

---

## Phase 2 — contacts (same engine, different table)
Add `{ key:'id', header:'Contact ID' }` to a Contacts export. Match precedence: `contact_id` → `lower(email)` → `linkedin_clean` → `mobile_no` (indexes exist). Whitelist: `full_name, email, mobile_no, alt_mobile_no, designation, linkedin_url` (+recompute `linkedin_clean`), `company` (by id/domain). Endpoint `POST /api/contacts/bulk-update`. Generalize the wizard to `<BulkImportWizard entity="companies"|"contacts">`.

---

## Owner decisions
1. **Admin-only** for v1? (recommended — yes.)
2. Blank cells: **don't overwrite** (recommended ON).
3. **Update-only** v1 (no creating from import)? (recommended — yes; create still via New Company + dedup.)
4. Confirm the editable field set (anything beyond the list above?).
5. Provide a **sample edited export** (export → change a few rows) to validate matching/diff/report end-to-end.
6. Confirm same-origin deployment so `/api/companies/bulk-update` is reachable in prod (it is — combined app).
