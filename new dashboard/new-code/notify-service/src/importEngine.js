'use strict';
/**
 * importEngine.js — server-side bulk upsert engine for the Import Wizard (DEC-14)
 *
 * Called exclusively from writeGateway.js handlers (company.import, contact.import,
 * lead.import).  Uses the service-role Supabase client (bypasses RLS).  Never called
 * from the browser.
 *
 * ── Upsert keys (per entity) ─────────────────────────────────────────────────
 *   company  → record_id (company_id) else domain_clean (derived from website/domain)
 *   contact  → record_id (contact_id) else email (lower-trimmed)
 *   lead     → record_id (lead_id)     — no domain/email fallback for leads
 *
 * ── Chunk contract ───────────────────────────────────────────────────────────
 *   Callers MUST send ≤ MAX_CHUNK_ROWS rows per call.  The UI chunks at 500 rows;
 *   this module enforces the same cap server-side and throws GatewayValidationError
 *   if exceeded.
 *
 * ── Undo / batch history ──────────────────────────────────────────────────────
 *   Every call writes one import_batch row (counts only; undo payload in import_row).
 *   For UPDATED rows: the prior values of the columns being changed are captured in
 *   import_row.undo_payload (jsonb) BEFORE the update executes.
 *   For INSERTED rows: undo_payload = { inserted: true } — the undo deleter uses this.
 *   Rows that were skipped/errored are still logged with status='skipped'|'error'.
 *
 * ── Event spine ───────────────────────────────────────────────────────────────
 *   After a successful write we leave a stub marker.  Wire it to eventBus.emitEvent
 *   only when the event-spine is validated (see TODO below).
 *
 * ── Column safety ─────────────────────────────────────────────────────────────
 *   Only columns in WRITABLE_COLUMNS[entity] are ever written.  Any key in the
 *   mapped row that is NOT in the whitelist is silently dropped before the write.
 *   This prevents accidental clobbering of system columns (created_by, is_demo, etc.).
 *
 * ── Discovered schema (live DB — read via PG read-only, 2026-06-28) ──────────
 *
 *   company_master
 *     PK: company_id bigint NOT NULL
 *     Unique match key (fallback): domain_clean text
 *     Writable cols: company_name varchar NOT NULL, company_web_url varchar,
 *       domain_clean text, cin_number varchar, email varchar, linkedin_url varchar,
 *       company_size bigint, description varchar, city_id integer (→city_master),
 *       industry_id bigint, sector_id bigint, sub_industry_id bigint, turnover_id bigint
 *     System cols (NOT writable by import): company_id, created_by, created_date,
 *       deleted_by, deleted_date, updated_by, updated_date, is_demo, is_lead,
 *       is_wishlist, company_image, logo_url, lead_name, designation, domain_id
 *
 *   contact_master
 *     PK: contact_id bigint NOT NULL
 *     Unique match key (fallback): email text (lower-trimmed)
 *     Writable cols: full_name text, email text, mobile_no text, alt_mobile_no text,
 *       designation text, linkedin_url text, linkedin_clean text, company_id bigint
 *       (→company_master), city_id bigint (→city_master)
 *     System cols (NOT writable): contact_id, is_demo, created_by, created_date,
 *       updated_by, updated_date, deleted_by, deleted_date, source_lead_id
 *
 *   lead_master
 *     PK: lead_id bigint NOT NULL
 *     No domain/email fallback — Record-ID only for leads
 *     Writable cols: lead_name text, email text, mobile_no varchar, alt_mobile_no varchar,
 *       designation text, description text, stage varchar, linkedin_url varchar,
 *       title varchar, value text, area_of_interest text, role_and_resp text,
 *       company_id bigint, contact_id bigint, project_id bigint
 *     System cols (NOT writable): lead_id, lead_number, created_by, created_date,
 *       updated_by, updated_date, deleted_by, deleted_date, is_demo, is_closed,
 *       agent_id, address_id, client_assoc_id, lead_designation_id, location_id,
 *       source_id, report_url
 *
 *   import_batch, import_row — see apply-import-batches.cjs (STAGED migration)
 */

const MAX_CHUNK_ROWS = 500;

/* ── Writable column whitelists ────────────────────────────────────────────── */
// These are the ONLY columns the import engine will ever write.
// Anything else from the mapped payload is silently ignored.
const WRITABLE_COLUMNS = {
  company: new Set([
    'company_name', 'company_web_url', 'domain_clean', 'cin_number',
    'email', 'linkedin_url', 'company_size', 'description',
    'city_id', 'industry_id', 'sector_id', 'sub_industry_id', 'turnover_id',
  ]),
  contact: new Set([
    'full_name', 'email', 'mobile_no', 'alt_mobile_no', 'designation',
    'linkedin_url', 'linkedin_clean', 'company_id', 'city_id',
  ]),
  lead: new Set([
    'lead_name', 'email', 'mobile_no', 'alt_mobile_no', 'designation',
    'description', 'stage', 'linkedin_url', 'title', 'value',
    'area_of_interest', 'role_and_resp', 'company_id', 'contact_id', 'project_id',
  ]),
};

/* ── Table + PK config per entity ──────────────────────────────────────────── */
const ENTITY_CONFIG = {
  company: {
    table:       'company_master',
    pk:          'company_id',
    fallbackKey: 'domain_clean',   // used when record_id absent
    requiredNew: ['company_name'], // columns required to INSERT (not needed for UPDATE)
  },
  contact: {
    table:       'contact_master',
    pk:          'contact_id',
    fallbackKey: 'email',
    requiredNew: ['full_name'],
  },
  lead: {
    table:       'lead_master',
    pk:          'lead_id',
    fallbackKey: null,             // leads: record_id is the ONLY match key
    requiredNew: [],
  },
};

/* ── Domain helper: derive domain_clean from a website string ────────────── */
function cleanDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/* ── ALT-499: assignee resolution for lead imports ─────────────────────────
 * `assigned_to` (mapped column) may hold a numeric user_id, a login email, or
 * a full name. Resolved in BULK per chunk (2 queries max), never per row.
 * Unresolvable values import the lead UNASSIGNED with a row-level warning.  */
function normAssignee(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === '' ? null : s;
}

async function resolveAssignees(admin, rawValues) {
  const map = new Map(); // normalized value -> user_id
  const wanted = [...new Set(rawValues.map(normAssignee).filter(Boolean))];
  if (wanted.length === 0) return map;

  // 1. Numeric values resolve directly.
  const nonNumeric = [];
  for (const w of wanted) {
    if (/^\d+$/.test(w)) map.set(w, Number(w));
    else nonNumeric.push(w);
  }
  if (nonNumeric.length === 0) return map;

  // 2. Emails → profiles.email (login email holds the user_id link).
  const emails = nonNumeric.filter((w) => w.includes('@'));
  if (emails.length > 0) {
    const { data } = await admin
      .from('profiles')
      .select('email, user_id')
      .in('email', emails);
    for (const p of data ?? []) {
      if (p.user_id != null && p.email) map.set(String(p.email).toLowerCase(), p.user_id);
    }
  }

  // 3. Remaining → case-insensitive full_name match on user_master.
  const names = nonNumeric.filter((w) => !map.has(w));
  if (names.length > 0) {
    const { data } = await admin
      .from('user_master')
      .select('user_id, full_name')
      .is('deleted_date', null);
    const byName = new Map();
    for (const u of data ?? []) {
      const n = normAssignee(u.full_name);
      if (n) byName.set(n, u.user_id); // last-wins; ambiguity acceptable for names
    }
    for (const w of names) {
      if (byName.has(w)) map.set(w, byName.get(w));
    }
  }
  return map;
}

/* ── Bulk name→id resolvers (company / project), same pattern as assignees ──
 * Mapped columns `company` and `project` hold NAMES; resolve to company_id /
 * project_id in bulk per chunk. Exact case-insensitive match on live rows;
 * unresolved values leave the field unset (row gets a warning where relevant). */
async function resolveByName(admin, table, idCol, nameCol, rawValues) {
  const map = new Map();
  const wanted = [...new Set(rawValues.map(normAssignee).filter(Boolean))];
  if (wanted.length === 0) return map;
  const { data } = await admin
    .from(table)
    .select(`${idCol}, ${nameCol}`)
    .is('deleted_date', null);
  const byName = new Map();
  for (const r of data ?? []) {
    const n = normAssignee(r[nameCol]);
    if (n && !byName.has(n)) byName.set(n, r[idCol]); // first-wins on dupes
  }
  for (const w of wanted) {
    if (byName.has(w)) map.set(w, byName.get(w));
  }
  return map;
}

/* ── New-lead enrichment (fresh-import path, 2026-07-02) ────────────────────
 * lead_master INSERTs need NOT-NULL columns the CSV can't supply. Mirror the
 * proven wishlist-conversion recipe (data/wishlist.ts convertWishlistToLead):
 *   lead_number     — generated 'ALT<n>' sequential (max existing + 1)
 *   client_assoc_id — precedent of existing leads in the SAME project, else the
 *                     project row's own client link if present, else row error
 *   source_id       — 8 = 'Datalist' (the import source per prod source_master)
 *   address_id      — 1 placeholder (same caveat as wishlist ensureAddress)
 *   designation/email/mobile_no — 'Unknown'/'' fallbacks like wishlist        */
const IMPORT_SOURCE_ID = 8; // source_master: 'Datalist'

async function nextLeadNumberBase(admin) {
  // lead_number format is 'ALT####' — find the max numeric suffix once per chunk.
  const { data } = await admin
    .from('lead_master')
    .select('lead_number')
    .like('lead_number', 'ALT%')
    .order('lead_id', { ascending: false })
    .limit(200);
  let max = 0;
  for (const r of data ?? []) {
    const m = /^ALT(\d+)$/.exec(r.lead_number ?? '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

async function clientAssocForProject(admin, projectId) {
  const { data } = await admin
    .from('lead_master')
    .select('client_assoc_id')
    .eq('project_id', projectId)
    .is('deleted_date', null)
    .not('client_assoc_id', 'is', null)
    .limit(1);
  if (data && data.length > 0) return data[0].client_assoc_id;
  // Empty project (e.g. a brand-new calling project): try the project row itself.
  try {
    const { data: proj } = await admin
      .from('project')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    if (proj && proj.client_assoc_id != null) return proj.client_assoc_id;
  } catch { /* project table shape may vary — fall through */ }
  return null;
}

/* ── Whitelist filter: drop any key not in the writable set ──────────────── */
function filterWritable(entity, rowObj) {
  const allowed = WRITABLE_COLUMNS[entity];
  const out = {};
  for (const [k, v] of Object.entries(rowObj)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

/* ── Coerce empty strings to null so we don't write blank over real data ─── */
function coerceValues(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (typeof v === 'string' && v.trim() === '') ? null : v;
  }
  return out;
}

/* ── Core per-row processor ─────────────────────────────────────────────────
 *
 * Returns: { status: 'inserted'|'updated'|'skipped'|'error',
 *            recordId: number|null, undoPayload: object, errorMsg: string|null }
 */
async function processRow(admin, entity, cfg, rawRow, actor) {
  try {
    const now = new Date().toISOString();
    const actorStr = String(actor.userId ?? actor.authUid);

    // 1. Build the write object (whitelist + coerce)
    let writeData = filterWritable(entity, coerceValues(rawRow));

    // For companies: auto-derive domain_clean from website if not explicitly provided
    if (entity === 'company' && !writeData.domain_clean && writeData.company_web_url) {
      writeData.domain_clean = cleanDomain(writeData.company_web_url);
    }

    // Merge pre-resolved relational ids (runImport bulk resolution): the mapped
    // `company` / `project` NAME columns resolve to company_id / project_id.
    // An EXPLICITLY mapped company_id (export→import round-trip) wins over name match.
    if (rawRow.__company_id != null && writeData.company_id == null) writeData.company_id = rawRow.__company_id;
    if (entity === 'lead' && rawRow.__project_id != null && writeData.project_id == null) writeData.project_id = rawRow.__project_id;

    // 2. Determine the match key
    const recordId = rawRow.record_id ? Number(rawRow.record_id) : null;
    const fallbackValue = cfg.fallbackKey ? (rawRow[cfg.fallbackKey] || null) : null;

    // No match key → this is a NEW record (fresh-import path, 2026-07-02).
    // Previously such rows were skipped, which made fresh imports impossible —
    // a brand-new CSV has no record_id. Duplicate protection = the wizard's
    // dedup preview (ALT-490) + batch undo; requiredNew still gates inserts.

    // 3. Look up existing record
    let existingRow = null;
    let matchedId = null;

    if (recordId) {
      // Primary match: by record ID
      const { data, error } = await admin
        .from(cfg.table)
        .select(`${cfg.pk}, *`)
        .eq(cfg.pk, recordId)
        .is('deleted_date', null)
        .maybeSingle();
      if (error) throw new Error(`lookup by ${cfg.pk}: ${error.message}`);
      existingRow = data;
      matchedId = data ? data[cfg.pk] : null;
    } else if (cfg.fallbackKey && fallbackValue) {
      // Fallback match: by domain_clean or email
      const matchVal = cfg.fallbackKey === 'email'
        ? fallbackValue.toLowerCase().trim()
        : fallbackValue.toLowerCase().trim();

      const { data, error } = await admin
        .from(cfg.table)
        .select(`${cfg.pk}, *`)
        .eq(cfg.fallbackKey, matchVal)
        .is('deleted_date', null)
        .eq('is_demo', false)
        .limit(2); // grab 2 to detect ambiguity
      if (error) throw new Error(`lookup by ${cfg.fallbackKey}: ${error.message}`);

      if (data && data.length > 1) {
        return {
          status: 'skipped',
          recordId: null,
          undoPayload: null,
          errorMsg: `Ambiguous match on ${cfg.fallbackKey}="${fallbackValue}" — ${data.length} records found. Resolve by record_id.`,
        };
      }
      existingRow = (data && data.length === 1) ? data[0] : null;
      matchedId = existingRow ? existingRow[cfg.pk] : null;
    }

    if (existingRow) {
      // 4a. UPDATE — capture undo payload BEFORE writing

      // Only keep keys that actually have a value to write (don't clobber with nulls unless explicit)
      const updateData = {};
      const undoPayload = { [cfg.pk]: matchedId, _before: {} };

      for (const [k, v] of Object.entries(writeData)) {
        if (v !== null && v !== undefined) {
          undoPayload._before[k] = existingRow[k] ?? null;
          updateData[k] = v;
        }
        // null/empty values: skip (don't overwrite with blank — "skipBlanks" is always ON)
      }

      if (Object.keys(updateData).length === 0) {
        // Nothing to update (all values blank or already matching)
        return {
          status: 'skipped',
          recordId: matchedId,
          undoPayload: null,
          errorMsg: 'No non-blank values to update',
        };
      }

      updateData.updated_by   = actorStr;
      updateData.updated_date = now;

      const { error: updateError } = await admin
        .from(cfg.table)
        .update(updateData)
        .eq(cfg.pk, matchedId);

      if (updateError) throw new Error(`update: ${updateError.message}`);

      // TODO(event-spine): emitEvent({ type: `${entity}.import.updated`, aggregateType: entity, aggregateId: matchedId, actor })

      return { status: 'updated', recordId: matchedId, undoPayload, errorMsg: null };

    } else {
      // 4b. INSERT — no prior values to undo; record the new PK for undo-delete

      if (cfg.requiredNew.length > 0) {
        for (const req of cfg.requiredNew) {
          if (!writeData[req]) {
            return {
              status: 'skipped',
              recordId: null,
              undoPayload: null,
              errorMsg: `Required column "${req}" is missing or blank for new record`,
            };
          }
        }
      }

      const insertData = {
        ...writeData,
        created_by:   actorStr,
        created_date: now,
        // lead_master has NO is_demo column (verified 2026-07-02) — stamping it
        // there errors the whole insert. company/contact keep it.
        ...(entity !== 'lead' ? { is_demo: false } : {}),
      };

      // New-lead enrichment (fresh-import path): lead_master has NOT-NULL columns
      // a CSV can't carry. Mirror wishlist conversion's proven recipe.
      if (entity === 'lead') {
        if (!insertData.lead_name) {
          return { status: 'skipped', recordId: null, undoPayload: null,
            errorMsg: 'lead_name is required to create a new lead' };
        }
        if (insertData.project_id == null) {
          return { status: 'skipped', recordId: null, undoPayload: null,
            errorMsg: `project ${rawRow.project ? `"${String(rawRow.project).trim()}" not found` : 'missing'} — new leads need a valid Project column` };
        }
        const clientAssocId = await clientAssocForProject(admin, insertData.project_id);
        if (clientAssocId == null) {
          return { status: 'skipped', recordId: null, undoPayload: null,
            errorMsg: 'could not derive client for this project (no existing leads to copy from) — seed one lead manually first' };
        }
        insertData.lead_number     = rawRow.__lead_number ?? `ALT${Date.now()}`;
        insertData.client_assoc_id = clientAssocId;
        insertData.source_id       = IMPORT_SOURCE_ID;      // 'Datalist'
        insertData.address_id      = 1;                     // placeholder (wishlist caveat)
        insertData.designation     = insertData.designation || 'Unknown';
        insertData.email           = insertData.email || '';
        insertData.mobile_no       = insertData.mobile_no || '';
        insertData.is_closed       = false;
      }

      const { data: inserted, error: insertError } = await admin
        .from(cfg.table)
        .insert(insertData)
        .select(cfg.pk)
        .single();

      if (insertError) throw new Error(`insert: ${insertError.message}`);

      const newId = inserted ? inserted[cfg.pk] : null;

      // TODO(event-spine): emitEvent({ type: `${entity}.import.inserted`, aggregateType: entity, aggregateId: newId, actor })

      // ALT-499: leads must be born ASSIGNABLE. Ownership/visibility = the
      // lead_report row (lead_report.user_id), so a lead_master row alone is
      // invisible to every agent. Seed a report the way wishlist conversion
      // does (report_id has a DB default; stage 1 = "Warm").
      // ALT-505: an imported COMPANY with Project (+ optional Assigned To)
      // seeds company_project_status so admin bulk-assigns at import time.
      if (entity === 'company' && newId != null && rawRow.__project_id != null) {
        const undoPayload = { inserted: true, [cfg.pk]: newId };
        let warn = null;
        const { data: cps, error: cpsErr } = await admin
          .from('company_project_status')
          .insert({
            company_id: newId,
            project_id: rawRow.__project_id,
            owner_user_id: rawRow.__assigned_user_id ?? null,
            created_by: actorStr,
            created_date: now,
          })
          .select('id')
          .single();
        if (cpsErr) {
          warn = `company imported but project bucket failed (${cpsErr.message}) — assign in-app`;
        } else if (cps?.id != null) {
          undoPayload.cps_id = cps.id; // undo removes the project-status row too
        }
        if (rawRow.assigned_to && rawRow.__assigned_user_id == null) {
          warn = `assigned_to "${String(rawRow.assigned_to).trim()}" did not match any user — imported without owner`;
        }
        return { status: 'inserted', recordId: newId, undoPayload, errorMsg: warn };
      }

      if (entity === 'lead' && newId != null) {
        const assignedUserId = rawRow.__assigned_user_id ?? null;
        const undoPayload = { inserted: true, [cfg.pk]: newId };
        let warn = null;

        if (assignedUserId != null) {
          const { data: rep, error: repErr } = await admin
            .from('lead_report')
            .insert({
              lead_id: newId,
              user_id: assignedUserId,
              stage_id: 1,
              report_status: 'Warm',
              created_by: actorStr,
              created_date: now,
            })
            .select('report_id')
            .single();
          if (repErr) {
            warn = `lead imported but assignment failed (${repErr.message}) — assign manually`;
          } else if (rep?.report_id != null) {
            undoPayload.report_id = rep.report_id; // undo must remove the report too
          }
        } else if (normAssignee(rawRow.assigned_to)) {
          warn = `assigned_to "${String(rawRow.assigned_to).trim()}" did not match any user — imported UNASSIGNED`;
        } else {
          warn = 'no assigned_to given — imported UNASSIGNED (invisible to agents until assigned)';
        }

        return { status: 'inserted', recordId: newId, undoPayload, errorMsg: warn };
      }

      return {
        status: 'inserted',
        recordId: newId,
        undoPayload: { inserted: true, [cfg.pk]: newId },
        errorMsg: null,
      };
    }

  } catch (e) {
    return { status: 'error', recordId: null, undoPayload: null, errorMsg: e.message };
  }
}

/* ── writeBatchRecord: insert a row into import_batch + import_row ───────── */
async function writeBatchRecord(admin, { entity, actorUserId, filename, rowResults }) {
  const counts = { inserted: 0, updated: 0, skipped: 0, error: 0 };
  for (const r of rowResults) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = rowResults.length;
  const status = counts.error > 0 ? 'partial' : 'done';

  // Insert into import_batch
  let batchId = null;
  try {
    const { data, error } = await admin
      .from('import_batch')
      .insert({
        entity,
        actor_user_id: actorUserId,
        filename:      filename ?? null,
        total,
        inserted:      counts.inserted,
        updated:       counts.updated,
        skipped:       counts.skipped,
        error:         counts.error,
        status,
      })
      .select('id')
      .single();

    if (error) {
      // import_batch table may not exist yet (migration not applied). Log but don't fail the import.
      console.warn('[importEngine] import_batch insert skipped (table missing?):', error.message);
      return null;
    }
    batchId = data?.id ?? null;
  } catch (e) {
    console.warn('[importEngine] import_batch insert threw:', e.message);
    return null;
  }

  if (!batchId) return null;

  // Insert per-row detail into import_row (batch insert)
  const rowInserts = rowResults.map((r, i) => ({
    batch_id:     batchId,
    row_index:    i,
    status:       r.status,
    record_id:    r.recordId,
    undo_payload: r.undoPayload,
    error_msg:    r.errorMsg,
  }));

  // Chunk the row inserts to avoid huge single requests (import_row can be large)
  const BATCH_CHUNK = 200;
  for (let i = 0; i < rowInserts.length; i += BATCH_CHUNK) {
    const slice = rowInserts.slice(i, i + BATCH_CHUNK);
    const { error } = await admin.from('import_row').insert(slice);
    if (error) {
      console.warn('[importEngine] import_row insert failed:', error.message);
      break; // non-fatal: batch header already written
    }
  }

  return batchId;
}

/* ── undoBatch: reverse an import batch ─────────────────────────────────── */
async function undoBatch(admin, batchId, actor) {
  // 1. Load the batch header
  const { data: batch, error: batchErr } = await admin
    .from('import_batch')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();

  if (batchErr) throw new Error(`load batch: ${batchErr.message}`);
  if (!batch)   throw new Error(`batch #${batchId} not found`);
  if (batch.status === 'undone') throw new Error(`batch #${batchId} already undone`);

  const cfg = ENTITY_CONFIG[batch.entity];
  if (!cfg) throw new Error(`unknown entity "${batch.entity}" in batch`);

  const now = new Date().toISOString();
  const actorStr = String(actor.userId ?? actor.authUid);

  // 2. Load only the rows that succeeded (inserted or updated)
  const { data: rows, error: rowErr } = await admin
    .from('import_row')
    .select('*')
    .eq('batch_id', batchId)
    .in('status', ['inserted', 'updated']);

  if (rowErr) throw new Error(`load rows: ${rowErr.message}`);

  let undone = 0, failed = 0;
  const errors = [];

  for (const row of rows ?? []) {
    try {
      if (row.status === 'inserted' && row.undo_payload?.inserted) {
        // Undo insert = soft-delete (set deleted_date)
        const { error } = await admin
          .from(cfg.table)
          .update({ deleted_by: actorStr, deleted_date: now })
          .eq(cfg.pk, row.record_id);
        if (error) throw new Error(error.message);
        // ALT-505: an imported company may have seeded company_project_status.
        if (row.undo_payload?.cps_id != null) {
          const { error: cpsErr } = await admin
            .from('company_project_status')
            .delete()
            .eq('id', row.undo_payload.cps_id);
          if (cpsErr) throw new Error(`company_project_status undo: ${cpsErr.message}`);
        }
        // ALT-499: an imported lead also seeded a lead_report — remove it too.
        if (row.undo_payload?.report_id != null) {
          const { error: repErr } = await admin
            .from('lead_report')
            .update({ deleted_by: actorStr, deleted_date: now })
            .eq('report_id', row.undo_payload.report_id);
          if (repErr) throw new Error(`lead_report undo: ${repErr.message}`);
        }
      } else if (row.status === 'updated' && row.undo_payload?._before) {
        // Undo update = restore prior values
        const restore = {
          ...row.undo_payload._before,
          updated_by:   actorStr,
          updated_date: now,
        };
        const { error } = await admin
          .from(cfg.table)
          .update(restore)
          .eq(cfg.pk, row.record_id);
        if (error) throw new Error(error.message);
      }
      undone++;
    } catch (e) {
      failed++;
      errors.push(`row ${row.row_index}: ${e.message}`);
    }
  }

  // 3. Mark batch as undone
  await admin
    .from('import_batch')
    .update({ status: 'undone', updated_at: now })
    .eq('id', batchId);

  return { batchId, undone, failed, errors };
}

/* ── Main entry point: runImport ────────────────────────────────────────────
 *
 * Called by writeGateway action handlers.
 *
 * @param {SupabaseClient} admin    — service-role client
 * @param {object}         actor   — { authUid, userId, role }
 * @param {object}         payload — {
 *   entity:   'company' | 'contact' | 'lead',
 *   rows:     MappedRow[],  // ≤ MAX_CHUNK_ROWS; keys are target field names
 *   filename: string?,      // original filename for the batch record
 * }
 * @returns {{ batchId, total, inserted, updated, skipped, error, rowResults[] }}
 */
async function runImport(admin, actor, payload) {
  const { entity, rows, filename } = payload || {};

  if (!entity || !ENTITY_CONFIG[entity]) {
    throw Object.assign(new Error(`payload.entity must be one of: ${Object.keys(ENTITY_CONFIG).join(', ')}`), { name: 'GatewayValidationError' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error('payload.rows must be a non-empty array'), { name: 'GatewayValidationError' });
  }
  if (rows.length > MAX_CHUNK_ROWS) {
    throw Object.assign(new Error(`payload.rows exceeds MAX_CHUNK_ROWS (${MAX_CHUNK_ROWS}). Send smaller chunks.`), { name: 'GatewayValidationError' });
  }

  const cfg = ENTITY_CONFIG[entity];
  const rowResults = [];

  // Bulk pre-resolution (ONCE per chunk, never per row):
  //   contacts + leads: `company` name → company_id
  //   leads:            `project` name → project_id, `assigned_to` → user_id (ALT-499)
  if (entity === 'contact' || entity === 'lead') {
    const companyMap = await resolveByName(admin, 'company_master', 'company_id', 'company_name',
      rows.map((r) => r.company));
    for (const row of rows) {
      const key = normAssignee(row.company);
      row.__company_id = key ? (companyMap.get(key) ?? null) : null;
    }
  }
  if (entity === 'lead' || entity === 'company') {
    // ALT-505: companies get the same project + assigned_to columns as leads
    // (ADR-32: beta imports COMPANIES) — they seed company_project_status.
    const [assigneeMap, projectMap] = await Promise.all([
      resolveAssignees(admin, rows.map((r) => r.assigned_to)),
      resolveByName(admin, 'project', 'project_id', 'project_name', rows.map((r) => r.project)),
    ]);
    for (const row of rows) {
      const aKey = normAssignee(row.assigned_to);
      row.__assigned_user_id = aKey ? (assigneeMap.get(aKey) ?? null) : null;
      const pKey = normAssignee(row.project);
      row.__project_id = pKey ? (projectMap.get(pKey) ?? null) : null;
    }
  }
  if (entity === 'lead') {
    // New-lead numbering: pre-reserve a sequential ALT#### per row (rows that
    // turn out to be UPDATEs simply don't use theirs; gaps are harmless).
    let numBase = await nextLeadNumberBase(admin);
    for (const row of rows) {
      numBase += 1;
      row.__lead_number = `ALT${numBase}`;
    }
  }

  // Process rows sequentially to avoid hammering DB with parallel requests
  // (for 100k-contact file the UI will call this endpoint many times in chunks)
  for (const row of rows) {
    const result = await processRow(admin, entity, cfg, row, actor);
    rowResults.push(result);
  }

  // Write batch + row history record (non-fatal if import_batch doesn't exist yet)
  const batchId = await writeBatchRecord(admin, {
    entity,
    actorUserId: actor.userId,
    filename,
    rowResults,
  });

  const counts = { inserted: 0, updated: 0, skipped: 0, error: 0 };
  for (const r of rowResults) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return {
    batchId,
    total:    rows.length,
    inserted: counts.inserted,
    updated:  counts.updated,
    skipped:  counts.skipped,
    error:    counts.error,
    rowResults,
  };
}

module.exports = { runImport, undoBatch, MAX_CHUNK_ROWS, ENTITY_CONFIG, WRITABLE_COLUMNS };
