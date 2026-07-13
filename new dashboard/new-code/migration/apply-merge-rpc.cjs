'use strict';
/**
 * apply-merge-rpc.cjs — ALT-416 atomic record-merge RPC (STAGED).
 *
 * ============================ DO NOT AUTO-RUN ============================
 * This is a STAGED migration. Launch posture = MANUAL deploys. It must be run
 * by hand AFTER owner sign-off + throwaway-login validation (an admin login
 * runs a real merge; a non-admin login is REJECTED with 42501). Show the owner
 * first. Running it in production without that gate is forbidden. Nothing in
 * the build pipeline invokes this file.
 * ========================================================================
 *
 * THE PROBLEM (ALT-416): new-code/web/src/data/merge.ts merges two duplicate
 * records (companies OR contacts) as a CLIENT-SIDE SEQUENCE of independent
 * Supabase calls — re-point each child FK, then soft-delete the loser. It is
 * NOT a transaction: a crash / network drop / RLS rejection midway leaves the
 * data HALF-MERGED (some children moved, loser still alive, or vice-versa) with
 * NO automatic rollback.
 *
 * WHAT THIS DOES: defines public.merge_records(...) — a SECURITY DEFINER
 * function that performs the SAME FK re-points + loser soft-delete that
 * merge.ts does today, but inside ONE server-side transaction (a SQL function
 * body runs atomically: it commits whole or, on any error, the whole statement
 * — and thus every UPDATE inside it — rolls back). It returns a small JSON
 * summary of how many rows were re-pointed per relationship.
 *
 * Re-points (MUST match merge.ts exactly — verified against the data layer):
 *
 *   COMPANY merge (loser company_id → survivor company_id):
 *     - contact_master.company_id
 *     - company_project_status.company_id   UNIQUE(company_id, project_id)
 *     - lead_master.company_id
 *     - interaction.record_id  WHERE record_type='company'
 *     (lead_master.client_assoc_id is NOT a company FK — left untouched, as in
 *      merge.ts.)
 *
 *   CONTACT merge (loser contact_id → survivor contact_id):
 *     - lead_master.contact_id
 *     - contact_project_status.contact_id   UNIQUE(contact_id, project_id)
 *     - interaction.record_id  WHERE record_type='contact'
 *
 * PER-PROJECT STATUS COLLISION (census bug D2 — handled HERE, unlike merge.ts):
 *   *_project_status has UNIQUE(record_id, project_id). If the loser AND the
 *   survivor BOTH already have a status row for the SAME project, a blunt
 *   `UPDATE … SET <id_col> = survivor WHERE <id_col> = loser` raises 23505 and
 *   (in merge.ts) ABORTS the whole merge. Here we instead SKIP the colliding
 *   child: we only re-point the loser's status rows for projects the survivor
 *   does NOT already cover, and DELETE the loser's leftover colliding rows
 *   (the survivor's status wins). The count of skipped/merged rows is reported.
 *
 * Audit: re-pointed rows on tables that carry updated_by/updated_date get them
 * stamped with p_actor / now() (matching merge.ts). The interaction table has
 * no such columns, so only record_id moves (matching merge.ts).
 *
 * SECURITY: SECURITY DEFINER so the function can re-point rows the calling admin
 * may not directly own under RLS, but EXECUTE is REVOKED from PUBLIC/anon and
 * GRANTed only to authenticated. The body itself enforces admin-only via
 * public.is_admin(); a non-admin caller is rejected (mapped to 42501).
 *
 * USAGE:  node apply-merge-rpc.cjs             (apply, staged/manual)
 *         node apply-merge-rpc.cjs --rollback  (DROP the function)
 *
 * Mirrors apply-assignment-rls.cjs / apply-task-rls.cjs: single BEGIN/COMMIT,
 * ROLLBACK on error, VERIFY (pg_proc + grants) after. Idempotent.
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- =====================================================================
-- ALT-416 — ATOMIC RECORD MERGE (SECURITY DEFINER RPC)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.merge_records(
  p_record_type text,
  p_survivor_id bigint,
  p_loser_id    bigint,
  p_actor       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now           timestamptz := now();
  v_repointed     jsonb := '{}'::jsonb;
  n_contacts      bigint := 0;
  n_company_ps    bigint := 0;
  n_contact_ps    bigint := 0;
  n_leads         bigint := 0;
  n_interactions  bigint := 0;
  n_ps_skipped    bigint := 0;
BEGIN
  -- ── Admin-only (mapped to a friendly "admin only" on the client). ──
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'merge_records is admin-only'
      USING ERRCODE = '42501';
  END IF;

  -- ── Guard rails. ──
  IF p_record_type NOT IN ('company','contact') THEN
    RAISE EXCEPTION 'merge_records: unknown record type %', p_record_type
      USING ERRCODE = '22023';
  END IF;
  IF p_survivor_id IS NULL OR p_loser_id IS NULL THEN
    RAISE EXCEPTION 'merge_records: survivor and loser ids are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_survivor_id = p_loser_id THEN
    RAISE EXCEPTION 'merge_records: pick two different records to merge'
      USING ERRCODE = '22023';
  END IF;

  -- ============================== COMPANY ==============================
  IF p_record_type = 'company' THEN
    -- contact_master.company_id
    UPDATE public.contact_master
       SET company_id = p_survivor_id, updated_by = p_actor, updated_date = v_now
     WHERE company_id = p_loser_id;
    GET DIAGNOSTICS n_contacts = ROW_COUNT;

    -- company_project_status.company_id — handle UNIQUE(company_id, project_id)
    -- collision (D2): drop the loser's rows for projects the survivor already
    -- has, then move the rest.
    DELETE FROM public.company_project_status l
     WHERE l.company_id = p_loser_id
       AND EXISTS (
         SELECT 1 FROM public.company_project_status s
          WHERE s.company_id = p_survivor_id
            AND s.project_id = l.project_id);
    GET DIAGNOSTICS n_ps_skipped = ROW_COUNT;

    UPDATE public.company_project_status
       SET company_id = p_survivor_id, updated_by = p_actor, updated_date = v_now
     WHERE company_id = p_loser_id;
    GET DIAGNOSTICS n_company_ps = ROW_COUNT;

    -- lead_master.company_id
    UPDATE public.lead_master
       SET company_id = p_survivor_id, updated_by = p_actor, updated_date = v_now
     WHERE company_id = p_loser_id;
    GET DIAGNOSTICS n_leads = ROW_COUNT;

    -- interaction rows (record_type='company') — no audit cols, move record_id only
    UPDATE public.interaction
       SET record_id = p_survivor_id
     WHERE record_type = 'company' AND record_id = p_loser_id;
    GET DIAGNOSTICS n_interactions = ROW_COUNT;

    -- soft-delete the loser LAST
    UPDATE public.company_master
       SET deleted_by = p_actor, deleted_date = v_now
     WHERE company_id = p_loser_id AND deleted_date IS NULL;

    v_repointed := jsonb_build_object(
      'contact_master.company_id',           n_contacts,
      'company_project_status.company_id',   n_company_ps,
      'company_project_status.skipped',      n_ps_skipped,
      'lead_master.company_id',              n_leads,
      'interaction(company).record_id',      n_interactions
    );

  -- ============================== CONTACT ==============================
  ELSE
    -- lead_master.contact_id
    UPDATE public.lead_master
       SET contact_id = p_survivor_id, updated_by = p_actor, updated_date = v_now
     WHERE contact_id = p_loser_id;
    GET DIAGNOSTICS n_leads = ROW_COUNT;

    -- contact_project_status.contact_id — handle UNIQUE(contact_id, project_id)
    -- collision (D2) the same way as company.
    DELETE FROM public.contact_project_status l
     WHERE l.contact_id = p_loser_id
       AND EXISTS (
         SELECT 1 FROM public.contact_project_status s
          WHERE s.contact_id = p_survivor_id
            AND s.project_id = l.project_id);
    GET DIAGNOSTICS n_ps_skipped = ROW_COUNT;

    UPDATE public.contact_project_status
       SET contact_id = p_survivor_id, updated_by = p_actor, updated_date = v_now
     WHERE contact_id = p_loser_id;
    GET DIAGNOSTICS n_contact_ps = ROW_COUNT;

    -- interaction rows (record_type='contact')
    UPDATE public.interaction
       SET record_id = p_survivor_id
     WHERE record_type = 'contact' AND record_id = p_loser_id;
    GET DIAGNOSTICS n_interactions = ROW_COUNT;

    -- soft-delete the loser LAST
    UPDATE public.contact_master
       SET deleted_by = p_actor, deleted_date = v_now
     WHERE contact_id = p_loser_id AND deleted_date IS NULL;

    v_repointed := jsonb_build_object(
      'lead_master.contact_id',              n_leads,
      'contact_project_status.contact_id',   n_contact_ps,
      'contact_project_status.skipped',      n_ps_skipped,
      'interaction(contact).record_id',      n_interactions
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',         true,
    'type',       p_record_type,
    'survivorId', p_survivor_id,
    'loserId',    p_loser_id,
    'repointed',  v_repointed
  );
END;
$$;

-- ---------------------------------------------------------------------
-- GRANTS — explicit-grant discipline (mirror apply-create-task-table.cjs):
--   anon/PUBLIC must never hold EXECUTE; authenticated may call it. The body
--   itself gates to is_admin(), so a non-admin authenticated caller is rejected.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.merge_records(text, bigint, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_records(text, bigint, bigint, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_records(text, bigint, bigint, text) TO authenticated;
`;

// Drops the function. Use if validation fails or to fully revert.
const ROLLBACK_SQL = `
DROP FUNCTION IF EXISTS public.merge_records(text, bigint, bigint, text);
`;

(async () => {
  const rollback = process.argv.includes('--rollback');
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(rollback ? ROLLBACK_SQL : SQL);
    await client.query('COMMIT');
    console.log(rollback ? 'ROLLED BACK merge-rpc OK (committed).' : 'APPLIED merge-rpc OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('OPERATION FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // === VERIFY: function exists, SECURITY DEFINER, signature ===
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
            p.provolatile, p.prosecdef, pg_get_function_result(p.oid) AS returns
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname = 'merge_records'
     ORDER BY p.proname`);
  console.log('\n=== merge_records FUNCTION (AFTER) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // === VERIFY: EXECUTE grants (anon/PUBLIC must hold NONE; authenticated YES) ===
  const grants = await client.query(
    `SELECT r.routine_name, p.grantee, p.privilege_type
     FROM information_schema.routine_privileges p
     JOIN information_schema.routines r
       ON r.specific_name = p.specific_name AND r.specific_schema = p.specific_schema
     WHERE r.routine_schema='public' AND r.routine_name='merge_records'
       AND p.grantee IN ('anon','authenticated','PUBLIC')
     ORDER BY p.grantee, p.privilege_type`);
  console.log('\n=== merge_records GRANTS (AFTER) ===');
  console.log(JSON.stringify(grants.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
