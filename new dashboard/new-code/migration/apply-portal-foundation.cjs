'use strict';
/**
 * ALT-222 / ALT-223 / ALT-226 / ALT-228 — Client Portal FOUNDATION (schema + tables + views + grants).
 *
 * Creates the `portal` schema and its base tables:
 *   - portal.client_portal_user  (one Supabase Auth user -> one client + one portal role)
 *   - portal.meeting_snapshot    (denormalised, isolation-bearing photograph of a meeting)
 *   - portal.notification        (portal-owned notifications; NOT the CRM in_app_notification table)
 * plus the curated SECURITY INVOKER portal_* views that clients read, and the grants
 * that give the connecting Supabase role (`authenticated`) USAGE on the schema + SELECT
 * on the VIEWS ONLY (ZERO grants on any base public table, and ZERO grants on the portal
 * base meeting_snapshot / client_portal_user tables).
 *
 * ============================================================================
 * ROLE / IDENTITY BRIDGE (reviewer MUST-FIX — was the existential gap)
 * ----------------------------------------------------------------------------
 * Supabase issues every logged-in user a JWT with `role=authenticated`. There is NO
 * separate Postgres login role for portal users, and PostgREST connects as `authenticated`.
 * The earlier design targeted a custom `portal_client` role that NOTHING ever bridged to
 * `authenticated`, so a real portal login would have matched no policy/grant (see nothing),
 * and any later "fix" that granted `authenticated -> portal_client` would have INHERITED the
 * CRM's permissive `company_master`/`contact_master` `FOR SELECT TO authenticated USING(true)`
 * base-table policies and leaked every tenant's data.
 *
 * Bridge decided + encoded here and in apply-portal-rls.cjs:
 *   (1) The connecting role for BOTH CRM staff and portal clients is `authenticated`.
 *   (2) A session is a *portal session* iff `portal.caller_client_assoc_id() IS NOT NULL`
 *       (i.e. there is an enabled portal.client_portal_user row for auth.uid()).
 *   (3) ALL portal policies are `TO authenticated` and require that the session IS a portal
 *       session (caller_client_assoc_id() IS NOT NULL) PLUS the per-role scope.
 *   (4) apply-portal-rls.cjs adds a RESTRICTIVE "deny portal sessions" policy to EVERY
 *       RLS-enabled public.* base table, so a portal session fails every CRM base-table
 *       policy and can NEVER read public.company_master / contact_master / lead_master /
 *       etc. directly — it can only read the portal.* views, scoped to its own tenant.
 *   (5) The custom `portal_client` role is REMOVED. It was unbridged and dangerous; keeping
 *       it invited the "grant authenticated -> portal_client" footgun above.
 *
 * PORTAL SCHEMA EXPOSURE (reviewer MUST-FIX): PostgREST only exposes `public` by default.
 * For the Supabase JS/REST client to read portal.* views, the `portal` schema MUST be added
 * to the API "Exposed schemas" (Supabase Dashboard -> Settings -> API -> Exposed schemas:
 * add `portal`), and the API roles need USAGE on the schema (granted below to `authenticated`
 * and `service_role`). This file grants USAGE + view SELECT to `authenticated`; the dashboard
 * "Exposed schemas" change is a deploy-time step recorded in REBUILD_LOG. Until `portal` is
 * exposed, the portal is reachable only via the service/admin API (service_role), which is
 * also granted below.
 *
 * Field set (ALT-243 LOCKED): clients see the FULL set the vendor MOBILE app surfaced
 * (old-code/amplior-mobile-app-main/src/screens/meetings/MeetingDetails.jsx) — company,
 * lead/contact, opportunity, meeting, and the pre-sales Q&A. Denormalised onto every row.
 *
 * Isolation columns (project_id + client_assoc_id + assigned_user_id) are on EVERY
 * meeting_snapshot row so the RLS filter is on the snapshot itself, never a join back
 * to shared tables. RLS itself is applied by apply-portal-rls.cjs (run AFTER this).
 *
 * Convention: single BEGIN/COMMIT; idempotent (IF NOT EXISTS / OR REPLACE / DO-guards);
 * embedded SQL; VERIFY after commit. Mirrors apply-access-rls.js.
 *
 * RUN ONLY via `node apply-portal-foundation.cjs` — this file does not self-execute on import.
 */
require('dotenv').config();
const { Pool } = require('pg');

const SQL = `
-- ============================================================
-- 0. Schema. (No custom portal_client role — Supabase connects portal users as the
--    built-in 'authenticated' role; see ROLE / IDENTITY BRIDGE in the file header.)
--    Clean up any pre-existing portal_client role grants from earlier drafts so a
--    re-run leaves no unbridged role behind. The role is dropped only if it owns
--    nothing and is not referenced (REASSIGN/DROP OWNED guarded).
-- ============================================================
CREATE SCHEMA IF NOT EXISTS portal;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_client') THEN
    -- Revoke anything earlier drafts may have granted, then drop the unused role.
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA portal FROM portal_client';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA portal FROM portal_client';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA portal FROM portal_client';
    EXECUTE 'REVOKE USAGE ON SCHEMA portal FROM portal_client';
    BEGIN
      EXECUTE 'DROP ROLE portal_client';
    EXCEPTION WHEN OTHERS THEN
      -- role still referenced somewhere unexpected; leave it but it now holds NO grants.
      RAISE NOTICE 'portal_client retained (still referenced); all grants revoked.';
    END;
  END IF;
END$$;

-- ============================================================
-- 1. portal.client_portal_user  (ALT-222)
--    Ties exactly one Supabase Auth user (auth_uid) to one client (client_assoc_id)
--    and one portal role. Route guard accepts only enabled rows.
-- ============================================================
CREATE TABLE IF NOT EXISTS portal.client_portal_user (
  client_portal_user_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  auth_uid        uuid NOT NULL,                       -- = auth.users.id (Supabase Auth)
  user_id         bigint NOT NULL,                     -- = public.user_master / lead_report.user_id (assigned-salesperson identity)
  client_assoc_id bigint NOT NULL,                     -- FK -> public.client_association.client_assoc_id  -- VERIFY column name
  portal_role     text NOT NULL
                  CHECK (portal_role IN ('COMPANY_ADMIN','SALES_HEAD','SALES_PERSON')),
  enabled         boolean NOT NULL DEFAULT true,
  -- audit
  created_by      text DEFAULT NULL,
  created_date    timestamptz NOT NULL DEFAULT now(),
  updated_by      text DEFAULT NULL,
  updated_date    timestamptz DEFAULT NULL,
  deleted_by      text DEFAULT NULL,
  deleted_date    timestamptz DEFAULT NULL,
  UNIQUE (auth_uid)
);
CREATE INDEX IF NOT EXISTS cpu_auth_uid_idx        ON portal.client_portal_user (auth_uid);
CREATE INDEX IF NOT EXISTS cpu_client_assoc_idx    ON portal.client_portal_user (client_assoc_id);
CREATE INDEX IF NOT EXISTS cpu_user_id_idx         ON portal.client_portal_user (user_id);

-- ============================================================
-- 2. portal.meeting_snapshot  (ALT-223)  — the load-bearing isolation table.
--    One row per generated meeting. Company/contact/lead/meeting fields are COPIED
--    (denormalised), never referenced, so the portal never queries shared tables.
--    Isolation columns project_id + client_assoc_id + assigned_user_id on EVERY row.
-- ============================================================
CREATE TABLE IF NOT EXISTS portal.meeting_snapshot (
  snapshot_id      bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,

  -- identity / linkage (kept for upsert + server-side reconciliation only; not exposed raw to clients beyond meeting_id)
  meeting_id       bigint NOT NULL,                    -- FK -> public.meeting_master.meeting_id
  report_id        bigint DEFAULT NULL,                -- FK -> public.lead_report.report_id (assign target row)
  lead_id          bigint DEFAULT NULL,                -- FK -> public.lead_master.lead_id

  -- ISOLATION COLUMNS (every RLS predicate filters on these, denormalised onto the row)
  project_id       bigint DEFAULT NULL,                -- FK -> public.project.project_id
  client_assoc_id  bigint NOT NULL,                    -- FK -> public.client_association.client_assoc_id
  assigned_user_id bigint DEFAULT NULL,                -- = lead_report.user_id at snapshot time (the assigned salesperson)

  -- snapshot provenance
  snapshot_source     text NOT NULL DEFAULT 'live'     -- 'live' (trigger) | 'backfill' (one-time seed)
                      CHECK (snapshot_source IN ('live','backfill')),
  started_at          timestamptz DEFAULT NULL,        -- drives the feedback gate (meeting start = date+time)
  captured_at         timestamptz NOT NULL DEFAULT now(),
  snapshot_taken_at   timestamptz NOT NULL DEFAULT now(),
  snapshot_refreshed_at timestamptz DEFAULT NULL,

  -- ---- COMPANY fields (mobile MeetingDetails "Company details") ----
  company_id          bigint DEFAULT NULL,             -- kept for server-side reconcile; NOT exposed by the view
  company_name        text DEFAULT NULL,
  company_industry    text DEFAULT NULL,               -- resolved industry name  -- VERIFY: company_master.industry_id -> industry_master.industry_name
  company_sector      text DEFAULT NULL,               -- VERIFY: company_master.sector_id -> company_sector.sector
  company_sub_industry text DEFAULT NULL,              -- VERIFY: company_master.sub_industry_id -> sub_industry name
  company_city        text DEFAULT NULL,               -- "Headquarters"  -- VERIFY: company_master.city_id -> city name
  company_turnover    text DEFAULT NULL,               -- VERIFY: company_master.turnover_id -> turnover label
  company_size        text DEFAULT NULL,               -- "Employee"  (company_master.company_size)
  company_web_url     text DEFAULT NULL,               -- company_master.company_web_url
  company_linkedin_url text DEFAULT NULL,              -- company_master.linkedin_url
  company_description text DEFAULT NULL,               -- company_master.description

  -- ---- ADDRESS fields (mobile "Address" + map link) ----
  address_line_one    text DEFAULT NULL,               -- location.address_line_one
  address_line_two    text DEFAULT NULL,               -- location.address_line_two
  address_city        text DEFAULT NULL,               -- VERIFY: lead address city name
  address_state       text DEFAULT NULL,               -- VERIFY: city -> state name
  address_country     text DEFAULT NULL,               -- VERIFY: state -> country name

  -- ---- LEAD / CONTACT fields (mobile "Lead Details") ----
  lead_name           text DEFAULT NULL,               -- lead_master.lead_name
  lead_designation    text DEFAULT NULL,               -- lead_master.designation / lead_designation_id -> name  -- VERIFY
  lead_email          text DEFAULT NULL,               -- lead_master.email
  lead_mobile_no      text DEFAULT NULL,               -- lead_master.mobile_no
  lead_alt_mobile_no  text DEFAULT NULL,               -- lead_master.alt_mobile_no
  lead_linkedin_url   text DEFAULT NULL,               -- lead_master.linkedin_url
  lead_role_and_resp  text DEFAULT NULL,               -- lead_master.role_and_resp
  lead_area_of_interest text DEFAULT NULL,             -- lead_master.area_of_interest

  -- ---- OPPORTUNITY fields (mobile "Opportunity Details") ----
  opportunity_title       text DEFAULT NULL,           -- lead_master.title
  opportunity_value       text DEFAULT NULL,           -- lead_master.value
  opportunity_description text DEFAULT NULL,           -- lead_master.description
  sales_intelligence      text DEFAULT NULL,           -- lead_report.sales_intelligence

  -- ---- MEETING fields (mobile meeting card + "Agenda & Notes") ----
  meeting_name        text DEFAULT NULL,               -- meeting_master.meeting_name
  meeting_date        date DEFAULT NULL,               -- meeting_master.meeting_date
  meeting_time        text DEFAULT NULL,               -- meeting_master.meeting_time
  meeting_duration    text DEFAULT NULL,               -- meeting_master.duration
  meeting_mode        text DEFAULT NULL,               -- meeting_master.meeting_mode (F2F/Online/Telephonic)
  meeting_status      text DEFAULT NULL,               -- meeting_master.meeting_status
  meeting_url         text DEFAULT NULL,               -- meeting_master.meeting_url (join link / dial)
  meeting_description text DEFAULT NULL,               -- meeting_master.description (agenda)
  meeting_reason      text DEFAULT NULL,               -- meeting_master.reason / dropped reason
  scheduled_by_name   text DEFAULT NULL,               -- "Meeting scheduled by" — Amplior creator full name  -- VERIFY
  assigned_rep_name   text DEFAULT NULL,               -- "SP-" — assigned salesperson full name  -- VERIFY

  -- ---- PRE-SALES Q&A + agenda discussion (mobile "Pre-Sales Questions" / "Discussion") ----
  pre_sales_qa        jsonb DEFAULT NULL,              -- [{ question, short_question, answer }]
  agenda_discussion   text DEFAULT NULL,               -- the "Discussion" pre-sales answer

  -- audit
  created_by          text DEFAULT NULL,
  created_date        timestamptz NOT NULL DEFAULT now(),
  updated_by          text DEFAULT NULL,
  updated_date        timestamptz DEFAULT NULL,

  UNIQUE (meeting_id)
);
CREATE INDEX IF NOT EXISTS ms_client_assoc_idx ON portal.meeting_snapshot (client_assoc_id);
CREATE INDEX IF NOT EXISTS ms_project_idx      ON portal.meeting_snapshot (project_id);
CREATE INDEX IF NOT EXISTS ms_assigned_idx     ON portal.meeting_snapshot (assigned_user_id);
CREATE INDEX IF NOT EXISTS ms_meeting_idx      ON portal.meeting_snapshot (meeting_id);

-- ============================================================
-- 3. portal.notification  (ALT-228) — portal-owned, RLS-scoped per recipient + client.
-- ============================================================
CREATE TABLE IF NOT EXISTS portal.notification (
  notification_id    bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  recipient_auth_uid uuid NOT NULL,                    -- = auth.uid() of the portal user it is for
  client_assoc_id    bigint NOT NULL,                  -- defense-in-depth scope (must match caller's client)
  project_id         bigint DEFAULT NULL,
  kind               text DEFAULT NULL,                -- e.g. 'meeting_scheduled','lead_reassigned','feedback','record_updated'
  body               text DEFAULT NULL,
  route              text DEFAULT NULL,                -- in-app deep link (e.g. /meetings/123)
  is_read            boolean NOT NULL DEFAULT false,
  read_at            timestamptz DEFAULT NULL,
  created_date       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_recipient_idx ON portal.notification (recipient_auth_uid);
CREATE INDEX IF NOT EXISTS notif_client_idx    ON portal.notification (client_assoc_id);

-- ============================================================
-- 4. Curated SECURITY INVOKER views (clients read ONLY these).
--    SECURITY INVOKER => the base-table RLS (apply-portal-rls.cjs) runs as the caller,
--    so a view can never widen a client's visibility. Company_id and other internal
--    reconciliation keys are intentionally NOT selected.
-- ============================================================

-- 4a. portal.portal_meetings — meeting list/detail rows from the snapshot.
DROP VIEW IF EXISTS portal.portal_meetings;
CREATE VIEW portal.portal_meetings
  WITH (security_invoker = true) AS
SELECT
  s.meeting_id,
  s.project_id,
  s.client_assoc_id,
  s.assigned_user_id,
  s.started_at,
  s.snapshot_source,
  s.company_name,
  s.company_industry,
  s.company_city,
  s.company_turnover,
  s.company_size,
  s.company_sector,
  s.company_web_url,
  s.company_linkedin_url,
  s.address_line_one,
  s.address_line_two,
  s.address_city,
  s.address_state,
  s.address_country,
  s.lead_name,
  s.lead_designation,
  s.lead_email,
  s.lead_mobile_no,
  s.lead_alt_mobile_no,
  s.lead_linkedin_url,
  s.lead_role_and_resp,
  s.lead_area_of_interest,
  s.opportunity_title,
  s.opportunity_value,
  s.opportunity_description,
  s.sales_intelligence,
  s.meeting_name,
  s.meeting_date,
  s.meeting_time,
  s.meeting_duration,
  s.meeting_mode,
  s.meeting_status,
  s.meeting_url,
  s.meeting_description,
  s.meeting_reason,
  s.scheduled_by_name,
  s.assigned_rep_name,
  s.pre_sales_qa,
  s.agenda_discussion,
  s.snapshot_taken_at,
  s.snapshot_refreshed_at
FROM portal.meeting_snapshot s;

-- 4b. portal.portal_lead — read-only lead/contact profile lens (snapshot only; not the CRM lead page).
DROP VIEW IF EXISTS portal.portal_lead;
CREATE VIEW portal.portal_lead
  WITH (security_invoker = true) AS
SELECT
  s.meeting_id,
  s.project_id,
  s.client_assoc_id,
  s.assigned_user_id,
  s.company_name,
  s.company_industry,
  s.company_city,
  s.company_web_url,
  s.company_linkedin_url,
  s.lead_name,
  s.lead_designation,
  s.lead_email,
  s.lead_mobile_no,
  s.lead_alt_mobile_no,
  s.lead_linkedin_url,
  s.lead_role_and_resp,
  s.lead_area_of_interest,
  s.opportunity_title,
  s.opportunity_value,
  s.opportunity_description,
  s.sales_intelligence,
  s.pre_sales_qa
FROM portal.meeting_snapshot s;

-- 4c. portal.portal_notifications — caller's own notifications (RLS-scoped per recipient + client).
DROP VIEW IF EXISTS portal.portal_notifications;
CREATE VIEW portal.portal_notifications
  WITH (security_invoker = true) AS
SELECT
  n.notification_id,
  n.recipient_auth_uid,
  n.client_assoc_id,
  n.project_id,
  n.kind,
  n.body,
  n.route,
  n.is_read,
  n.read_at,
  n.created_date
FROM portal.notification n;

-- 4d. portal.portal_dashboard_metrics — pre-aggregated counts scoped per project (no row leakage).
DROP VIEW IF EXISTS portal.portal_dashboard_metrics;
CREATE VIEW portal.portal_dashboard_metrics
  WITH (security_invoker = true) AS
SELECT
  s.client_assoc_id,
  s.project_id,
  s.assigned_user_id,
  count(*)                                                                AS total_meetings,
  count(*) FILTER (WHERE s.meeting_status IN ('Scheduled','Confirmed'))   AS scheduled_count,
  count(*) FILTER (WHERE s.meeting_status = 'Completed')                  AS completed_count,
  count(*) FILTER (WHERE s.meeting_status = 'Rescheduled')                AS rescheduled_count,
  count(*) FILTER (WHERE s.meeting_status = 'Cancelled')                  AS dropped_count,
  count(*) FILTER (WHERE s.meeting_status = 'Missed')                     AS missed_count
FROM portal.meeting_snapshot s
GROUP BY s.client_assoc_id, s.project_id, s.assigned_user_id;

-- ============================================================
-- 5. GRANTS — the connecting role is 'authenticated' (Supabase). Clients get USAGE on
--    the schema + SELECT on the VIEWS ONLY. RLS (apply-portal-rls.cjs) is what scopes
--    each authenticated session to its own tenant; a NON-portal authenticated session
--    (CRM staff) is excluded by every portal policy's caller_client_assoc_id() IS NOT NULL
--    guard, so giving 'authenticated' SELECT on the views is safe.
--
--    service_role (Supabase admin / notify-service) gets USAGE + full table access so the
--    snapshot writer, backfill, and notification INSERT path work server-side.
--
--    NO grant on any base public.* table is added here (and apply-portal-rls.cjs adds a
--    RESTRICTIVE deny-portal-sessions policy on the public tables themselves).
-- ============================================================
GRANT USAGE ON SCHEMA portal TO authenticated;
GRANT USAGE ON SCHEMA portal TO service_role;

GRANT SELECT ON portal.portal_meetings          TO authenticated;
GRANT SELECT ON portal.portal_lead              TO authenticated;
GRANT SELECT ON portal.portal_notifications     TO authenticated;
GRANT SELECT ON portal.portal_dashboard_metrics TO authenticated;

-- The views are SECURITY INVOKER, so 'authenticated' also needs the underlying base-table
-- privilege for the view to resolve — but RLS then gates which ROWS are visible. We grant
-- the minimum: SELECT on meeting_snapshot + notification (rows still filtered by policy),
-- and SELECT on client_portal_user is NOT granted to authenticated except via its own
-- self-row policy below. Notifications also get UPDATE(read state) so the read-toggle works.
GRANT SELECT ON portal.meeting_snapshot     TO authenticated;
GRANT SELECT ON portal.client_portal_user   TO authenticated;
GRANT SELECT, UPDATE (is_read, read_at) ON portal.notification TO authenticated;

-- service_role: full access to base tables for the writer/backfill/notify paths.
GRANT SELECT, INSERT, UPDATE, DELETE ON portal.meeting_snapshot   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON portal.client_portal_user TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON portal.notification       TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA portal TO service_role;

-- Defense-in-depth: clients (authenticated) get NO INSERT/DELETE on snapshot, NO write on
-- client_portal_user, and NO sequence access. (UPDATE on snapshot is also withheld; the
-- read-state UPDATE on notification is column-scoped above and gated by RLS.)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON portal.meeting_snapshot   FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON portal.client_portal_user FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA portal FROM authenticated;
`;

(async () => {
  const pg = new Pool({ connectionString: process.env.PG_CONNECTION_STRING });
  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL);
    await client.query('COMMIT');
    console.log('APPLIED apply-portal-foundation OK (committed).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('APPLY FAILED, rolled back:', e.message);
    client.release();
    await pg.end();
    process.exit(1);
  }

  // VERIFY: tables
  const tbls = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='portal' AND table_type='BASE TABLE'
     ORDER BY table_name`);
  console.log('\n=== portal BASE TABLES (AFTER) ===');
  console.log(JSON.stringify(tbls.rows, null, 2));

  // VERIFY: views + security_invoker reloption
  const vws = await client.query(
    `SELECT c.relname AS view_name, c.reloptions
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='portal' AND c.relkind='v'
     ORDER BY c.relname`);
  console.log('\n=== portal VIEWS (AFTER, reloptions should show security_invoker=true) ===');
  console.log(JSON.stringify(vws.rows, null, 2));

  // VERIFY: grants — authenticated must have SELECT on views + base SELECT (rows gated by RLS),
  // NO INSERT/UPDATE/DELETE on snapshot/client_portal_user.
  const grants = await client.query(
    `SELECT grantee, table_name, privilege_type
     FROM information_schema.role_table_grants
     WHERE table_schema='portal' AND grantee IN ('authenticated','service_role')
     ORDER BY grantee, table_name, privilege_type`);
  console.log('\n=== portal GRANTS to authenticated / service_role (AFTER) ===');
  console.log(JSON.stringify(grants.rows, null, 2));

  // VERIFY: the unbridged portal_client role is gone (or at least holds no grants).
  const role = await client.query(
    `SELECT rolname FROM pg_roles WHERE rolname='portal_client'`);
  console.log('\n=== portal_client ROLE (should be empty array — role removed) ===');
  console.log(JSON.stringify(role.rows, null, 2));

  // VERIFY: isolation columns present on meeting_snapshot
  const iso = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='portal' AND table_name='meeting_snapshot'
       AND column_name IN ('project_id','client_assoc_id','assigned_user_id')
     ORDER BY column_name`);
  console.log('\n=== meeting_snapshot ISOLATION COLUMNS (AFTER) ===');
  console.log(JSON.stringify(iso.rows, null, 2));

  console.log('\nNOTE (deploy step): add `portal` to Supabase API "Exposed schemas" so the JS/REST client can read portal.* views. Until then, portal is reachable only via service_role.');

  client.release();
  await pg.end();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
