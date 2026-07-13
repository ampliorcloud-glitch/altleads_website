'use strict';
/**
 * apply-company-hierarchy.cjs
 * Staged ADDITIVE migration — ALT-469 (parent company / account hierarchy).
 *
 * STATUS: STAGED — NOT executed. `node -c apply-company-hierarchy.cjs` checks syntax.
 *         Apply to prod ONLY after Ankit's go-ahead (CLAUDE.md §2). Purely additive
 *         (one nullable self-ref FK + index); the UI is dark behind COMPANY_HIERARCHY.
 *
 * WHY: Enterprise accounts have subsidiaries / divisions (e.g. a parent group with
 *      multiple operating companies, each holding their own contacts). Both SuiteCRM
 *      (`member_accounts`) and Vtiger (`parentid`) model this; AltLeads had no way to
 *      express "Company B is a subsidiary of Company A". OSS-CRM synthesis P1 gap.
 *
 * MODEL: `company_master.parent_company_id bigint NULL REFERENCES company_master(company_id)`.
 *        NULL = top-level. Self-cycles are prevented in the UI (can't pick self) and
 *        should be guarded by a future trigger if hierarchy depth grows; a 1-level
 *        self-ref is all the current UI exposes.
 *
 * IDEMPOTENT (IF NOT EXISTS). RELEVANT TICKET: ALT-469.
 *
 * ── ROLLBACK ──────────────────────────────────────────────────────────────────
 *   ALTER TABLE company_master DROP COLUMN IF EXISTS parent_company_id;
 */

const SQL = `
ALTER TABLE public.company_master
  ADD COLUMN IF NOT EXISTS parent_company_id bigint
    REFERENCES public.company_master(company_id);

COMMENT ON COLUMN public.company_master.parent_company_id IS
  'ALT-469: self-ref parent account. NULL = top-level. Subsidiaries = rows whose parent_company_id = this id.';

CREATE INDEX IF NOT EXISTS idx_company_master_parent
  ON public.company_master(parent_company_id)
  WHERE parent_company_id IS NOT NULL;
`;

async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(SQL);
    await c.query('COMMIT');
    console.log('✅ applied: ALT-469 company_master.parent_company_id + index');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

if (require.main === module && process.argv.includes('--apply')) {
  main();
} else {
  console.log('STAGED — not applied. Run `node apply-company-hierarchy.cjs --apply` to execute (after sign-off).');
}
