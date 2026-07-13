'use strict';
/**
 * apply-email-sending-domains.cjs — ALT-503/506 Phase 1 (ADR-35, 2026-07-03).
 *
 * Per-project domain-authenticated sending, benchmark model (HubSpot unlimited
 * authenticated domains / Odoo from_filter-per-domain):
 *
 *  - sending_domain        registry of domains we may send from. Each row keeps
 *                          its required DNS records as jsonb (provider-supplied
 *                          SPF/DKIM/DMARC), each with a verified flag; the row's
 *                          status flips to 'verified' only when ALL records
 *                          verify. Sending from an unverified domain is BLOCKED
 *                          in the send endpoint (deliverability guard).
 *  - project_email_setting one row per project → which sending_domain it uses.
 *                          No row → fallback domain (amplior.com / env default).
 *  - sending_alias         per-user override of the auto-derived alias
 *                          (default = local-part of the user's email on the
 *                          project's domain). Empty table = pure 3a behaviour.
 *
 * Additive only — new tables, no changes to existing objects.
 * RLS: authenticated users may SELECT (compose UI needs to show the From);
 * all writes go through notify-service admin endpoints (service role).
 */
const SQL = `
CREATE TABLE IF NOT EXISTS public.sending_domain (
  domain_id     serial PRIMARY KEY,
  domain        text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','disabled')),
  dns_records   jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{type:'TXT'|'CNAME', host, value, purpose:'spf'|'dkim'|'dmarc', verified:bool, seen?:text}]
  notes         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  verified_at   timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_email_setting (
  project_id    bigint PRIMARY KEY,
  domain_id     int NOT NULL REFERENCES public.sending_domain(domain_id),
  updated_by    uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sending_alias (
  alias_id      serial PRIMARY KEY,
  user_id       bigint NOT NULL,
  domain_id     int NOT NULL REFERENCES public.sending_domain(domain_id),
  alias         text NOT NULL,      -- local-part only (before the @)
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain_id)
);

ALTER TABLE public.sending_domain       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_email_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sending_alias        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY sending_domain_select ON public.sending_domain
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY project_email_setting_select ON public.project_email_setting
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sending_alias_select ON public.sending_alias
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;
async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT');
    console.log('✅ sending_domain + project_email_setting + sending_alias created (RLS on, select-only)');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ rolled back:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
}
if (require.main === module && process.argv.includes('--apply')) main();
else console.log('STAGED — run with --apply (additive tables for ALT-503/506).');
