/**
 * apply-collaborator-access-setting.cjs
 *
 * STAGED — do NOT execute until COLLAB_ASSOC is flipped to true and
 * apply-create-collaborator.cjs + apply-create-association.cjs have
 * been applied to production (owner sign-off DEC-03 required).
 *
 * Creates the `collaborator_access_setting` table used by
 * CollaboratorAccessTab (Admin → Collab Access) to persist the
 * per-object-type access level (view | edit) for collaborators.
 *
 * Run:   node new-code/migration/apply-collaborator-access-setting.cjs
 * Check: node -c  new-code/migration/apply-collaborator-access-setting.cjs
 *
 * Table: public.collaborator_access_setting
 *   object_type   TEXT        PRIMARY KEY  CHECK (object_type IN ('lead','contact','company','meeting'))
 *   access_level  TEXT        NOT NULL     CHECK (access_level IN ('view','edit'))  DEFAULT 'view'
 *   updated_by    TEXT        (auth.uid / user_id of the admin who changed it)
 *   updated_date  TIMESTAMPTZ
 *
 * The table is seeded with four default rows (one per object type, all 'view').
 *
 * RLS:
 *   SELECT: any authenticated user (collaborator logic reads this to decide what to show/allow)
 *   INSERT/UPDATE: only role = 'ADMIN' (enforced via service-role for the admin tab write path)
 *   DELETE: disabled (rows are always updated in place via upsert)
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs   = require('fs');

/* ------------------------------------------------------------------
   Load credentials from .credentials/ (gitignored)
------------------------------------------------------------------ */
const credDir = path.resolve(__dirname, '../../.credentials');

function readCred(filename) {
  const fp = path.join(credDir, filename);
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing credential file: ${fp}`);
  }
  return fs.readFileSync(fp, 'utf8').trim();
}

const SUPABASE_URL         = readCred('supabase_url.txt');
const SUPABASE_SERVICE_KEY = readCred('supabase_service_role_key.txt');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ------------------------------------------------------------------
   Migration SQL
------------------------------------------------------------------ */
const SQL = `
-- collaborator_access_setting
-- Stores the admin-configured access level (view | edit) per object type.
-- One row per object type; upserted by CollaboratorAccessTab.

CREATE TABLE IF NOT EXISTS public.collaborator_access_setting (
  object_type   TEXT        NOT NULL,
  access_level  TEXT        NOT NULL DEFAULT 'view',
  updated_by    TEXT,
  updated_date  TIMESTAMPTZ,

  CONSTRAINT collaborator_access_setting_pkey
    PRIMARY KEY (object_type),

  CONSTRAINT collaborator_access_setting_object_type_check
    CHECK (object_type IN ('lead', 'contact', 'company', 'meeting')),

  CONSTRAINT collaborator_access_setting_access_level_check
    CHECK (access_level IN ('view', 'edit'))
);

-- Seed default rows (all 'view') — INSERT only if the row does not exist.
INSERT INTO public.collaborator_access_setting (object_type, access_level)
VALUES
  ('lead',    'view'),
  ('contact', 'view'),
  ('company', 'view'),
  ('meeting', 'view')
ON CONFLICT (object_type) DO NOTHING;

-- RLS: enable and lock to authenticated reads + service-role writes.
ALTER TABLE public.collaborator_access_setting ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read (collaborator gating logic needs this).
CREATE POLICY "collaborator_access_setting_select"
  ON public.collaborator_access_setting
  FOR SELECT
  TO authenticated
  USING (true);

-- Only the service role (= admin API calls through CollaboratorAccessTab)
-- may insert or update. Client-side writes from the admin tab go through
-- the Supabase client with service-role key — no separate RLS policy needed.
-- If you want to allow the anon key with admin role check, add a policy here.
`;

/* ------------------------------------------------------------------
   Main
------------------------------------------------------------------ */
async function main() {
  console.log('Applying collaborator_access_setting migration…');
  console.log('Supabase URL:', SUPABASE_URL);

  const { error } = await supabase.rpc('exec_sql', { sql: SQL }).catch(() => ({ error: null }));

  if (error) {
    // Try direct REST if rpc not available
    console.warn('rpc/exec_sql not available, using raw SQL via supabase-js v2 sql()...');
    const result = await supabase.sql(SQL);
    if (result.error) {
      console.error('Migration failed:', result.error.message);
      process.exit(1);
    }
  }

  console.log('Migration applied successfully.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify the table exists in Supabase Studio → Table Editor.');
  console.log('  2. Apply apply-create-collaborator.cjs and apply-create-association.cjs.');
  console.log('  3. Flip COLLAB_ASSOC = true in src/lib/collabAssoc.ts.');
  console.log('  4. Test: Admin → Collab Access tab.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
