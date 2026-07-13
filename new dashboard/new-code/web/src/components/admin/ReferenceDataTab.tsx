import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchReferenceData,
  addSource,
  addDesignation,
  addDomain,
  updateSource,
  updateDesignation,
  updateDomain,
  type RefRow,
} from '../../data/admin';
import {
  Card,
  FigmaTableHead,
  LoadingRow,
  EmptyRow,
  AddButton,
  EditIconButton,
} from './primitives';
import { Modal, Field, TextInput, PrimaryButton, GhostButton } from './Modal';

type RefKind = 'source' | 'designation' | 'domain';

/** Figma-style reference table: Sr. No. | Name | Edit */
function FigmaRefTable({
  title,
  rows,
  loading,
  emptyLabel,
  onAdd,
  onEdit,
}: {
  title: string;
  rows: RefRow[];
  loading: boolean;
  emptyLabel: string;
  onAdd?: () => void;
  onEdit?: (row: RefRow) => void;
}) {
  const columns = [
    { key: 'sr',   label: 'Sr. No.', width: 72 },
    { key: 'name', label: `${title} Name` },
    ...(onEdit ? [{ key: 'edit', label: 'Edit', align: 'right' as const, width: 60 }] : []),
  ];

  return (
    <div>
      {/* Table toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
          {title}
        </h3>
        {onAdd && <AddButton label={`Add ${title}`} onClick={onAdd} />}
      </div>

      <Card>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <FigmaTableHead columns={columns} />
            <tbody>
              {loading ? (
                <LoadingRow colSpan={columns.length} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={columns.length} label={emptyLabel} />
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.id}
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
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        width: 72,
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Name */}
                    <td
                      style={{
                        padding: '0 16px',
                        fontSize: 13,
                        color: '#374151',
                        verticalAlign: 'middle',
                      }}
                    >
                      {r.name}
                    </td>

                    {/* Edit icon (only for editable tables) */}
                    {onEdit && (
                      <td
                        style={{
                          padding: '0 16px',
                          verticalAlign: 'middle',
                          textAlign: 'right',
                          width: 60,
                        }}
                      >
                        <EditIconButton onClick={() => onEdit(r)} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ReferenceDataTab({ actorId }: { actorId: string }) {
  const [sources, setSources] = useState<RefRow[]>([]);
  const [industries, setIndustries] = useState<RefRow[]>([]);
  const [designations, setDesignations] = useState<RefRow[]>([]);
  const [domains, setDomains] = useState<RefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single modal drives both Add (no editId) and Edit (editId set).
  const [modalKind, setModalKind] = useState<RefKind | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [addName, setAddName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const KIND_LABEL: Record<RefKind, string> = {
    source: 'Source',
    designation: 'Designation',
    domain: 'Domain',
  };

  const load = async () => {
    setLoading(true);
    const res = await fetchReferenceData();
    setSources(res.sources);
    setIndustries(res.industries);
    setDesignations(res.designations);
    setDomains(res.domains);
    setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = (kind: RefKind) => {
    setModalKind(kind);
    setEditId(null);
    setAddName('');
    setSaveError(null);
  };

  const openEdit = (kind: RefKind, row: RefRow) => {
    setModalKind(kind);
    setEditId(row.id);
    setAddName(row.name);
    setSaveError(null);
  };

  const closeModal = () => {
    setModalKind(null);
    setEditId(null);
  };

  const handleSave = async () => {
    if (!modalKind || !addName.trim()) return;
    setSaving(true);
    setSaveError(null);
    const name = addName.trim();
    let err: string | null;
    if (editId !== null) {
      err =
        modalKind === 'source'
          ? await updateSource(editId, name, actorId)
          : modalKind === 'designation'
            ? await updateDesignation(editId, name, actorId)
            : await updateDomain(editId, name, actorId);
    } else {
      err =
        modalKind === 'source'
          ? await addSource(name, actorId)
          : modalKind === 'designation'
            ? await addDesignation(name, actorId)
            : await addDomain(name, actorId);
    }
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    setSaving(false);
    closeModal();
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {error && (
        <div
          style={{
            background: 'rgba(196,77,77,0.06)',
            border: '1px solid rgba(196,77,77,0.15)',
            borderRadius: 8,
            padding: '10px 16px',
          }}
        >
          <p style={{ color: '#DC2626', fontSize: 12, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Two-column grid for the four tables */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 28,
        }}
      >
        <FigmaRefTable
          title="Designation"
          rows={designations}
          loading={loading}
          emptyLabel="No designations."
          onAdd={() => openAdd('designation')}
          onEdit={(row) => openEdit('designation', row)}
        />
        <FigmaRefTable
          title="Domain"
          rows={domains}
          loading={loading}
          emptyLabel="No domains."
          onAdd={() => openAdd('domain')}
          onEdit={(row) => openEdit('domain', row)}
        />
        <FigmaRefTable
          title="Source"
          rows={sources}
          loading={loading}
          emptyLabel="No sources."
          onAdd={() => openAdd('source')}
          onEdit={(row) => openEdit('source', row)}
        />
        <FigmaRefTable
          title="Industry"
          rows={industries}
          loading={loading}
          emptyLabel="No industries."
        />
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalKind !== null}
        title={
          modalKind
            ? `${editId !== null ? 'Edit' : 'Add'} ${KIND_LABEL[modalKind]}`
            : ''
        }
        onClose={closeModal}
        footer={
          <>
            <GhostButton onClick={closeModal} disabled={saving}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleSave} disabled={saving || !addName.trim()}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {editId !== null ? 'Save' : 'Add'}
            </PrimaryButton>
          </>
        }
      >
        <Field label="Name *">
          <TextInput
            value={addName}
            onChange={setAddName}
            placeholder={
              modalKind === 'source'
                ? 'e.g. Referral'
                : modalKind === 'domain'
                  ? 'e.g. Facility Management'
                  : 'e.g. Account Executive'
            }
          />
        </Field>
        {saveError && (
          <p style={{ fontSize: 12, color: '#EF4444', margin: '10px 0 0' }}>{saveError}</p>
        )}
      </Modal>
    </div>
  );
}
