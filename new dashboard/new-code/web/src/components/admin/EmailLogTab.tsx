/**
 * EmailLogTab — Admin panel: the full outbound email record book (ALT-510).
 * Reads email_log via notify-service (admin-only unfiltered endpoint).
 * Shows system + user sends, success AND failure (with the error text),
 * so "did the email go?" is answered by a screen, not a database query.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchEmailLog, type EmailLogEntry } from '../../data/emailSending';
import { Card, FigmaTableHead, LoadingRow, EmptyRow, ErrorRow } from './primitives';

const COLS = [
  { key: 'when', label: 'When' },
  { key: 'to', label: 'To' },
  { key: 'type', label: 'Type' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status' },
  { key: 'record', label: 'Record' },
];

export function EmailLogTab() {
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchEmailLog({ limit: 200 });
      setEmails(r.emails);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emails.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (q && !(`${e.sent_to ?? ''} ${e.subject ?? ''} ${e.email_type ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [emails, statusFilter, search]);

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ padding: '14px 16px 8px' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Email log</div>
          <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
            Every outbound email — user sends and system mails, successes and failures. Last 200.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search to / subject / type…"
            style={{ fontSize: 12.5, padding: '5px 9px', border: '1px solid #d4d4d8', borderRadius: 6, height: 32, width: 220 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'sent' | 'failed')}
            style={{ fontSize: 12.5, padding: '5px 8px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff', height: 32 }}
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={() => void load()}
            style={{ background: '#fff', border: '1px solid #d4d4d8', borderRadius: 6, height: 32, width: 32, cursor: 'pointer', color: '#52525B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Refresh"
          ><RefreshCw size={13} /></button>
        </div>
      </div>
      <table className="w-full" style={{ fontSize: 12.5, borderCollapse: 'collapse' }}>
        <FigmaTableHead columns={COLS} />
        <tbody>
          {loading && <LoadingRow colSpan={6} />}
          {error && <ErrorRow colSpan={6} label={error} />}
          {!loading && !error && rows.length === 0 && <EmptyRow colSpan={6} label="No emails match." />}
          {!loading && !error && rows.map((e) => (
            <tr key={e.id} style={{ borderTop: '1px solid #F4F4F5' }}>
              <td style={{ padding: '7px 10px 7px 16px', whiteSpace: 'nowrap', color: '#71717A' }}>
                {new Date(e.created_date).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td style={{ padding: '7px 10px' }}>{e.sent_to ?? '—'}</td>
              <td style={{ padding: '7px 10px' }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 9, background: e.email_type === 'user_send' ? '#EFF6FF' : '#F4F4F5', color: e.email_type === 'user_send' ? '#1D4ED8' : '#52525B' }}>
                  {e.email_type ?? '—'}
                </span>
              </td>
              <td style={{ padding: '7px 10px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.subject ?? undefined}>
                {e.subject ?? '—'}
              </td>
              <td style={{ padding: '7px 10px' }}>
                {e.status === 'sent'
                  ? <span style={{ color: '#047857', fontWeight: 600, fontSize: 11.5 }}>✓ sent</span>
                  : (
                    <span className="inline-flex items-center gap-1" style={{ color: '#B91C1C', fontWeight: 600, fontSize: 11.5 }} title={e.error ?? undefined}>
                      <AlertTriangle size={11} /> failed
                    </span>
                  )}
              </td>
              <td style={{ padding: '7px 10px', fontSize: 11.5, color: '#71717A' }}>
                {e.lead_id != null ? `lead #${e.lead_id}` : e.contact_id != null ? `contact #${e.contact_id}` : e.company_id != null ? `company #${e.company_id}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <div className="flex justify-center" style={{ padding: 10 }}><Loader2 size={15} className="animate-spin" color="#71717A" /></div>}
    </Card>
  );
}
