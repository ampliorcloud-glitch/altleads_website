/**
 * WishlistPreview — compact "mini record" for a wishlist entry, rendered INSIDE
 * the generic RecordPreviewPanel (ALT-327/328). A denser, VIEW-oriented mirror of
 * WishlistDetailPage: header (company + prospect name + designation + status),
 * location (city/state/pincode), assignment (agent + team lead + captured-by),
 * and key fields (lead number/phone, industry, description/notes).
 *
 * Reuses the EXISTING data layer exactly like WishlistDetailPage:
 *   - fetchWishlistDetail (data/wishlist) for the full record
 *   - STATUS_WISHLIST / STATUS_CONVERTED + fmtLongDate for the status badge + dates
 * No new data fns are introduced.
 *
 * INTENTIONALLY view-only. Wishlist's heavy actions — Assign/Reassign and
 * Convert-to-Lead — are existing modal flows that stay on the full detail page;
 * the panel's "Open full record →" affordance covers them. So this preview does
 * NOT rebuild AssignModal / ConvertModal.
 */
import { useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Building2,
  MapPin,
  Phone,
  Hash,
  Briefcase,
  User,
  Users,
  UserCheck,
  FileText,
} from 'lucide-react';
import {
  fetchWishlistDetail,
  fmtLongDate,
  STATUS_WISHLIST,
  STATUS_CONVERTED,
  type WishlistDetail,
} from '../../data/wishlist';
import { CopyButton } from '../ui/CopyButton';

const BRAND = 'var(--color-brand, #1A7EE8)';

/* Status badge — mirrors WishlistPage / WishlistDetailPage tints. */
const statusStyles: Record<string, { bg: string; text: string; ring: string }> = {
  [STATUS_WISHLIST]: { bg: '#eff6ff', text: '#1d4ed8', ring: '#bfdbfe' },
  [STATUS_CONVERTED]: { bg: '#f0fdf4', text: '#15803d', ring: '#bbf7d0' },
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

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* Compact label/value row with optional link + copy (mirrors ContactPreview Field). */
function Field({
  icon, label, value, href, copyValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  href?: string;
  copyValue?: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 28 }}>
      <span style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {href ? (
            <a
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              title={copyValue ?? (typeof value === 'string' ? value : undefined)}
              style={{ fontSize: 13, color: BRAND, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {value}
            </a>
          ) : (
            <span
              title={copyValue ?? (typeof value === 'string' ? value : undefined)}
              style={{ fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {value || <span style={{ color: '#D1D5DB' }}>—</span>}
            </span>
          )}
          {copyValue ? <CopyButton value={copyValue} label={label} /> : null}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
      {children}
    </h3>
  );
}

export function WishlistPreview({ wishlistId }: { wishlistId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<WishlistDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItem(null);

    (async () => {
      const { item: detail, error: err } = await fetchWishlistDetail(wishlistId);
      if (cancelled) return;
      if (err) {
        setError(err);
      } else if (!detail) {
        setError('This wishlist item could not be found.');
      } else {
        setItem(detail);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [wishlistId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
        <Loader2 size={20} className="animate-spin" style={{ color: '#9CA3AF' }} />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: '#F87171' }} />
        <span style={{ fontSize: 13, color: '#6B7280' }}>{error ?? 'Wishlist item not found.'}</span>
      </div>
    );
  }

  const location = [item.city, item.state].filter(Boolean).join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header: avatar + company + prospect name + designation + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: '#E8F2FD', color: '#1A7EE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, flexShrink: 0, letterSpacing: 0.4,
          }}
        >
          {companyInitials(item.company || '?')}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              {item.company || 'Untitled company'}
            </h2>
            <StatusBadge status={item.status} />
          </div>
          {item.contactName && (
            <p style={{ fontSize: 12.5, color: '#374151', margin: '4px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <User size={12} style={{ color: '#9CA3AF' }} />
              {item.contactName}
            </p>
          )}
          {item.designation && (
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' }}>{item.designation}</p>
          )}
        </div>
      </div>

      {/* Assignment — assigned agent + team lead (+ captured-by) */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', background: '#fff' }}>
        <SectionTitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Assignment
          </span>
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field icon={<UserCheck size={14} />} label="Assigned Agent" value={item.agent} />
          <Field icon={<Users size={14} />} label="Team Lead" value={item.teamLead} />
          <Field icon={<User size={14} />} label="Captured By" value={item.sharedByName || item.sharedById} />
        </div>
        {item.assignTlId == null && (
          <p style={{ fontSize: 11.5, color: '#D97706', margin: '10px 0 0', display: 'inline-flex', alignItems: 'flex-start', gap: 5 }}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            No Team Lead assigned — convert is blocked until a Team Lead is set (contact Admin).
          </p>
        )}
      </div>

      {/* Location */}
      <div>
        <SectionTitle>Location</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field icon={<MapPin size={14} />} label="City / State" value={location} />
          <Field icon={<MapPin size={14} />} label="Pincode" value={item.pincode} />
        </div>
      </div>

      {/* Key fields */}
      <div>
        <SectionTitle>Details</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field icon={<Hash size={14} />} label="Wishlist ID" value={String(item.wishlistId)} />
          <Field
            icon={<Phone size={14} />}
            label="Lead Number / Phone"
            value={item.phone}
            href={item.phone ? `tel:${item.phone}` : undefined}
            copyValue={item.phone}
          />
          <Field icon={<Briefcase size={14} />} label="Industry" value={item.industry} />
          <Field icon={<Building2 size={14} />} label="Designation" value={item.designation} />
          {item.createdDateRaw && (
            <Field icon={<Hash size={14} />} label="Captured" value={fmtLongDate(item.createdDateRaw)} />
          )}
        </div>
      </div>

      {/* Notes / description */}
      {item.description && (
        <div>
          <SectionTitle>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <FileText size={12} /> Notes
            </span>
          </SectionTitle>
          <p style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
            {item.description}
          </p>
        </div>
      )}
    </div>
  );
}

export default WishlistPreview;
