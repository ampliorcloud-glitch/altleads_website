/**
 * DepartingUserReassignTab — Admin tool to transfer all owned records from a
 * departing user to one or more new owners (ALT-443).
 *
 * Flow:
 *  1. Pick the departing user (dropdown of all users).
 *  2. See how many leads / companies / contacts they own.
 *  3. Pick new owner(s) + optional max-per-company cap.
 *  4. Confirm → reassign all via existing primitives + distributeRecords.
 *
 * Always visible to admins (AdminPage is isAdmin-gated). No feature flag needed.
 *
 * Pattern mirrors HbProjectSettingsTab:
 *  - Card for the user-picker, SectionCard for the details + action panel.
 *  - GhostButton / PrimaryButton from Modal.tsx.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Info, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  countOwnedRecords,
  fetchOwnedLeadIds,
  fetchOwnedCompanyRows,
  fetchOwnedContactRows,
  reassignLeadsBulk,
  reassignCompaniesBulk,
  reassignContactsBulk,
  fetchAssignableUsers,
} from '../../data/assignment';
import { distributeRecords } from '../../data/bulkActions';
import type { UserOption } from '../../data/wishlist';
import { Card, SectionCard } from './primitives';
import { GhostButton, PrimaryButton } from './Modal';
import { BulkProgressBar } from '../common/BulkProgressBar';

// ── Lightweight user-list for the departing-user picker ──────────────────────

interface UserRow {
  user_id: number;
  full_name: string;
}

async function fetchAllUsersMini(): Promise<UserRow[]> {
  const { data } = await supabase
    .from('user_master')
    .select('user_id, full_name')
    .is('deleted_date', null)
    .order('full_name', { ascending: true });
  return ((data ?? []) as { user_id: number; full_name: string | null }[])
    .map((u) => ({ user_id: u.user_id, full_name: (u.full_name ?? '').trim() || `User #${u.user_id}` }));
}

// ── Count card ────────────────────────────────────────────────────────────────

function CountRow({ label, count, loading }: { label: string; count: number; loading: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
      {loading ? (
        <Loader2 size={13} className="animate-spin" style={{ color: '#9CA3AF' }} />
      ) : (
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: count > 0 ? '#1A7EE8' : '#9CA3AF',
            minWidth: 32,
            textAlign: 'right',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function DepartingUserReassignTab({ actorId }: { actorId: string }) {
  // User list
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Departing user selection
  const [departingUserId, setDepartingUserId] = useState<number | null>(null);

  // Record counts for the departing user
  const [counts, setCounts] = useState<{ leads: number; contacts: number; companies: number } | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [countsError, setCountsError] = useState<string | null>(null);

  // New owner(s)
  const [candidateOwners, setCandidateOwners] = useState<UserOption[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<Set<number>>(new Set());
  const [maxPerCompanyStr, setMaxPerCompanyStr] = useState('');

  // Execution state
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ leads: number; companies: number; contacts: number } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  /* Load all users once */
  useEffect(() => {
    fetchAllUsersMini().then((rows) => {
      setAllUsers(rows);
      setUsersLoading(false);
    }).catch((e: unknown) => {
      setUsersError((e as Error).message ?? 'Failed to load users.');
      setUsersLoading(false);
    });
  }, []);

  /* Load counts + candidate owners when departing user changes */
  useEffect(() => {
    if (departingUserId == null) {
      setCounts(null);
      setCandidateOwners([]);
      setSelectedOwnerIds(new Set());
      setMaxPerCompanyStr('');
      setRunResult(null);
      setRunError(null);
      return;
    }
    setCountsLoading(true);
    setCountsError(null);
    setCounts(null);
    setRunResult(null);
    setRunError(null);

    setOwnersLoading(true);

    Promise.all([
      countOwnedRecords(departingUserId),
      fetchAssignableUsers(null),
    ]).then(([countRes, owners]) => {
      if (countRes.error) {
        setCountsError(countRes.error);
      } else {
        setCounts({ leads: countRes.leads, contacts: countRes.contacts, companies: countRes.companies });
      }
      setCountsLoading(false);
      // Filter out the departing user from the candidate list.
      setCandidateOwners(owners.filter((o) => o.id !== departingUserId));
      setOwnersLoading(false);
      setSelectedOwnerIds(new Set());
    });
  }, [departingUserId]);

  const toggleOwner = (id: number) => {
    setSelectedOwnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const capVal = maxPerCompanyStr.trim() !== '' ? parseInt(maxPerCompanyStr, 10) : undefined;
  const capInvalid = maxPerCompanyStr.trim() !== '' && (isNaN(capVal!) || capVal! <= 0);
  const multiOwner = selectedOwnerIds.size >= 2;

  const totalOwnedCount = (counts?.leads ?? 0) + (counts?.companies ?? 0) + (counts?.contacts ?? 0);

  const canRun =
    !running &&
    departingUserId != null &&
    selectedOwnerIds.size > 0 &&
    totalOwnedCount > 0 &&
    !capInvalid;

  const handleRun = async () => {
    if (!canRun || departingUserId == null) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    const ac = new AbortController();
    abortRef.current = ac;

    const ownerIds = [...selectedOwnerIds];
    const cap = capVal && !capInvalid ? capVal : undefined;
    let leadsOk = 0, companiesOk = 0, contactsOk = 0;
    let firstErr: string | null = null;

    try {
      // ── Leads ─────────────────────────────────────────────────
      const leadIds = await fetchOwnedLeadIds(departingUserId);
      const totalLeads = leadIds.length;
      if (totalLeads > 0 && !ac.signal.aborted) {
        const records = leadIds.map((id) => ({ id, companyKey: null }));
        const slices = distributeRecords(records, ownerIds, { maxPerCompany: cap });
        const baseTotal = totalLeads + (counts?.companies ?? 0) + (counts?.contacts ?? 0);
        let done = 0;
        setProgress({ done, total: baseTotal });

        for (const [ownerId, ids] of slices) {
          if (ac.signal.aborted) break;
          if (ids.length === 0) continue;
          const res = await reassignLeadsBulk(ids, ownerId, actorId, {
            signal: ac.signal,
            onProgress: (ownerDone) => setProgress({ done: done + ownerDone, total: baseTotal }),
          });
          leadsOk += res.ok;
          done += res.ok + res.failed;
          if (!firstErr && res.error) firstErr = res.error;
          setProgress({ done, total: baseTotal });
        }
      }

      // ── Companies ─────────────────────────────────────────────
      const companyRows = await fetchOwnedCompanyRows(departingUserId);
      if (companyRows.length > 0 && !ac.signal.aborted) {
        // Group by project_id — reassignCompaniesBulk requires a project.
        const byProject = new Map<number, number[]>();
        for (const r of companyRows) {
          const arr = byProject.get(r.project_id) ?? [];
          arr.push(r.company_id);
          byProject.set(r.project_id, arr);
        }
        const totalSoFar = leadsOk;
        const baseTotal = (counts?.leads ?? 0) + companyRows.length + (counts?.contacts ?? 0);
        let done = totalSoFar;
        setProgress({ done, total: baseTotal });

        for (const [projectId, companyIds] of byProject) {
          if (ac.signal.aborted) break;
          const records = companyIds.map((id) => ({ id, companyKey: id }));
          const slices = distributeRecords(records, ownerIds, { maxPerCompany: cap });
          for (const [ownerId, ids] of slices) {
            if (ac.signal.aborted) break;
            if (ids.length === 0) continue;
            const res = await reassignCompaniesBulk(ids, projectId, ownerId, actorId, {
              signal: ac.signal,
              onProgress: () => setProgress({ done, total: baseTotal }),
            });
            companiesOk += res.ok;
            done += res.ok + res.failed;
            if (!firstErr && res.error) firstErr = res.error;
            setProgress({ done, total: baseTotal });
          }
        }
      }

      // ── Contacts ──────────────────────────────────────────────
      const contactRows = await fetchOwnedContactRows(departingUserId);
      if (contactRows.length > 0 && !ac.signal.aborted) {
        const byProject = new Map<number, number[]>();
        for (const r of contactRows) {
          const arr = byProject.get(r.project_id) ?? [];
          arr.push(r.contact_id);
          byProject.set(r.project_id, arr);
        }
        const baseTotal = (counts?.leads ?? 0) + (counts?.companies ?? 0) + contactRows.length;
        let done = leadsOk + companiesOk;
        setProgress({ done, total: baseTotal });

        for (const [projectId, contactIds] of byProject) {
          if (ac.signal.aborted) break;
          // For contacts, we don't have company_id here; use contact_id as key (no grouping needed).
          const records = contactIds.map((id) => ({ id, companyKey: null }));
          const slices = distributeRecords(records, ownerIds, { maxPerCompany: cap });
          for (const [ownerId, ids] of slices) {
            if (ac.signal.aborted) break;
            if (ids.length === 0) continue;
            const res = await reassignContactsBulk(ids, projectId, ownerId, actorId, {
              signal: ac.signal,
              onProgress: () => setProgress({ done, total: baseTotal }),
            });
            contactsOk += res.ok;
            done += res.ok + res.failed;
            if (!firstErr && res.error) firstErr = res.error;
            setProgress({ done, total: baseTotal });
          }
        }
      }
    } catch (e: unknown) {
      firstErr = (e as Error).message ?? 'Unknown error.';
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }

    if (firstErr && leadsOk + companiesOk + contactsOk === 0) {
      setRunError(firstErr);
      return;
    }

    setRunResult({ leads: leadsOk, companies: companiesOk, contacts: contactsOk });
    // Refresh counts for the departing user.
    const refreshed = await countOwnedRecords(departingUserId);
    if (!refreshed.error) {
      setCounts({ leads: refreshed.leads, contacts: refreshed.contacts, companies: refreshed.companies });
    }
    if (firstErr) {
      setRunError(`Partially completed — some records could not be reassigned: ${firstErr}`);
    }
  };

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Explainer */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <Info size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          <strong>Departing user tool:</strong>{' '}
          Transfers ALL owned records (leads, companies, contacts) from one user to one or more new
          owners. Distribution is round-robin; an optional "Max per company" cap limits how many
          records from the same company any single new owner receives.{' '}
          <strong>This action cannot be undone in bulk</strong> — verify the record counts before
          confirming.
          {/* TODO(gatekeeper ALT-431): route write calls through the gatekeeper once RLS lands. */}
        </div>
      </div>

      {/* Departing user picker */}
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <label
            style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Departing user
          </label>
        </div>
        <div style={{ padding: '14px 20px' }}>
          {usersLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF' }}>
              <Loader2 size={14} className="animate-spin" /> Loading users...
            </div>
          ) : usersError ? (
            <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{usersError}</p>
          ) : (
            <select
              value={departingUserId ?? ''}
              onChange={(e) => setDepartingUserId(e.target.value === '' ? null : Number(e.target.value))}
              style={{
                fontSize: 13,
                padding: '7px 10px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                background: '#fff',
                color: '#374151',
                height: 36,
                width: '100%',
                maxWidth: 420,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">— choose a user —</option>
              {allUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* Record counts + reassignment panel */}
      {departingUserId != null && (
        <SectionCard
          title={allUsers.find((u) => u.user_id === departingUserId)?.full_name ?? `User #${departingUserId}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserX size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Departing user</span>
            </div>
          }
        >
          {/* Counts */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Owned records
            </div>
            {countsError ? (
              <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{countsError}</p>
            ) : (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden', background: '#FAFAFA' }}>
                <CountRow label="Leads (lead_report.user_id)" count={counts?.leads ?? 0} loading={countsLoading} />
                <CountRow label="Companies (company_project_status)" count={counts?.companies ?? 0} loading={countsLoading} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>Contacts (contact_project_status)</span>
                  {countsLoading ? (
                    <Loader2 size={13} className="animate-spin" style={{ color: '#9CA3AF' }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: (counts?.contacts ?? 0) > 0 ? '#1A7EE8' : '#9CA3AF', minWidth: 32, textAlign: 'right' }}>
                      {counts?.contacts ?? 0}
                    </span>
                  )}
                </div>
              </div>
            )}
            {!countsLoading && counts != null && totalOwnedCount === 0 && (
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                This user has no owned records. Nothing to reassign.
              </p>
            )}
          </div>

          {/* New owner(s) */}
          {!countsLoading && counts != null && totalOwnedCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  New owner(s)
                </div>
                {ownersLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF' }}>
                    <Loader2 size={14} className="animate-spin" /> Loading owners...
                  </div>
                ) : candidateOwners.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#9CA3AF' }}>No eligible owners found.</p>
                ) : (
                  <>
                    <div
                      style={{
                        maxHeight: 200,
                        overflowY: 'auto',
                        border: '1px solid #D1D5DB',
                        borderRadius: 6,
                        padding: '4px 0',
                      }}
                    >
                      {candidateOwners.map((o) => {
                        const checked = selectedOwnerIds.has(o.id);
                        return (
                          <label
                            key={o.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              cursor: running ? 'not-allowed' : 'pointer',
                              background: checked ? '#EFF6FF' : 'transparent',
                              fontSize: 13,
                              color: '#374151',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={running}
                              onChange={() => toggleOwner(o.id)}
                              style={{ accentColor: '#1A7EE8', width: 14, height: 14, flexShrink: 0 }}
                            />
                            {o.label}
                          </label>
                        );
                      })}
                    </div>
                    {selectedOwnerIds.size > 0 && (
                      <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                        {selectedOwnerIds.size} selected
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Max per company — only show when 2+ owners */}
              {multiOwner && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Max per company{' '}
                    <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxPerCompanyStr}
                    onChange={(e) => setMaxPerCompanyStr(e.target.value)}
                    disabled={running}
                    placeholder="e.g. 3 — leave blank for no limit"
                    style={{
                      fontSize: 13,
                      padding: '7px 10px',
                      border: `1px solid ${capInvalid ? '#EF4444' : '#D1D5DB'}`,
                      borderRadius: 6,
                      background: '#fff',
                      color: '#374151',
                      height: 36,
                      width: '100%',
                      maxWidth: 280,
                      outline: 'none',
                    }}
                  />
                  {capInvalid && (
                    <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>Must be a positive whole number.</p>
                  )}
                  <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                    Limits how many records from the same company any single new owner receives.
                  </p>
                </div>
              )}

              {/* Progress bar */}
              {running && progress && (
                <BulkProgressBar done={progress.done} total={progress.total} />
              )}

              {/* Result / error feedback */}
              {runResult && !runError && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #86EFAC',
                    borderRadius: 6,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#166534',
                  }}
                >
                  Done: reassigned{' '}
                  <strong>{runResult.leads}</strong> lead{runResult.leads !== 1 ? 's' : ''},{' '}
                  <strong>{runResult.companies}</strong> compan{runResult.companies !== 1 ? 'ies' : 'y'},{' '}
                  <strong>{runResult.contacts}</strong> contact{runResult.contacts !== 1 ? 's' : ''}.
                </div>
              )}
              {runError && (
                <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{runError}</p>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                {running ? (
                  <GhostButton onClick={() => abortRef.current?.abort()} disabled={false}>
                    Cancel
                  </GhostButton>
                ) : (
                  <GhostButton
                    onClick={() => {
                      setSelectedOwnerIds(new Set());
                      setMaxPerCompanyStr('');
                      setRunResult(null);
                      setRunError(null);
                    }}
                    disabled={running}
                  >
                    Reset
                  </GhostButton>
                )}
                <PrimaryButton onClick={handleRun} disabled={!canRun}>
                  {running && <Loader2 size={13} className="animate-spin" />}
                  Reassign all
                </PrimaryButton>
              </div>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
