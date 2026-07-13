/**
 * EmailActivityPanel — "Emails" list for one record (ALT-510).
 *
 * Reads email_log via the notify-service (GET /api/email/log?lead_id=…)
 * so users see every email tied to the record — sent AND failed (failures
 * show their error so nobody wonders "did it go?"). Mounted on the Lead,
 * Contact and Company detail pages.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Mail, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchEmailLog, type EmailLogEntry } from '../../data/emailSending';

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function EmailActivityPanel({
  leadId,
  contactId,
  companyId,
  refreshKey = 0,
}: {
  leadId?: number | null;
  contactId?: number | null;
  companyId?: number | null;
  /** Bump after a send so the list refreshes. */
  refreshKey?: number;
}) {
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const filter =
        leadId != null ? { lead_id: leadId } :
        contactId != null ? { contact_id: contactId } :
        companyId != null ? { company_id: companyId } : null;
      if (!filter) { setEmails([]); return; }
      const r = await fetchEmailLog({ ...filter, limit: 25 });
      setEmails(r.emails);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [leadId, contactId, companyId, refreshKey]);

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <div className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600 }}>
          <Mail size={14} color="#71717A" /> Emails
          {emails.length > 0 && <span style={{ fontSize: 11, color: '#71717A', fontWeight: 500 }}>({emails.length})</span>}
        </div>
        <button
          onClick={() => void load()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: 2 }}
          aria-label="Refresh emails"
          title="Refresh"
        ><RefreshCw size={13} /></button>
      </div>

      {loading && <div className="flex items-center gap-2" style={{ fontSize: 12, color: '#71717A', padding: '6px 0' }}><Loader2 size={13} className="animate-spin" /> Loading…</div>}
      {error && <div style={{ fontSize: 12, color: '#B91C1C', padding: '6px 0' }}>{error}</div>}
      {!loading && !error && emails.length === 0 && (
        <div style={{ fontSize: 12, color: '#9CA3AF', padding: '6px 0' }}>
          No emails yet — use "Send email" on this record.
        </div>
      )}

      {!loading && !error && emails.map((e) => (
        <div key={e.id} style={{ borderTop: '1px solid #F4F4F5', padding: '8px 0' }}>
          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.subject || '(no subject)'}
            </span>
            <span style={{ fontSize: 11, color: '#71717A', flexShrink: 0 }}>{fmtWhen(e.created_date)}</span>
          </div>
          <div className="flex items-center gap-2" style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
            <span>to {e.sent_to}</span>
            {e.status === 'sent'
              ? <span style={{ color: '#047857', fontWeight: 600 }}>✓ sent</span>
              : (
                <span className="inline-flex items-center gap-1" style={{ color: '#B91C1C', fontWeight: 600 }} title={e.error ?? undefined}>
                  <AlertTriangle size={11} /> failed{e.error ? ` — ${e.error.slice(0, 60)}` : ''}
                </span>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
