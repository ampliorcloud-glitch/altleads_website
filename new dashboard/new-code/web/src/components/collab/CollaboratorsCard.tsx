/**
 * CollaboratorsCard — shows current collaborators on a record + "Add collaborator" modal.
 *
 * Rendered ONLY when COLLAB_ASSOC is true (controlled by the calling detail page).
 * Kept separate from existing owner/Team display per design doc (§1.5 #5, §4 #6).
 *
 * Uses: record_collaborator via data/collaborators.ts
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus, X, ChevronDown } from 'lucide-react';
import {
  listCollaborators,
  addCollaborator,
  removeCollaborator,
} from '../../data/collaborators';
import { SectionCard } from '../admin/primitives';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';
import type { Collaborator, CollaboratorRole, RecordType } from '../../lib/collabAssoc';

/* ------------------------------------------------------------------ */
/*  Role badge                                                          */
/* ------------------------------------------------------------------ */

function RoleBadge({ role }: { role: CollaboratorRole }) {
  const cfg =
    role === 'editor'
      ? { bg: '#EFF6FF', color: '#1D4ED8', label: 'Editor' }
      : { bg: '#F3F4F6', color: '#6B7280', label: 'Viewer' };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 4,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
        letterSpacing: '0.03em',
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Initials avatar (local, small)                                      */
/* ------------------------------------------------------------------ */

function MiniAvatar({ name }: { name: string }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: '#E8F2FD',
        color: '#1A7EE8',
        fontSize: 10,
        fontWeight: 700,
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      {letters}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Collaborator Modal                                              */
/* ------------------------------------------------------------------ */

function AddCollaboratorModal({
  open,
  userOptions,
  onAdd,
  onClose,
}: {
  open: boolean;
  userOptions: SearchSelectOption[];
  onAdd: (userId: number, role: CollaboratorRole) => Promise<void>;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState<number | null>(null);
  const [role, setRole] = useState<CollaboratorRole>('viewer');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!userId) { setErr('Please select a user.'); return; }
    setSaving(true);
    setErr(null);
    await onAdd(userId, role);
    setSaving(false);
    setUserId(null);
    setRole('viewer');
  };

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
          width: 380,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>
            Add collaborator
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
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>User</label>
          <SearchSelect
            options={userOptions}
            value={userId}
            onChange={setUserId}
            placeholder="Search users…"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Access level</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as CollaboratorRole)}
            style={{
              fontSize: 13,
              padding: '7px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              height: 36,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="viewer">Viewer — can view the record, not edit</option>
            <option value="editor">Editor — can view and edit</option>
          </select>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
            The global admin setting may further restrict what collaborators can do.
          </p>
        </div>

        {err && <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{err}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              fontSize: 13,
              padding: '7px 16px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !userId}
            style={{
              fontSize: 13,
              padding: '7px 16px',
              border: 'none',
              borderRadius: 6,
              background: saving || !userId ? '#93C5FD' : '#1A7EE8',
              color: '#fff',
              cursor: saving || !userId ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main card                                                           */
/* ------------------------------------------------------------------ */

export interface CollaboratorsCardProps {
  recordType: RecordType;
  recordId: number;
  /** Options for the "add" user picker — caller fetches project users. */
  userOptions: SearchSelectOption[];
  actorId: string;
}

export function CollaboratorsCard({
  recordType,
  recordId,
  userOptions,
  actorId,
}: CollaboratorsCardProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listCollaborators(recordType, recordId);
    setCollaborators(res.collaborators);
    setError(res.error);
    setLoading(false);
  }, [recordType, recordId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (userId: number, role: CollaboratorRole) => {
    const res = await addCollaborator({
      recordType,
      recordId,
      userId,
      role,
      actorId,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowAdd(false);
    await load();
  };

  const handleRemove = async (collaboratorId: number) => {
    setRemovingId(collaboratorId);
    const res = await removeCollaborator({ collaboratorId, actorId });
    setRemovingId(null);
    if (res.error) { setError(res.error); return; }
    await load();
  };

  return (
    <>
      <SectionCard
        title="Collaborators"
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
            <UserPlus size={13} />
            Add collaborator
          </button>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" />
            Loading collaborators…
          </div>
        ) : error ? (
          <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{error}</p>
        ) : collaborators.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            No collaborators yet. Add team members who need access to this record.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {collaborators.map((c) => {
              const name = c.full_name ?? `User #${c.user_id}`;
              return (
                <div
                  key={c.collaborator_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                >
                  <MiniAvatar name={name} />
                  <span style={{ fontSize: 13, color: '#111827', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                  <RoleBadge role={c.collaborator_role} />
                  <button
                    type="button"
                    onClick={() => handleRemove(c.collaborator_id)}
                    disabled={removingId === c.collaborator_id}
                    title="Remove collaborator"
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
                    {removingId === c.collaborator_id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <X size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <AddCollaboratorModal
        open={showAdd}
        userOptions={userOptions}
        onAdd={handleAdd}
        onClose={() => setShowAdd(false)}
      />
    </>
  );
}
