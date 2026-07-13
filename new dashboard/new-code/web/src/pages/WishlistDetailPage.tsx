import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchWishlistDetail,
  fetchWishlistLookups,
  assignWishlist,
  updateWishlistStatus,
  convertWishlistToLead,
  fmtLongDate,
  STATUS_WISHLIST,
  STATUS_CONVERTED,
  type WishlistDetail,
  type WishlistLookups,
} from '../data/wishlist';
import { isConflict, CONFLICT_MESSAGE } from '../lib/concurrency';
import { humanizeWriteError } from '../lib/writeError';
import { AssignModal } from '../components/wishlist/AssignModal';
import { ConvertModal, type ConvertFormResult } from '../components/wishlist/ConvertModal';
import { useToast } from '../components/ui/Toast';
import { pushRecent } from '../lib/useRecentlyViewed';
import {
  ArrowLeft,
  Loader2,
  Building2,
  MapPin,
  User,
  Users,
  Hash,
  UserCheck,
  ArrowRightLeft,
  ExternalLink,
  ImageOff,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

/* ── status badge (mirrors WishlistPage) ─────────────────────────────────── */

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

/* ── small primitives ────────────────────────────────────────────────────── */

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'block', width: 3, height: 16, background: '#1A7EE8', borderRadius: 2, flexShrink: 0 }} />
          <span style={{ color: '#6B7280' }}>{icon}</span>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  const has = value && value.trim();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-stone-400 font-medium uppercase tracking-wide" style={{ fontSize: 10 }}>
        {label}
      </span>
      {has ? (
        href ? (
          <a
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 transition-colors break-words"
            style={{ fontSize: 13 }}
          >
            {value}
          </a>
        ) : (
          <span className="text-stone-800 break-words" style={{ fontSize: 13 }}>
            {value}
          </span>
        )
      ) : (
        <span className="text-stone-300" style={{ fontSize: 13 }}>
          —
        </span>
      )}
    </div>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 } as const;

/* ── page ────────────────────────────────────────────────────────────────── */

export function WishlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const wishlistId = Number(id);

  // SHARED RULE 1: audit fields (created_by/updated_by) must be the current
  // user's numeric user_id — never a name/email. If the profile isn't loaded yet
  // we have no id; `actor` is null and writes are blocked until it resolves.
  const actor = profile?.user_id != null ? String(profile.user_id) : null;

  const [item, setItem] = useState<WishlistDetail | null>(null);
  const [lookups, setLookups] = useState<WishlistLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // action state
  const [assignOpen, setAssignOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const appToast = useToast();

  const load = useCallback(async () => {
    if (!wishlistId) { setLoadError('not-found'); setLoading(false); return; }
    setLoading(true);
    // Fetch the detail first so the assignee ids are known, then build the
    // assign-dropdown options WITH the current agent/TL guaranteed present (so a
    // reassign never drops the currently-selected agent from the list).
    const detail = await fetchWishlistDetail(wishlistId);
    const lk = await fetchWishlistLookups(detail.item?.assignAgentId, detail.item?.assignTlId);
    setItem(detail.item);
    setLoadError(detail.error || (detail.item ? null : 'not-found'));
    setLookups(lk);
    setLoading(false);
  }, [wishlistId]);

  useEffect(() => {
    load();
  }, [load]);

  // Record this wishlist item in "recently viewed" once it loads.
  useEffect(() => {
    if (!item?.company) return;
    pushRecent(
      { type: 'wishlist', id: String(item.wishlistId), label: item.company, route: `/wishlist/${item.wishlistId}` },
      profile?.user_id,
    );
  }, [item?.company, item?.wishlistId, profile?.user_id]);

  // Local success banner is set via setToast(...) but otherwise never cleared,
  // so it would stay on screen forever. Auto-dismiss after 3s like app toasts.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    const detail = await fetchWishlistDetail(wishlistId);
    if (detail.item) setItem(detail.item);
  }, [wishlistId]);

  /* ── handlers ──────────────────────────────────────────────── */

  const handleAssign = async (agentId: number, teamLeadId: number | null) => {
    if (!item) return;
    if (!actor) {
      setActionError('Your user profile is still loading. Please try again in a moment.');
      return;
    }
    setActionSaving(true);
    setActionError(null);
    const res = await assignWishlist({
      wishlistId: item.wishlistId,
      agentId,
      teamLeadId,
      actor,
      // Notification context — resolved here in one spot from the loaded item.
      // TODO recipients: owner will tune per-action later
      leadName: item.contactName || item.company || undefined,
      company: item.company || undefined,
      isReassign: item.assignAgentId != null,
      // Concurrency guard (ALT-430): pass the raw updated_date from the loaded item.
      originalUpdatedDate: item.updatedDateRaw ?? null,
    });
    setActionSaving(false);
    if (isConflict(res)) {
      setActionError(CONFLICT_MESSAGE);
      await refresh();
      return;
    }
    if (res?.error) {
      setActionError(humanizeWriteError(res.error));
      return;
    }
    setAssignOpen(false);
    setToast('Wishlist assignment updated.');
    await refresh();
  };

  const handleStatusChange = async (status: string) => {
    if (!item || status === item.status) return;
    if (!actor) {
      setToast('Your user profile is still loading. Please try again in a moment.');
      return;
    }
    setStatusSaving(true);
    // Concurrency guard (ALT-430): pass the raw updated_date from the loaded item.
    const res = await updateWishlistStatus(item.wishlistId, status, actor, item.updatedDateRaw ?? null);
    setStatusSaving(false);
    if (isConflict(res)) {
      setToast(CONFLICT_MESSAGE);
      await refresh();
    } else if (!res?.error) {
      setToast('Status updated.');
      await refresh();
    } else {
      setToast(humanizeWriteError(res.error) ?? 'Something went wrong. Please try again.');
    }
  };

  const handleConvert = async (form: ConvertFormResult) => {
    if (!item) return;
    if (!actor) {
      setActionError('Your user profile is still loading. Please try again in a moment.');
      return;
    }
    setActionSaving(true);
    setActionError(null);
    const res = await convertWishlistToLead({
      wishlistId: item.wishlistId,
      clientAssocId: form.clientAssocId,
      projectId: form.projectId,
      agentId: item.assignAgentId,
      companyId: item.companyId,
      leadName: form.leadName,
      designation: form.designation,
      email: form.email,
      mobileNo: form.mobileNo,
      cityId: item.cityId,
      actor,
    });
    setActionSaving(false);
    if ('error' in res) {
      const msg = humanizeWriteError(res.error) ?? 'Something went wrong. Please try again.';
      setActionError(msg);
      appToast.error(msg);
      return;
    }
    setConvertOpen(false);
    appToast.success('Lead created from wishlist');
    // jump straight to the freshly created lead
    navigate(`/leads/${res.lead_id}`);
  };

  /* ── states ────────────────────────────────────────────────── */

  if (loading) {
    return (
      <AppShell title="Wishlist">
        <div className="flex items-center justify-center h-64 gap-2 text-stone-400">
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading wishlist item…</span>
        </div>
      </AppShell>
    );
  }

  if (loadError === 'not-found' || !item) {
    return (
      <AppShell title="Wishlist">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-stone-400">
          <Building2 size={24} className="text-stone-300" />
          <p style={{ fontSize: 14 }}>This wishlist item could not be found.</p>
          <button
            onClick={() => navigate('/wishlist')}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            style={{ fontSize: 13 }}
          >
            Back to Wishlist
          </button>
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell title="Wishlist">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-stone-400">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-red-500" style={{ fontSize: 14 }}>
            {loadError}
          </p>
        </div>
      </AppShell>
    );
  }

  const convertible = item.convertible;
  const location = [item.city, item.state].filter(Boolean).join(', ');
  const fullAddress = [item.addressLine1, item.addressLine2, location, item.pincode]
    .filter(Boolean)
    .join(', ');
  const geoLink =
    item.latitude && item.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
      : '';

  return (
    <AppShell title="Wishlist">
      <div className="space-y-4" style={{ maxWidth: 1100 }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-stone-400" style={{ fontSize: 12 }}>
          <button
            onClick={() => navigate('/wishlist')}
            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={13} />
            Wishlist
          </button>
          <ChevronRight size={11} />
          <span className="text-stone-600 truncate">{item.company || 'Untitled company'}</span>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="flex items-center gap-2 px-4 rounded-lg border"
            style={{ background: '#f0fdf4', borderColor: '#bbf7d0', height: 36 }}
          >
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-green-700" style={{ fontSize: 12 }}>
              {toast}
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20 }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-semibold text-stone-900" style={{ fontSize: 18 }}>
                  {item.company || 'Untitled company'}
                </h1>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex items-center gap-2 text-stone-500 flex-wrap" style={{ fontSize: 13 }}>
                {item.industry && (
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-stone-400" />
                    {item.industry}
                  </span>
                )}
                {location && (
                  <>
                    {item.industry && <span className="text-stone-300">·</span>}
                    <span className="flex items-center gap-1">
                      <MapPin size={13} className="text-stone-400" />
                      {location}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setActionError(null);
                  setAssignOpen(true);
                }}
                disabled={!convertible}
                className="inline-flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontSize: 13, padding: '7px 14px', height: 34, borderRadius: 6 }}
              >
                <UserCheck size={14} />
                {item.assignAgentId != null ? 'Reassign' : 'Assign'}
              </button>
              <button
                onClick={() => {
                  setActionError(null);
                  setConvertOpen(true);
                }}
                disabled={!convertible}
                title={convertible ? undefined : 'Already converted to a lead'}
                className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
                style={{ fontSize: 13, padding: '7px 14px', height: 34, borderRadius: 6, background: '#1A7EE8', border: 'none', cursor: convertible ? 'pointer' : 'not-allowed' }}
                onMouseEnter={(e) => { if (convertible) (e.currentTarget as HTMLButtonElement).style.background = '#1463B8'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1A7EE8'; }}
              >
                <ArrowRightLeft size={14} />
                Convert to Lead
              </button>
            </div>
          </div>

          {/* Status changer + audit */}
          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-stone-400 font-medium uppercase tracking-wide" style={{ fontSize: 10 }}>
                Status
              </span>
              <select
                value={item.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusSaving || !convertible}
                className="border border-stone-300 rounded-md bg-white text-stone-800 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
              >
                {/* Wishlist statuses: WishList (sent) and Converted To Lead (terminal). */}
                <option value={STATUS_WISHLIST}>{STATUS_WISHLIST}</option>
                <option value={STATUS_CONVERTED}>{STATUS_CONVERTED}</option>
                {/* Keep any legacy/unknown status selectable so the controlled
                    select never renders blank for an out-of-band value. */}
                {item.status &&
                  item.status !== STATUS_WISHLIST &&
                  item.status !== STATUS_CONVERTED && (
                    <option value={item.status}>{item.status}</option>
                  )}
              </select>
              {statusSaving && <Loader2 size={13} className="animate-spin text-stone-400" />}
              {!convertible && (
                <span className="text-stone-400" style={{ fontSize: 11 }}>
                  Converted items are locked.
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-stone-400" style={{ fontSize: 11 }}>
              <span className="flex items-center gap-1">
                <Hash size={11} />
                ID {item.wishlistId}
              </span>
              {item.createdDateRaw && (
                <span>
                  Captured <span className="text-stone-500">{fmtLongDate(item.createdDateRaw)}</span>
                </span>
              )}
              {item.updatedDateRaw && (
                <span>
                  Updated <span className="text-stone-500">{fmtLongDate(item.updatedDateRaw)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two-column: detail cards + geo image */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="space-y-4 min-w-0">
            {/* Company / target */}
            <Card title="Target Company" icon={<Building2 size={14} />}>
              <div style={grid}>
                <Field label="Company" value={item.company} />
                <Field label="Industry" value={item.industry} />
                <Field label="City" value={item.city} />
                <Field label="State" value={item.state} />
                <Field label="Pincode" value={item.pincode} />
              </div>
              {fullAddress && (
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <Field label="Address" value={fullAddress} />
                </div>
              )}
            </Card>

            {/* Contact */}
            <Card title="Contact" icon={<User size={14} />}>
              <div style={grid}>
                <Field label="Contact Name" value={item.contactName} />
                <Field label="Designation" value={item.designation} />
                <Field
                  label="Phone"
                  value={item.phone}
                  href={item.phone ? `tel:${item.phone}` : undefined}
                />
              </div>
            </Card>

            {/* Assignment */}
            <Card
              title="Assignment"
              icon={<Users size={14} />}
              action={
                convertible ? (
                  <button
                    onClick={() => {
                      setActionError(null);
                      setAssignOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    style={{ fontSize: 12 }}
                  >
                    {item.assignAgentId != null ? 'Reassign' : 'Assign'}
                  </button>
                ) : undefined
              }
            >
              <div style={grid}>
                <Field label="Assigned Agent" value={item.agent} />
                <Field label="Team Lead" value={item.teamLead} />
                <Field label="Captured By" value={item.sharedByName || item.sharedById} />
              </div>
              {item.assignTlId == null && (
                <p className="mt-3 text-amber-600 flex items-center gap-1.5" style={{ fontSize: 12 }}>
                  <AlertCircle size={13} />
                  No Team Lead assigned — convert is blocked until a Team Lead is set (contact Admin).
                </p>
              )}
            </Card>

            {/* Notes */}
            {item.description && (
              <Card title="Notes" icon={<User size={14} />}>
                <p className="text-stone-700 leading-relaxed whitespace-pre-wrap" style={{ fontSize: 13 }}>
                  {item.description}
                </p>
              </Card>
            )}
          </div>

          {/* Geo image + location */}
          <div className="space-y-4">
            <Card title="Geo-tagged Photo" icon={<MapPin size={14} />}>
              {item.imageUrl ? (
                <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="block group">
                  <img
                    src={item.imageUrl}
                    alt={`${item.company} site`}
                    className="w-full rounded-md border border-stone-200 object-cover"
                    style={{ maxHeight: 220 }}
                  />
                  <span
                    className="mt-2 inline-flex items-center gap-1 text-blue-600 group-hover:text-blue-700 transition-colors"
                    style={{ fontSize: 12 }}
                  >
                    Open full image
                    <ExternalLink size={11} />
                  </span>
                </a>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-stone-400 py-6">
                  <ImageOff size={22} className="text-stone-300" />
                  <span style={{ fontSize: 12 }}>No photo captured</span>
                </div>
              )}

              {(item.latitude && item.longitude) || item.mapAddress ? (
                <div className="mt-4 pt-4 border-t border-stone-100 space-y-2">
                  {item.latitude && item.longitude && (
                    <Field label="Coordinates" value={`${item.latitude}, ${item.longitude}`} href={geoLink} />
                  )}
                  {item.mapAddress && <Field label="Map Address" value={item.mapAddress} />}
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {assignOpen && (
        <AssignModal
          currentAgentId={item.assignAgentId}
          currentTlId={item.assignTlId}
          agents={lookups?.agents ?? []}
          teamLeads={lookups?.teamLeads ?? []}
          saving={actionSaving}
          error={actionError}
          onConfirm={handleAssign}
          onClose={() => setAssignOpen(false)}
        />
      )}
      {convertOpen && (
        <ConvertModal
          item={item}
          lookups={lookups}
          saving={actionSaving}
          error={actionError}
          onConfirm={handleConvert}
          onClose={() => setConvertOpen(false)}
        />
      )}
    </AppShell>
  );
}

export default WishlistDetailPage;
