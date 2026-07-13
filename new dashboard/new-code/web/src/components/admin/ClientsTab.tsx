import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchClients,
  updateClient,
  createClient,
  setClientEnabled,
  type AdminClient,
  type AdminLookups,
  type ClientEditInput,
} from '../../data/admin';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import {
  Card,
  FigmaTableHead,
  LoadingRow,
  EmptyRow,
  ErrorRow,
  StatusToggle,
  AddButton,
  EditIconButton,
} from './primitives';
import { Modal, Field, TextInput, SelectInput, PrimaryButton, GhostButton } from './Modal';

const emptyForm: ClientEditInput = {
  client_name: '',
  full_name: '',
  email: '',
  mobile_number: '',
  cin_number: '',
  location: '',
  website: '',
  industry_id: 0,
  domain_id: 0,
  enabled: true,
};

export function ClientsTab({ lookups, actorId }: { lookups: AdminLookups; actorId: string }) {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyClientId, setBusyClientId] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const [mode, setMode] = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientEditInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetchClients();
    setClients(res.clients);
    setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (c: AdminClient) => {
    const disabling = c.enabled;
    if (disabling) {
      const ok = await confirm({
        title: `Disable client "${c.client_name}"?`,
        message: 'They will be marked inactive. Existing projects and data are unaffected.',
        tone: 'danger',
        confirmLabel: 'Disable client',
      });
      if (!ok) return;
    }
    setBusyClientId(c.client_assoc_id);
    const err = await setClientEnabled(c.client_assoc_id, !c.enabled, actorId);
    setBusyClientId(null);
    if (err) { toast.error(err); return; }
    setClients((prev) =>
      prev.map((x) => (x.client_assoc_id === c.client_assoc_id ? { ...x, enabled: !c.enabled } : x))
    );
    toast.success(disabling ? 'Client disabled' : 'Client enabled');
  };

  const setField = <K extends keyof ClientEditInput>(k: K, v: ClientEditInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const openCreate = () => {
    setForm({
      ...emptyForm,
      industry_id: lookups.industries[0]?.id ?? 0,
      domain_id: lookups.domains[0]?.id ?? 0,
    });
    setMode('create');
    setEditId(null);
    setSaveError(null);
  };

  const openEdit = (c: AdminClient) => {
    setForm({
      client_name: c.client_name,
      full_name: c.full_name,
      email: c.email,
      mobile_number: c.mobile_number,
      cin_number: c.cin_number,
      location: c.location ?? '',
      website: c.website ?? '',
      industry_id: c.industry_id ?? lookups.industries[0]?.id ?? 0,
      domain_id: c.domain_id ?? lookups.domains[0]?.id ?? 0,
      enabled: c.enabled,
    });
    setMode('edit');
    setEditId(c.client_assoc_id);
    setSaveError(null);
  };

  const valid =
    form.client_name.trim() &&
    form.full_name.trim() &&
    form.email.trim() &&
    form.mobile_number.trim() &&
    form.cin_number.trim() &&
    form.industry_id &&
    form.domain_id;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setSaveError(null);
    const err =
      mode === 'edit' && editId != null
        ? await updateClient(editId, form, actorId)
        : await createClient(form, actorId);
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    setSaving(false);
    setMode(null);
    await load();
  };

  const columns = [
    { key: 'sr',       label: 'Sr. No.',         width: 64 },
    { key: 'client',   label: 'Client Name' },
    { key: 'contact',  label: 'Primary Contact' },
    { key: 'industry', label: 'Industry' },
    { key: 'domain',   label: 'Domain' },
    { key: 'location', label: 'Location' },
    { key: 'status',   label: 'Status',           width: 140 },
    { key: 'actions',  label: 'Edit',             align: 'right' as const, width: 60 },
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
        <AddButton label="Add Client" onClick={openCreate} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <FigmaTableHead columns={columns} />
            <tbody>
              {loading ? (
                <LoadingRow colSpan={columns.length} label="Loading clients..." />
              ) : error ? (
                <ErrorRow colSpan={columns.length} label={error} />
              ) : clients.length === 0 ? (
                <EmptyRow colSpan={columns.length} label="No clients yet." />
              ) : (
                clients.map((c, idx) => (
                  <tr
                    key={c.client_assoc_id}
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

                    {/* Client Name */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                        {c.client_name}
                      </span>
                    </td>

                    {/* Primary Contact */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                        {c.full_name || '—'}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{c.email}</p>
                    </td>

                    {/* Industry */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {c.industryName || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Domain */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {c.domainName || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Location */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {c.location || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <StatusToggle
                        enabled={c.enabled}
                        busy={busyClientId === c.client_assoc_id}
                        onToggle={() => handleToggle(c)}
                      />
                    </td>

                    {/* Edit */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <EditIconButton onClick={() => openEdit(c)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={mode !== null}
        title={mode === 'edit' ? 'Edit Client' : 'Add Client'}
        onClose={() => setMode(null)}
        width={600}
        footer={
          <>
            <GhostButton onClick={() => setMode(null)} disabled={saving}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleSave} disabled={saving || !valid}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {mode === 'edit' ? 'Save Edit' : 'Add Client'}
            </PrimaryButton>
          </>
        }
      >
        {/* Section card header inside modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 4,
              height: 18,
              background: '#1A7EE8',
              borderRadius: 2,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Client Details</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Client Name *">
            <TextInput
              value={form.client_name}
              onChange={(v) => setField('client_name', v)}
              placeholder="Name"
            />
          </Field>
          <Field label="Contact Person *">
            <TextInput
              value={form.full_name}
              onChange={(v) => setField('full_name', v)}
              placeholder="Rosa Schmeler"
            />
          </Field>
          <Field label="Email Address *">
            <TextInput
              type="email"
              value={form.email}
              onChange={(v) => setField('email', v)}
              placeholder="abcd@amplior.com"
            />
          </Field>
          <Field label="Phone Number *">
            <TextInput
              value={form.mobile_number}
              onChange={(v) => setField('mobile_number', v)}
              placeholder="000-000-0000"
            />
          </Field>
          <Field label="CIN Number *">
            <TextInput
              value={form.cin_number}
              onChange={(v) => setField('cin_number', v)}
              placeholder="XY0000000000"
            />
          </Field>
          <Field label="Location">
            <TextInput
              value={form.location}
              onChange={(v) => setField('location', v)}
              placeholder="Bartlett"
            />
          </Field>
          <Field label="Industry *">
            <SelectInput
              value={String(form.industry_id)}
              onChange={(v) => setField('industry_id', Number(v))}
            >
              <option value="0">Select industry</option>
              {lookups.industries.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Domain *">
            <SelectInput
              value={String(form.domain_id)}
              onChange={(v) => setField('domain_id', Number(v))}
            >
              <option value="0">Select domain</option>
              {lookups.domains.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Website">
            <TextInput
              value={form.website}
              onChange={(v) => setField('website', v)}
              placeholder="URL"
            />
          </Field>
          <Field label="Status *">
            <SelectInput
              value={form.enabled ? '1' : '0'}
              onChange={(v) => setField('enabled', v === '1')}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </SelectInput>
          </Field>
        </div>

        {saveError && (
          <p style={{ fontSize: 12, color: '#EF4444', margin: '12px 0 0' }}>{saveError}</p>
        )}
      </Modal>
    </div>
  );
}
