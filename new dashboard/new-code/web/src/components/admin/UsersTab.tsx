import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Copy, Check, X } from 'lucide-react';
import {
  fetchUsers,
  setUserEnabled,
  setUserRoles,
  createUser,
  resetUserPassword,
  type AdminUser,
  type AdminLookups,
} from '../../data/admin';
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

/**
 * Client/portal sales roles. is_web=false (they were the vendor mobile = CLIENT
 * app roles), so they're excluded from the generic web-role picker — but they're
 * valid, grantable roles and Add User already offers them, so the Edit modal must
 * always surface them too (see the Edit-roles modal below).
 */
const SALES_ROLE_NAMES = ['SALES_HEAD', 'SALES_PERSON'];

const PAGE_SIZE = 20;

export function UsersTab({ lookups, actorId }: { lookups: AdminLookups; actorId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add User modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRoleId, setAddRoleId] = useState('1');
  const [addMobile, setAddMobile] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<{ user_id: number; tempPassword: string } | null>(null);
  const [pwCopied, setPwCopied] = useState(false);

  // Reset Password modal state
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<{ tempPassword: string; created: boolean } | null>(null);
  const [resetPwCopied, setResetPwCopied] = useState(false);

  // Web-assignable roles only (is_web). Non-web roles (SALES_HEAD, SALES_PERSON)
  // are kept out of the picker but still shown if a user already has them.
  const webRoles = useMemo(() => lookups.roles.filter((r) => r.is_web), [lookups.roles]);

  const load = async () => {
    setLoading(true);
    const res = await fetchUsers(lookups.roles);
    setUsers(res.users);
    setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.email, u.designation, ...u.roleNames].join(' ').toLowerCase().includes(q)
    );
  }, [users, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim());

  const handleToggle = async (u: AdminUser) => {
    const disabling = u.enabled;
    if (disabling) {
      const ok = await confirm({
        title: `Disable ${u.full_name || 'this user'}?`,
        message: 'They will lose access to the app until re-enabled. Their existing data is unaffected.',
        tone: 'danger',
        confirmLabel: 'Disable user',
      });
      if (!ok) return;
    }
    setBusyUserId(u.user_id);
    const err = await setUserEnabled(u.user_id, !u.enabled, actorId);
    setBusyUserId(null);
    if (err) { toast.error(err); return; }
    setUsers((prev) =>
      prev.map((x) => (x.user_id === u.user_id ? { ...x, enabled: !u.enabled } : x))
    );
    toast.success(disabling ? 'User disabled' : 'User enabled');
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditRoleIds(new Set(u.roleIds));
    setSaveError(null);
  };

  const toggleRole = (roleId: number) => {
    setEditRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSaveRole = async () => {
    if (!editUser) return;
    const nextIds = [...editRoleIds];
    setSaving(true);
    setSaveError(null);
    const err = await setUserRoles(editUser.user_id, nextIds, actorId);
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    const roleNameMap = new Map(lookups.roles.map((r) => [r.role_id, r.name]));
    const nextNames = nextIds.map((id) => roleNameMap.get(id) ?? '').filter(Boolean);
    setUsers((prev) =>
      prev.map((x) =>
        x.user_id === editUser.user_id ? { ...x, roleIds: nextIds, roleNames: nextNames } : x
      )
    );
    setSaving(false);
    setEditUser(null);
  };

  const resetAddModal = () => {
    setAddFullName('');
    setAddEmail('');
    setAddRoleId('1');
    setAddMobile('');
    setAddError(null);
    setAddSuccess(null);
    setPwCopied(false);
  };

  const handleAddUser = async () => {
    setAddError(null);
    setAddLoading(true);
    try {
      const result = await createUser({
        full_name: addFullName.trim(),
        email: addEmail.trim(),
        role_id: parseInt(addRoleId, 10),
        mobile_number: addMobile.trim() || undefined,
        created_by: actorId || undefined,
      });
      setAddSuccess({ user_id: result.user_id, tempPassword: result.tempPassword });
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  const handleCopyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw).then(() => {
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 2000);
    }).catch(() => toast.error('Could not copy to clipboard'));
  };

  const openResetModal = (u: AdminUser) => {
    setResetUser(u);
    setResetError(null);
    setResetSuccess(null);
    setResetPwCopied(false);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setResetError(null);
    setResetLoading(true);
    try {
      const result = await resetUserPassword(resetUser.user_id);
      setResetSuccess({ tempPassword: result.tempPassword, created: result.created });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCopyResetPassword = (pw: string) => {
    navigator.clipboard.writeText(pw).then(() => {
      setResetPwCopied(true);
      setTimeout(() => setResetPwCopied(false), 2000);
    }).catch(() => toast.error('Could not copy to clipboard'));
  };

  const columns = [
    { key: 'sr',          label: 'Sr. No.',    width: 64 },
    { key: 'name',        label: 'Name' },
    { key: 'email',       label: 'Email' },
    { key: 'designation', label: 'Designation' },
    { key: 'roles',       label: 'Roles' },
    { key: 'status',      label: 'Status',      width: 120 },
    { key: 'actions',     label: 'Actions',     align: 'right' as const, width: 140 },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 10, color: '#9CA3AF', pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search users..."
            style={{
              fontSize: 13,
              paddingLeft: 30,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              outline: 'none',
              height: 34,
              width: 240,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; }}
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(0); }}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 8, background: 'none', border: 'none',
                cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'inline-flex', lineHeight: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <AddButton label="Add User" onClick={() => { resetAddModal(); setAddModalOpen(true); }} />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <FigmaTableHead columns={columns} />
            <tbody>
              {loading ? (
                <LoadingRow colSpan={columns.length} label="Loading users..." />
              ) : error ? (
                <ErrorRow colSpan={columns.length} label={error} />
              ) : pageRows.length === 0 ? (
                <EmptyRow colSpan={columns.length} label="No users match your search." />
              ) : (
                pageRows.map((u, idx) => (
                  <tr
                    key={u.user_id}
                    style={{
                      borderBottom: '1px solid #F3F4F6',
                      height: 44,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
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
                      {safePage * PAGE_SIZE + idx + 1}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={u.full_name} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                          {u.full_name || <span style={{ color: '#D1D5DB' }}>—</span>}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {u.email || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Designation */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {u.designation || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Roles */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.roleNames.length > 0 ? (
                          u.roleNames.map((r) => <RoleChip key={r} label={r} />)
                        ) : (
                          <span style={{ color: '#D1D5DB', fontSize: 13 }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Status toggle */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <StatusToggle
                        enabled={u.enabled}
                        busy={busyUserId === u.user_id}
                        onToggle={() => handleToggle(u)}
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          onClick={() => openResetModal(u)}
                          title="Reset password"
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid #D1D5DB',
                            background: '#fff',
                            color: '#374151',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; }}
                        >
                          Reset pw
                        </button>
                        <EditIconButton onClick={() => openEdit(u)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {!loading && !error && filtered.length > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            Page {safePage + 1} of {pageCount}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostButton
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              Previous
            </GhostButton>
            <GhostButton
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next
            </GhostButton>
          </div>
        </div>
      )}

      {/* Add User modal */}
      <Modal
        open={addModalOpen}
        title="Add New User"
        onClose={() => { setAddModalOpen(false); resetAddModal(); }}
        width={480}
        footer={
          addSuccess ? (
            <GhostButton onClick={() => { setAddModalOpen(false); resetAddModal(); }}>
              Close
            </GhostButton>
          ) : (
            <>
              <GhostButton onClick={() => { setAddModalOpen(false); resetAddModal(); }} disabled={addLoading}>
                Cancel
              </GhostButton>
              <PrimaryButton onClick={handleAddUser} disabled={addLoading || !addFullName.trim() || !emailOk}>
                {addLoading && <Loader2 size={13} className="animate-spin" />}
                Create User
              </PrimaryButton>
            </>
          )
        }
      >
        {addSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: '12px 14px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 8,
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', margin: '0 0 6px' }}>
                User created successfully!
              </p>
              <p style={{ fontSize: 12, color: '#374151', margin: '0 0 10px' }}>
                Share this temporary password with the new user — they can change it in Settings.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  background: '#fff',
                  border: '1px solid #D1D5DB',
                  borderRadius: 6,
                }}
              >
                <code style={{ flex: 1, fontSize: 14, fontFamily: 'monospace', color: '#111827', letterSpacing: '0.05em' }}>
                  {addSuccess.tempPassword}
                </code>
                <button
                  onClick={() => handleCopyPassword(addSuccess!.tempPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: pwCopied ? '#16A34A' : '#6B7280',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Copy password"
                >
                  {pwCopied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full Name *">
              <TextInput
                value={addFullName}
                onChange={setAddFullName}
                placeholder="e.g. Jane Smith"
              />
            </Field>
            <Field label="Email *">
              <TextInput
                type="email"
                value={addEmail}
                onChange={setAddEmail}
                placeholder="jane@company.com"
              />
            </Field>
            {addEmail.trim() && !emailOk && (
              <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>Enter a valid email address.</p>
            )}
            <Field label="Role *">
              <SelectInput value={addRoleId} onChange={setAddRoleId}>
                {lookups.roles.map((r) => (
                  <option key={r.role_id} value={String(r.role_id)}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Mobile (optional)">
              <TextInput
                value={addMobile}
                onChange={setAddMobile}
                placeholder="+91 98765 43210"
              />
            </Field>
            {addError && (
              <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{addError}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Reset Password modal */}
      <Modal
        open={!!resetUser}
        title={resetUser ? `Reset password — ${resetUser.full_name}` : 'Reset password'}
        onClose={() => setResetUser(null)}
        width={440}
        footer={
          resetSuccess ? (
            <GhostButton onClick={() => setResetUser(null)}>
              Close
            </GhostButton>
          ) : (
            <>
              <GhostButton onClick={() => setResetUser(null)} disabled={resetLoading}>
                Cancel
              </GhostButton>
              <PrimaryButton onClick={handleResetPassword} disabled={resetLoading}>
                {resetLoading && <Loader2 size={13} className="animate-spin" />}
                Reset password
              </PrimaryButton>
            </>
          )
        }
      >
        {resetUser && (
          resetSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 8,
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', margin: '0 0 6px' }}>
                  {resetSuccess.created ? 'Login created successfully!' : 'Password reset successfully!'}
                </p>
                <p style={{ fontSize: 12, color: '#374151', margin: '0 0 10px' }}>
                  {resetSuccess.created
                    ? `${resetUser.full_name} had no login yet — one was created. Share this temporary password; they can change it in Settings.`
                    : `Share this temporary password with ${resetUser.full_name} — they can change it in Settings.`}
                </p>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    background: '#fff',
                    border: '1px solid #D1D5DB',
                    borderRadius: 6,
                  }}
                >
                  <code style={{ flex: 1, fontSize: 14, fontFamily: 'monospace', color: '#111827', letterSpacing: '0.05em' }}>
                    {resetSuccess.tempPassword}
                  </code>
                  <button
                    onClick={() => handleCopyResetPassword(resetSuccess!.tempPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: resetPwCopied ? '#16A34A' : '#6B7280',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Copy password"
                  >
                    {resetPwCopied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: '#F9FAFB',
                  borderRadius: 6,
                  border: '1px solid #F3F4F6',
                }}
              >
                <Avatar name={resetUser.full_name} size={32} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                    {resetUser.full_name}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{resetUser.email}</p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                This generates a new temporary password. If this user has no login yet (most users migrated from the
                old system don't), their login is created now. Any current password stops working immediately.
              </p>
              {resetError && (
                <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{resetError}</p>
              )}
            </div>
          )
        )}
      </Modal>

      {/* Edit roles modal */}
      <Modal
        open={!!editUser}
        title={editUser ? `Edit roles — ${editUser.full_name}` : 'Edit roles'}
        onClose={() => setEditUser(null)}
        footer={
          <>
            <GhostButton onClick={() => setEditUser(null)} disabled={saving}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleSaveRole} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save
            </PrimaryButton>
          </>
        }
      >
        {editUser && (() => {
          // Show every web-assignable role, PLUS the client/portal sales roles
          // (SALES_HEAD/SALES_PERSON), PLUS any other non-web role the user already
          // holds. The sales roles are is_web=false (they were the vendor mobile =
          // CLIENT app roles) but are valid, GRANTABLE roles — Add User already
          // offers them, so Edit must too, otherwise an admin can never give a user
          // a sales role they don't already have (the bug). Including them always
          // makes Edit symmetric with Add. Any extra is also surfaced so it can be
          // intentionally removed, never silently lost.
          const ids = new Set(webRoles.map((r) => r.role_id));
          const salesRoles = lookups.roles.filter(
            (r) => SALES_ROLE_NAMES.includes(r.name) && !ids.has(r.role_id)
          );
          salesRoles.forEach((r) => ids.add(r.role_id));
          const extras = editUser.roleIds
            .filter((id) => !ids.has(id))
            .map((id) => lookups.roles.find((r) => r.role_id === id))
            .filter((r): r is NonNullable<typeof r> => !!r);
          const roleOptions = [...webRoles, ...salesRoles, ...extras];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* User info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: '#F9FAFB',
                  borderRadius: 6,
                  border: '1px solid #F3F4F6',
                }}
              >
                <Avatar name={editUser.full_name} size={32} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                    {editUser.full_name}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{editUser.email}</p>
                </div>
              </div>

              {/* Role checkboxes */}
              <Field label="Roles">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 6,
                    background: '#fff',
                  }}
                >
                  {roleOptions.map((r) => {
                    const checked = editRoleIds.has(r.role_id);
                    const nonWeb = !r.is_web;
                    return (
                      <label
                        key={r.role_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(r.role_id)}
                          style={{ accentColor: '#1A7EE8', width: 14, height: 14, flexShrink: 0 }}
                        />
                        <span style={{ color: '#374151' }}>{r.name}</span>
                        {nonWeb && (
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>(non-web)</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </Field>

              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                Tick every role this user should have. Unticked roles are removed; the user's
                other roles are preserved.
              </p>

              {saveError && (
                <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{saveError}</p>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
