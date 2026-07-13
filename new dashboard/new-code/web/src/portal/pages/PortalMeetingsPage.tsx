/**
 * Client Portal — MEETINGS LIST (NET-NEW page, ALT-234).
 *
 * Requires the portal schema applied to the DB AND added to Supabase API exposed
 * schemas; inert until then. (Until both are done, fetchPortalMeetings resolves to
 * an error and this page shows its error/retry state.)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DATA ISOLATION (non-negotiable): this page reads ONLY from ../data/portal
 * (fetchPortalMeetings → the SECURITY-INVOKER portal.portal_meetings view over
 * portal.meeting_snapshot, RLS-scoped to the caller's tenant/role). It NEVER imports
 * or reuses any CRM page or CRM data module (LeadsPage / LeadDetailPage / realLeads /
 * leadWorkspace / companies / meeting_master etc.) — those read the live shared tables
 * and would leak one client's work to another. Only the portal data layer, the shared
 * presentational UI primitives, and react-router are imported here.
 *
 * A brand-new screen (not a re-skin of a CRM list): the vendor mobile meetings list
 * flow ported to responsive web, reading the snapshot only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X, ChevronRight, RotateCw, CalendarClock } from 'lucide-react';
import {
  fetchPortalMeetings,
  type PortalMeeting,
} from '../data/portal';
import { SkeletonTable } from '../../components/ui/Skeleton';

/** Pseudo status value for the "all statuses" filter option. */
const ALL_STATUSES = '__all__';

/** Load lifecycle for the list fetch. */
type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; rows: PortalMeeting[] };

const ACCENT = '#1A7EE8';

/**
 * Status → pill colours. Unknown/empty statuses fall back to a neutral grey so a new
 * status value from the snapshot never breaks the page.
 */
const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  scheduled:   { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  confirmed:   { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  completed:   { bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
  rescheduled: { bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
  cancelled:   { bg: 'rgba(196,77,77,0.06)', fg: '#B91C1C', border: 'rgba(196,77,77,0.15)' },
  dropped:     { bg: 'rgba(196,77,77,0.06)', fg: '#B91C1C', border: 'rgba(196,77,77,0.15)' },
  missed:      { bg: 'rgba(196,77,77,0.06)', fg: '#B91C1C', border: 'rgba(196,77,77,0.15)' },
};
const STATUS_FALLBACK = { bg: '#F3F4F6', fg: '#4B5563', border: '#E5E7EB' };

function statusStyle(status: string | null) {
  if (!status) return STATUS_FALLBACK;
  return STATUS_STYLE[status.trim().toLowerCase()] ?? STATUS_FALLBACK;
}

/** Render the snapshot date + free-text time into one human label. */
function formatWhen(date: string | null, time: string | null): string {
  let datePart = '';
  if (date) {
    const parsed = Date.parse(date);
    datePart = Number.isNaN(parsed)
      ? date
      : new Date(parsed).toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
  }
  const timePart = time ? time.trim() : '';
  if (datePart && timePart) return `${datePart} · ${timePart}`;
  return datePart || timePart || '—';
}

/** Plain dash for any empty snapshot cell. */
function orDash(value: string | null): string {
  const v = value?.trim();
  return v ? v : '—';
}

export function PortalMeetingsPage() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    const result = await fetchPortalMeetings();
    if (!result.ok) {
      setState({ phase: 'error', message: result.error });
      return;
    }
    setState({ phase: 'ready', rows: result.data });
  }, []);

  useEffect(() => {
    let active = true;
    setState({ phase: 'loading' });
    fetchPortalMeetings().then((result) => {
      if (!active) return;
      if (!result.ok) setState({ phase: 'error', message: result.error });
      else setState({ phase: 'ready', rows: result.data });
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = state.phase === 'ready' ? state.rows : [];

  // Distinct status values present in the data, for the filter dropdown.
  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>(); // lower → original label
    for (const r of rows) {
      const label = r.meeting_status?.trim();
      if (label) seen.set(label.toLowerCase(), label);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Apply the search box + status filter.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wantStatus = statusFilter === ALL_STATUSES ? null : statusFilter.toLowerCase();
    return rows.filter((r) => {
      if (wantStatus && (r.meeting_status?.trim().toLowerCase() ?? '') !== wantStatus) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        r.company_name,
        r.company_city,
        r.meeting_name,
        r.assigned_rep_name,
        r.meeting_status,
        r.meeting_mode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const handleRetry = useCallback(() => {
    load().then(() => {
      // Surface the retry outcome only on failure; success speaks for itself.
    });
  }, [load]);

  // ─────────────────────────── render ───────────────────────────

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: '#111827' }}>
          Meetings
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          The meetings we have set up for your team. Select one to see the full detail.
        </p>
      </header>

      {/* Controls: search + status filter. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, contact, rep…"
            aria-label="Search meetings"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 32px 9px 32px',
              fontSize: 14,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              outline: 'none',
              background: '#fff',
            }}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                padding: 2,
                lineHeight: 0,
                display: 'inline-flex',
              }}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          style={{
            padding: '9px 12px',
            fontSize: 14,
            border: '1px solid #d1d5db',
            borderRadius: 8,
            background: '#fff',
            color: '#374151',
            cursor: 'pointer',
            minWidth: 160,
          }}
        >
          <option value={ALL_STATUSES}>All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {state.phase === 'loading' ? <SkeletonTable rows={8} cols={5} /> : null}

      {/* Error + retry */}
      {state.phase === 'error' ? (
        <div
          role="alert"
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            borderRadius: 12,
            padding: '24px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#b91c1c' }}>
            Couldn’t load your meetings
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9b3a3a', wordBreak: 'break-word' }}>
            {state.message}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: ACCENT,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <RotateCw size={15} />
            Try again
          </button>
        </div>
      ) : null}

      {/* Ready */}
      {state.phase === 'ready' ? (
        rows.length === 0 ? (
          <EmptyState
            title="No meetings yet"
            body="When our team sets up a meeting for your company, it will appear here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching meetings"
            body="No meetings match your search or filter. Try clearing them."
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatusFilter(ALL_STATUSES);
                }}
                style={{
                  marginTop: 14,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: ACCENT,
                  background: 'transparent',
                  border: `1px solid ${ACCENT}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <MeetingTable rows={filtered} />
        )
      ) : null}
    </div>
  );
}

// ─────────────────────────── sub-components ───────────────────────────

const HEADER_CELL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#6b7280',
  padding: '10px 14px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const BODY_CELL: React.CSSProperties = {
  fontSize: 13.5,
  color: '#374151',
  padding: '12px 14px',
  verticalAlign: 'middle',
  borderTop: '1px solid #f1f3f5',
};

function MeetingTable({ rows }: { rows: PortalMeeting[] }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--color-page-bg)' }}>
            <tr>
              <th style={HEADER_CELL}>Company</th>
              <th style={HEADER_CELL}>Contact</th>
              <th style={HEADER_CELL}>When</th>
              <th style={HEADER_CELL}>Status</th>
              <th style={HEADER_CELL}>Assigned rep</th>
              <th style={{ ...HEADER_CELL, width: 40 }} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ss = statusStyle(r.meeting_status);
              return (
                <tr key={r.meeting_id} style={{ cursor: 'default' }}>
                  <td style={BODY_CELL}>
                    <Link
                      to={`/portal/meetings/${r.meeting_id}`}
                      style={{
                        fontWeight: 600,
                        color: '#111827',
                        textDecoration: 'none',
                      }}
                    >
                      {orDash(r.company_name)}
                    </Link>
                    {r.company_city ? (
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {r.company_city}
                      </div>
                    ) : null}
                  </td>
                  <td style={BODY_CELL}>{orDash(r.meeting_name)}</td>
                  <td style={{ ...BODY_CELL, whiteSpace: 'nowrap' }}>
                    {formatWhen(r.meeting_date, r.meeting_time)}
                  </td>
                  <td style={BODY_CELL}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 999,
                        background: ss.bg,
                        color: ss.fg,
                        border: `1px solid ${ss.border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {orDash(r.meeting_status)}
                    </span>
                  </td>
                  <td style={BODY_CELL}>{orDash(r.assigned_rep_name)}</td>
                  <td style={{ ...BODY_CELL, textAlign: 'right' }}>
                    <Link
                      to={`/portal/meetings/${r.meeting_id}`}
                      aria-label={`Open meeting for ${orDash(r.company_name)}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: ACCENT,
                        textDecoration: 'none',
                      }}
                    >
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px dashed #d1d5db',
        borderRadius: 12,
        background: '#fff',
        padding: '48px 24px',
        textAlign: 'center',
        color: '#6b7280',
      }}
    >
      <CalendarClock size={28} style={{ color: '#9ca3af', marginBottom: 10 }} />
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#374151' }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, maxWidth: 360, marginInline: 'auto' }}>{body}</p>
      {action}
    </div>
  );
}
