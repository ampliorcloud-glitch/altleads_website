/**
 * ActivityTimelineTab (ALT-268, owner #5) — admin-only "all activity, all projects"
 * detailed timeline. Lives as the "Activity" tab in AdminPage (which is already
 * gated to ADMIN), so it inherits admin-only access. Read-only.
 *
 * Shows recent org-wide activity (status changes + logged calls from the
 * `interaction` table) newest-first, with a project selector that includes
 * "All projects". Each row links to the record it concerns.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Phone, RefreshCw, Activity, ChevronRight, Layers } from 'lucide-react';
import { fetchMyProjects, type MyProject } from '../../data/admin';
import {
  fetchActivityTimeline,
  type ActivityEvent,
  type ActivityKind,
} from '../../data/activityTimeline';

/** '2026-06-21T08:32:00Z' -> '21 Jun 2026, 2:02 PM IST'. */
function fmtIst(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    return (
      d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ' IST'
    );
  } catch {
    return iso;
  }
}

/** Day bucket label, IST (e.g. "Sat, 21 Jun 2026"). */
function dayKeyIst(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown date';
  try {
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.substring(0, 10);
  }
}

const KIND_META: Record<ActivityKind, { label: string; icon: React.ReactNode; bg: string; fg: string }> = {
  call:          { label: 'Call',          icon: <Phone size={13} />,     bg: '#EFF6FF', fg: '#1D4ED8' },
  status_change: { label: 'Status change', icon: <RefreshCw size={13} />, bg: '#F0FDF4', fg: '#16A34A' },
  other:         { label: 'Activity',      icon: <Activity size={13} />,  bg: '#F4F4F5', fg: '#52525B' },
};

function recordPath(recordType: string, recordId: number): string | null {
  switch (recordType) {
    case 'contact': return `/contacts/${recordId}`;
    case 'company': return `/companies/${recordId}`;
    case 'lead':    return `/leads/${recordId}`;
    default:        return null;
  }
}

export function ActivityTimelineTab() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null); // null = All projects
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Admin sees every enabled project for the scope picker.
  useEffect(() => {
    let cancelled = false;
    fetchMyProjects(null, true)
      .then((list) => { if (!cancelled) setProjects(list); })
      .catch(() => { /* picker just shows "All projects" */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchActivityTimeline({ projectId, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setTruncated(res.truncated);
        setError(res.error);
      })
      .catch((e) => { if (!cancelled) setError(e?.message ?? 'Failed to load activity.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

  // Group events by IST day for a scannable timeline.
  const grouped = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const ev of events) {
      const k = dayKeyIst(ev.when);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <div>
      {/* Header + project scope */}
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-gray-900)' }}>
            Activity timeline
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-gray-500)' }}>
            Every status change and logged call across {projectId == null ? 'all projects' : 'this project'},
            newest first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Layers size={15} style={{ color: 'var(--color-gray-400)' }} />
          <select
            value={projectId == null ? 'all' : String(projectId)}
            onChange={(e) => setProjectId(e.target.value === 'all' ? null : Number(e.target.value))}
            style={{
              fontSize: 13, height: 32, padding: '0 28px 0 10px', cursor: 'pointer',
              border: '1px solid var(--border-color)', borderRadius: 8,
              background: 'var(--color-surface)', color: 'var(--color-gray-900)',
            }}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Refresh"
            aria-label="Refresh activity"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border-color)', background: 'var(--color-surface)',
              color: 'var(--color-gray-500)',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center gap-2" style={{ padding: '40px 0', color: 'var(--color-gray-500)', fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" /> Loading activity...
        </div>
      ) : error ? (
        <div style={{ padding: '24px 0', color: '#DC2626', fontSize: 13 }}>{error}</div>
      ) : events.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 13 }}>
          No activity recorded {projectId == null ? 'yet' : 'for this project yet'}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-500)', marginBottom: 8 }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {dayEvents.map((ev) => {
                  const meta = KIND_META[ev.kind];
                  const path = recordPath(ev.recordType, ev.recordId);
                  return (
                    <div
                      key={ev.id}
                      role={path ? 'button' : undefined}
                      tabIndex={path ? 0 : undefined}
                      onClick={path ? () => navigate(path) : undefined}
                      onKeyDown={path ? (e) => { if (e.key === 'Enter') navigate(path); } : undefined}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 12px', borderRadius: 8,
                        border: '1px solid var(--border-color)', background: 'var(--color-surface)',
                        cursor: path ? 'pointer' : 'default',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                          background: meta.bg, color: meta.fg,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {meta.icon}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>{meta.label}</span>
                          {ev.disposition && (
                            <span style={{
                              fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 4,
                              background: meta.bg, color: meta.fg,
                            }}>
                              {ev.disposition}
                            </span>
                          )}
                          <span style={{ color: 'var(--color-gray-400)' }}>·</span>
                          <span style={{ color: 'var(--color-gray-500)', textTransform: 'capitalize' }}>
                            {ev.recordType} #{ev.recordId}
                          </span>
                          {ev.projectName && (
                            <>
                              <span style={{ color: 'var(--color-gray-400)' }}>·</span>
                              <span style={{ color: 'var(--color-gray-500)' }}>{ev.projectName}</span>
                            </>
                          )}
                        </div>
                        {ev.note && (
                          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-gray-700)', wordBreak: 'break-word' }}>
                            {ev.note}
                          </p>
                        )}
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-gray-400)' }}>
                          {ev.actorName ? `${ev.actorName} · ` : ''}{fmtIst(ev.when)}
                        </p>
                      </div>
                      {path && <ChevronRight size={15} style={{ flexShrink: 0, color: 'var(--color-gray-300)', marginTop: 4 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {truncated && (
            <p style={{ fontSize: 12, color: 'var(--color-gray-400)', textAlign: 'center', margin: 0 }}>
              Showing the latest 200 activities. Pick a project to narrow the view.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
