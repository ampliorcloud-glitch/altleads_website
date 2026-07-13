/**
 * CompanySitesPanel — the prequalified-questions panel shown on CompanyDetailPage.
 *
 * Supports two modes driven by the project's prequalified_granularity setting:
 *
 *   granularity = 'site'    (default)
 *     Lists all sites for the company; each site shows city, employee count,
 *     commercial model, notes, DNC/feasibility status, edit-in-place, and
 *     change history. (Original behaviour.)
 *
 *   granularity = 'company'
 *     Shows a single company-wide form for prequalified answers
 *     (total_employees, commercial_model, notes). Answers are stored in
 *     company_hb_prequal (via upsertCompanyHbPrequal). Edit history is
 *     shown from hb_company_prequal_history.
 *     Per-site DNC/feasibility actions remain (they are scope-independent).
 *
 * Renders null when HUNGERBOX_FEATURES is false.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { HUNGERBOX_FEATURES, COMMERCIAL_MODEL_OPTIONS } from '../../lib/hungerbox';
import type { PrequalGranularity } from '../../data/projectHbSettings';
import {
  fetchCompanyHbPrequal,
  fetchCompanyPrequalHistory,
  upsertCompanyHbPrequal,
  type CompanyHbPrequal,
  type CompanyPrequalHistory,
} from '../../data/projectHbSettings';
import {
  fetchCompanySites,
  fetchSiteWithHistory,
  upsertSitePrequalified,
  type CompanySite,
  type SiteHistory,
} from '../../data/companySites';
import {
  fetchSiteDnc,
  fetchSiteFeasibility,
  type HbDncRecord,
  type HbFeasibilityRecord,
} from '../../data/dnc';
import { fetchCompanyDnc, fetchCompanyFeasibility } from '../../data/dnc';
import { DncAction, FeasibilityAction } from './DncFeasibilityActions';
import { NonContactableBadge } from './NonContactableBadge';
import type { ContactNonContactableState } from '../../data/dnc';
import { nonContactableReason } from '../../lib/hungerbox';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Save,
  X,
  Users,
} from 'lucide-react';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// -----------------------------------------------------------------------
// History row
// -----------------------------------------------------------------------
function HistoryRow({ entry }: { entry: SiteHistory }) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 8,
        fontSize: 11,
        color: '#6B7280',
        padding: '4px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <Clock size={11} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>
        <span style={{ color: '#374151', fontWeight: 600 }}>{entry.changed_by}</span>
        {' changed '}
        <span style={{ fontStyle: 'italic' }}>{entry.field_name}</span>
        {entry.old_value != null && (
          <> from <span style={{ color: '#DC2626' }}>{entry.old_value}</span></>
        )}
        {' → '}
        <span style={{ color: '#16A34A' }}>{entry.new_value ?? '(cleared)'}</span>
        <span style={{ marginLeft: 6, color: '#9CA3AF' }}>{formatTs(entry.changed_at)}</span>
      </span>
    </li>
  );
}

// -----------------------------------------------------------------------
// Single site card
// -----------------------------------------------------------------------
interface SiteCardProps {
  site: CompanySite;
  companyDnc: HbDncRecord | null;
  companyFeasibility: HbFeasibilityRecord | null;
  actorId: string;
  onRefresh: () => void;
}

function SiteCard({ site, companyDnc, companyFeasibility, actorId, onRefresh }: SiteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<SiteHistory[]>([]);
  const [siteDnc, setSiteDnc] = useState<HbDncRecord | null>(null);
  const [siteFeas, setSiteFeas] = useState<HbFeasibilityRecord | null>(null);
  const [dncFeasLoading, setDncFeasLoading] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [employees, setEmployees] = useState<string>(site.total_employees != null ? String(site.total_employees) : '');
  const [model, setModel] = useState<string>(site.commercial_model ?? '');
  const [notes, setNotes] = useState<string>(site.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setDncFeasLoading(true);
    setHistoryLoading(true);
    Promise.all([
      fetchSiteDnc(site.site_id),
      fetchSiteFeasibility(site.site_id),
      fetchSiteWithHistory(site.site_id).then((s) => s?.history ?? []),
    ]).then(([dnc, feas, hist]) => {
      if (cancelled) return;
      setSiteDnc(dnc);
      setSiteFeas(feas);
      setHistory(hist);
      setDncFeasLoading(false);
      setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [expanded, site.site_id]);

  const cDnc = companyDnc?.is_active ?? false;
  const sDnc = siteDnc?.is_active ?? false;
  const cNonFeas = companyFeasibility != null && !companyFeasibility.is_feasible;
  const sNonFeas = siteFeas != null && !siteFeas.is_feasible;
  const dncActive = cDnc || sDnc;
  const nonFeasActive = cNonFeas || sNonFeas;
  const nonContactableState: ContactNonContactableState = {
    is_non_contactable: dncActive || nonFeasActive,
    reason: nonContactableReason(dncActive, nonFeasActive),
    company_dnc: cDnc,
    site_dnc: sDnc,
    company_non_feasible: cNonFeas,
    site_non_feasible: sNonFeas,
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    const empNum = employees.trim() ? parseInt(employees.trim(), 10) : null;
    const res = await upsertSitePrequalified({
      companyId: site.company_id,
      cityId: site.city_id,
      answers: {
        total_employees: empNum != null && !isNaN(empNum) ? empNum : null,
        commercial_model: model.trim() || null,
        notes: notes.trim() || null,
      },
      changedBy: actorId,
    });
    setSaving(false);
    if (res.error) { setSaveErr(res.error); return; }
    setEditing(false);
    onRefresh();
  };

  return (
    <div
      style={{
        border: '1px solid',
        borderColor: nonContactableState.is_non_contactable ? 'rgba(196,77,77,0.15)' : '#E5E7EB',
        borderRadius: 8,
        background: nonContactableState.is_non_contactable ? '#FFF5F5' : '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Building2 size={14} style={{ color: '#6B7280' }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>
          {site.city_name || `City #${site.city_id}`}
        </span>
        {site.total_employees != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B7280' }}>
            <Users size={11} />
            {site.total_employees.toLocaleString()}
          </span>
        )}
        {site.commercial_model && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#EFF6FF',
            color: '#1D4ED8',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}>
            {site.commercial_model}
          </span>
        )}
        <NonContactableBadge state={nonContactableState} />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F3F4F6' }}>

          {/* Prequalified answers */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Pre-qualified answers</span>
              {!editing && (
                <button
                  onClick={() => {
                    setEmployees(site.total_employees != null ? String(site.total_employees) : '');
                    setModel(site.commercial_model ?? '');
                    setNotes(site.notes ?? '');
                    setEditing(true);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 2 }}
                  title="Edit prequalified answers"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, color: '#6B7280' }}>
                  Total employees
                  <input
                    type="number"
                    value={employees}
                    onChange={(e) => setEmployees(e.target.value)}
                    style={{ display: 'block', marginTop: 2, width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
                  />
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>
                  Commercial model
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{ display: 'block', marginTop: 2, width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="">— Select —</option>
                    {COMMERCIAL_MODEL_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: '#6B7280' }}>
                  Notes
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    style={{ display: 'block', marginTop: 2, width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                  />
                </label>
                {saveErr && <p style={{ color: '#DC2626', fontSize: 12 }}>{saveErr}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#1A7EE8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setSaveErr(null); }}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#F9FAFB', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                  >
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
                <span>
                  <span style={{ color: '#9CA3AF', fontSize: 11 }}>Employees</span>
                  <br />
                  <span style={{ color: '#111827', fontWeight: 500 }}>
                    {site.total_employees != null ? site.total_employees.toLocaleString() : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </span>
                </span>
                <span>
                  <span style={{ color: '#9CA3AF', fontSize: 11 }}>Commercial model</span>
                  <br />
                  <span style={{ color: '#111827', fontWeight: 500 }}>
                    {site.commercial_model || <span style={{ color: '#D1D5DB' }}>—</span>}
                  </span>
                </span>
                {site.notes && (
                  <span style={{ flexBasis: '100%' }}>
                    <span style={{ color: '#9CA3AF', fontSize: 11 }}>Notes</span>
                    <br />
                    <span style={{ color: '#374151' }}>{site.notes}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* DNC + Feasibility actions for this site */}
          {dncFeasLoading ? (
            <div style={{ marginTop: 12 }}><Loader2 size={12} className="animate-spin" style={{ color: '#9CA3AF' }} /></div>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <DncAction
                companyId={site.company_id}
                siteId={site.site_id}
                scope="site"
                current={siteDnc}
                actorId={actorId}
                onChanged={() => {
                  setExpanded(false);
                  setTimeout(() => setExpanded(true), 50);
                  onRefresh();
                }}
              />
              <FeasibilityAction
                companyId={site.company_id}
                siteId={site.site_id}
                scope="site"
                current={siteFeas}
                actorId={actorId}
                onChanged={() => {
                  setExpanded(false);
                  setTimeout(() => setExpanded(true), 50);
                  onRefresh();
                }}
              />
            </div>
          )}

          {/* History */}
          {historyLoading ? (
            <div style={{ marginTop: 12 }}><Loader2 size={12} className="animate-spin" style={{ color: '#9CA3AF' }} /></div>
          ) : history.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                Change history
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {history.slice(0, 10).map((h) => (
                  <HistoryRow key={h.history_id} entry={h} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Company-wide prequal form (used when granularity = 'company')
// -----------------------------------------------------------------------
function HistoryEntryRow({ entry }: { entry: CompanyPrequalHistory }) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 8,
        fontSize: 11,
        color: '#6B7280',
        padding: '4px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <Clock size={11} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>
        <span style={{ color: '#374151', fontWeight: 600 }}>{entry.changed_by}</span>
        {' changed '}
        <span style={{ fontStyle: 'italic' }}>{entry.field_name}</span>
        {entry.old_value != null && (
          <> from <span style={{ color: '#DC2626' }}>{entry.old_value}</span></>
        )}
        {' → '}
        <span style={{ color: '#16A34A' }}>{entry.new_value ?? '(cleared)'}</span>
        <span style={{ marginLeft: 6, color: '#9CA3AF' }}>{formatTs(entry.changed_at)}</span>
      </span>
    </li>
  );
}

interface CompanyPrequalFormProps {
  companyId: number;
  actorId: string;
}

function CompanyPrequalForm({ companyId, actorId }: CompanyPrequalFormProps) {
  const [prequal, setPrequal] = useState<CompanyHbPrequal | null>(null);
  const [history, setHistory] = useState<CompanyPrequalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [employees, setEmployees] = useState('');
  const [model, setModel] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchCompanyHbPrequal(companyId).then((data) => {
      setPrequal(data);
      setLoading(false);
    });
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistory = useCallback(() => {
    setHistLoading(true);
    fetchCompanyPrequalHistory(companyId).then((h) => {
      setHistory(h);
      setHistLoading(false);
    });
  }, [companyId]);

  const handleEdit = () => {
    setEmployees(prequal?.total_employees != null ? String(prequal.total_employees) : '');
    setModel(prequal?.commercial_model ?? '');
    setNotes(prequal?.notes ?? '');
    setEditing(true);
    setSaveErr(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr(null);
    const empNum = employees.trim() ? parseInt(employees.trim(), 10) : null;
    const res = await upsertCompanyHbPrequal({
      companyId,
      answers: {
        total_employees: empNum != null && !isNaN(empNum) ? empNum : null,
        commercial_model: model.trim() || null,
        notes: notes.trim() || null,
      },
      changedBy: actorId,
    });
    setSaving(false);
    if (res.error) { setSaveErr(res.error); return; }
    setEditing(false);
    loadData();
  };

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) loadHistory();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid #F3F4F6',
          background: '#F9FAFB',
        }}
      >
        <Building2 size={14} style={{ color: '#6B7280' }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>
          Company-wide answers
        </span>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          Applies to all sites / locations
        </span>
      </div>

      <div style={{ padding: '14px' }}>
        {/* Prequalified answers */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Pre-qualified answers</span>
            {!editing && (
              <button
                onClick={handleEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 2 }}
                title="Edit company-wide prequalified answers"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, color: '#6B7280' }}>
                Total employees
                <input
                  type="number"
                  value={employees}
                  onChange={(e) => setEmployees(e.target.value)}
                  style={{ display: 'block', marginTop: 2, width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#6B7280' }}>
                Commercial model
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{ display: 'block', marginTop: 2, width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">— Select —</option>
                  {COMMERCIAL_MODEL_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, color: '#6B7280' }}>
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{ display: 'block', marginTop: 2, width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                />
              </label>
              {saveErr && <p style={{ color: '#DC2626', fontSize: 12 }}>{saveErr}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#1A7EE8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setSaveErr(null); }}
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: '#F9FAFB', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : prequal == null ? (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>No answers recorded yet. Click the pencil to add.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
              <span>
                <span style={{ color: '#9CA3AF', fontSize: 11 }}>Employees</span>
                <br />
                <span style={{ color: '#111827', fontWeight: 500 }}>
                  {prequal.total_employees != null
                    ? prequal.total_employees.toLocaleString()
                    : <span style={{ color: '#D1D5DB' }}>—</span>}
                </span>
              </span>
              <span>
                <span style={{ color: '#9CA3AF', fontSize: 11 }}>Commercial model</span>
                <br />
                <span style={{ color: '#111827', fontWeight: 500 }}>
                  {prequal.commercial_model || <span style={{ color: '#D1D5DB' }}>—</span>}
                </span>
              </span>
              {prequal.notes && (
                <span style={{ flexBasis: '100%' }}>
                  <span style={{ color: '#9CA3AF', fontSize: 11 }}>Notes</span>
                  <br />
                  <span style={{ color: '#374151' }}>{prequal.notes}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* History toggle */}
        <button
          onClick={handleToggleHistory}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginTop: 4 }}
        >
          {showHistory ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Change history
        </button>

        {showHistory && (
          histLoading ? (
            <div style={{ marginTop: 8 }}><Loader2 size={12} className="animate-spin" style={{ color: '#9CA3AF' }} /></div>
          ) : history.length > 0 ? (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
              {history.slice(0, 10).map((h) => (
                <HistoryEntryRow key={h.history_id} entry={h} />
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>No history yet.</p>
          )
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Main panel
// -----------------------------------------------------------------------
interface CompanySitesPanelProps {
  companyId: number;
  actorId: string;
  /**
   * Granularity of prequalified questions for the active project.
   * - 'site'    (default): per-site answers shown in SiteCard list.
   * - 'company': a single company-wide answer form (CompanyPrequalForm).
   *
   * The DNC / feasibility company-level actions are always shown regardless
   * of granularity — they are scope-independent.
   */
  granularity?: PrequalGranularity;
}

export function CompanySitesPanel({ companyId, actorId, granularity = 'site' }: CompanySitesPanelProps) {
  if (!HUNGERBOX_FEATURES) return null;

  const [sites, setSites] = useState<CompanySite[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyDnc, setCompanyDnc] = useState<HbDncRecord | null>(null);
  const [companyFeasibility, setCompanyFeasibility] = useState<HbFeasibilityRecord | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchCompanySites(companyId),
      fetchCompanyDnc(companyId),
      fetchCompanyFeasibility(companyId),
    ]).then(([s, dnc, feas]) => {
      setSites(s);
      setCompanyDnc(dnc);
      setCompanyFeasibility(feas);
      setLoading(false);
    });
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Company-level DNC / feasibility actions (always shown) */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <DncAction
          companyId={companyId}
          siteId={null}
          scope="company"
          current={companyDnc}
          actorId={actorId}
          onChanged={load}
        />
        <FeasibilityAction
          companyId={companyId}
          siteId={null}
          scope="company"
          current={companyFeasibility}
          actorId={actorId}
          onChanged={load}
        />
      </div>

      {/* Granularity label */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: '#9CA3AF',
            background: '#F3F4F6',
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          {granularity === 'company' ? 'Company-wide answers' : 'Site-wise answers'}
        </span>
      </div>

      {/* Company-wide mode */}
      {granularity === 'company' && (
        <CompanyPrequalForm companyId={companyId} actorId={actorId} />
      )}

      {/* Site-wise mode (original behaviour) */}
      {granularity === 'site' && (
        loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading sites…
          </div>
        ) : sites.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>No sites loaded yet for this company.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sites.map((s) => (
              <SiteCard
                key={s.site_id}
                site={s}
                companyDnc={companyDnc}
                companyFeasibility={companyFeasibility}
                actorId={actorId}
                onRefresh={load}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
