import { useEffect, useRef, useState } from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';
import { upsertCompanyStatus } from '../../data/projectStatus';
import type { DropdownOption } from '../../data/dropdowns';

const inputBase: React.CSSProperties = {
  fontSize: 12,
  padding: '5px 8px',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--color-surface)',
  color: 'var(--color-gray-900)',
  outline: 'none',
  height: 26,
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

interface InlineAccountStatusCellProps {
  companyId: number;
  /**
   * The project this inline edit writes to. The parent RESOLVES this before
   * passing it in (AMBIG E1): the global scope when one is selected, else the
   * record's sole project when it belongs to exactly one. It's only null when
   * genuinely ambiguous (no global scope AND the record is in multiple
   * projects) — in which case the cell stays read-only with `blockedReason`.
   */
  projectId: number | null;
  current: string | null;
  options: DropdownOption[];
  actorId: string | null;
  /**
   * Tooltip shown when `projectId` is null (read-only). Lets the parent explain
   * WHY (e.g. "in multiple projects — pick one above"). Defaults to the original
   * "Select a project first".
   */
  blockedReason?: string;
  /** Called with the saved value (null = cleared) only after a successful write. */
  onUpdated: (companyId: number, newStatus: string | null) => void;
}

/**
 * Inline-editable per-project Account Status cell — mirrors Contacts'
 * InlineStatusCell. Project-gated (read-only only when the project can't be
 * resolved). On save it calls upsertCompanyStatus, toasts, and only updates the
 * parent on success (so an RLS 42501 surfaces a friendly message instead of
 * silently flipping).
 */
export function InlineAccountStatusCell({
  companyId, projectId, current, options, actorId, blockedReason, onUpdated,
}: InlineAccountStatusCellProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Close on outside click.
  useEffect(() => {
    if (!editing) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setEditing(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  async function handleChange(value: string) {
    if (!projectId) return;
    setBusy(true);
    const newStatus = value === '' ? null : value;
    const { error } = await upsertCompanyStatus(companyId, projectId, { account_status: newStatus }, actorId);
    setBusy(false);
    setEditing(false);
    // Only update on success — surface RLS / write failures (e.g. 42501).
    if (error) { toast.error(error); return; }
    onUpdated(companyId, newStatus);
    toast.success('Status updated');
  }

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); if (projectId) setEditing(true); }}
        title={projectId ? 'Click to change status' : (blockedReason ?? 'Select a project first')}
        style={{ cursor: projectId ? 'pointer' : 'default', display: 'inline-block' }}
      >
        <StatusBadge value={current} category="account_status" />
      </span>
    );
  }

  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block' }}>
      <select
        autoFocus
        value={current ?? ''}
        disabled={busy}
        onChange={(e) => void handleChange(e.target.value)}
        style={{ ...inputBase, paddingRight: 24, cursor: 'pointer' }}
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.option_id} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default InlineAccountStatusCell;
