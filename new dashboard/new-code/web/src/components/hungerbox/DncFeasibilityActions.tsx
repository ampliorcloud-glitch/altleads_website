/**
 * DncFeasibilityActions — buttons + confirm dialogs for marking/unmarking
 * DNC and non-feasible at company or site scope.
 *
 * Used by CompanyDetailPage (per-company + per-site) and ContactDetailPage
 * (per-site of the contact's company+city).
 *
 * Guarded by HUNGERBOX_FEATURES — renders null when flag is false.
 */
import React, { useState } from 'react';
import { HUNGERBOX_FEATURES, DNC_REASONS, NON_FEASIBLE_REASONS, type HbScope } from '../../lib/hungerbox';
import { markDnc, unmarkDnc, markNonFeasible, markFeasible } from '../../data/dnc';
import type { HbDncRecord, HbFeasibilityRecord } from '../../data/dnc';

/* -----------------------------------------------------------------------
   Small inline select + submit form
----------------------------------------------------------------------- */
interface ReasonSelectProps {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

function ReasonSelect({ options, value, onChange, placeholder }: ReasonSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: 13,
        padding: '5px 8px',
        border: '1px solid #D1D5DB',
        borderRadius: 6,
        background: '#fff',
        color: '#374151',
        width: '100%',
        marginTop: 6,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

/* -----------------------------------------------------------------------
   Confirm overlay (lightweight — no portal, just inline)
----------------------------------------------------------------------- */
interface ConfirmPanelProps {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  confirmTone: 'danger' | 'warning';
  busy: boolean;
}

function ConfirmPanel({ title, children, onConfirm, onCancel, confirmLabel, confirmTone, busy }: ConfirmPanelProps) {
  const dangerStyle: React.CSSProperties =
    confirmTone === 'danger'
      ? { background: '#DC2626', color: '#fff', border: 'none' }
      : { background: '#D97706', color: '#fff', border: 'none' };

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 50,
        top: '100%',
        left: 0,
        marginTop: 4,
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: 16,
        minWidth: 280,
        maxWidth: 340,
      }}
    >
      <p style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 8 }}>{title}</p>
      {children}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            ...dangerStyle,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Saving…' : confirmLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            background: '#F9FAFB',
            border: '1px solid #D1D5DB',
            color: '#374151',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
   DncAction — toggles DNC for a company or site
----------------------------------------------------------------------- */
interface DncActionProps {
  companyId: number;
  siteId: number | null;
  scope: HbScope;
  current: HbDncRecord | null;
  actorId: string;
  onChanged: () => void;
}

export function DncAction({ companyId, siteId, scope, current, actorId, onChanged }: DncActionProps) {
  if (!HUNGERBOX_FEATURES) return null;

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isActive = current?.is_active ?? false;

  const handleMark = async () => {
    if (!reason) return;
    setBusy(true);
    setErr(null);
    const res = isActive
      ? await unmarkDnc({ companyId, siteId, scope, reason, markedBy: actorId })
      : await markDnc({ companyId, siteId, scope, reason, markedBy: actorId });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    setOpen(false);
    setReason('');
    onChanged();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => { setOpen((o) => !o); setErr(null); }}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          border: '1px solid',
          cursor: 'pointer',
          background: isActive ? 'rgba(196,77,77,0.06)' : '#F9FAFB',
          color: isActive ? '#DC2626' : '#374151',
          borderColor: isActive ? 'rgba(196,77,77,0.15)' : '#D1D5DB',
        }}
        title={isActive ? 'Remove DNC flag' : 'Mark as DNC (Do Not Contact)'}
      >
        {isActive ? '— Remove DNC' : '+ Mark DNC'}
      </button>

      {open && (
        <ConfirmPanel
          title={isActive ? 'Remove DNC flag' : `Mark as DNC (${scope} scope)`}
          onConfirm={handleMark}
          onCancel={() => setOpen(false)}
          confirmLabel={isActive ? 'Remove DNC' : 'Mark DNC'}
          confirmTone="danger"
          busy={busy}
        >
          <ReasonSelect
            options={DNC_REASONS}
            value={reason}
            onChange={setReason}
            placeholder="Select a reason…"
          />
          {err && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 6 }}>{err}</p>}
        </ConfirmPanel>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
   FeasibilityAction — toggles feasibility for a company or site
----------------------------------------------------------------------- */
interface FeasibilityActionProps {
  companyId: number;
  siteId: number | null;
  scope: HbScope;
  current: HbFeasibilityRecord | null;
  actorId: string;
  onChanged: () => void;
}

export function FeasibilityAction({ companyId, siteId, scope, current, actorId, onChanged }: FeasibilityActionProps) {
  if (!HUNGERBOX_FEATURES) return null;

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isFeasible = current == null || current.is_feasible;

  const handleToggle = async () => {
    if (!reason) return;
    setBusy(true);
    setErr(null);
    const res = isFeasible
      ? await markNonFeasible({ companyId, siteId, scope, reason, markedBy: actorId })
      : await markFeasible({ companyId, siteId, scope, reason, markedBy: actorId });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    setOpen(false);
    setReason('');
    onChanged();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => { setOpen((o) => !o); setErr(null); }}
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          border: '1px solid',
          cursor: 'pointer',
          background: !isFeasible ? '#FFFBEB' : '#F9FAFB',
          color: !isFeasible ? '#D97706' : '#374151',
          borderColor: !isFeasible ? '#FDE68A' : '#D1D5DB',
        }}
        title={!isFeasible ? 'Mark as feasible' : 'Mark as non-feasible'}
      >
        {!isFeasible ? '+ Mark Feasible' : '— Mark Non-Feasible'}
      </button>

      {open && (
        <ConfirmPanel
          title={!isFeasible ? 'Mark as feasible again' : `Mark as non-feasible (${scope} scope)`}
          onConfirm={handleToggle}
          onCancel={() => setOpen(false)}
          confirmLabel={!isFeasible ? 'Mark Feasible' : 'Mark Non-Feasible'}
          confirmTone="warning"
          busy={busy}
        >
          <ReasonSelect
            options={NON_FEASIBLE_REASONS}
            value={reason}
            onChange={setReason}
            placeholder="Select a reason…"
          />
          {err && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 6 }}>{err}</p>}
        </ConfirmPanel>
      )}
    </div>
  );
}
