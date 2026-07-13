'use strict';
/**
 * apply-email-templates-and-log-links.cjs — ALT-509/510 (2026-07-03).
 *
 * 1. email_log: add contact_id + company_id so sends from Contact/Company
 *    pages link to their records (was lead_id only) — powers the record
 *    timeline "Emails" panel (ALT-510).
 * 2. email_template: reusable compose templates (ALT-509). Both scopes built
 *    (Ankit's engineer-all-options rule): 'global' = admin-managed, visible to
 *    everyone; 'personal' = owned by one user. Merge fields ({{first_name}},
 *    {{company}}, {{full_name}}, {{my_name}}) are resolved client-side at
 *    compose time.
 *
 * Additive only. RLS: SELECT for authenticated (global + own personal);
 * writes go through notify-service endpoints (service role).
 */
const SQL = `
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS contact_id bigint;
ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS company_id bigint;

CREATE TABLE IF NOT EXISTS public.email_template (
  template_id   serial PRIMARY KEY,
  name          text NOT NULL,
  subject       text NOT NULL DEFAULT '',
  body          text NOT NULL DEFAULT '',
  scope         text NOT NULL DEFAULT 'personal' CHECK (scope IN ('global','personal')),
  owner_user_id bigint,           -- profiles.user_id for personal templates; NULL for global
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY email_template_select ON public.email_template
    FOR SELECT TO authenticated
    USING (scope = 'global' OR owner_user_id = current_user_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;
async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT');
    console.log('✅ email_log +contact_id/company_id; email_template created (RLS on)');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ rolled back:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
}
if (require.main === module && process.argv.includes('--apply')) main();
else console.log('STAGED — run with --apply (additive, ALT-509/510).');
