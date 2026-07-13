/**
 * BulkStatusModal — "Set the status for N records" (Step E, universal pass).
 *
 * A small status picker reusing the shared ModalShell — mirrors BulkProjectModal.
 * Presentation only: the caller supplies the module's status options (account_status
 * for companies, contact_status for contacts) and performs the write. Status is
 * per-project, so the caller gates this behind a selected project.
 */
import { useState } from 'react';
import { Loader2, Tag } from 'lucide-react';
import { ModalShell } from '../wishlist/AssignModal';
import { BulkProgressBar } from './BulkProgressBar';

const selectCls =
  'w-full border border-stone-300 rounded-md px-3 text-stone-800 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

export function BulkStatusModal({
  entityLabel,
  count,
  options,
  saving,
  error,
  progress,
  onCancel,
  onConfirm,
  onClose,
}: {
  entityLabel: string;
  count: number;
  options: { value: string; label: string }[];
  saving: boolean;
  error: string | null;
  /** Live bulk progress (done of total). When set + saving, shows a bar + Cancel. */
  progress?: { done: number; total: number } | null;
  /** Abort the in-flight bulk job (stops cleanly between records). */
  onCancel?: () => void;
  onConfirm: (status: string) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>(options[0]?.value ?? '');

  return (
    <ModalShell
      title={`Set status for ${count} ${entityLabel}${count === 1 ? '' : 's'}`}
      icon={<Tag size={16} />}
      onClose={onClose}
      busy={saving}
    >
      <p className="text-stone-500 mb-4" style={{ fontSize: 12 }}>
        {`Update the status of the ${count} selected ${entityLabel.toLowerCase()}${count === 1 ? '' : 's'} ` +
          `in this project. Only records you own can be changed.`}
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="bulk-status" className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
            Status<span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="bulk-status"
            aria-required={true}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectCls}
            style={{ height: 36, fontSize: 13 }}
            disabled={saving}
          >
            <option value="">Select a status…</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
              No status options are configured.
            </p>
          )}
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
          onClick={() => status && onConfirm(status)}
          disabled={saving || !status}
          className="inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          style={{ fontSize: 13, padding: '7px 14px', height: 34, background: 'var(--color-brand)' }}
          onMouseEnter={(e) => { if (!(saving || !status)) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Set status
        </button>
      </div>
    </ModalShell>
  );
}
