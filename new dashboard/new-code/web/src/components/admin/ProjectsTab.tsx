import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import {
  fetchProjects,
  createProject,
  setProjectEnabled,
  assignUserToProject,
  unassignProjectUser,
  fetchUsers,
  type AdminProject,
  type AdminLookups,
  type AdminUser,
} from '../../data/admin';
import { supabase } from '../../lib/supabase';
import {
  Card,
  FigmaTableHead,
  LoadingRow,
  EmptyRow,
  ErrorRow,
  StatusToggle,
  RoleChip,
  Avatar,
  AddButton,
  EditIconButton,
} from './primitives';
import { Modal, Field, TextInput, SelectInput, PrimaryButton, GhostButton } from './Modal';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';

interface ClientOption {
  id: number;
  name: string;
}

export function ProjectsTab({ lookups, actorId }: { lookups: AdminLookups; actorId: string }) {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // Create project modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // View/assign members modal
  const [viewProject, setViewProject] = useState<AdminProject | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState(lookups.projectRoleNames[0] ?? 'AGENT');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [busyProjectId, setBusyProjectId] = useState<number | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const load = async () => {
    setLoading(true);
    const res = await fetchProjects();
    setProjects(res.projects);
    setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase
      .from('client_association')
      .select('client_assoc_id, client_name')
      .is('deleted_date', null)
      .order('client_name')
      .then(({ data }) => {
        setClients(
          (
            (data ?? []) as unknown as { client_assoc_id: number; client_name: string }[]
          ).map((c) => ({ id: c.client_assoc_id, name: c.client_name }))
        );
      });
    fetchUsers(lookups.roles).then((r) => setUsers(r.users.filter((u) => u.enabled)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newClientId) return;
    setCreating(true);
    setCreateError(null);
    const err = await createProject(newName.trim(), Number(newClientId), actorId);
    if (err) {
      setCreateError(err);
      setCreating(false);
      return;
    }
    setCreating(false);
    setCreateOpen(false);
    setNewName('');
    setNewClientId('');
    await load();
  };

  const handleToggle = async (p: AdminProject) => {
    const disabling = p.enabled;
    if (disabling) {
      const ok = await confirm({
        title: `Disable project "${p.project_name}"?`,
        message: 'It will be hidden from project pickers until re-enabled. Existing leads and data are unaffected.',
        tone: 'danger',
        confirmLabel: 'Disable project',
      });
      if (!ok) return;
    }
    setBusyProjectId(p.project_id);
    const err = await setProjectEnabled(p.project_id, !p.enabled, actorId);
    setBusyProjectId(null);
    if (err) { toast.error(err); return; }
    setProjects((prev) =>
      prev.map((x) => (x.project_id === p.project_id ? { ...x, enabled: !p.enabled } : x))
    );
    toast.success(disabling ? 'Project disabled' : 'Project enabled');
  };

  const openView = (p: AdminProject) => {
    setViewProject(p);
    setAssignUserId('');
    setAssignRole(lookups.projectRoleNames[0] ?? 'AGENT');
    setAssignError(null);
  };

  // Users not already assigned to the open project (avoid duplicate members).
  const assignableUsers = useMemo(() => {
    if (!viewProject) return users;
    const memberIds = new Set(viewProject.members.map((m) => m.user_id));
    return users.filter((u) => !memberIds.has(u.user_id));
  }, [users, viewProject]);

  const handleAssign = async () => {
    if (!viewProject || !assignUserId) return;
    setAssigning(true);
    setAssignError(null);
    const err = await assignUserToProject(
      viewProject.project_id,
      Number(assignUserId),
      assignRole,
      actorId
    );
    if (err) {
      setAssignError(err);
      setAssigning(false);
      return;
    }
    setAssigning(false);
    setViewProject(null);
    await load();
  };

  const handleUnassign = async (projectUserId: number) => {
    const ok = await confirm({
      title: 'Remove this member from the project?',
      message: 'They will no longer have access to this project\'s leads. You can re-add them later.',
      tone: 'danger',
      confirmLabel: 'Remove member',
    });
    if (!ok) return;
    setBusyMemberId(projectUserId);
    const err = await unassignProjectUser(projectUserId, actorId);
    setBusyMemberId(null);
    if (err) { toast.error(err); return; }
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        members: p.members.filter((m) => m.project_user_id !== projectUserId),
      }))
    );
    // Also update viewProject so the modal reflects the change immediately
    setViewProject((vp) =>
      vp
        ? { ...vp, members: vp.members.filter((m) => m.project_user_id !== projectUserId) }
        : vp
    );
    toast.success('Member removed');
  };

  const columns = [
    { key: 'sr',      label: 'Sr. No.',         width: 64 },
    { key: 'name',    label: 'Project Name' },
    { key: 'client',  label: 'Client Association' },
    { key: 'members', label: 'Members',          width: 90 },
    { key: 'status',  label: 'Status',           width: 140 },
    { key: 'view',    label: 'View',             align: 'right' as const, width: 60 },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 4,
        }}
      >
        <AddButton
          label="Add Project"
          onClick={() => {
            setCreateOpen(true);
            setCreateError(null);
          }}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <FigmaTableHead columns={columns} />
            <tbody>
              {loading ? (
                <LoadingRow colSpan={columns.length} label="Loading projects..." />
              ) : error ? (
                <ErrorRow colSpan={columns.length} label={error} />
              ) : projects.length === 0 ? (
                <EmptyRow colSpan={columns.length} label="No projects yet." />
              ) : (
                projects.map((p, idx) => (
                  <tr
                    key={p.project_id}
                    style={{
                      borderBottom: '1px solid #F3F4F6',
                      height: 44,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = '';
                    }}
                  >
                    {/* Sr. No. */}
                    <td
                      style={{
                        padding: '0 12px',
                        fontSize: 13,
                        color: '#6B7280',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Project Name */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 13, color: '#111827' }}>{p.project_name}</span>
                    </td>

                    {/* Client Association */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {p.clientName || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Members count */}
                    <td
                      style={{
                        padding: '0 16px',
                        fontSize: 13,
                        color: '#374151',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                      }}
                    >
                      {p.members.length}
                    </td>

                    {/* Status toggle */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <StatusToggle
                        enabled={p.enabled}
                        busy={busyProjectId === p.project_id}
                        onToggle={() => handleToggle(p)}
                      />
                    </td>

                    {/* View icon */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <EditIconButton onClick={() => openView(p)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create project modal */}
      <Modal
        open={createOpen}
        title="Add Project"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <GhostButton onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </GhostButton>
            <PrimaryButton
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newClientId}
            >
              {creating && <Loader2 size={13} className="animate-spin" />} Create
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Project Name *">
            <TextInput value={newName} onChange={setNewName} placeholder="e.g. DTSS Lead Gen" />
          </Field>
          <Field label="Client Association *">
            <SelectInput value={newClientId} onChange={setNewClientId}>
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          {createError && (
            <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{createError}</p>
          )}
        </div>
      </Modal>

      {/* View / assign members modal */}
      <Modal
        open={!!viewProject}
        title={viewProject ? `Project: ${viewProject.project_name}` : 'Project'}
        onClose={() => setViewProject(null)}
        width={540}
        footer={
          <>
            <GhostButton onClick={() => setViewProject(null)} disabled={assigning}>
              Close
            </GhostButton>
            <PrimaryButton onClick={handleAssign} disabled={assigning || !assignUserId}>
              {assigning && <Loader2 size={13} className="animate-spin" />}
              <UserPlus size={13} /> Assign
            </PrimaryButton>
          </>
        }
      >
        {viewProject && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Members list */}
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#6B7280',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Members ({viewProject.members.length})
              </p>
              {viewProject.members.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>No users assigned yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {viewProject.members.map((m) => (
                    <div
                      key={m.project_user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        padding: '5px 8px 5px 6px',
                        background: '#F9FAFB',
                      }}
                    >
                      <Avatar name={m.full_name} size={24} />
                      <div style={{ lineHeight: 1.3 }}>
                        <span style={{ fontSize: 12, color: '#374151', display: 'block' }}>
                          {m.full_name}
                        </span>
                        <RoleChip label={m.role_name} />
                      </div>
                      <button
                        onClick={() => handleUnassign(m.project_user_id)}
                        disabled={busyMemberId === m.project_user_id}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#D1D5DB',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        aria-label="Unassign"
                      >
                        {busyMemberId === m.project_user_id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <X size={13} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assign user */}
            <div
              style={{
                borderTop: '1px solid #F3F4F6',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: 0,
                }}
              >
                Assign User
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="User *">
                  <SelectInput value={assignUserId} onChange={setAssignUserId}>
                    <option value="">
                      {assignableUsers.length === 0
                        ? 'All users already assigned'
                        : 'Select a user'}
                    </option>
                    {assignableUsers.map((u) => (
                      <option key={u.user_id} value={String(u.user_id)}>
                        {u.full_name} — {u.email}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Project Role *">
                  <SelectInput value={assignRole} onChange={setAssignRole}>
                    {lookups.projectRoleNames.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              {assignError && (
                <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{assignError}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
