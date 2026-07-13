/**
 * Client Portal — HOME / DASHBOARD SHELL (ALT-240, net-new page).
 *
 * Requires the portal schema applied to the DB AND added to Supabase API exposed
 * schemas; inert until then. (Until both are done, the portal fetchers in
 * ../data/portal resolve to an error/empty result and this page degrades
 * gracefully — it shows a friendly notice, never crashes.)
 *
 * DATA ISOLATION (non-negotiable): this page reads ONLY through ../data/portal,
 * which queries the `portal` schema's SECURITY-INVOKER snapshot-backed views. It
 * NEVER imports or reuses any CRM page or CRM data module (LeadsPage,
 * LeadDetailPage, data/realLeads, data/leadWorkspace, data/companies, …) — those
 * read live shared tables and would leak one client's work to another. Only the
 * portal data layer, shared UI primitives, the brand seam, and react-router are
 * imported here.
 *
 * Scope (Phase-1 shell): a branded welcome line (useBrand().name) + status cards
 * derived from fetchPortalMeetings() / fetchPortalNotifications(). Detailed charts
 * are deferred — owner will spec them (see the clearly-marked TODO below).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPortalMeetings,
  fetchPortalNotifications,
  isMeetingStarted,
  type PortalMeeting,
  type PortalNotification,
} from '../data/portal';
import { useBrand } from '../brand';
import { Skeleton, SkeletonCards } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

/** Derived headline counts the status cards render. */
interface HomeStats {
  /** Meetings that have NOT yet started (started_at is null or in the future). */
  upcomingMeetings: number;
  /** Started meetings with no recorded outcome → feedback can be given now. */
  awaitingFeedback: number;
  /** Unread portal notifications. */
  unreadNotifications: number;
  /** All meetings visible to the caller (RLS-scoped). */
  totalMeetings: number;
}

const EMPTY_STATS: HomeStats = {
  upcomingMeetings: 0,
  awaitingFeedback: 0,
  unreadNotifications: 0,
  totalMeetings: 0,
};

/** Meeting statuses that count as a final/closed outcome (no feedback prompt). */
const CLOSED_STATUSES = new Set(['Completed', 'Cancelled', 'Dropped', 'Missed']);

function deriveStats(
  meetings: PortalMeeting[],
  notifications: PortalNotification[],
): HomeStats {
  let upcomingMeetings = 0;
  let awaitingFeedback = 0;

  for (const m of meetings) {
    const started = isMeetingStarted(m.started_at);
    if (!started) {
      upcomingMeetings += 1;
      continue;
    }
    // Feedback opens once a meeting has STARTED (../data/portal gate) and is still
    // worth recording — i.e. it has not already reached a closed status.
    const status = (m.meeting_status ?? '').trim();
    if (!CLOSED_STATUSES.has(status)) awaitingFeedback += 1;
  }

  const unreadNotifications = notifications.reduce(
    (acc, n) => (n.is_read ? acc : acc + 1),
    0,
  );

  return {
    upcomingMeetings,
    awaitingFeedback,
    unreadNotifications,
    totalMeetings: meetings.length,
  };
}

interface StatusCardProps {
  label: string;
  value: number;
  accent: string;
  to?: string;
}

function StatusCard({ label, value, accent, to }: StatusCardProps) {
  const body = (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        background: '#fff',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
    </div>
  );

  if (!to) return body;
  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {body}
    </Link>
  );
}

export function PortalHomePage() {
  const brand = useBrand();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);

      const [meetingsRes, notificationsRes] = await Promise.all([
        fetchPortalMeetings(),
        fetchPortalNotifications(),
      ]);

      if (cancelled) return;

      // Degrade gracefully: the portal schema may not be applied/exposed yet, in
      // which case the fetchers return { ok:false }. Show a friendly notice and
      // keep the page usable (zeroed cards) rather than crashing.
      if (!meetingsRes.ok || !notificationsRes.ok) {
        const message = !meetingsRes.ok ? meetingsRes.error : (notificationsRes as { ok: false; error: string }).error;
        setStats(EMPTY_STATS);
        setLoadError(message);
        setLoading(false);
        toast.error("We couldn't load your dashboard just now. Please try again shortly.");
        return;
      }

      setStats(deriveStats(meetingsRes.data, notificationsRes.data));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // toast is a stable context API; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '8px 4px 32px' }}>
      {/* Welcome line — branded per the active deploy (Amplior by default). */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
          Welcome to your {brand.name} portal
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
          Here's a quick snapshot of your meetings and updates.
        </p>
      </header>

      {/* Status cards. */}
      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <>
          {loadError ? (
            <div
              role="status"
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                fontSize: 13,
                color: '#92400e',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
              }}
            >
              Your dashboard isn't available yet. Once everything is set up, your
              meetings and updates will appear here.
            </div>
          ) : null}

          <section
            aria-label="Overview"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <StatusCard
              label="Upcoming meetings"
              value={stats.upcomingMeetings}
              accent={brand.accent}
              to="/portal/meetings"
            />
            <StatusCard
              label="Awaiting your feedback"
              value={stats.awaitingFeedback}
              accent="#B45309"
              to="/portal/meetings"
            />
            <StatusCard
              label="Unread notifications"
              value={stats.unreadNotifications}
              accent="#15803D"
            />
            <StatusCard
              label="Total meetings"
              value={stats.totalMeetings}
              accent="#6b7280"
              to="/portal/meetings"
            />
          </section>
        </>
      )}

      {/* TODO(owner): detailed charts — pipeline / revenue / industry / city breakdowns
          and role-scoped graphs (Sales-Head extras vs Sales-Person "today's meetings").
          Deferred per CLIENT-PORTAL-PHASE1.md §6 until the owner shares the chart spec
          (reference look = Amplior×HungerBox 3-Year Review PDF). This shell ships status
          cards only; do NOT add chart libraries or live-data queries here. */}
      <section style={{ marginTop: 28 }}>
        <div
          style={{
            border: '1px dashed #d1d5db',
            borderRadius: 12,
            background: 'var(--color-page-bg)',
            padding: '24px 20px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#374151' }}>
            Insights &amp; charts
          </h2>
          <p style={{ margin: '6px 0 14px', fontSize: 13, color: '#6b7280' }}>
            Detailed dashboards are coming soon.
          </p>
          {/* Placeholder shimmer so the eventual layout is visible without real data. */}
          <div aria-hidden="true" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Skeleton width="48%" height={120} radius={12} />
            <Skeleton width="48%" height={120} radius={12} />
          </div>
        </div>
      </section>
    </div>
  );
}
