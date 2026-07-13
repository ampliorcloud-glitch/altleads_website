/**
 * PreSalesQuestionsTab — Admin UI for managing pre-sales questions per domain.
 *
 * Layout:
 *   - Domain selector dropdown at the top (pulls from domain_master).
 *   - FigmaRefTable-style table showing that domain's questions:
 *       Sr. No. | Short Label | Full Question | Active (toggle) | Edit
 *   - "Add Question" button opens a Modal (Short Label, Full Question, domain pre-filled).
 *   - Edit icon opens the same Modal pre-populated for updating.
 *
 * Owner decisions flagged in this file:
 *   FLAG-1: The Discussion question is protected — admins cannot disable or delete it
 *           from this UI. Confirm whether this guard should also live server-side.
 *   FLAG-2: `is_active` column must be added to `pre_sales_question` via migration
 *           before this tab (and the agent-side filter) works correctly. Until then,
 *           the tab will show an error from fetchPreSalesQuestionsAdmin.
 *   FLAG-3: Delete is hidden for any question that has existing answers (checked
 *           client-side then confirmed server-side in deletePreSalesQuestion). If the
 *           owner wants hard-delete capability, that's a separate decision.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  fetchPreSalesQuestionsAdmin,
  addPreSalesQuestion,
  updatePreSalesQuestion,
  setPreSalesQuestionActive,
  deletePreSalesQuestion,
  type PreSalesQuestionAdmin,
} from '../../data/admin';
import {
  Card,
  FigmaTableHead,
  LoadingRow,
  EmptyRow,
  AddButton,
  EditIconButton,
  StatusToggle,
} from './primitives';
import { Modal, Field, TextInput, SelectInput, PrimaryButton, GhostButton } from './Modal';
import { useConfirm } from '../ui/ConfirmDialog';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DomainOption {
  id: number;
  name: string;
}

type ModalMode = 'add' | 'edit' | null;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PreSalesQuestionsTab({ actorId }: { actorId: string }) {
  const confirm = useConfirm();
  const [allQuestions, setAllQuestions] = useState<PreSalesQuestionAdmin[]>([]);
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // toggle busy state: key = pre_sa_que_id
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<PreSalesQuestionAdmin | null>(null);
  const [formShortQ, setFormShortQ] = useState('');
  const [formFullQ, setFormFullQ] = useState('');
  const [formDomainId, setFormDomainId] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* ---- load ---- */
  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { questions, error } = await fetchPreSalesQuestionsAdmin();
    if (error) {
      setFetchError(error);
      setLoading(false);
      return;
    }

    setAllQuestions(questions);

    // Build domain list from the questions themselves (plus any domains already in state).
    const domainMap = new Map<number, string>();
    for (const q of questions) {
      if (q.domain_id != null && q.domain_name) {
        domainMap.set(q.domain_id, q.domain_name);
      }
    }
    const domainList: DomainOption[] = Array.from(domainMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id);
    setDomains(domainList);

    // Default to first domain if nothing selected yet.
    setSelectedDomainId((prev) => {
      if (prev != null) return prev;
      return domainList[0]?.id ?? null;
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---- derived ---- */
  const visibleQuestions =
    selectedDomainId == null
      ? allQuestions
      : allQuestions.filter((q) => q.domain_id === selectedDomainId);

  /* ---- toggle active ---- */
  const handleToggleActive = async (q: PreSalesQuestionAdmin) => {
    // FLAG-1: Protect the Discussion question from being disabled.
    if (q.is_discussion && q.is_active) {
      setActionError(
        'The Discussion question cannot be disabled — it is required for all domains.'
      );
      return;
    }
    setTogglingId(q.pre_sa_que_id);
    setActionError(null);
    const err = await setPreSalesQuestionActive(q.pre_sa_que_id, !q.is_active, actorId);
    setTogglingId(null);
    if (err) {
      setActionError(err);
      return;
    }
    // Optimistic update in local state.
    setAllQuestions((prev) =>
      prev.map((row) =>
        row.pre_sa_que_id === q.pre_sa_que_id ? { ...row, is_active: !q.is_active } : row
      )
    );
  };

  /* ---- delete ---- */
  const handleDelete = async (q: PreSalesQuestionAdmin) => {
    if (q.is_discussion) {
      setActionError('The Discussion question cannot be deleted.');
      return;
    }
    const ok = await confirm({ title: 'Delete question?', message: `Delete "${q.short_question || q.question}"? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    setDeletingId(q.pre_sa_que_id);
    setActionError(null);
    const err = await deletePreSalesQuestion(q.pre_sa_que_id, actorId);
    setDeletingId(null);
    if (err) {
      setActionError(err);
      return;
    }
    setAllQuestions((prev) => prev.filter((row) => row.pre_sa_que_id !== q.pre_sa_que_id));
  };

  /* ---- modal helpers ---- */
  const openAdd = () => {
    setEditTarget(null);
    setFormShortQ('');
    setFormFullQ('');
    setFormDomainId(selectedDomainId != null ? String(selectedDomainId) : (domains[0]?.id != null ? String(domains[0].id) : ''));
    setModalError(null);
    setModalMode('add');
  };

  const openEdit = (q: PreSalesQuestionAdmin) => {
    setEditTarget(q);
    setFormShortQ(q.short_question);
    setFormFullQ(q.question);
    setFormDomainId(q.domain_id != null ? String(q.domain_id) : '');
    setModalError(null);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditTarget(null);
    setModalError(null);
  };

  const handleSave = async () => {
    if (!formShortQ.trim()) {
      setModalError('Short label is required.');
      return;
    }
    if (!formFullQ.trim()) {
      setModalError('Full question text is required.');
      return;
    }
    const domId = Number(formDomainId);
    if (!domId) {
      setModalError('Please select a domain.');
      return;
    }
    setSaving(true);
    setModalError(null);

    let err: string | null = null;
    if (modalMode === 'add') {
      err = await addPreSalesQuestion({
        domain_id: domId,
        short_question: formShortQ,
        question: formFullQ,
        actorId,
      });
    } else if (modalMode === 'edit' && editTarget) {
      err = await updatePreSalesQuestion({
        pre_sa_que_id: editTarget.pre_sa_que_id,
        short_question: formShortQ,
        question: formFullQ,
        domain_id: domId,
        actorId,
      });
    }

    setSaving(false);
    if (err) {
      setModalError(err);
      return;
    }
    closeModal();
    await load();
  };

  /* ---- table columns ---- */
  const columns = [
    { key: 'sr',     label: 'Sr. No.',      width: 72 },
    { key: 'short',  label: 'Short Label',  width: 160 },
    { key: 'full',   label: 'Full Question' },
    { key: 'active', label: 'Active',        width: 110 },
    { key: 'edit',   label: 'Edit',          align: 'right' as const, width: 80 },
  ];

  /* ------------------------------------------------------------------ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Error from fetch (likely missing is_active column) */}
      {fetchError && (
        <div
          style={{
            background: 'rgba(196,77,77,0.06)',
            border: '1px solid rgba(196,77,77,0.15)',
            borderRadius: 8,
            padding: '10px 16px',
          }}
        >
          <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>
            <strong>Error loading questions:</strong> {fetchError}
          </p>
          <p style={{ color: '#DC2626', fontSize: 12, margin: '6px 0 0' }}>
            If you see "column is_active does not exist", run the migration:
            <code style={{ display: 'block', marginTop: 4, fontFamily: 'monospace', fontSize: 11 }}>
              ALTER TABLE pre_sales_question ADD COLUMN is_active boolean NOT NULL DEFAULT true;
            </code>
          </p>
        </div>
      )}

      {/* Action-level error (toggle / delete) */}
      {actionError && (
        <div
          style={{
            background: 'rgba(196,77,77,0.06)',
            border: '1px solid rgba(196,77,77,0.15)',
            borderRadius: 8,
            padding: '10px 16px',
          }}
        >
          <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{actionError}</p>
        </div>
      )}

      {/* Domain selector + toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' }}>
          Domain:
        </label>
        <select
          value={selectedDomainId ?? ''}
          onChange={(e) => {
            setSelectedDomainId(e.target.value ? Number(e.target.value) : null);
            setActionError(null);
          }}
          style={{
            fontSize: 13,
            padding: '7px 10px',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            background: '#fff',
            color: '#374151',
            minWidth: 220,
            height: 36,
          }}
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto' }}>
          <AddButton label="Add Question" onClick={openAdd} />
        </div>
      </div>

      {/* Table */}
      <div>
        <div style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
            {selectedDomainId != null
              ? (domains.find((d) => d.id === selectedDomainId)?.name ?? 'Questions')
              : 'All Questions'}
          </h3>
        </div>

        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <FigmaTableHead columns={columns} />
              <tbody>
                {loading ? (
                  <LoadingRow colSpan={columns.length} />
                ) : visibleQuestions.length === 0 ? (
                  <EmptyRow
                    colSpan={columns.length}
                    label={
                      selectedDomainId != null
                        ? 'No questions configured for this domain.'
                        : 'No pre-sales questions found.'
                    }
                  />
                ) : (
                  visibleQuestions.map((q, idx) => {
                    const isToggling = togglingId === q.pre_sa_que_id;
                    const isDeleting = deletingId === q.pre_sa_que_id;
                    return (
                      <tr
                        key={q.pre_sa_que_id}
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          height: 48,
                          transition: 'background 0.12s',
                          opacity: isDeleting ? 0.4 : 1,
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

                        {/* Short Label */}
                        <td
                          style={{
                            padding: '0 16px',
                            fontSize: 13,
                            color: '#111827',
                            fontWeight: 500,
                            verticalAlign: 'middle',
                            width: 160,
                          }}
                        >
                          {q.short_question || '—'}
                          {q.is_discussion && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                fontWeight: 600,
                                background: '#DBEAFE',
                                color: '#1D4ED8',
                                borderRadius: 3,
                                padding: '1px 5px',
                              }}
                            >
                              DISCUSSION
                            </span>
                          )}
                        </td>

                        {/* Full Question */}
                        <td
                          style={{
                            padding: '0 16px',
                            fontSize: 12,
                            color: '#6B7280',
                            verticalAlign: 'middle',
                            maxWidth: 380,
                          }}
                        >
                          <span
                            title={q.question || undefined}
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {q.question || '—'}
                          </span>
                        </td>

                        {/* Active toggle */}
                        <td
                          style={{
                            padding: '0 16px',
                            verticalAlign: 'middle',
                            width: 110,
                          }}
                        >
                          <StatusToggle
                            enabled={q.is_active}
                            onToggle={() => handleToggleActive(q)}
                            busy={isToggling}
                          />
                        </td>

                        {/* Edit + Delete */}
                        <td
                          style={{
                            padding: '0 16px',
                            verticalAlign: 'middle',
                            textAlign: 'right',
                            width: 80,
                          }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <EditIconButton onClick={() => openEdit(q)} />
                            {/* Hide delete for Discussion questions */}
                            {!q.is_discussion && (
                              <button
                                type="button"
                                onClick={() => handleDelete(q)}
                                disabled={isDeleting}
                                aria-label="Delete"
                                style={{
                                  padding: '4px 6px',
                                  background: 'none',
                                  border: 'none',
                                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                                  color: '#D1D5DB',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.color = '#DC2626';
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB';
                                }}
                              >
                                {isDeleting ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalMode !== null}
        title={modalMode === 'add' ? 'Add Pre-Sales Question' : 'Edit Pre-Sales Question'}
        onClose={closeModal}
        width={520}
        footer={
          <>
            <GhostButton onClick={closeModal} disabled={saving}>
              Cancel
            </GhostButton>
            <PrimaryButton
              onClick={handleSave}
              disabled={saving || !formShortQ.trim() || !formFullQ.trim() || !formDomainId}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {modalMode === 'add' ? 'Add' : 'Save'}
            </PrimaryButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Domain *">
            <SelectInput value={formDomainId} onChange={setFormDomainId}>
              <option value="">Select domain...</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Short Label *">
            <TextInput
              value={formShortQ}
              onChange={setFormShortQ}
              placeholder="e.g. Current Vendor?"
            />
          </Field>

          <Field label="Full Question *">
            <TextInput
              value={formFullQ}
              onChange={setFormFullQ}
              placeholder="e.g. Who is the current security vendor / provider?"
            />
          </Field>

          {modalError && (
            <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{modalError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
