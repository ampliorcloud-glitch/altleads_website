/**
 * RecycleBinPage — admin-only (ALT-400).
 *
 * Lists soft-deleted records and lets an admin restore them.
 * Two entity tabs: Companies (company_master) and Contacts (contact_master).
 *
 * NOTE(ALT-400): validate restore against RLS on a throwaway admin login before
 * relying on it in prod.
 *
 * Gating — two layers (same defence-in-depth as ImportPage):
 *   1. App.tsx wraps /recycle-bin in <AdminRoute>.
 *   2. The page itself checks isAdmin and shows a calm notice if bypassed.
 */
import { useState, useEffect, useCallback } from 'react';
import { Trash2, ShieldAlert, RotateCcw, AlertTriangle } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
  fetchDeleted,
  restoreRecord,
  type RecycleBinEntity,
  type DeletedRecord,
} from '../data/recycleBin';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabId = RecycleBinEntity;

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'company', label: 'Companies' },
  { id: 'contact', label: 'Contacts' },
  { id: 'lead', label: 'Leads' },
  { id: 'meeting', label: 'Meetings' },
];

/* ------------------------------------------------------------------ */
/*  Date formatter                                                     */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso.substring(0, 10);
  return `${m[3]} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function RecycleBinPage() {
  const { isAdmin, profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState<TabId>('company');
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  /* ── Load records for the active tab ── */
  const load = useCallback(async (entity: TabId) => {
    setLoading(true);
    setError(null);
    setRecords([]);
    setTruncated(false);

    const result = await fetchDeleted(entity);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setRecords(result.records);
    setTruncated(result.truncated);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load(activeTab);
  }, [activeTab, isAdmin, load]);

  /* ── Restore handler ── */
  async function handleRestore(record: DeletedRecord) {
    const entityLabel =
      activeTab === 'company' ? 'company'
      : activeTab === 'contact' ? 'contact'
      : activeTab === 'lead' ? 'lead'
      : 'meeting';

    const ok = await confirm({
      title: `Restore this ${entityLabel}?`,
      message: (
        <span>
          <strong>{record.name}</strong> will be made visible again to all users. This cannot be
          automatically undone — you would need to delete it again manually.
        </span>
      ),
      confirmLabel: 'Restore',
      tone: 'default',
    });

    if (!ok) return;

    const actorId = String(profile?.user_id ?? '');
    setRestoringId(record.id);

    const { error: restoreError } = await restoreRecord(activeTab, record.id, actorId);
    setRestoringId(null);

    if (restoreError) {
      toast.error(restoreError);
      return;
    }

    toast.success(`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} "${record.name}" restored successfully.`);
    // Refresh the list
    void load(activeTab);
  }

  /* ── Non-admin guard ── */
  if (!isAdmin) {
    return (
      <AppShell title="Recycle Bin">
        <div className="max-w-2xl mx-auto">
          <div
            className="bg-white border border-stone-200 rounded-lg flex flex-col items-center justify-center gap-2 text-stone-500"
            style={{ fontSize: 13, padding: '48px 16px', textAlign: 'center' }}
          >
            <ShieldAlert size={22} style={{ color: '#9ca3af' }} />
            The Recycle Bin is restricted to administrators.
          </div>
        </div>
      </AppShell>
    );
  }

  /* ── Render ── */
  return (
    <AppShell title="Recycle Bin">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>

          {/* Card header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
            }}
          >
            <span style={{ display: 'block', width: 4, height: 20, background: '#1A7EE8', borderRadius: 2, flexShrink: 0 }} />
            <Trash2 size={15} strokeWidth={1.75} style={{ color: '#6B7280' }} />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
              Recycle Bin
            </h2>
          </div>

          {/* Description */}
          <div style={{ padding: '12px 20px 0', fontSize: 13, color: '#6B7280', lineHeight: 1.55 }}>
            Soft-deleted records are hidden from all list views but remain in the database.
            Restoring a record makes it visible again immediately.
            {' '}
            <strong style={{ color: '#B45309' }}>
              Restore is a production-data write — confirm on a throwaway admin login first.
            </strong>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex', gap: 4,
              padding: '12px 20px 0',
              borderBottom: '1px solid #F3F4F6',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? '#1A7EE8' : '#6B7280',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #1A7EE8' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: -1,
                  transition: 'color 0.12s, border-color 0.12s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table body */}
          <div style={{ padding: '0 20px 20px' }}>

            {/* Truncation banner */}
            {truncated && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginTop: 14, padding: '8px 12px',
                  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6,
                  fontSize: 12, color: '#92400E',
                }}
              >
                <AlertTriangle size={14} />
                Showing the 500 most-recently-deleted records. Older records exist — restore or permanently purge some to see them.
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div
                  style={{
                    width: 20, height: 20,
                    border: '2px solid #E5E7EB',
                    borderTopColor: '#1A7EE8',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div
                style={{
                  marginTop: 16, padding: '12px 14px',
                  background: 'rgba(196,77,77,0.06)', border: '1px solid rgba(196,77,77,0.15)', borderRadius: 6,
                  fontSize: 13, color: '#B91C1C',
                }}
              >
                {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && records.length === 0 && (
              <div
                style={{
                  padding: '48px 0', textAlign: 'center',
                  fontSize: 13, color: '#9CA3AF',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
              >
                <Trash2 size={28} strokeWidth={1.25} style={{ color: '#D1D5DB' }} />
                No deleted {activeTab === 'company' ? 'companies' : activeTab === 'contact' ? 'contacts' : activeTab === 'lead' ? 'leads' : 'meetings'} found.
              </div>
            )}

            {/* Table */}
            {!loading && !error && records.length > 0 && (
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Deleted on</th>
                      <th style={thStyle}>Deleted by</th>
                      <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr
                        key={rec.id}
                        style={{ borderBottom: '1px solid #F3F4F6' }}
                      >
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 500, color: '#111827' }}>{rec.name}</span>
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#9CA3AF' }}>#{rec.id}</span>
                        </td>
                        <td style={{ ...tdStyle, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {fmtDate(rec.deleted_date)}
                        </td>
                        <td style={{ ...tdStyle, color: '#6B7280' }}>{rec.deleted_by}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <button
                            type="button"
                            disabled={restoringId === rec.id}
                            onClick={() => handleRestore(rec)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              height: 28,
                              padding: '0 10px',
                              fontSize: 12,
                              fontWeight: 500,
                              borderRadius: 5,
                              border: '1px solid #D1D5DB',
                              background: restoringId === rec.id ? '#F3F4F6' : '#FFFFFF',
                              color: restoringId === rec.id ? '#9CA3AF' : '#374151',
                              cursor: restoringId === rec.id ? 'not-allowed' : 'pointer',
                              transition: 'background 0.12s, color 0.12s',
                            }}
                          >
                            <RotateCcw size={12} strokeWidth={1.75} />
                            {restoringId === rec.id ? 'Restoring…' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared cell styles                                                 */
/* ------------------------------------------------------------------ */

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #E5E7EB',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 10px',
  verticalAlign: 'middle',
  color: '#374151',
};
