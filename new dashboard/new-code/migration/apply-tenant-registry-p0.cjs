'use strict';
/** apply-tenant-registry-p0.cjs — ALT-522 P0 (ADR-36, 2026-07-06).
 *
 *  Multi-tenancy T2, phase 0: the tenant registry ONLY.
 *  - `tenant` table; row 1 = Amplior (us). Every future customer = a row here.
 *  - ADDITIVE + INERT: no existing table, query, or RLS policy is touched, so
 *    the live CRM cannot be affected. The P1 retrofit (tenant_id + RLS across
 *    existing tables) is a separate, staged, post-beta project.
 *  - Standing rule from today (ONBOARDING.md §3): every NEW table is born with
 *    `tenant_id int NOT NULL DEFAULT 1 REFERENCES tenant(tenant_id)`.
 */
const SQL = `
CREATE TABLE IF NOT EXISTS public.tenant (
  tenant_id   serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.tenant (tenant_id, name, slug)
  VALUES (1, 'Amplior', 'amplior')
  ON CONFLICT (tenant_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('public.tenant','tenant_id'), GREATEST(1, (SELECT MAX(tenant_id) FROM public.tenant)));
ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;
`;
async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT');
    console.log('✅ tenant registry created; tenant 1 = Amplior (additive, inert)');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ rolled back:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
}
if (require.main === module && process.argv.includes('--apply')) main();
else console.log('STAGED — run with --apply (ALT-522 P0, additive only).');
