/**
 * DropdownsTab — Admin panel tab for managing dropdown_option lists.
 *
 * Features:
 *   - Category picker (contact_status, call_disposition, account_status,
 *     decision_power, feasibility) — generic: new categories auto-appear.
 *   - List options with label, active/inactive toggle, sort order.
 *   - Add option (label input; value auto-derived as slug).
 *   - Edit label inline via modal.
 *   - Enable / disable (soft — is_active flag, no hard delete).
 *   - Reorder via "Move up / Move down" buttons.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import {
  fetchAllGrouped,
  createOption,
  updateOption,
  setActive,
  reorderOption,
  CATEGORY_LABELS,
  KNOWN_CATEGORIES,
  type DropdownOption,
  type DropdownGrouped,
} from '../../data/dropdowns';
import {
  Card,
  FigmaTableHead,
  LoadingRow,
  EmptyRow,
  ErrorRow,
  AddButton,
  EditIconButton,
  StatusToggle,
} from './primitives';
import { Modal, Field, TextInput, PrimaryButton, GhostButton } from './Modal';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Friendly label for a category key, with fallback to formatted key. */
function categoryLabel(cat: string): string {
  return (
    CATEGORY_LABELS[cat] ??
    cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** All categories that appear in the loaded data or the known list, deduped, in preferred order. */
function buildCategoryList(grouped: DropdownGrouped): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  // Known categories first
  for (const k of KNOWN_CATEGORIES) {
    if (!seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  // Then any extra categories from the DB
  for (const k of Object.keys(grouped)) {
    if (!seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

const TABLE_COLUMNS = [
  { key: 'sr',     label: 'Sr. No.', width: 72 },
  { key: 'label',  label: 'Label' },
  { key: 'value',  label: 'Value', width: 180 },
  { key: 'order',  label: 'Order', width: 80 },
  { key: 'status', label: 'Status', width: 110 },
  { key: 'actions',label: 'Actions', align: 'right' as const, width: 120 },
];

export function DropdownsTab({ actorId }: { actorId: string }) {
  const [grouped, setGrouped] = useState<DropdownGrouped>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* --- busy map: option_id -> true while a toggle/reorder is in-flight --- */
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  /* --- Add modal state --- */
  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addOrder, setAddOrder] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  /* --- Edit modal state --- */
  const [editOption, setEditOption] = useState<DropdownOption | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editOrder, setEditOrder] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /* ---- load ---- */
  const load = async () => {
    setLoading(true);
    const { grouped: g, error: e } = await fetchAllGrouped();
    setGrouped(g);
    const cats = buildCategoryList(g);
    setCategories(cats);
    if (!selectedCat && cats.length > 0) setSelectedCat(cats[0]);
    setError(e);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- current rows for selected category ---- */
  const rows: DropdownOption[] = grouped[selectedCat] ?? [];

  /* ---- toggle active ---- */
  const handleToggle = async (opt: DropdownOption) => {
    setBusy((b) => ({ ...b, [opt.option_id]: true }));
    const err = await setActive(opt.option_id, !opt.is_active, actorId || null);
    if (err) setError(err);
    else await load();
    setBusy((b) => ({ ...b, [opt.option_id]: false }));
  };

  /* ---- reorder: move up / down ---- */
  const handleMove = async (opt: DropdownOption, direction: 'up' | 'down') => {
    const idx = rows.indexOf(opt);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rows.length) return;

    const swapOpt = rows[swapIdx];
    const myOrder = opt.sort_order ?? idx + 1;
    const swapOrder = swapOpt.sort_order ?? swapIdx + 1;

    setBusy((b) => ({ ...b, [opt.option_id]: true, [swapOpt.option_id]: true }));
    // Swap sort_order values
    await reorderOption(opt.option_id, swapOrder, actorId || null);
    await reorderOption(swapOpt.option_id, myOrder, actorId || null);
    await load();
    setBusy((b) => {
      const next = { ...b };
      delete next[opt.option_id];
      delete next[swapOpt.option_id];
      return next;
    });
  };

  /* ---- add option ---- */
  const openAdd = () => {
    setAddLabel('');
    setAddOrder('');
    setAddError(null);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!addLabel.trim() || !selectedCat) return;
    setAddSaving(true);
    setAddError(null);
    const err = await createOption({
      category: selectedCat,
      label: addLabel.trim(),
      sort_order: addOrder.trim() ? Number(addOrder.trim()) : undefined,
      actorId: actorId || null,
    });
    if (err) {
      setAddError(err);
      setAddSaving(false);
      return;
    }
    setAddSaving(false);
    setAddOpen(false);
    await load();
  };

  /* ---- edit option ---- */
  const openEdit = (opt: DropdownOption) => {
    setEditOption(opt);
    setEditLabel(opt.label);
    setEditOrder(opt.sort_order != null ? String(opt.sort_order) : '');
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editOption || !editLabel.trim()) return;
    setEditSaving(true);
    setEditError(null);
    const err = await updateOption(
      editOption.option_id,
      {
        label: editLabel.trim(),
        sort_order: editOrder.trim() !== '' ? Number(editOrder.trim()) : null,
      },
      actorId || null,
    );
    if (err) {
      setEditError(err);
      setEditSaving(false);
      return;
    }
    setEditSaving(false);
    setEditOption(null);
    await load();
  };

  /* ---- render ---- */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Global error banner */}
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

      {/* Category selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' }}>
          Category:
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(loading && categories.length === 0 ? KNOWN_CATEGORIES : categories).map((cat) => {
            const active = cat === selectedCat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#1A7EE8' : '#374151',
                  background: active ? '#E8F2FD' : '#F9FAFB',
                  border: active ? '1px solid #93C5FD' : '1px solid #E5E7EB',
                  borderRadius: 6,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {categoryLabel(cat)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table header + Add button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
          {selectedCat ? categoryLabel(selectedCat) : '—'} Options
        </h3>
        {selectedCat && (
          <AddButton label="Add Option" onClick={openAdd} />
        )}
      </div>

      {/* Options table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <FigmaTableHead columns={TABLE_COLUMNS} />
            <tbody>
              {loading ? (
                <LoadingRow colSpan={TABLE_COLUMNS.length} />
              ) : !selectedCat ? (
                <EmptyRow colSpan={TABLE_COLUMNS.length} label="Select a category above." />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={TABLE_COLUMNS.length} label="No options yet — add one above." />
              ) : (
                rows.map((opt, idx) => (
                  <tr
                    key={opt.option_id}
                    style={{
                      borderBottom: '1px solid #F3F4F6',
                      height: 44,
                      transition: 'background 0.12s',
                      opacity: opt.is_active ? 1 : 0.6,
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

                    {/* Label */}
                    <td
                      style={{
                        padding: '0 16px',
                        fontSize: 13,
                        color: '#111827',
                        fontWeight: 500,
                        verticalAlign: 'middle',
                      }}
                    >
                      {opt.label}
                    </td>

                    {/* Value (slug) */}
                    <td
                      style={{
                        padding: '0 16px',
                        fontSize: 12,
                        color: '#6B7280',
                        fontFamily: 'monospace',
                        verticalAlign: 'middle',
                        width: 180,
                      }}
                    >
                      {opt.value}
                    </td>

                    {/* Order */}
                    <td
                      style={{
                        padding: '0 16px',
                        fontSize: 13,
                        color: '#9CA3AF',
                        verticalAlign: 'middle',
                        width: 80,
                        textAlign: 'center',
                      }}
                    >
                      {opt.sort_order ?? '—'}
                    </td>

                    {/* Status toggle */}
                    <td
                      style={{
                        padding: '0 16px',
                        verticalAlign: 'middle',
                        width: 110,
                      }}
                    >
                      <StatusToggle
                        enabled={opt.is_active}
                        busy={!!busy[opt.option_id]}
                        onToggle={() => handleToggle(opt)}
                      />
                    </td>

                    {/* Actions: edit + move up/down */}
                    <td
                      style={{
                        padding: '0 12px',
                        verticalAlign: 'middle',
                        textAlign: 'right',
                        width: 120,
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <EditIconButton onClick={() => openEdit(opt)} />

                        {/* Move up */}
                        <button
                          type="button"
                          disabled={idx === 0 || !!busy[opt.option_id]}
                          onClick={() => handleMove(opt, 'up')}
                          title="Move up"
                          aria-label="Move up"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: idx === 0 ? 'default' : 'pointer',
                            color: idx === 0 ? '#D1D5DB' : '#6B7280',
                            padding: '3px 4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: 4,
                            transition: 'color 0.12s',
                          }}
                        >
                          <ChevronUp size={14} />
                        </button>

                        {/* Move down */}
                        <button
                          type="button"
                          disabled={idx === rows.length - 1 || !!busy[opt.option_id]}
                          onClick={() => handleMove(opt, 'down')}
                          title="Move down"
                          aria-label="Move down"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: idx === rows.length - 1 ? 'default' : 'pointer',
                            color: idx === rows.length - 1 ? '#D1D5DB' : '#6B7280',
                            padding: '3px 4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: 4,
                            transition: 'color 0.12s',
                          }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inactive hint */}
      {rows.some((r) => !r.is_active) && (
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
          Inactive options are dimmed and hidden from form dropdowns, but kept for historical data.
        </p>
      )}

      {/* ── Add Option modal ── */}
      <Modal
        open={addOpen}
        title={`Add Option — ${selectedCat ? categoryLabel(selectedCat) : ''}`}
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <GhostButton onClick={() => setAddOpen(false)} disabled={addSaving}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleAdd} disabled={addSaving || !addLabel.trim()}>
              {addSaving && <Loader2 size={13} className="animate-spin" />} Add Option
            </PrimaryButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Label *">
            <TextInput
              value={addLabel}
              onChange={setAddLabel}
              placeholder="e.g. In Progress"
            />
          </Field>
          <Field label="Sort Order (optional)">
            <TextInput
              value={addOrder}
              onChange={setAddOrder}
              placeholder="e.g. 10"
              type="number"
            />
          </Field>
          {addLabel.trim() && (
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
              Value will be auto-derived as:{' '}
              <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 3 }}>
                {addLabel
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_+|_+$/g, '')}
              </code>
            </p>
          )}
          {addError && (
            <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{addError}</p>
          )}
        </div>
      </Modal>

      {/* ── Edit Option modal ── */}
      <Modal
        open={editOption !== null}
        title="Edit Option"
        onClose={() => setEditOption(null)}
        footer={
          <>
            <GhostButton onClick={() => setEditOption(null)} disabled={editSaving}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleEdit} disabled={editSaving || !editLabel.trim()}>
              {editSaving && <Loader2 size={13} className="animate-spin" />} Save
            </PrimaryButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Label *">
            <TextInput
              value={editLabel}
              onChange={setEditLabel}
              placeholder="e.g. In Progress"
            />
          </Field>
          <Field label="Sort Order (optional)">
            <TextInput
              value={editOrder}
              onChange={setEditOrder}
              placeholder="e.g. 10"
              type="number"
            />
          </Field>
          {editError && (
            <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{editError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
