/**
 * SendingDomainsTab — Admin panel tab for email sending domains
 * (ALT-503/506, ADR-35: per-project domain-authenticated sending).
 *
 * Sections:
 *   1. Domain registry — add a domain, see its required DNS records
 *      (SPF / DKIM / DMARC) with copy buttons, run live verification.
 *      Sending from a domain is blocked server-side until it verifies.
 *   2. Per-project sending domain — each project picks one VERIFIED
 *      domain; no row = fallback domain (shown in the header).
 */

import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Copy, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import {
  fetchDomains,
  addDomain,
  verifyDomain,
  setProjectDomain,
  setAlias,
  type DomainsResponse,
  type SendingDomain,
} from '../../data/emailSending';
import { supabase } from '../../lib/supabase';
import { Card, FigmaTableHead, LoadingRow, EmptyRow, ErrorRow, AddButton } from './primitives';
import { Modal, Field, TextInput, PrimaryButton, GhostButton } from './Modal';
import { useToast } from '../ui/Toast';

interface ProjectRow { project_id: number; project_name: string; }
interface UserRow { user_id: number; full_name: string; }

function StatusChip({ status }: { status: SendingDomain['status'] }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    verified: { bg: '#ECFDF5', fg: '#047857', label: '✓ Verified' },
    pending:  { bg: '#FFF7ED', fg: '#C2410C', label: '⏳ DNS pending' },
    disabled: { bg: '#F4F4F5', fg: '#71717A', label: 'Disabled' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10 }}>
      {s.label}
    </span>
  );
}

export function SendingDomainsTab({ actorId: _actorId }: { actorId: string | null }) {
  const toast = useToast();
  const [data, setData] = useState<DomainsResponse | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newProvider, setNewProvider] = useState<'google' | 'microsoft' | 'relay'>('relay');
  const [adding, setAdding] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [ovUser, setOvUser] = useState<number | null>(null);
  const [ovDomain, setOvDomain] = useState<number | null>(null);
  const [ovAlias, setOvAlias] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [d, { data: projs, error: pErr }, { data: us }] = await Promise.all([
        fetchDomains(),
        supabase.from('project').select('project_id, project_name').order('project_name'),
        supabase.from('user_master').select('user_id, full_name').is('deleted_date', null).order('full_name'),
      ]);
      if (pErr) throw pErr;
      setData(d);
      setProjects((projs ?? []) as ProjectRow[]);
      setUsers((us ?? []) as UserRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function onAdd() {
    const dom = newDomain.trim().toLowerCase();
    if (!dom) return;
    setAdding(true);
    try {
      await addDomain(dom, newProvider);
      toast.success(`Domain added — now add its DNS records, then Verify`);
      setAddOpen(false);
      setNewDomain('');
      setNewProvider('relay');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  }

  async function onVerify(id: number) {
    setVerifying(id);
    try {
      const r = await verifyDomain(id);
      if (r.verified) toast.success('Domain verified — sending enabled ✓');
      else toast.error('Not verified yet — DNS records missing or still propagating (can take up to a few hours)');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(null);
    }
  }

  async function onSetProject(projectId: number, domainId: number | null) {
    try {
      await setProjectDomain(projectId, domainId);
      toast.success('Project sending domain saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async function onSaveAlias() {
    if (ovUser == null || ovDomain == null || !ovAlias.trim()) return;
    try {
      await setAlias(ovUser, ovDomain, ovAlias.trim());
      toast.success('Alias override saved');
      setOvUser(null); setOvDomain(null); setOvAlias('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save alias');
    }
  }

  async function onClearAlias(userId: number, domainId: number) {
    try {
      await setAlias(userId, domainId, null);
      toast.success('Override removed — back to auto alias');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  }

  const verified = (data?.domains ?? []).filter((d) => d.status === 'verified');
  const settingFor = (pid: number) => data?.settings.find((s) => s.project_id === pid)?.domain_id ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1 · Domain registry ─────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between" style={{ padding: '14px 16px 6px' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sending domains</div>
            <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
              Emails users send from the CRM go out as <b>their-name@domain</b>. A domain must be
              DNS-verified before it can send.{' '}
              {data?.relay === 'fallback' && (
                <span style={{ color: '#C2410C' }}>
                  Relay not configured yet — sends currently go via the system mailbox with the user as Reply-To.
                </span>
              )}
            </div>
          </div>
          <AddButton label="Add domain" onClick={() => setAddOpen(true)} />
        </div>
        <table className="w-full" style={{ fontSize: 12.5, borderCollapse: 'collapse' }}>
          <FigmaTableHead columns={[{ key: 'x', label: '' }, { key: 'domain', label: 'Domain' }, { key: 'status', label: 'Status' }, { key: 'verified', label: 'Verified at' }, { key: 'actions', label: 'Actions' }]} />
          <tbody>
            {loading && <LoadingRow colSpan={5} />}
            {error && <ErrorRow colSpan={5} label={error} />}
            {!loading && !error && (data?.domains.length ?? 0) === 0 && (
              <EmptyRow colSpan={5} label="No sending domains yet — add amplior.com to start." />
            )}
            {!loading && !error && data?.domains.map((d) => (
              <React.Fragment key={d.domain_id}>
                <tr style={{ borderTop: '1px solid #F4F4F5' }}>
                  <td style={{ width: 34, padding: '8px 0 8px 14px' }}>
                    <button
                      onClick={() => setExpanded(expanded === d.domain_id ? null : d.domain_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: 2 }}
                      aria-label="Show DNS records"
                    >
                      {expanded === d.domain_id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                    <span className="inline-flex items-center gap-1.5"><Globe size={13} color="#71717A" />{d.domain}</span>
                    {d.domain === data.fallback_domain && (
                      <span style={{ fontSize: 10.5, color: '#71717A', marginLeft: 8 }}>(fallback)</span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 8, padding: '1px 7px', borderRadius: 8, background: d.provider === 'google' ? '#FEF3C7' : d.provider === 'microsoft' ? '#DBEAFE' : '#F4F4F5', color: d.provider === 'google' ? '#92400E' : d.provider === 'microsoft' ? '#1E40AF' : '#52525B' }}>
                      {d.provider === 'google' ? 'Google Workspace' : d.provider === 'microsoft' ? 'Microsoft 365' : 'relay only'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}><StatusChip status={d.status} /></td>
                  <td style={{ padding: '8px 10px', color: '#71717A' }}>
                    {d.verified_at ? new Date(d.verified_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <GhostButton onClick={() => void onVerify(d.domain_id)} disabled={verifying === d.domain_id}>
                      {verifying === d.domain_id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <span className="inline-flex items-center gap-1"><RefreshCw size={12} />Verify DNS</span>}
                    </GhostButton>
                  </td>
                </tr>
                {expanded === d.domain_id && (
                  <tr>
                    <td colSpan={5} style={{ background: '#FAFAFA', padding: '10px 16px 14px 48px' }}>
                      <div style={{ fontSize: 11.5, color: '#52525B', marginBottom: 8 }}>
                        Add these records in the domain's DNS panel (GoDaddy / Hostinger / Cloudflare — wherever
                        the domain is managed), then click <b>Verify DNS</b>. DKIM value comes from the relay
                        provider once configured.
                      </div>
                      <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr style={{ color: '#71717A', textAlign: 'left' }}>
                            <th style={{ padding: '4px 8px' }}>Purpose</th>
                            <th style={{ padding: '4px 8px' }}>Type</th>
                            <th style={{ padding: '4px 8px' }}>Host / Name</th>
                            <th style={{ padding: '4px 8px' }}>Value</th>
                            <th style={{ padding: '4px 8px' }}>Check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(d.dns_records ?? []).map((r, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #EEE' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600, textTransform: 'uppercase', fontSize: 10.5 }}>{r.purpose}</td>
                              <td style={{ padding: '6px 8px' }}>{r.type}</td>
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{r.host}</td>
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, maxWidth: 380, wordBreak: 'break-all' }}>
                                {r.value}
                                <button
                                  onClick={() => { void navigator.clipboard.writeText(r.value); toast.success('Copied'); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A7EE8', marginLeft: 6, verticalAlign: 'middle' }}
                                  aria-label="Copy value"
                                ><Copy size={12} /></button>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                {r.verified
                                  ? <span style={{ color: '#047857', fontWeight: 600 }}>✓</span>
                                  : <span style={{ color: '#C2410C' }} title={r.seen}>✗</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── 2 · Per-project sending domain ───────────────────────── */}
      <Card>
        <div style={{ padding: '14px 16px 6px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Per-project sending domain</div>
          <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
            Each project sends from ONE verified domain. Projects without a pick use the fallback
            ({data?.fallback_domain ?? 'amplior.com'}). Changing it affects future emails only.
          </div>
        </div>
        <table className="w-full" style={{ fontSize: 12.5, borderCollapse: 'collapse' }}>
          <FigmaTableHead columns={[{ key: 'project', label: 'Project' }, { key: 'domain', label: 'Sending domain' }]} />
          <tbody>
            {loading && <LoadingRow colSpan={2} />}
            {!loading && projects.length === 0 && <EmptyRow colSpan={2} label="No projects" />}
            {!loading && projects.map((p) => (
              <tr key={p.project_id} style={{ borderTop: '1px solid #F4F4F5' }}>
                <td style={{ padding: '8px 16px', fontWeight: 500 }}>{p.project_name}</td>
                <td style={{ padding: '8px 16px' }}>
                  <select
                    value={settingFor(p.project_id) ?? ''}
                    onChange={(e) => void onSetProject(p.project_id, e.target.value === '' ? null : Number(e.target.value))}
                    style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', minWidth: 260 }}
                  >
                    <option value="">Fallback — {data?.fallback_domain}</option>
                    {verified.map((d) => (
                      <option key={d.domain_id} value={d.domain_id}>{d.domain}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── 3 · Alias overrides (3b) — default is auto-alias (3a) ── */}
      <Card>
        <div style={{ padding: '14px 16px 10px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>From-address overrides (optional)</div>
          <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
            By default a user sends as their own email name on the project's domain (e.g. priya@ →
            priya@outreach-domain). Add an override only when someone should send under a different name.
          </div>
          <div className="flex items-end gap-2 flex-wrap" style={{ marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#71717A', marginBottom: 4 }}>User</div>
              <select value={ovUser ?? ''} onChange={(e) => setOvUser(e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', minWidth: 200, height: 32 }}>
                <option value="">Select user…</option>
                {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#71717A', marginBottom: 4 }}>Domain</div>
              <select value={ovDomain ?? ''} onChange={(e) => setOvDomain(e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', minWidth: 200, height: 32 }}>
                <option value="">Select domain…</option>
                {(data?.domains ?? []).map((d) => <option key={d.domain_id} value={d.domain_id}>{d.domain}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#71717A', marginBottom: 4 }}>Alias (before the @)</div>
              <input value={ovAlias} onChange={(e) => setOvAlias(e.target.value)}
                placeholder="e.g. priya.sharma"
                style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', minWidth: 170, height: 32 }} />
            </div>
            <GhostButton
              onClick={() => void onSaveAlias()}
              disabled={ovUser == null || ovDomain == null || !ovAlias.trim()}
            >Save override</GhostButton>
          </div>
          {(data?.aliases.length ?? 0) > 0 && (
            <table style={{ fontSize: 12, borderCollapse: 'collapse', marginTop: 12, width: '100%' }}>
              <thead>
                <tr style={{ color: '#71717A', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>User</th>
                  <th style={{ padding: '4px 8px' }}>Sends as</th>
                  <th style={{ padding: '4px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {data!.aliases.map((a) => {
                  const dom = data!.domains.find((d) => d.domain_id === a.domain_id);
                  const u = users.find((x) => x.user_id === a.user_id);
                  return (
                    <tr key={`${a.user_id}-${a.domain_id}`} style={{ borderTop: '1px solid #F4F4F5' }}>
                      <td style={{ padding: '6px 8px' }}>{u?.full_name ?? a.user_id}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11.5 }}>{a.alias}@{dom?.domain ?? '?'}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <button
                          onClick={() => void onClearAlias(a.user_id, a.domain_id)}
                          style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontSize: 11.5 }}
                        >Remove (back to auto)</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* ── Add-domain modal ─────────────────────────────────────── */}
      <Modal
        open={addOpen}
        title="Add sending domain"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <GhostButton onClick={() => setAddOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void onAdd()} disabled={adding || !newDomain.trim()}>
              {adding ? <Loader2 size={14} className="animate-spin" /> : 'Add domain'}
            </PrimaryButton>
          </>
        }
      >
        <Field label="Domain (the part after the @ in the From address)">
          <TextInput
            value={newDomain}
            onChange={setNewDomain}
            placeholder="e.g. amplior.com or outreach.client-name.com"
          />
        </Field>
        <div style={{ marginTop: 10 }}>
          <Field label="Where do this domain's mailboxes live? (decides which connect option users get)">
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value as 'google' | 'microsoft' | 'relay')}
              style={{ fontSize: 13, padding: '6px 9px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', height: 34, width: '100%' }}
            >
              <option value="relay">No real mailboxes — relay sending only</option>
              <option value="google">Google Workspace (Gmail mailboxes)</option>
              <option value="microsoft">Microsoft 365 (Outlook mailboxes)</option>
            </select>
          </Field>
        </div>
        <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 8 }}>
          After adding, you'll get 3 DNS records (SPF · DKIM · DMARC) to place in the domain's DNS.
          Sending stays blocked until verification passes — this protects deliverability.
        </div>
      </Modal>
    </div>
  );
}
