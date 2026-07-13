import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { MobileMeetingRecord } from '../../components/sales/MobileMeetingRecord';
import { fetchMeetingDetail, type MeetingDetail } from '../../data/meetings';
import { useAuth } from '../../contexts/AuthContext';

/**
 * SalesMeetingDetailPage (ALT-275) — the Sales-Portal / client-portal meeting
 * record screen. Renders the "mobile-ditto" MobileMeetingRecord (an exact-layout
 * copy of the legacy mobile app) inside the sales AppShell so the sales nav shows.
 *
 * Sales users reach this via /sales/meetings/:id and must NEVER land on the
 * internal /meetings/:id screen (the MeetingsPage list in the sales shell links
 * here, and SalesProtectedRoute keeps pure-sales users out of the internal tree).
 */
export function SalesMeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, isInternalUser } = useAuth();
  // Call recording / SharePoint image are Sales-Head-only on mobile. Show them to
  // Sales Heads + internal staff; a plain Sales Person (or a future client) does not.
  const canSeeRecordings = isInternalUser || roles.includes('SALES_HEAD');

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const result = await fetchMeetingDetail(id);
      if (cancelled) return;
      setMeeting(result.meeting);
      setError(result.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell title="Meeting">
      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/sales/meetings')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--color-gray-500)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          <ArrowLeft size={15} />
          Back to Meetings
        </button>

        {loading ? (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '64px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--color-gray-500)',
              fontSize: 13,
            }}
          >
            <Loader2 size={16} className="animate-spin" />
            Loading meeting...
          </div>
        ) : error ? (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '48px 16px',
              textAlign: 'center',
              color: '#DC2626',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : !meeting ? (
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '56px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              color: 'var(--color-gray-500)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--color-gray-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarDays size={20} strokeWidth={1.5} />
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-gray-700)' }}>
              Meeting not found
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>This meeting may have been removed or never existed.</p>
          </div>
        ) : (
          <MobileMeetingRecord meeting={meeting} canSeeRecordings={canSeeRecordings} />
        )}
      </div>
    </AppShell>
  );
}

export default SalesMeetingDetailPage;
