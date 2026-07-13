/**
 * MultiSelectFilter — searchable, multi-value list filter (UX-AUDIT Top-30 #6).
 *
 * Replaces the single-value native <select> facets ("pick exactly one") with a
 * searchable popover of checkboxes, so a user can filter to e.g. three agents or
 * two cities at once. Semantics are OR-within-a-facet: an empty selection means
 * "All" (no filtering); one or more selected means "match any of these".
 *
 * Dependency-free (mirrors SearchSelect's approach): a trigger button + an
 * absolutely-positioned popover that closes on outside-click / Escape.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

interface Props {
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  options: string[];
  /** Min width of the control (default 130). */
  minWidth?: number;
}

const triggerStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '5px 8px',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--color-surface)',
  color: 'var(--color-gray-900)',
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  cursor: 'pointer',
  width: '100%',
};

export function MultiSelectFilter({ label, selected, onChange, options, minWidth = 130 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  const summary =
    selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <div className="flex flex-col gap-1" style={{ minWidth }} ref={ref}>
      <label className="font-medium text-stone-500" style={{ fontSize: 11 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label}: ${summary}`}
          title={selected.length ? selected.join(', ') : `Filter by ${label.toLowerCase()}`}
          style={{
            ...triggerStyle,
            borderColor: selected.length ? 'var(--color-brand)' : 'var(--border-input)',
          }}
        >
          <span
            style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: selected.length ? 'var(--color-gray-900)' : 'var(--color-gray-400)',
            }}
          >
            {summary}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {selected.length > 0 && (
              <span
                style={{
                  background: 'var(--color-brand)', color: '#fff', fontSize: 10, fontWeight: 700,
                  borderRadius: 999, minWidth: 16, height: 16, padding: '0 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}
              >
                {selected.length}
              </span>
            )}
            <ChevronDown size={13} className="text-stone-400" />
          </span>
        </button>

        {open && (
          <div
            role="listbox"
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              minWidth: '100%', width: 'max-content', maxWidth: 280,
              background: '#fff', border: '1px solid var(--border-color)', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
            }}
          >
            {/* Search */}
            <div style={{ padding: 8, borderBottom: '1px solid #F3F4F6', position: 'relative' }}>
              <Search size={13} className="absolute text-stone-400 pointer-events-none" style={{ left: 16, top: 16 }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="input-brand-focus"
                style={{
                  width: '100%', height: 30, padding: '0 8px 0 26px',
                  border: '1px solid var(--border-input)', borderRadius: 6, fontSize: 13,
                }}
              />
            </div>

            {/* Options */}
            <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#9CA3AF' }}>No matches</div>
              ) : (
                filtered.map((opt) => {
                  const checked = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(opt)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 8px', borderRadius: 6, border: 'none',
                        background: checked ? 'var(--color-brand-light)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left', fontSize: 13,
                        color: 'var(--color-gray-900)',
                      }}
                      onMouseEnter={(e) => { if (!checked) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = checked ? 'var(--color-brand-light)' : 'transparent'; }}
                    >
                      <span
                        style={{
                          width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                          border: `1.5px solid ${checked ? 'var(--color-brand)' : '#CBD5E1'}`,
                          background: checked ? 'var(--color-brand)' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {checked && <Check size={11} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderTop: '1px solid #F3F4F6' }}>
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                  fontSize: 12, color: selected.length ? 'var(--color-gray-500)' : '#D1D5DB',
                  cursor: selected.length ? 'pointer' : 'default', padding: 2,
                }}
              >
                <X size={12} /> Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', cursor: 'pointer', padding: 2 }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
