/**
 * CompanyHierarchyCard — ALT-469 parent / subsidiary account hierarchy.
 *
 * Rendered ONLY when COMPANY_HIERARCHY is true (gated by CompanyDetailPage).
 * Self-contained: loads parent + subsidiaries on mount, leaving the page's main
 * load path untouched while the flag is off.
 *
 *   • Shows the parent account (clickable breadcrumb) if set.
 *   • Lists direct subsidiaries (clickable).
 *   • Lets an editor pick / change / clear the parent via a company SearchSelect
 *     (self excluded; a company can't be its own parent).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Building2, CornerDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionCard } from '../admin/primitives';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';
import { COMPANY_HIERARCHY } from '../../lib/companyHierarchyFlag';
import {
  fetchParentCompany,
  fetchSubsidiaries,
  setParentCompany,
  type CompanyRef,
} from '../../data/companyHierarchy';
import { fetchCompanyOptions } from '../../data/contacts';

interface Props {
  companyId: number;
  /** App user_id (number) of the current user — stamps updated_by. */
  actorUserId: number | null;
  /** Whether the current user may change the parent (admin / TL). */
  canEdit: boolean;
}

export function CompanyHierarchyCard({ companyId, actorUserId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parent, setParent] = useState<CompanyRef | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<CompanyRef[]>([]);
  const [companyOptions, setCompanyOptions] = useState<{ company_id: number; company_name: string | null }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, subs] = await Promise.all([
        fetchParentCompany(companyId),
        fetchSubsidiaries(companyId),
      ]);
      setParent(p);
      setSubsidiaries(subs);
      if (canEdit) setCompanyOptions(await fetchCompanyOptions());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  }, [companyId, canEdit]);

  useEffect(() => {
    if (!COMPANY_HIERARCHY) return;
    void load();
  }, [load]);

  // Company picker options — exclude self (can't parent to itself).
  const parentOptions: SearchSelectOption[] = useMemo(
    () =>
      companyOptions
        .filter((c) => c.company_id !== companyId)
        .map((c) => ({ id: c.company_id, label: c.company_name ?? `Company #${c.company_id}` })),
    [companyOptions, companyId],
  );

  const handleSetParent = useCallback(
    async (parentId: number | null) => {
      if (saving) return;
      setSaving(true);
      setError(null);
      const res = await setParentCompany(
        companyId,
        parentId,
        actorUserId != null ? String(actorUserId) : 'unknown',
      );
      if (res.ok) {
        await load();
      } else {
        setError(res.error);
      }
      setSaving(false);
    },
    [companyId, actorUserId, saving, load],
  );

  if (!COMPANY_HIERARCHY) return null;

  return (
    <SectionCard title="Account hierarchy">
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 13 }}>
            <Loader2 size={14} className="spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Parent */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                Parent account
              </div>
              {parent ? (
                <Link
                  to={`/companies/${parent.company_id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: '#1D4ED8',
                    textDecoration: 'none',
                  }}
                >
                  <Building2 size={14} />
                  {parent.company_name ?? `Company #${parent.company_id}`}
                </Link>
              ) : (
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>Top-level (no parent)</span>
              )}
              {canEdit && (
                <div style={{ marginTop: 10, maxWidth: 360 }}>
                  <SearchSelect
                    options={parentOptions}
                    value={parent?.company_id ?? null}
                    onChange={handleSetParent}
                    placeholder={saving ? 'Saving…' : 'Set parent company…'}
                    disabled={saving}
                  />
                  {parent && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSetParent(null)}
                      style={{
                        marginTop: 6,
                        background: 'none',
                        border: 'none',
                        color: '#6B7280',
                        fontSize: 12,
                        cursor: saving ? 'default' : 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear parent
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Subsidiaries */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                Subsidiaries{subsidiaries.length > 0 ? ` (${subsidiaries.length})` : ''}
              </div>
              {subsidiaries.length === 0 ? (
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>None</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {subsidiaries.map((s) => (
                    <Link
                      key={s.company_id}
                      to={`/companies/${s.company_id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        color: '#374151',
                        textDecoration: 'none',
                      }}
                    >
                      <CornerDownRight size={13} style={{ color: '#9CA3AF' }} />
                      {s.company_name ?? `Company #${s.company_id}`}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={{ fontSize: 12, color: '#B91C1C' }}>{error}</div>}
          </>
        )}
      </div>
    </SectionCard>
  );
}
