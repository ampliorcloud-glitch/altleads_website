/**
 * AssociationsPanel — lists record_association rows for a record + "Associate record" modal.
 *
 * Rendered ONLY when COLLAB_ASSOC is true.
 *
 * v1 scope: Lead↔Contact associations (bidirectional read; write from either record).
 * The panel is generic (works on any RecordType) so Company / Meeting can reuse it later.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Link2, X, Star, StarOff } from 'lucide-react';
import {
  listAssociations,
  addAssociation,
  removeAssociation,
  setPrimaryAssociation,
} from '../../data/associations';
import { SectionCard } from '../admin/primitives';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';
import {
  ASSOC_LABELS,
  type Association,
  type AssocLabel,
  type RecordType,
} from '../../lib/collabAssoc';

/* ------------------------------------------------------------------ */
/*  Type icon map                                                       */
/* ------------------------------------------------------------------ */

const TYPE_ICON: Record<RecordType, string> = {
  lead: 'L',
  contact: 'C',
  company: 'Co',
  meeting: 'M',
};

const TYPE_COLOR: Record<RecordType, { bg: string; color: string }> = {
  lead:    { bg: '#EFF6FF', color: '#1D4ED8' },
  contact: { bg: '#ECFDF5', color: '#059669' },
  company: { bg: '#F5F3FF', color: '#7C3AED' },
  meeting: { bg: '#FFF7ED', color: '#C2410C' },
};

function TypePill({ type }: { type: RecordType }) {
  const cfg = TYPE_COLOR[type];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {TYPE_ICON[type]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Label badge                                                         */
/* ------------------------------------------------------------------ */

function LabelBadge({ label }: { label: AssocLabel }) {
  if (!label) return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: '2px 7px',
        borderRadius: 4,
        background: '#F9FAFB',
        color: '#6B7280',
        border: '1px solid #E5E7EB',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: determine the "other" endpoint from current record's POV   */
/* ------------------------------------------------------------------ */

function otherEndpoint(
  assoc: Association,
  selfType: RecordType,
  selfId: number,
): { type: RecordType; id: number } {
  if (assoc.from_type === selfType && assoc.from_id === selfId) {
    return { type: assoc.to_type, id: assoc.to_id };
  }
  return { type: assoc.from_type, id: assoc.from_id };
}

/* ------------------------------------------------------------------ */
/*  Associate Record Modal                                              */
/* ------------------------------------------------------------------ */

interface AssociateModalProps {
  open: boolean;
  /** Options for "which record to link" — caller supplies relevant options */
  targetOptions: Record<RecordType, SearchSelectOption[]>;
  onAssociate: (targetType: RecordType, targetId: number, label: AssocLabel, isPrimary: boolean) => Promise<void>;
  onClose: () => void;
}

function AssociateModal({ open, targetOptions, onAssociate, onClose }: AssociateModalProps) {
  const [targetType, setTargetType] = useState<RecordType>('contact');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [label, setLabel] = useState<AssocLabel>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleTypeChange = (t: RecordType) => {
    setTargetType(t);
    setTargetId(null);
  };

  const handleSubmit = async () => {
    if (!targetId) { setErr('Please select a record to link.'); return; }
    setSaving(true);
    setErr(null);
    await onAssociate(targetType, targetId, label, isPrimary);
    setSaving(false);
    setTargetId(null);
    setLabel(null);
    setIsPrimary(false);
  };

  const opts = targetOptions[targetType] ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: '24px',
          width: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>
            Associate record
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Record type</label>
          <select
            value={targetType}
            onChange={(e) => handleTypeChange(e.target.value as RecordType)}
            style={{
              fontSize: 13, padding: '7px 10px', border: '1px solid #D1D5DB',
              borderRadius: 6, background: '#fff', color: '#374151', height: 36,
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="contact">Contact</option>
            <option value="lead">Lead</option>
            <option value="company">Company</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Record</label>
          {opts.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              No {targetType} records available to link.
            </p>
          ) : (
            <SearchSelect
              options={opts}
              value={targetId}
              onChange={setTargetId}
              placeholder={`Search ${targetType}s…`}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Role / label</label>
          <select
            value={label ?? ''}
            onChange={(e) => setLabel((e.target.value || null) as AssocLabel)}
            style={{
              fontSize: 13, padding: '7px 10px', border: '1px solid #D1D5DB',
              borderRadius: 6, background: '#fff', color: '#374151', height: 36,
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">No label</option>
            {ASSOC_LABELS.filter(Boolean).map((l) => (
              <option key={l!} value={l!}>{l}</option>
            ))}
          </select>
        </div>

        <label
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: '#1A7EE8', cursor: 'pointer' }}
          />
          Mark as primary contact for this lead
        </label>

        {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              fontSize: 13, padding: '7px 16px', border: '1px solid #D1D5DB',
              borderRadius: 6, background: '#fff', color: '#374151', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !targetId}
            style={{
              fontSize: 13, padding: '7px 16px', border: 'none', borderRadius: 6,
              background: saving || !targetId ? '#93C5FD' : '#1A7EE8',
              color: '#fff', cursor: saving || !targetId ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Associate
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                          */
/* ------------------------------------------------------------------ */

export interface AssociationsPanelProps {
  recordType: RecordType;
  recordId: number;
  /** Options for the target-record picker, grouped by type */
  targetOptions: Record<RecordType, SearchSelectOption[]>;
  actorId: string;
}

export function AssociationsPanel({
  recordType,
  recordId,
  targetOptions,
  actorId,
}: AssociationsPanelProps) {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listAssociations(recordType, recordId);
    setAssociations(res.associations);
    setError(res.error);
    setLoading(false);
  }, [recordType, recordId]);

  useEffect(() => { load(); }, [load]);

  const handleAssociate = async (
    targetType: RecordType,
    targetId: number,
    label: AssocLabel,
    isPrimary: boolean,
  ) => {
    const res = await addAssociation({
      typeA: recordType, idA: recordId,
      typeB: targetType, idB: targetId,
      label,
      isPrimary,
      actorId,
    });
    if (res.error) { setError(res.error); return; }
    setShowAdd(false);
    await load();
  };

  const handleRemove = async (assocId: number) => {
    setRemovingId(assocId);
    const res = await removeAssociation({ associationId: assocId, actorId });
    setRemovingId(null);
    if (res.error) { setError(res.error); return; }
    await load();
  };

  const handleSetPrimary = async (assocId: number) => {
    setSettingPrimaryId(assocId);
    const res = await setPrimaryAssociation({
      anchorType: recordType,
      anchorId: recordId,
      associationId: assocId,
      actorId,
    });
    setSettingPrimaryId(null);
    if (res.error) { setError(res.error); return; }
    await load();
  };

  return (
    <>
      <SectionCard
        title="Associated records"
        action={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              padding: '5px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <Link2 size={13} />
            Associate record
          </button>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" />
            Loading associations…
          </div>
        ) : error ? (
          <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
        ) : associations.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            No associated records yet. Link contacts, leads, or companies to this record.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {associations.map((a) => {
              const other = otherEndpoint(a, recordType, recordId);
              const name = a.display_name ?? `${other.type} #${other.id}`;
              const busy = removingId === a.association_id || settingPrimaryId === a.association_id;
              return (
                <div
                  key={a.association_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 0',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <TypePill type={other.type} />
                  <span style={{ fontSize: 13, color: '#111827', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  <LabelBadge label={a.assoc_label} />
                  {/* Primary star toggle */}
                  <button
                    type="button"
                    onClick={() => !a.is_primary && handleSetPrimary(a.association_id)}
                    disabled={busy || a.is_primary}
                    title={a.is_primary ? 'Primary contact' : 'Set as primary'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: a.is_primary ? 'default' : 'pointer',
                      color: a.is_primary ? '#F59E0B' : '#D1D5DB',
                      padding: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {settingPrimaryId === a.association_id
                      ? <Loader2 size={13} className="animate-spin" />
                      : a.is_primary ? <Star size={13} /> : <StarOff size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(a.association_id)}
                    disabled={busy}
                    title="Remove association"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9CA3AF',
                      padding: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {removingId === a.association_id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <X size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <AssociateModal
        open={showAdd}
        targetOptions={targetOptions}
        onAssociate={handleAssociate}
        onClose={() => setShowAdd(false)}
      />
    </>
  );
}
