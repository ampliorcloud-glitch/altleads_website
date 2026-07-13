/**
 * QualificationCard — ALT-470/471/472 lead-state v2 panel.
 *
 * Rendered ONLY when LEAD_STATE_V2 is true (gated by the calling detail page).
 * Self-contained: fetches its own qualification + lost-reason + UTM data on mount
 * so the page's main load path is untouched while the flag is off.
 *
 *   • Qualification (ALT-471): segmented control. Editable by QC + Admin only
 *     (ERPNext QC-accountability model). Others see a read-only badge + audit line.
 *   • Lost reasons (ALT-472): shown when the current stage is terminal/"lost".
 *     Multi-select checkboxes; the owner (or QC/Admin) can record ≥1 reason.
 *   • UTM (ALT-470): read-only attribution chips when present.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { SectionCard } from '../admin/primitives';
import {
  LEAD_STATE_V2,
  QUALIFICATION_OPTIONS,
  qualificationStyle,
  isLostStage,
  type QualificationStatus,
} from '../../lib/leadStateFlag';
import {
  fetchQualification,
  updateQualification,
  fetchLostReasonOptions,
  fetchSelectedLostReasons,
  setLostReasons,
  fetchUtm,
  fetchCompetitorOptions,
  fetchSelectedCompetitors,
  ensureCompetitor,
  setCompetitors,
  type LostReason,
  type Competitor,
  type QualificationState,
  type UtmState,
} from '../../data/leadState';

interface Props {
  reportId: number | null;
  leadId: number;
  stageId: number | null;
  /** App user_id (number) of the current user — stamps qualified_by. */
  actorUserId: number | null;
  /** Whether the current user may set qualification (QC or Admin). */
  canQualify: boolean;
  /** Whether the current user may edit lost reasons (owner, QC, or Admin). */
  canEditLostReasons: boolean;
}

const EMPTY_QUAL: QualificationState = {
  qualification_status: null,
  qualified_by: null,
  qualified_on: null,
};
const EMPTY_UTM: UtmState = { utm_source: null, utm_medium: null, utm_campaign: null };

export function QualificationCard({
  reportId,
  leadId,
  stageId,
  actorUserId,
  canQualify,
  canEditLostReasons,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qual, setQual] = useState<QualificationState>(EMPTY_QUAL);
  const [utm, setUtm] = useState<UtmState>(EMPTY_UTM);
  const [reasonOptions, setReasonOptions] = useState<LostReason[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<number[]>([]);
  const [competitorOptions, setCompetitorOptions] = useState<Competitor[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<number[]>([]);
  const [newCompetitor, setNewCompetitor] = useState('');

  const lostStage = isLostStage(stageId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, u] = await Promise.all([
        reportId ? fetchQualification(reportId) : Promise.resolve(EMPTY_QUAL),
        fetchUtm(leadId),
      ]);
      setQual(q);
      setUtm(u);
      if (reportId) {
        const [compOpts, compSel] = await Promise.all([
          fetchCompetitorOptions(),
          fetchSelectedCompetitors(reportId),
        ]);
        setCompetitorOptions(compOpts);
        setSelectedCompetitors(compSel);
      }
      if (lostStage && reportId) {
        const [opts, sel] = await Promise.all([
          fetchLostReasonOptions(),
          fetchSelectedLostReasons(reportId),
        ]);
        setReasonOptions(opts);
        setSelectedReasons(sel);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead state');
    } finally {
      setLoading(false);
    }
  }, [reportId, leadId, lostStage]);

  useEffect(() => {
    if (!LEAD_STATE_V2) return;
    void load();
  }, [load]);

  const handleSetQual = useCallback(
    async (next: QualificationStatus | null) => {
      if (!reportId || actorUserId == null || saving) return;
      setSaving(true);
      setError(null);
      const res = await updateQualification(reportId, next, actorUserId);
      if (res.ok) {
        setQual({
          qualification_status: next,
          qualified_by: next ? actorUserId : null,
          qualified_on: next ? new Date().toISOString() : null,
        });
      } else {
        setError(res.error);
      }
      setSaving(false);
    },
    [reportId, actorUserId, saving],
  );

  const toggleReason = useCallback(
    async (reasonId: number) => {
      if (!reportId || saving) return;
      const next = selectedReasons.includes(reasonId)
        ? selectedReasons.filter((id) => id !== reasonId)
        : [...selectedReasons, reasonId];
      setSelectedReasons(next); // optimistic
      setSaving(true);
      setError(null);
      const res = await setLostReasons(reportId, next, actorUserId != null ? String(actorUserId) : 'unknown');
      if (!res.ok) {
        setError(res.error);
        await load(); // resync on failure
      }
      setSaving(false);
    },
    [reportId, saving, selectedReasons, actorUserId, load],
  );

  const persistCompetitors = useCallback(
    async (ids: number[]) => {
      if (!reportId) return;
      setSelectedCompetitors(ids); // optimistic
      setSaving(true);
      setError(null);
      const res = await setCompetitors(reportId, ids, actorUserId != null ? String(actorUserId) : 'unknown');
      if (!res.ok) {
        setError(res.error);
        await load();
      }
      setSaving(false);
    },
    [reportId, actorUserId, load],
  );

  const toggleCompetitor = useCallback(
    (competitorId: number) => {
      const next = selectedCompetitors.includes(competitorId)
        ? selectedCompetitors.filter((id) => id !== competitorId)
        : [...selectedCompetitors, competitorId];
      void persistCompetitors(next);
    },
    [selectedCompetitors, persistCompetitors],
  );

  const addNewCompetitor = useCallback(async () => {
    const name = newCompetitor.trim();
    if (!name || !reportId || saving) return;
    setSaving(true);
    setError(null);
    const res = await ensureCompetitor(name, actorUserId != null ? String(actorUserId) : 'unknown');
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setNewCompetitor('');
    // refresh options so the new competitor shows, then link it
    const opts = await fetchCompetitorOptions();
    setCompetitorOptions(opts);
    setSaving(false);
    if (!selectedCompetitors.includes(res.competitor_id)) {
      void persistCompetitors([...selectedCompetitors, res.competitor_id]);
    }
  }, [newCompetitor, reportId, saving, actorUserId, selectedCompetitors, persistCompetitors]);

  if (!LEAD_STATE_V2) return null;

  const style = qualificationStyle(qual.qualification_status);
  const hasUtm = utm.utm_source || utm.utm_medium || utm.utm_campaign;

  return (
    <SectionCard title="Qualification & attribution">
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 13 }}>
            <Loader2 size={14} className="spin" /> Loading…
          </div>
        ) : (
          <>
            {/* ── Qualification (ALT-471) ─────────────────────────────── */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                Qualification status
              </div>
              {canQualify ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {QUALIFICATION_OPTIONS.map((opt) => {
                    const active = qual.qualification_status === opt.value;
                    const s = qualificationStyle(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={saving}
                        onClick={() => handleSetQual(active ? null : opt.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: `1px solid ${active ? s.color : '#E5E7EB'}`,
                          background: active ? s.bg : '#FFFFFF',
                          color: active ? s.color : '#374151',
                          fontSize: 13,
                          fontWeight: active ? 600 : 500,
                          cursor: saving ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {active && <Check size={13} />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 12,
                    background: style.bg,
                    color: style.color,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {style.label}
                </span>
              )}
              {qual.qualified_on && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                  Set by user #{qual.qualified_by ?? '—'} on{' '}
                  {new Date(qual.qualified_on).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* ── Lost reasons (ALT-472) — only on terminal/lost stage ── */}
            {lostStage && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                  Lost reason{' '}
                  <span style={{ fontWeight: 400, color: '#9CA3AF' }}>
                    (select at least one)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reasonOptions.length === 0 && (
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>No reasons configured.</span>
                  )}
                  {reasonOptions.map((r) => {
                    const checked = selectedReasons.includes(r.lost_reason_id);
                    return (
                      <label
                        key={r.lost_reason_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: '#374151',
                          cursor: canEditLostReasons && !saving ? 'pointer' : 'default',
                          opacity: canEditLostReasons ? 1 : 0.7,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEditLostReasons || saving}
                          onChange={() => toggleReason(r.lost_reason_id)}
                        />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
                {selectedReasons.length === 0 && (
                  <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 6 }}>
                    This lead is marked lost — record why for accurate loss analysis.
                  </div>
                )}
              </div>
            )}

            {/* ── Competitors (ALT-473) ────────────────────────────────── */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                Competitors{' '}
                <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(incumbents we're displacing)</span>
              </div>
              {selectedCompetitors.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {selectedCompetitors.map((id) => {
                    const name = competitorOptions.find((c) => c.competitor_id === id)?.name ?? `#${id}`;
                    return (
                      <span
                        key={id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 12,
                          background: '#F5F3FF',
                          color: '#6D28D9',
                          fontSize: 12,
                        }}
                      >
                        {name}
                        {canEditLostReasons && (
                          <X
                            size={12}
                            style={{ cursor: saving ? 'default' : 'pointer' }}
                            onClick={() => !saving && toggleCompetitor(id)}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              {canEditLostReasons && (
                <>
                  {competitorOptions.filter((c) => !selectedCompetitors.includes(c.competitor_id)).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {competitorOptions
                        .filter((c) => !selectedCompetitors.includes(c.competitor_id))
                        .map((c) => (
                          <button
                            key={c.competitor_id}
                            type="button"
                            disabled={saving}
                            onClick={() => toggleCompetitor(c.competitor_id)}
                            style={{
                              padding: '3px 9px',
                              borderRadius: 12,
                              border: '1px dashed #D1D5DB',
                              background: '#FFFFFF',
                              color: '#6B7280',
                              fontSize: 12,
                              cursor: saving ? 'default' : 'pointer',
                            }}
                          >
                            + {c.name}
                          </button>
                        ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
                    <input
                      type="text"
                      value={newCompetitor}
                      onChange={(e) => setNewCompetitor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void addNewCompetitor();
                        }
                      }}
                      placeholder="Add a competitor…"
                      style={{
                        flex: 1,
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void addNewCompetitor()}
                      disabled={!newCompetitor.trim() || saving}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: !newCompetitor.trim() || saving ? '#C4B5FD' : '#7C3AED',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: !newCompetitor.trim() || saving ? 'default' : 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </>
              )}
              {selectedCompetitors.length === 0 && !canEditLostReasons && (
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>None tagged.</span>
              )}
            </div>

            {/* ── UTM attribution (ALT-470) — read-only chips ──────────── */}
            {hasUtm && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                  Attribution
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    ['Source', utm.utm_source],
                    ['Medium', utm.utm_medium],
                    ['Campaign', utm.utm_campaign],
                  ] as const)
                    .filter(([, v]) => !!v)
                    .map(([k, v]) => (
                      <span
                        key={k}
                        style={{
                          padding: '3px 9px',
                          borderRadius: 12,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          fontSize: 12,
                        }}
                      >
                        {k}: {v}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {error && <div style={{ fontSize: 12, color: '#B91C1C' }}>{error}</div>}
          </>
        )}
      </div>
    </SectionCard>
  );
}
