'use strict';
/**
 * apply-fix-contact-masked-view.cjs — HOTFIX (2026-07-03, Ankit bug report).
 *
 * BUG: Contacts module dead in prod — "column contact_master_masked.updated_date
 * does not exist". Cause: ALT-430 (concurrency guard, commit 378ce8d) added
 * updated_date to the contacts list SELECT, but the list reads the
 * contact_master_masked VIEW, created earlier WITHOUT that column.
 *
 * FIX: CREATE OR REPLACE VIEW with the identical definition + cm.updated_date
 * appended (view columns can only be appended at the end — kept last).
 * Additive, no data change, no redeploy needed; the page recovers on refresh.
 */
const SQL = `
CREATE OR REPLACE VIEW public.contact_master_masked AS
 SELECT cm.contact_id,
    cm.full_name,
    cm.designation,
    cm.company_id,
    comp.company_name,
    cm.city_id,
    city.city_name,
    cm.is_demo,
    cm.created_by,
    cm.created_date,
        CASE WHEN can_see_contact_details(cm.created_by::text) THEN cm.email        ELSE NULL::text END AS email,
        CASE WHEN can_see_contact_details(cm.created_by::text) THEN cm.mobile_no    ELSE NULL::text END AS mobile_no,
        CASE WHEN can_see_contact_details(cm.created_by::text) THEN cm.alt_mobile_no ELSE NULL::text END AS alt_mobile_no,
        CASE WHEN can_see_contact_details(cm.created_by::text) THEN cm.linkedin_url  ELSE NULL::text END AS linkedin_url,
        CASE WHEN can_see_contact_details(cm.created_by::text) THEN cm.linkedin_clean ELSE NULL::text END AS linkedin_clean,
    cm.updated_date
   FROM contact_master cm
     LEFT JOIN company_master comp ON comp.company_id = cm.company_id
     LEFT JOIN city_master city ON city.city_id = cm.city_id
  WHERE cm.deleted_date IS NULL;
`;
async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT');
    console.log('✅ hotfix applied: contact_master_masked now exposes updated_date');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ rolled back:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
}
if (require.main === module && process.argv.includes('--apply')) main();
else console.log('STAGED — run with --apply (prod hotfix for the dead Contacts module).');
