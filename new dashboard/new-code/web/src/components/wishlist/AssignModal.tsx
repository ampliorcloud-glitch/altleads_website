import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, UserCheck } from 'lucide-react';
import type { UserOption } from '../../data/wishlist';
import { useFocusTrap } from '../../lib/useFocusTrap';

/* ── shared modal shell ──────────────────────────────────────────────────── */

export function ModalShell({
  title,
  icon,
  onClose,
  children,
  width = 460,
  busy = false,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  /** When true (bulk op in progress), backdrop clicks are a no-op. */
  busy?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true); // ModalShell only renders while open (ALT-203)
  useEffect(() => {
    const t = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop: swallow clicks while a bulk op is running (Fix 1 — ALT-UX). */}
      <div className="absolute inset-0" style={{ background: 'rgba(24,24,27,0.30)' }} onClick={busy ? undefined : onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative bg-white border border-stone-200 rounded-xl flex flex-col outline-none"
        style={{ width, maxWidth: '100%', maxHeight: '90vh', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-stone-400 shrink-0">{icon}</span>}
            <h2 className="font-semibold text-stone-900 truncate" style={{ fontSize: 15 }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const selectCls =
  'w-full border border-stone-300 rounded-md px-3 text-stone-800 bg-white ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

function Label({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

/* ── Assign / Reassign modal ─────────────────────────────────────────────── */

export function AssignModal({
  currentAgentId,
  currentTlId,
  agents,
  teamLeads,
  saving,
  error,
  onConfirm,
  onClose,
}: {
  currentAgentId: number | null;
  currentTlId: number | null;
  agents: UserOption[];
  teamLeads: UserOption[];
  saving: boolean;
  error: string | null;
  onConfirm: (agentId: number, teamLeadId: number | null) => void;
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState<number | null>(currentAgentId);
  const [tlId, setTlId] = useState<number | null>(currentTlId);

  const isReassign = currentAgentId != null;

  return (
    <ModalShell
      title={isReassign ? 'Reassign Wishlist' : 'Assign Wishlist'}
      icon={<UserCheck size={16} />}
      onClose={onClose}
    >
      <p className="text-stone-500 mb-4" style={{ fontSize: 12 }}>
        Assign this target company to an agent. The agent is notified and can convert it into a lead.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="assign-agent" required>Agent</Label>
          <select
            id="assign-agent"
            aria-required={true}
            value={agentId ?? ''}
            onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : null)}
            className={selectCls}
            style={{ height: 36, fontSize: 13 }}
            disabled={saving}
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {agents.length === 0 && (
            <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
              No agents available.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="assign-team-lead">Team Lead</Label>
          <select
            id="assign-team-lead"
            value={tlId ?? ''}
            onChange={(e) => setTlId(e.target.value ? Number(e.target.value) : null)}
            className={selectCls}
            style={{ height: 36, fontSize: 13 }}
            disabled={saving}
          >
            <option value="">Unassigned</option>
            {teamLeads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-stone-400 mt-1" style={{ fontSize: 11 }}>
            The Team Lead owns the quality gate before a lead is converted.
          </p>
        </div>

        {error && (
          <p className="text-red-600" style={{ fontSize: 12 }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-stone-100">
        <button
          onClick={onClose}
          disabled={saving}
          className="border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-medium rounded-md transition-colors disabled:opacity-50"
          style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
        >
          Cancel
        </button>
        <button
          onClick={() => agentId != null && onConfirm(agentId, tlId)}
          disabled={saving || agentId == null}
          className="inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          style={{ fontSize: 13, padding: '7px 14px', height: 34, background: 'var(--color-brand)' }}
          onMouseEnter={(e) => { if (!(saving || agentId == null)) (e.currentTarget as HTMLElement).style.background = 'var(--color-brand-dark)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-brand)'; }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {isReassign ? 'Reassign' : 'Assign'}
        </button>
      </div>
    </ModalShell>
  );
}
