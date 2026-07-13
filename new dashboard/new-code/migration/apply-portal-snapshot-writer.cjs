'use strict';
/**
 * ALT-224 — Client Portal SNAPSHOT WRITER (the live path).
 *
 * DECISION D (LOCKED): the snapshot writer is a SECURITY DEFINER Postgres function fired
 * by a DB TRIGGER on the meeting source table. The browser NEVER writes snapshots; the
 * snapshot is therefore atomic + unbypassable (never forgotten at a call site).
 *
 * portal.write_meeting_snapshot(p_meeting_id bigint, p_source text) RETURNS void:
 *   reads the live meeting_master / meeting_schedule / lead_report / lead_master /
 *   company_master / location rows, denormalises project_id + client_assoc_id +
 *   assigned_user_id and the full mobile-app field set, and UPSERTs ONE row into
 *   portal.meeting_snapshot keyed by meeting_id, with snapshot_source = p_source.
 *
 * Join chain (from new-code/migration/schema.sql):
 *   meeting_master.meeting_id
 *     <- meeting_schedule.meeting_id  -> meeting_schedule.report_id
 *        -> lead_report.report_id     (assigned_user_id = lead_report.user_id, sales_intelligence, lead_id)
 *           -> lead_master.lead_id    (company_id, project_id, client_assoc_id, location_id, contact fields)
 *              -> company_master.company_id  (company fields)
 *              -> location.location_id       (address fields)
 *   pre_sales_answer (report_id) JOIN pre_sales_question -> pre_sales_qa jsonb + agenda_discussion.
 *
 * ============================================================================
 * MEETING_SCHEDULE FAN-OUT (reviewer MUST-FIX — was a cross-tenant mislabel risk).
 * ----------------------------------------------------------------------------
 * meeting_schedule.meeting_id is NULLABLE and NOT unique: a meeting that was rescheduled
 * has MULTIPLE meeting_schedule rows, potentially pointing at different report_ids / leads
 * (different client_assoc_id). The earlier writer did `LIMIT 1` with NO ORDER BY, so it
 * picked a NON-DETERMINISTIC schedule row and could stamp the snapshot with the WRONG
 * client_assoc_id — RLS would then faithfully serve that meeting to the WRONG client.
 * Fix: resolve a SINGLE, DETERMINISTIC schedule row (the latest non-deleted one, by
 * meeting_sched_id DESC) in a CTE, and ASSERT it resolves to exactly one tenant. If two
 * schedule rows for the same meeting resolve to different client_assoc_id values, the
 * writer RAISES (aborting the trigger/backfill) rather than silently mislabel.
 *
 * STARTED_AT CAST (reviewer MUST-FIX): meeting_date is `date`, meeting_time is free-text
 * varchar(255). `timestamptz + time` is NOT a valid Postgres operator, and `text::time`
 * throws on any non-HH:MM[:SS] value. Fixed via portal.safe_meeting_start(date, text):
 * (date + safely-parsed time)::timestamptz, returning date::timestamptz at 00:00 on a bad
 * time string instead of throwing.
 *
 * AFTER INSERT/UPDATE trigger on meeting_master calls the writer. DROP TRIGGER IF EXISTS first.
 *
 * Convention: single BEGIN/COMMIT; idempotent (OR REPLACE / DROP TRIGGER IF EXISTS);
 * embedded SQL; VERIFY after commit. RUN AFTER apply-portal-foundation.cjs (+ -rls).
 * RUN ONLY via `node apply-portal-snapshot-writer.cjs`.
 *
 * NOTE: several source columns are best-guess names from the plan/schema; each is marked
 *       '-- VERIFY column name' and must be confirmed in throwaway-login validation review.
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- ============================================================
-- 0. safe_meeting_start(d date, t text) — date + safely-parsed time => timestamptz.
--    meeting_time is free-text varchar; a bad value must NOT abort the writer/backfill.
--    IMMUTABLE so it can be used freely; returns 00:00 on unparseable time text.
-- ============================================================
CREATE OR REPLACE FUNCTION portal.safe_meeting_start(d date, t text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $sf$
DECLARE
  v_time time := time '00:00';
BEGIN
  IF d IS NULL THEN
    RETURN NULL;
  END IF;
  IF t IS NOT NULL AND btrim(t) <> '' THEN
    BEGIN
      v_time := btrim(t)::time;
    EXCEPTION WHEN OTHERS THEN
      v_time := time '00:00';            -- dirty free-text time -> midnight, never throw
    END;
  END IF;
  RETURN (d + v_time)::timestamptz;      -- date + time => timestamp, then cast (valid operator)
END;
$sf$;
REVOKE EXECUTE ON FUNCTION portal.safe_meeting_start(date, text) FROM PUBLIC;

-- ============================================================
-- 1. portal.write_meeting_snapshot(p_meeting_id, p_source) — SECURITY DEFINER upsert.
--    p_source defaults to 'live'; the backfill applier calls it with 'backfill'.
-- ============================================================
CREATE OR REPLACE FUNCTION portal.write_meeting_snapshot(
  p_meeting_id bigint,
  p_source     text DEFAULT 'live'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal, public
AS $fn$
DECLARE
  v_report_id  bigint;
  v_tenants    int;
  v_qa         jsonb;
  v_agenda     text;
BEGIN
  IF p_meeting_id IS NULL THEN
    RETURN;
  END IF;

  -- ---- Resolve ONE deterministic schedule row (latest non-deleted) -> its report_id ----
  -- Latest by meeting_sched_id DESC. report_id may itself be NULL on a schedule row, so we
  -- prefer the latest schedule that actually carries a report_id.
  SELECT msch.report_id
  INTO   v_report_id
  FROM   public.meeting_schedule msch
  WHERE  msch.meeting_id = p_meeting_id
    AND  msch.deleted_date IS NULL
    AND  msch.report_id IS NOT NULL
  ORDER BY msch.meeting_sched_id DESC
  LIMIT 1;

  -- ---- Single-tenant assertion: if multiple non-deleted schedule rows for this meeting
  --      resolve to DIFFERENT client_assoc_id values, refuse to snapshot (no silent mislabel).
  SELECT count(DISTINCT lm.client_assoc_id)
  INTO   v_tenants
  FROM   public.meeting_schedule msch
  JOIN   public.lead_report lr ON lr.report_id = msch.report_id AND lr.deleted_date IS NULL
  JOIN   public.lead_master lm ON lm.lead_id   = lr.lead_id     AND lm.deleted_date IS NULL
  WHERE  msch.meeting_id = p_meeting_id
    AND  msch.deleted_date IS NULL
    AND  msch.report_id IS NOT NULL;

  IF v_tenants > 1 THEN
    RAISE EXCEPTION
      'portal.write_meeting_snapshot: meeting_id % resolves to % distinct client_assoc_id values via meeting_schedule; refusing to snapshot (cross-tenant mislabel risk).',
      p_meeting_id, v_tenants;
  END IF;

  IF v_report_id IS NULL THEN
    -- No usable schedule/report link -> nothing to snapshot (would also fail NOT NULL on client_assoc_id).
    RETURN;
  END IF;

  -- Pre-sales Q&A (jsonb array) + the "Discussion"/agenda answer, by the resolved report_id.
  -- pre_sales_answer.report_id -> pre_sales_question.pre_sa_que_id (-> question/short_question).
  SELECT
    jsonb_agg(jsonb_build_object(
      'question',       psq.question,
      'short_question', psq.short_question,
      'answer',         psa.answer
    ) ORDER BY psa.pre_sa_ans_id),
    max(CASE WHEN psq.short_question = 'Discussion' THEN psa.answer END)
  INTO v_qa, v_agenda
  FROM public.pre_sales_answer  psa
  JOIN public.pre_sales_question psq ON psq.pre_sa_que_id = psa.pre_sa_que_id
  WHERE psa.report_id = v_report_id
    AND psa.deleted_date IS NULL;

  INSERT INTO portal.meeting_snapshot AS tgt (
    meeting_id, report_id, lead_id,
    project_id, client_assoc_id, assigned_user_id,
    snapshot_source, started_at, captured_at, snapshot_taken_at,
    -- company
    company_id, company_name, company_industry, company_sector, company_sub_industry,
    company_city, company_turnover, company_size, company_web_url, company_linkedin_url,
    company_description,
    -- address
    address_line_one, address_line_two, address_city, address_state, address_country,
    -- lead / contact
    lead_name, lead_designation, lead_email, lead_mobile_no, lead_alt_mobile_no,
    lead_linkedin_url, lead_role_and_resp, lead_area_of_interest,
    -- opportunity
    opportunity_title, opportunity_value, opportunity_description, sales_intelligence,
    -- meeting
    meeting_name, meeting_date, meeting_time, meeting_duration, meeting_mode,
    meeting_status, meeting_url, meeting_description, meeting_reason,
    scheduled_by_name, assigned_rep_name,
    -- pre-sales
    pre_sales_qa, agenda_discussion,
    created_by, created_date
  )
  SELECT
    mm.meeting_id,
    lr.report_id,
    lm.lead_id,
    lm.project_id,
    lm.client_assoc_id,
    lr.user_id,                                              -- assigned salesperson
    p_source,
    -- started_at = meeting date + safely-parsed time (drives the feedback gate).
    portal.safe_meeting_start(mm.meeting_date, mm.meeting_time),
    now(), now(),
    -- company
    cm.company_id,
    cm.company_name,
    NULL,                                                    -- VERIFY company_industry: industry_id -> industry name (lookup join TBD)
    NULL,                                                    -- VERIFY company_sector: sector_id -> company_sector.sector
    NULL,                                                    -- VERIFY company_sub_industry: sub_industry_id -> name
    NULL,                                                    -- VERIFY company_city: city_id -> city name
    NULL,                                                    -- VERIFY company_turnover: turnover_id -> label
    cm.company_size::text,
    cm.company_web_url,
    cm.linkedin_url,
    cm.description,
    -- address (from lead_master.location_id -> location)
    loc.address_line_one,
    loc.address_line_two,
    NULL,                                                    -- VERIFY address_city
    NULL,                                                    -- VERIFY address_state
    NULL,                                                    -- VERIFY address_country
    -- lead / contact (lead_master IS the contact record in this schema)
    lm.lead_name,
    lm.designation,                                          -- VERIFY: lead_designation_id -> designation_master.designation_name preferred
    lm.email,
    lm.mobile_no,
    lm.alt_mobile_no,
    lm.linkedin_url,
    lm.role_and_resp,
    lm.area_of_interest,
    -- opportunity
    lm.title,
    lm.value,
    lm.description,
    lr.sales_intelligence,
    -- meeting
    mm.meeting_name,
    mm.meeting_date,
    mm.meeting_time,
    mm.duration,
    mm.meeting_mode,
    mm.meeting_status,
    mm.meeting_url,
    mm.description,
    mm.reason,
    NULL,                                                    -- VERIFY scheduled_by_name: lead_report.created_by -> user full name lookup
    NULL,                                                    -- VERIFY assigned_rep_name: lead_report.user_id -> user full name lookup
    -- pre-sales
    v_qa,
    v_agenda,
    'snapshot_writer',
    now()
  FROM public.meeting_master   mm
  JOIN public.lead_report      lr   ON lr.report_id   = v_report_id  AND lr.deleted_date IS NULL
  JOIN public.lead_master      lm   ON lm.lead_id      = lr.lead_id   AND lm.deleted_date IS NULL
  LEFT JOIN public.company_master cm ON cm.company_id  = lm.company_id   AND cm.deleted_date IS NULL
  LEFT JOIN public.location    loc  ON loc.location_id = lm.location_id  AND loc.deleted_date IS NULL
  WHERE mm.meeting_id = p_meeting_id
    AND mm.deleted_date IS NULL
  ON CONFLICT (meeting_id) DO UPDATE SET
    report_id             = EXCLUDED.report_id,
    lead_id               = EXCLUDED.lead_id,
    project_id            = EXCLUDED.project_id,
    client_assoc_id       = EXCLUDED.client_assoc_id,
    assigned_user_id      = EXCLUDED.assigned_user_id,
    snapshot_source       = EXCLUDED.snapshot_source,
    started_at            = EXCLUDED.started_at,
    snapshot_refreshed_at = now(),
    company_id            = EXCLUDED.company_id,
    company_name          = EXCLUDED.company_name,
    company_industry      = EXCLUDED.company_industry,
    company_sector        = EXCLUDED.company_sector,
    company_sub_industry  = EXCLUDED.company_sub_industry,
    company_city          = EXCLUDED.company_city,
    company_turnover      = EXCLUDED.company_turnover,
    company_size          = EXCLUDED.company_size,
    company_web_url       = EXCLUDED.company_web_url,
    company_linkedin_url  = EXCLUDED.company_linkedin_url,
    company_description   = EXCLUDED.company_description,
    address_line_one      = EXCLUDED.address_line_one,
    address_line_two      = EXCLUDED.address_line_two,
    address_city          = EXCLUDED.address_city,
    address_state         = EXCLUDED.address_state,
    address_country       = EXCLUDED.address_country,
    lead_name             = EXCLUDED.lead_name,
    lead_designation      = EXCLUDED.lead_designation,
    lead_email            = EXCLUDED.lead_email,
    lead_mobile_no        = EXCLUDED.lead_mobile_no,
    lead_alt_mobile_no    = EXCLUDED.lead_alt_mobile_no,
    lead_linkedin_url     = EXCLUDED.lead_linkedin_url,
    lead_role_and_resp    = EXCLUDED.lead_role_and_resp,
    lead_area_of_interest = EXCLUDED.lead_area_of_interest,
    opportunity_title     = EXCLUDED.opportunity_title,
    opportunity_value     = EXCLUDED.opportunity_value,
    opportunity_description = EXCLUDED.opportunity_description,
    sales_intelligence    = EXCLUDED.sales_intelligence,
    meeting_name          = EXCLUDED.meeting_name,
    meeting_date          = EXCLUDED.meeting_date,
    meeting_time          = EXCLUDED.meeting_time,
    meeting_duration      = EXCLUDED.meeting_duration,
    meeting_mode          = EXCLUDED.meeting_mode,
    meeting_status        = EXCLUDED.meeting_status,
    meeting_url           = EXCLUDED.meeting_url,
    meeting_description   = EXCLUDED.meeting_description,
    meeting_reason        = EXCLUDED.meeting_reason,
    scheduled_by_name     = EXCLUDED.scheduled_by_name,
    assigned_rep_name     = EXCLUDED.assigned_rep_name,
    pre_sales_qa          = EXCLUDED.pre_sales_qa,
    agenda_discussion     = EXCLUDED.agenda_discussion,
    updated_by            = 'snapshot_writer',
    updated_date          = now();
END;
$fn$;

-- Lock down EXECUTE: SECURITY DEFINER + EXECUTE-to-PUBLIC default would let any portal/
-- authenticated session call write_meeting_snapshot(<any meeting_id>) and force-refresh /
-- tamper with arbitrary snapshot rows under definer privileges (DoS / data tampering).
-- Only service_role may invoke it (the trigger runs as table owner, not via this grant).
REVOKE EXECUTE ON FUNCTION portal.write_meeting_snapshot(bigint, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION portal.write_meeting_snapshot(bigint, text) TO service_role;

-- ============================================================
-- 2. Trigger function + AFTER INSERT/UPDATE trigger on the meeting source table.
--    The browser never writes snapshots; this fires on every meeting create/edit.
-- ============================================================
CREATE OR REPLACE FUNCTION portal.trg_write_meeting_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = portal, public
AS $trg$
BEGIN
  -- Snapshot is 'live' for all trigger-driven writes (backfill calls the writer directly).
  PERFORM portal.write_meeting_snapshot(NEW.meeting_id, 'live');
  RETURN NEW;
END;
$trg$;

-- Trigger functions are EXECUTE-to-PUBLIC by default; a direct call outside trigger context
-- would run definer-privileged. Only the trigger machinery needs it.
REVOKE EXECUTE ON FUNCTION portal.trg_write_meeting_snapshot() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION portal.trg_write_meeting_snapshot() TO service_role;

DROP TRIGGER IF EXISTS meeting_snapshot_aiu ON public.meeting_master;
CREATE TRIGGER meeting_snapshot_aiu
  AFTER INSERT OR UPDATE ON public.meeting_master
  FOR EACH ROW
  EXECUTE FUNCTION portal.trg_write_meeting_snapshot();
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED apply-portal-snapshot-writer OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // VERIFY: writer + trigger + helper functions exist, SECURITY DEFINER, NOT executable by PUBLIC.
  const fns = await client.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef,
            has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='portal'
       AND p.proname IN ('write_meeting_snapshot','trg_write_meeting_snapshot','safe_meeting_start')
     ORDER BY p.proname`);
  console.log('\n=== snapshot writer FUNCTIONS (AFTER — public_can_execute should be false) ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  // VERIFY: trigger present on meeting_master
  const trg = await client.query(
    `SELECT t.tgname, c.relname AS on_table, t.tgenabled
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname='public' AND c.relname='meeting_master'
       AND t.tgname='meeting_snapshot_aiu'`);
  console.log('\n=== meeting_master TRIGGER (AFTER) ===');
  console.log(JSON.stringify(trg.rows, null, 2));

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
