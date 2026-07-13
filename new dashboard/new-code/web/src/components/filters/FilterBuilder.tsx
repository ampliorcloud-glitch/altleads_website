/**
 * FilterBuilder — advanced per-field filter UI for list pages.
 *
 * ALT-270 · v1 (2026-06-28)
 *
 * Only rendered when ADVANCED_FILTERS is true. When the flag is false, list
 * pages continue to render their existing basic filter panels unchanged.
 *
 * UX:
 *   • A "Filters" button opens/closes this panel (inline below the toolbar).
 *   • Inside: a list of conditions (field → operator → value), rendered as rows.
 *   • "Add condition" appends a new row with the first available field pre-selected.
 *   • Each condition row has a remove (×) button.
 *   • The group combinator (AND / OR) toggles above the conditions (v1: single group).
 *   • Condition chips are also surfaced via the existing <ActiveFilters> bar —
 *     callers compute FilterChip[] from the state and pass it in.
 *
 * Consistent with the app's existing UI variables (--color-brand, --border-input,
 * --radius-input, --color-surface, --color-gray-*) and component patterns.
 *
 * HungerBox-specific fields (is_dnc, is_feasible) are hidden when
 * HUNGERBOX_FEATURES is false.
 */

import React, { useCallback } from 'react';
import { Plus, X, SlidersHorizontal } from 'lucide-react';
import { HUNGERBOX_FEATURES } from '../../lib/hungerbox';
import {
  type AdvancedFilterState,
  type FilterCondition,
  type FilterGroup,
  type FilterOperator,
  type FieldDef,
  opsForType,
  OP_LABELS,
  opNeedsNoValue,
  opIsBetween,
  opIsMulti,
} from '../../lib/filterEngine';

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------

interface FilterBuilderProps {
  /** Whether the panel is expanded. */
  open: boolean;
  /** Toggle open/close (called by the "Filters" button in the toolbar slot). */
  onToggle: () => void;
  /** Available fields for this entity (from ENTITY_FIELDS[entity]). */
  fields: FieldDef[];
  /** Current filter state (controlled). */
  value: AdvancedFilterState;
  /** Called on every change. */
  onChange: (next: AdvancedFilterState) => void;
}

// -----------------------------------------------------------------------
// Tiny id generator (stable within a session; not crypto-random)
// -----------------------------------------------------------------------

let _seq = 0;
function newId(): string {
  return `fid-${++_seq}`;
}

// -----------------------------------------------------------------------
// Visible fields helper
// -----------------------------------------------------------------------

function visibleFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => !f.hungerboxOnly || HUNGERBOX_FEATURES);
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

/** Single-value text / date / number input. */
function ValueInput({
  value,
  onChange,
  type = 'text',
  placeholder = 'Value',
}: {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date' | 'number';
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-brand-focus"
      style={{
        fontSize: 13,
        padding: '4px 8px',
        border: '1px solid var(--border-input)',
        borderRadius: 'var(--radius-input)',
        background: 'var(--color-surface)',
        color: 'var(--color-gray-900)',
        height: 30,
        minWidth: 120,
        outline: 'none',
      }}
    />
  );
}

/** Two-value range input (between / not_between). */
function RangeInput({
  value,
  onChange,
  type = 'text',
}: {
  value: [string, string];
  onChange: (v: [string, string]) => void;
  type?: 'text' | 'date' | 'number';
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <ValueInput value={value[0]} onChange={(v) => onChange([v, value[1]])} type={type} placeholder="From" />
      <span style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>–</span>
      <ValueInput value={value[1]} onChange={(v) => onChange([value[0], v])} type={type} placeholder="To" />
    </div>
  );
}

/** Multi-value input: comma-separated tags. */
function MultiValueInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options?: string[];
  placeholder?: string;
}) {
  // If options are provided, render a checkbox list; otherwise a comma-separated input.
  if (options && options.length > 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '4px 0',
          maxWidth: 340,
        }}
      >
        {options.map((opt) => {
          const checked = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange(checked ? value.filter((v) => v !== opt) : [...value, opt])
              }
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 12,
                border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--border-input)'}`,
                background: checked ? 'var(--color-brand-light, #E8F2FD)' : 'var(--color-surface)',
                color: checked ? 'var(--color-brand)' : 'var(--color-gray-700)',
                cursor: 'pointer',
                fontWeight: checked ? 600 : 400,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // Free-text: comma-separated input — "Enter comma-separated values"
  const raw = value.join(', ');
  return (
    <input
      type="text"
      value={raw}
      onChange={(e) => {
        const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
        onChange(parts);
      }}
      placeholder={placeholder ?? 'Value 1, Value 2, …'}
      className="input-brand-focus"
      style={{
        fontSize: 13,
        padding: '4px 8px',
        border: '1px solid var(--border-input)',
        borderRadius: 'var(--radius-input)',
        background: 'var(--color-surface)',
        color: 'var(--color-gray-900)',
        height: 30,
        minWidth: 200,
        outline: 'none',
      }}
    />
  );
}

/** Boolean toggle: true / false buttons. */
function BooleanInput({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {([true, false] as const).map((b) => (
        <button
          key={String(b)}
          type="button"
          onClick={() => onChange(b)}
          style={{
            fontSize: 12,
            padding: '3px 12px',
            borderRadius: 6,
            border: `1.5px solid ${value === b ? 'var(--color-brand)' : 'var(--border-input)'}`,
            background: value === b ? 'var(--color-brand-light, #E8F2FD)' : 'var(--color-surface)',
            color: value === b ? 'var(--color-brand)' : 'var(--color-gray-700)',
            cursor: 'pointer',
            fontWeight: value === b ? 600 : 400,
          }}
        >
          {b ? 'True' : 'False'}
        </button>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Condition row
// -----------------------------------------------------------------------

interface ConditionRowProps {
  cond: FilterCondition;
  fields: FieldDef[];
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}

function ConditionRow({ cond, fields, onChange, onRemove }: ConditionRowProps) {
  const fieldDef = fields.find((f) => f.field === cond.field) ?? fields[0];
  const availableOps = fieldDef ? opsForType(fieldDef.fieldType) : [];

  const selectStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '4px 8px',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-input)',
    background: 'var(--color-surface)',
    color: 'var(--color-gray-900)',
    height: 30,
    cursor: 'pointer',
    outline: 'none',
  };

  const handleFieldChange = (field: string) => {
    const def = fields.find((f) => f.field === field);
    if (!def) return;
    const ops = opsForType(def.fieldType);
    const op: FilterOperator = ops.includes(cond.op) ? cond.op : ops[0];
    onChange({ ...cond, field, fieldType: def.fieldType, op, value: null });
  };

  const handleOpChange = (op: FilterOperator) => {
    // Reset value when switching to/from multi/range/no-value ops
    const needsReset =
      opNeedsNoValue(op) ||
      opIsMulti(op) !== opIsMulti(cond.op) ||
      opIsBetween(op) !== opIsBetween(cond.op);
    onChange({ ...cond, op, value: needsReset ? null : cond.value });
  };

  // Value editor selection
  const renderValue = () => {
    if (opNeedsNoValue(cond.op)) return null;

    if (cond.fieldType === 'boolean') {
      return (
        <BooleanInput
          value={typeof cond.value === 'boolean' ? cond.value : null}
          onChange={(v) => onChange({ ...cond, value: v })}
        />
      );
    }

    if (opIsMulti(cond.op)) {
      const current = Array.isArray(cond.value) ? (cond.value as string[]) : [];
      return (
        <MultiValueInput
          value={current}
          onChange={(v) => onChange({ ...cond, value: v })}
          options={fieldDef?.options}
        />
      );
    }

    if (opIsBetween(cond.op)) {
      const current: [string, string] = Array.isArray(cond.value)
        ? (cond.value as [string, string])
        : ['', ''];
      return (
        <RangeInput
          value={current}
          onChange={(v) => onChange({ ...cond, value: v })}
          type={
            cond.fieldType === 'date'
              ? 'date'
              : cond.fieldType === 'number'
              ? 'number'
              : 'text'
          }
        />
      );
    }

    if (cond.op === 'relative_past' || cond.op === 'relative_next') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ValueInput
            type="number"
            value={cond.value != null ? String(cond.value) : ''}
            onChange={(v) => onChange({ ...cond, value: v === '' ? null : Number(v) })}
            placeholder="Days"
          />
          <span style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>days</span>
        </div>
      );
    }

    if (fieldDef?.options && fieldDef.options.length > 0) {
      return (
        <select
          value={typeof cond.value === 'string' ? cond.value : ''}
          onChange={(e) => onChange({ ...cond, value: e.target.value || null })}
          style={selectStyle}
        >
          <option value="">Select…</option>
          {fieldDef.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <ValueInput
        type={
          cond.fieldType === 'date'
            ? 'date'
            : cond.fieldType === 'number'
            ? 'number'
            : 'text'
        }
        value={typeof cond.value === 'string' ? cond.value : cond.value != null ? String(cond.value) : ''}
        onChange={(v) => onChange({ ...cond, value: v || null })}
      />
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '6px 0',
        flexWrap: 'wrap',
      }}
    >
      {/* Field picker */}
      <select
        value={cond.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        aria-label="Filter field"
        style={{ ...selectStyle, minWidth: 140 }}
      >
        {fields.map((f) => (
          <option key={f.field} value={f.field}>{f.label}</option>
        ))}
      </select>

      {/* Operator picker */}
      <select
        value={cond.op}
        onChange={(e) => handleOpChange(e.target.value as FilterOperator)}
        aria-label="Filter operator"
        style={{ ...selectStyle, minWidth: 150 }}
      >
        {availableOps.map((op) => (
          <option key={op} value={op}>{OP_LABELS[op]}</option>
        ))}
      </select>

      {/* Value input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {renderValue()}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        title="Remove"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 6,
          border: '1px solid var(--border-input)',
          background: 'var(--color-surface)',
          color: 'var(--color-gray-500)',
          cursor: 'pointer',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------
// useFilterBuilderLogic — shared stateless logic extracted for reuse by
// the split Button/Panel exports.
// -----------------------------------------------------------------------

function useFilterBuilderLogic(
  rawFields: FieldDef[],
  value: AdvancedFilterState,
  onChange: (next: AdvancedFilterState) => void,
) {
  const fields = visibleFields(rawFields);
  const group: FilterGroup | undefined = value.groups[0];
  const conditions = group?.conditions ?? [];
  const combinator = group?.combinator ?? 'AND';

  const setGroup = useCallback(
    (g: FilterGroup) => { onChange({ groups: [g] }); },
    [onChange],
  );

  const addCondition = useCallback(() => {
    const firstField = fields[0];
    if (!firstField) return;
    const ops = opsForType(firstField.fieldType);
    const newCond: FilterCondition = {
      id: newId(),
      field:     firstField.field,
      fieldType: firstField.fieldType,
      op:        ops[0],
      value:     null,
    };
    const g = group ?? { id: 'g1', combinator: 'AND', conditions: [] };
    setGroup({ ...g, conditions: [...g.conditions, newCond] });
  }, [fields, group, setGroup]);

  const updateCondition = useCallback((idx: number, next: FilterCondition) => {
    const updated = conditions.map((c, i) => (i === idx ? next : c));
    setGroup({ id: group?.id ?? 'g1', combinator, conditions: updated });
  }, [conditions, combinator, group, setGroup]);

  const removeCondition = useCallback((idx: number) => {
    const updated = conditions.filter((_, i) => i !== idx);
    if (updated.length === 0) {
      onChange({ groups: [] });
    } else {
      setGroup({ id: group?.id ?? 'g1', combinator, conditions: updated });
    }
  }, [conditions, combinator, group, onChange, setGroup]);

  const setCombinator = useCallback((c: 'AND' | 'OR') => {
    setGroup({ id: group?.id ?? 'g1', combinator: c, conditions });
  }, [conditions, group, setGroup]);

  const clearAll = useCallback(() => onChange({ groups: [] }), [onChange]);

  return { fields, conditions, combinator, addCondition, updateCondition, removeCondition, setCombinator, clearAll };
}

// -----------------------------------------------------------------------
// FilterBuilderButton — the toolbar trigger button only
// -----------------------------------------------------------------------

interface FilterBuilderButtonProps {
  open: boolean;
  onToggle: () => void;
  conditionCount: number;
}

export function FilterBuilderButton({ open, onToggle, conditionCount }: FilterBuilderButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      title="Advanced filters"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 13,
        fontWeight: 500,
        height: 30,
        padding: '0 10px',
        borderRadius: 'var(--radius-input)',
        border: `1.5px solid ${conditionCount > 0 ? 'var(--color-brand)' : 'var(--border-input)'}`,
        background: conditionCount > 0 ? 'var(--color-brand-light, #E8F2FD)' : 'var(--color-surface)',
        color: conditionCount > 0 ? 'var(--color-brand)' : 'var(--color-gray-700)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <SlidersHorizontal size={13} />
      Filters
      {conditionCount > 0 && (
        <span
          style={{
            background: 'var(--color-brand)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 999,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {conditionCount}
        </span>
      )}
    </button>
  );
}

// -----------------------------------------------------------------------
// FilterBuilderPanel — the panel body only (renders when open)
// -----------------------------------------------------------------------

interface FilterBuilderPanelProps {
  fields: FieldDef[];
  value: AdvancedFilterState;
  onChange: (next: AdvancedFilterState) => void;
}

export function FilterBuilderPanel({ fields: rawFields, value, onChange }: FilterBuilderPanelProps) {
  const { fields, conditions, combinator, addCondition, updateCondition, removeCondition, setCombinator, clearAll } =
    useFilterBuilderLogic(rawFields, value, onChange);

  return (
    <div
      role="region"
      aria-label="Filter builder"
      style={{
        padding: '12px 16px',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        background: 'var(--color-surface)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginTop: 4,
        marginBottom: 4,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-gray-600)' }}>
          {conditions.length === 0
            ? 'No active filters'
            : `${conditions.length} condition${conditions.length > 1 ? 's' : ''}`}
        </span>

        {/* AND / OR combinator (only meaningful with 2+ conditions) */}
        {conditions.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>Match</span>
            {(['AND', 'OR'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCombinator(c)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '2px 10px',
                  borderRadius: 6,
                  border: `1.5px solid ${combinator === c ? 'var(--color-brand)' : 'var(--border-input)'}`,
                  background: combinator === c ? 'var(--color-brand-light, #E8F2FD)' : 'var(--color-surface)',
                  color: combinator === c ? 'var(--color-brand)' : 'var(--color-gray-600)',
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>conditions</span>
          </div>
        )}
      </div>

      {/* Condition rows */}
      {conditions.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--color-gray-400)', padding: '4px 0 8px' }}>
          Add a condition below to filter by any field.
        </div>
      )}

      <div>
        {conditions.map((cond, idx) => (
          <ConditionRow
            key={cond.id}
            cond={cond}
            fields={fields}
            onChange={(next) => updateCondition(idx, next)}
            onRemove={() => removeCondition(idx)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={addCondition}
          disabled={fields.length === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 500,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-input)',
            background: 'var(--color-surface)',
            color: 'var(--color-gray-700)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          Add condition
        </button>

        {conditions.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              fontSize: 12,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              color: 'var(--color-gray-500)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 0',
            }}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// FilterBuilder — combined button + panel (kept for backwards compat /
// simpler integration when caller can render everything in one place)
// -----------------------------------------------------------------------

export function FilterBuilder(props: FilterBuilderProps) {
  const conditions = props.value.groups[0]?.conditions ?? [];
  return (
    <>
      <FilterBuilderButton
        open={props.open}
        onToggle={props.onToggle}
        conditionCount={conditions.length}
      />
      {props.open && (
        <FilterBuilderPanel
          fields={props.fields}
          value={props.value}
          onChange={props.onChange}
        />
      )}
    </>
  );
}

export default FilterBuilder;
