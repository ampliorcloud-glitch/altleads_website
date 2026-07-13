/**
 * BulkProjectModal — "Add N records to a project" (ALT-291).
 *
 * A small project picker reusing the shared ModalShell. Presentation only:
 * the caller supplies the user's accessible projects and performs the write.
 */
import { useState } from 'react';
import { Loader2, FolderPlus } from 'lucide-react';
import { ModalShell } from '../wishlist/AssignModal';
import { BulkProgressBar } from './BulkProgressBar';
import type { ScopedProject } from '../../contexts/ProjectContext';

const selectCls =
  'w-full border border-stone-300 rounded-md px-3 text-stone-800 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

export function BulkProjectModal({
  entityLabel,
  count,
  projects,
  saving,
  error,
  progress,
  onCancel,
  onConfirm,
  onClose,
}: {
  entityLabel: string;
  count: number;
  projects: ScopedProject[];
  saving: boolean;
  error: string | null;
  /** Live bulk progress (done of total). When set + saving, shows a bar + Cancel. */
  progress?: { done: number; total: number } | null;
  /** Abort the in-flight bulk job (stops cleanly between records). */
  onCancel?: () => void;
  onConfirm: (projectId: number) => void;
  onClose: () => void;
}) {
  const [projectId, setProjectId] = useState<number | null>(projects[0]?.project_id ?? null);

  return (
    <ModalShell
      title={`Add ${count} ${entityLabel}${count === 1 ? '' : 's'} to a project`}
      icon={<FolderPlus size={16} />}
      onClose={onClose}
      busy={saving}
    >
      <p className="text-stone-500 mb-4" style={{ fontSize: 12 }}>
        {`Enroll the ${count} selected ${entityLabel.toLowerCase()}${count === 1 ? '' : 's'} into a project. ` +
          `Existing members are left as-is (no status is changed).`}
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="bulk-project" className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
            Project<span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="bulk-project"
            aria-required={true}
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
            className={selectCls}
            style={{ height: 36, fontSize: 13 }}
            disabled={saving}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_name}
              </option>
            ))}
          </select>
          {projects.length === 0 && (
            <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
              You have no projects to add to.
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
          onClick={() => projectId != null && onConfirm(projectId)}
          disabled={saving || projectId == null}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Add to project
        </button>
      </div>
    </ModalShell>
  );
}
