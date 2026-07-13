/**
 * projectHbSettings.ts — Data layer for per-project HungerBox settings.
 *
 * Table: public.project_hb_setting  (created by apply-prequalified-granularity.cjs)
 *   project_id                bigint  PK  FK → project_master.project_id
 *   prequalified_granularity  text    NOT NULL  DEFAULT 'site'  CHECK IN ('company','site')
 *   updated_by                text
 *   updated_at                timestamptz
 *
 * Table: public.company_hb_prequal  (created by apply-prequalified-granularity.cjs)
 *   company_id       bigint   PK  FK → company_master.company_id (CASCADE)
 *   total_employees  integer
 *   commercial_model text
 *   notes            text
 *   updated_by       text
 *   updated_at       timestamptz
 *
 * Table: public.hb_company_prequal_history  (audit log, same shape as hb_site_history)
 *   history_id  bigint PK
 *   company_id  bigint NOT NULL
 *   changed_by  text
 *   changed_at  timestamptz
 *   field_name  text
 *   old_value   text
 *   new_value   text
 *
 * ALL reads/writes are guarded by HUNGERBOX_FEATURES.
 * When the flag is false every function returns a default/null — no DB trips.
 *
 * TODO(gatekeeper ALT-431): route upsert calls through server-side write gateway
 */

import { supabase } from '../lib/supabase';
import { HUNGERBOX_FEATURES, type HbPrequalifiedAnswers } from '../lib/hungerbox';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

/** Granularity setting for a project's prequalified questions. */
export type PrequalGranularity = 'company' | 'site';

/** The default when no row exists yet. */
export const DEFAULT_PREQUAL_GRANULARITY: PrequalGranularity = 'site';

export interface ProjectHbSetting {
  project_id: number;
  prequalified_granularity: PrequalGranularity;
}

export interface CompanyHbPrequal {
  company_id: number;
  total_employees: number | null;
  commercial_model: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface CompanyPrequalHistory {
  history_id: number;
  company_id: number;
  changed_by: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

// -----------------------------------------------------------------------
// Row types
// -----------------------------------------------------------------------
interface ProjectHbSettingRow {
  project_id: number;
  prequalified_granularity: string;
}

interface CompanyHbPrequalRow {
  company_id: number;
  total_employees: number | null;
  commercial_model: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

interface CompanyPrequalHistoryRow {
  history_id: number;
  company_id: number;
  changed_by: string;
  changed_at: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

// -----------------------------------------------------------------------
// Reads — project setting
// -----------------------------------------------------------------------

/**
 * Fetch the HB setting for a project.
 * Returns the default ('site') when no row exists yet.
 */
export async function fetchProjectHbSetting(
  projectId: number,
): Promise<{ setting: ProjectHbSetting; error: string | null }> {
  const defaultSetting: ProjectHbSetting = {
    project_id: projectId,
    prequalified_granularity: DEFAULT_PREQUAL_GRANULARITY,
  };

  if (!HUNGERBOX_FEATURES) return { setting: defaultSetting, error: null };

  const { data, error } = await supabase
    .from('project_hb_setting')
    .select('project_id, prequalified_granularity')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.error('[projectHbSettings] fetchProjectHbSetting', error.message);
    return { setting: defaultSetting, error: error.message };
  }

  if (!data) return { setting: defaultSetting, error: null };

  const row = data as ProjectHbSettingRow;
  return {
    setting: {
      project_id: row.project_id,
      prequalified_granularity:
        row.prequalified_granularity === 'company' ? 'company' : 'site',
    },
    error: null,
  };
}

// -----------------------------------------------------------------------
// Writes — project setting
// -----------------------------------------------------------------------

/**
 * Upsert the prequalified_granularity setting for a project.
 * Returns null on success, error string on failure.
 *
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function upsertProjectHbSetting(
  projectId: number,
  granularity: PrequalGranularity,
  actorId: string,
): Promise<string | null> {
  if (!HUNGERBOX_FEATURES) return 'HungerBox features not enabled.';

  const { error } = await supabase
    .from('project_hb_setting')
    .upsert(
      {
        project_id: projectId,
        prequalified_granularity: granularity,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' },
    );

  if (error) return error.message;
  return null;
}

// -----------------------------------------------------------------------
// Reads — company-level prequal
// -----------------------------------------------------------------------

/**
 * Fetch the company-wide prequalified answers for a company.
 * Returns null when no row exists yet (first time → empty form).
 */
export async function fetchCompanyHbPrequal(
  companyId: number,
): Promise<CompanyHbPrequal | null> {
  if (!HUNGERBOX_FEATURES) return null;

  const { data, error } = await supabase
    .from('company_hb_prequal')
    .select('company_id, total_employees, commercial_model, notes, updated_by, updated_at')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[projectHbSettings] fetchCompanyHbPrequal', error.message);
    return null;
  }
  if (!data) return null;

  const row = data as CompanyHbPrequalRow;
  return {
    company_id: row.company_id,
    total_employees: row.total_employees ?? null,
    commercial_model: row.commercial_model ?? null,
    notes: row.notes ?? null,
    updated_by: row.updated_by ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * Fetch the full edit history for a company's company-level prequal answers.
 */
export async function fetchCompanyPrequalHistory(
  companyId: number,
): Promise<CompanyPrequalHistory[]> {
  if (!HUNGERBOX_FEATURES) return [];

  const { data, error } = await supabase
    .from('hb_company_prequal_history')
    .select('*')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[projectHbSettings] fetchCompanyPrequalHistory', error.message);
    return [];
  }

  return ((data ?? []) as CompanyPrequalHistoryRow[]).map((h) => ({
    history_id: h.history_id,
    company_id: h.company_id,
    changed_by: h.changed_by,
    changed_at: h.changed_at,
    field_name: h.field_name,
    old_value: h.old_value ?? null,
    new_value: h.new_value ?? null,
  }));
}

// -----------------------------------------------------------------------
// Writes — company-level prequal
// -----------------------------------------------------------------------

/**
 * Upsert the company-wide prequalified answers. Writes each changed field
 * to hb_company_prequal_history.
 *
 * TODO(gatekeeper ALT-431): route through server-side write gateway
 */
export async function upsertCompanyHbPrequal(params: {
  companyId: number;
  answers: Partial<HbPrequalifiedAnswers>;
  changedBy: string;
}): Promise<{ error: string | null }> {
  if (!HUNGERBOX_FEATURES) return { error: 'HungerBox features not enabled.' };

  const now = new Date().toISOString();

  const { error: upsertErr } = await supabase
    .from('company_hb_prequal')
    .upsert(
      {
        company_id: params.companyId,
        total_employees: params.answers.total_employees ?? null,
        commercial_model: params.answers.commercial_model ?? null,
        notes: params.answers.notes ?? null,
        updated_by: params.changedBy,
        updated_at: now,
      },
      { onConflict: 'company_id' },
    );

  if (upsertErr) return { error: upsertErr.message };

  // Write history for each field passed in
  const historyRows = Object.entries(params.answers).map(([field, newVal]) => ({
    company_id: params.companyId,
    changed_by: params.changedBy,
    changed_at: now,
    field_name: field,
    old_value: null, // enriching old_value deferred (same as hb_site_history)
    new_value: newVal != null ? String(newVal) : null,
  }));

  if (historyRows.length > 0) {
    const { error: histErr } = await supabase
      .from('hb_company_prequal_history')
      .insert(historyRows);
    if (histErr) {
      console.warn('[projectHbSettings] history insert failed:', histErr.message);
      // Non-fatal: the prequal row was saved.
    }
  }

  return { error: null };
}
