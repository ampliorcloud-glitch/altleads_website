import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import { fetchWishlist, fmtLongDate, type WishlistItem } from '../../data/wishlist';
import { WishlistCreateModal } from '../../components/wishlist/WishlistCreateModal';
import { Plus, Loader2, Building2, MapPin, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * SalesWishlistPage — Sales Portal screen for capturing prospects (ALT-276).
 *
 * Sales / client-portal users land here to ADD a wishlist entry (Company +
 * Prospect + Location), mirroring the legacy mobile Wishlist flow. This is a
 * thin, sales-flavoured page (rendered under the sales AppShell) — it does NOT
 * reuse the internal WishlistPage (whose toolbar exposes internal-only filters,
 * the column customizer, and links to internal /wishlist/:id detail). It shows a
 * simple card list of the wishlist entries the session can read, plus the
 * "Add to wishlist" button that opens WishlistCreateModal.
 *
 * NOTE: data is not yet sales-scoped at the data layer (RLS scoping is a later
 * ticket) — like the rest of the Sales Portal it shows what the session can read.
 */

const statusStyles: Record<string, { bg: string; text: string; ring: string }> = {
  WishList: { bg: '#eff6ff', text: '#1d4ed8', ring: '#bfdbfe' },
  'Converted To Lead': { bg: '#f0fdf4', text: '#15803d', ring: '#bbf7d0' },
};
const statusDefault = { bg: '#f4f4f5', text: '#52525b', ring: '#d4d4d8' };

function StatusBadge({ status }: { status: string }) {
  const s = statusStyles[status] ?? statusDefault;
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        boxShadow: `inset 0 0 0 1px ${s.ring}`,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {status || '—'}
    </span>
  );
}

export function SalesWishlistPage() {
  const { profile } = useAuth();
  const actor = profile?.user_id != null ? String(profile.user_id) : null;

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await fetchWishlist();
    setItems(res.items);
    setLoadError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell title="Wishlist">
      <div style={{ maxWidth: 920 }}>
        {/* Header + add button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-gray-900)', margin: 0 }}>
              Wishlist
            </h1>
            <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: '4px 0 0' }}>
              Flag a company you'd like to pursue — share it with AltLeads.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#1A7EE8',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              padding: '8px 14px',
              border: 'none',
              cursor: 'pointer',
              height: 36,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1463B8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8'; }}
          >
            <Plus size={15} />
            Add to wishlist
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-gray-400)', padding: '40px 0', justifyContent: 'center' }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading wishlist…</span>
          </div>
        ) : loadError ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <AlertCircle size={22} className="text-red-400" />
            <span style={{ fontSize: 13, color: 'var(--color-gray-600)' }}>{loadError}</span>
            <button
              type="button"
              onClick={load}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 500, color: '#1A7EE8',
                border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff',
                padding: '6px 14px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '48px 0', color: 'var(--color-gray-400)',
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
            }}
          >
            <Building2 size={24} className="text-stone-300" />
            <span style={{ fontSize: 13 }}>No wishlist entries yet.</span>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              style={{ fontSize: 13, fontWeight: 500, color: '#1A7EE8', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Add your first prospect
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => {
              const location = [item.city, item.state].filter(Boolean).join(', ');
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                        {item.company || 'Untitled company'}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, color: 'var(--color-gray-500)', fontSize: 12, flexWrap: 'wrap' }}>
                      {item.contactName && <span>{item.contactName}{item.designation ? ` · ${item.designation}` : ''}</span>}
                      {location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={12} /> {location}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-gray-400)', whiteSpace: 'nowrap' }}>
                    {item.createdDate ? fmtLongDate(item.createdDate) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <WishlistCreateModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        actor={actor}
        onCreated={load}
      />
    </AppShell>
  );
}

export default SalesWishlistPage;
