'use strict';
/** apply-sending-ladder-prep.cjs — board entry 6 (2026-07-03): unified sending ladder.
 *
 *  1. sending_domain.provider — which org hosts this domain's mailboxes:
 *     'google' | 'microsoft' | 'relay' (relay = domain has no real mailboxes,
 *     send via SMTP relay only). Drives which connector a user is offered.
 *  2. user_mailbox_connection — one row per user per domain: their connected
 *     mailbox (OAuth). Tokens are stored SERVER-SIDE ONLY (service role); RLS
 *     exposes existence/status to the owner, never tokens.
 *  Additive only. OAuth flows themselves = ALT-519 (Google) / ALT-520 (Microsoft).
 */
const SQL = `
ALTER TABLE public.sending_domain
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'relay'
  CHECK (provider IN ('google','microsoft','relay'));

CREATE TABLE IF NOT EXISTS public.user_mailbox_connection (
  connection_id serial PRIMARY KEY,
  user_id       bigint NOT NULL,
  domain_id     int REFERENCES public.sending_domain(domain_id),
  provider      text NOT NULL CHECK (provider IN ('google','microsoft')),
  mailbox_email text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','error')),
  access_token  text,   -- server-side use only (RLS hides the row's tokens via column omission in views if ever exposed)
  refresh_token text,
  token_expires_at timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain_id)
);
ALTER TABLE public.user_mailbox_connection ENABLE ROW LEVEL SECURITY;
-- NO select policy for authenticated on purpose: tokens must never reach the
-- client. Connection status is served by notify-service endpoints only.
`;
async function main() {
  require('dotenv').config();
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await c.connect();
  try {
    await c.query('BEGIN'); await c.query(SQL); await c.query('COMMIT');
    console.log('✅ sending_domain.provider + user_mailbox_connection (RLS locked)');
  } catch (e) { await c.query('ROLLBACK'); console.error('❌ rolled back:', e.message); process.exitCode = 1; }
  finally { await c.end(); }
}
if (require.main === module && process.argv.includes('--apply')) main();
else console.log('STAGED — run with --apply.');
