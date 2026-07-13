/**
 * ReassignModal — generic "Change owner / Reassign" dialog (ALT-288, ALT-443).
 *
 * Single-owner mode (default): pick one owner. Unchanged behaviour for all
 * existing callers (LeadDetailPage, CompanyDetailPage, etc.).
 *
 * Multi-owner + max-per-company mode (ALT-443): when `multiOwner` is true the
 * modal shows a multi-select checkbox list of owners plus an optional
 * "Max per company" numeric input. The onConfirmMulti callback receives the
 * selected owner IDs and the cap value.
 *
 * The CALLER decides who may open this (admin/manager only — see useAuth().
 * canReassign) and supplies the eligible owner list (data/assignment.ts
 * fetchAssignableUsers). This component is presentation only — it performs no
 * writes and no permission checks.
 */
import { useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import type { UserOption } from '../../data/wishlist';
import { ModalShell } from '../wishlist/AssignModal';
import { BulkProgressBar } from './BulkProgressBar';

const selectCls =
  'w-full border border-stone-300 rounded-md px-3 text-stone-800 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

const textareaCls =
  'w-full border border-stone-300 rounded-md px-3 py-2 text-stone-800 bg-white resize-y ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

const inputCls =
  'border border-stone-300 rounded-md px-3 text-stone-800 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

// ─── Single-owner mode ───────────────────────────────────────────────────────

export function ReassignModal({
  /** Heading noun, e.g. "Lead", "Meeting", "Company". */
  entityLabel,
  /** Field label for the picker, e.g. "Salesperson", "Owner". */
  ownerLabel = 'Owner',
  /** How many records are being reassigned (>1 ⇒ bulk wording). */
  count = 1,
  currentOwnerId,
  owners,
  saving,
  error,
  progress,
  onCancel,
  onConfirm,
  onClose,
}: {
  entityLabel: string;
  ownerLabel?: string;
  count?: number;
  currentOwnerId: number | null;
  owners: UserOption[];
  saving: boolean;
  error: string | null;
  /** Live bulk progress (done of total). When set + saving, shows a bar + Cancel. */
  progress?: { done: number; total: number } | null;
  /** Abort the in-flight bulk job (stops cleanly between records). */
  onCancel?: () => void;
  /**
   * Confirm callback. `reason` is the optional, free-text note typed by the
   * actor (empty string when left blank) — callers that don't care may ignore it.
   */
  onConfirm: (ownerId: number, reason?: string) => void;
  onClose: () => void;
}) {
  const [ownerId, setOwnerId] = useState<number | null>(currentOwnerId);
  const [reason, setReason] = useState('');

  // "Reassign" when a current owner exists (single record); bulk is always a (re)assign.
  const isBulk = count > 1;
  const isReassign = isBulk || currentOwnerId != null;
  const title = isBulk
    ? `Reassign ${count} ${entityLabel}s`
    : `${isReassign ? 'Reassign' : 'Assign'} ${entityLabel}`;

  return (
    <ModalShell title={title} icon={<UserCheck size={16} />} onClose={onClose} busy={saving}>
      <p className="text-stone-500 mb-4" style={{ fontSize: 12 }}>
        {isBulk
          ? `Choose the new ${ownerLabel.toLowerCase()} for the ${count} selected ${entityLabel.toLowerCase()}s. They will be notified.`
          : `Choose the new ${ownerLabel.toLowerCase()} for this ${entityLabel.toLowerCase()}. They will be notified.`}
      </p>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="reassign-owner"
            className="block mb-1 text-stone-600 font-medium"
            style={{ fontSize: 12 }}
          >
            {ownerLabel}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="reassign-owner"
            aria-required={true}
            value={ownerId ?? ''}
            onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : null)}
            className={selectCls}
            style={{ height: 36, fontSize: 13 }}
            disabled={saving}
          >
            <option value="">{`Select a ${ownerLabel.toLowerCase()}…`}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {owners.length === 0 && (
            <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
              No eligible people available.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reassign-reason"
            className="block mb-1 text-stone-600 font-medium"
            style={{ fontSize: 12 }}
          >
            Reason <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="reassign-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={textareaCls}
            style={{ fontSize: 13, minHeight: 60 }}
            rows={2}
            placeholder="Why is this being reassigned? (recorded in the activity log)"
            disabled={saving}
          />
        </div>

        {error && (
          <p className="text-red-600" style={{ fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>

      {progress && saving && (
        <BulkProgressBar done={progress.done} total={progress.total} />
      )}

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-stone-100">
        {progress && saving && onCancel ? (
          <button
            onClick={onCancel}
            className="border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-medium rounded-md transition-colors"
            style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
          >
            Cancel
          </button>
        ) : (
        <button
          onClick={onClose}
          disabled={saving}
          className="border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-medium rounded-md transition-colors disabled:opacity-50"
          style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
        >
          Cancel
        </button>
        )}
        <button
          onClick={() => ownerId != null && onConfirm(ownerId, reason.trim() || undefined)}
          disabled={saving || ownerId == null || (!isBulk && ownerId === currentOwnerId)}
          className="inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          style={{ fontSize: 13, padding: '7px 14px', height: 34, background: 'var(--color-brand)' }}
          onMouseEnter={(e) => { if (!(saving || ownerId == null || (!isBulk && ownerId === currentOwnerId))) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {isReassign ? 'Reassign' : 'Assign'}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Multi-owner mode (ALT-443) ──────────────────────────────────────────────

/**
 * BulkReassignModal — extends ReassignModal for multi-owner bulk reassignment
 * with an optional "Max per company" cap (ALT-443).
 *
 * When multiple owners are chosen, records are distributed round-robin via
 * distributeRecords(). When only one owner is chosen, it falls back to the
 * single-owner bulk path (same as before). The maxPerCompany input is only
 * shown when 2+ owners are selected.
 */
export function BulkReassignModal({
  entityLabel,
  ownerLabel = 'Owner',
  count,
  owners,
  saving,
  error,
  progress,
  onCancel,
  onConfirm,
  onClose,
}: {
  entityLabel: string;
  ownerLabel?: string;
  count: number;
  owners: UserOption[];
  saving: boolean;
  error: string | null;
  progress?: { done: number; total: number } | null;
  onCancel?: () => void;
  /** Called with the chosen owner IDs and optional per-company cap. */
  onConfirm: (ownerIds: number[], maxPerCompany?: number) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [maxPerCompanyStr, setMaxPerCompanyStr] = useState('');

  const toggleOwner = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const multi = selectedIds.size >= 2;
  const capVal = maxPerCompanyStr.trim() !== '' ? parseInt(maxPerCompanyStr, 10) : undefined;
  const capInvalid = maxPerCompanyStr.trim() !== '' && (isNaN(capVal!) || capVal! <= 0);

  const canConfirm = !saving && selectedIds.size > 0 && !capInvalid;

  return (
    <ModalShell
      title={`Reassign ${count} ${entityLabel}${count === 1 ? '' : 's'}`}
      icon={<UserCheck size={16} />}
      onClose={onClose}
      busy={saving}
    >
      <p className="text-stone-500 mb-4" style={{ fontSize: 12 }}>
        Pick one or more {ownerLabel.toLowerCase()}s. Records are distributed round-robin across the
        chosen people. They will each be notified.
      </p>

      <div className="space-y-4">
        {/* Owner multi-select */}
        <div>
          <label className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
            {ownerLabel}s
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          {owners.length === 0 ? (
            <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
              No eligible people available.
            </p>
          ) : (
            <div
              style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                padding: '4px 0',
              }}
            >
              {owners.map((o) => {
                const checked = selectedIds.has(o.id);
                return (
                  <label
                    key={o.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 12px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      background: checked ? '#EFF6FF' : 'transparent',
                      fontSize: 13,
                      color: '#374151',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() => toggleOwner(o.id)}
                      style={{ accentColor: '#1A7EE8', width: 14, height: 14, flexShrink: 0 }}
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
          )}
          {selectedIds.size > 0 && (
            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              {selectedIds.size} selected
            </p>
          )}
        </div>

        {/* Max-per-company — only show when 2+ owners selected */}
        {multi && (
          <div>
            <label className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
              Max per company{' '}
              <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              value={maxPerCompanyStr}
              onChange={(e) => setMaxPerCompanyStr(e.target.value)}
              disabled={saving}
              placeholder="e.g. 3 — leave blank for no limit"
              className={inputCls}
              style={{ height: 36, fontSize: 13, width: '100%' }}
            />
            {capInvalid && (
              <p className="text-red-500 mt-1" style={{ fontSize: 11 }}>
                Must be a positive whole number.
              </p>
            )}
            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
              Limits how many records from the same company any single owner receives in this batch.
            </p>
          </div>
        )}

        {error && (
          <p className="text-red-600" style={{ fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>

      {progress && saving && (
        <BulkProgressBar done={progress.done} total={progress.total} />
      )}

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-stone-100">
        {progress && saving && onCancel ? (
          <button
            onClick={onCancel}
            className="border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-medium rounded-md transition-colors"
            style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={onClose}
            disabled={saving}
            className="border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-medium rounded-md transition-colors disabled:opacity-50"
            style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => canConfirm && onConfirm([...selectedIds], capVal && !capInvalid ? capVal : undefined)}
          disabled={!canConfirm}
          className="inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          style={{ fontSize: 13, padding: '7px 14px', height: 34, background: 'var(--color-brand)' }}
          onMouseEnter={(e) => { if (canConfirm) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Reassign
        </button>
      </div>
    </ModalShell>
  );
}
