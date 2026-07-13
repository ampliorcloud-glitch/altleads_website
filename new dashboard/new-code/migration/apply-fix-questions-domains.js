'use strict';
/**
 * apply-fix-questions-domains.js — 2026-06-18
 * ===========================================
 * Fixes two admin-panel breakages (see REBUILD_LOG 2026-06-18, ALT-143/ALT-144):
 *   (1) pre_sales_question was missing the `is_active` column the Questions tab
 *       selects/inserts/updates → 42703 → empty tab, no edits. Add it.
 *   (2) pre_sales_question + domain_master still carried the legacy blanket
 *       `authenticated_full_access` (FOR ALL USING(true)) policy → any logged-in
 *       user could write reference data. Lock writes to admins (read stays open),
 *       matching the dropdown_option / user_role pattern from security-lockdown.
 *
 * Idempotent. Reuses public.is_admin() (security-lockdown.sql).
 * Run: node apply-fix-questions-domains.js   (needs PG_CONNECTION_STRING in .env)
 *
 * NOTE: the human-readable SQL also lives in fix-questions-domains.sql (gitignored,
 * like all *.sql here). This applier embeds it so the change is preserved in git.
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
ALTER TABLE public.pre_sales_question
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "authenticated_full_access" ON public.pre_sales_question;
DROP POLICY IF EXISTS "psq_select_authenticated"  ON public.pre_sales_question;
DROP POLICY IF EXISTS "psq_admin_insert"          ON public.pre_sales_question;
DROP POLICY IF EXISTS "psq_admin_update"          ON public.pre_sales_question;
DROP POLICY IF EXISTS "psq_admin_delete"          ON public.pre_sales_question;
CREATE POLICY "psq_select_authenticated" ON public.pre_sales_question
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "psq_admin_insert" ON public.pre_sales_question
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "psq_admin_update" ON public.pre_sales_question
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "psq_admin_delete" ON public.pre_sales_question
  FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "authenticated_full_access" ON public.domain_master;
DROP POLICY IF EXISTS "dom_select_authenticated"  ON public.domain_master;
DROP POLICY IF EXISTS "dom_admin_insert"          ON public.domain_master;
DROP POLICY IF EXISTS "dom_admin_update"          ON public.domain_master;
DROP POLICY IF EXISTS "dom_admin_delete"          ON public.domain_master;
CREATE POLICY "dom_select_authenticated" ON public.domain_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "dom_admin_insert" ON public.domain_master
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "dom_admin_update" ON public.domain_master
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "dom_admin_delete" ON public.domain_master
  FOR DELETE TO authenticated USING (public.is_admin());
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  try {
    await pg.query(SQL);
    console.log('fix-questions-domains applied ✅ (is_active added; admin-write RLS on pre_sales_question + domain_master)');
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  } finally {
    await pg.end();
  }
})();
