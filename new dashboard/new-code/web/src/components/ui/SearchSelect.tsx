/**
 * SearchSelect — a lightweight, dependency-free searchable combobox.
 *
 * Props:
 *   options       — list of { id, label, sublabel? } items
 *   value         — currently selected id (number | null)
 *   onChange      — called with id (number) or null (clear)
 *   placeholder   — input placeholder text
 *   disabled      — disable the whole control
 *   renderOption  — optional custom option renderer
 */

import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchSelectOption {
  id: number;
  label: string;
  sublabel?: string; // shown in grey below label
}

interface Props {
  options: SearchSelectOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value != null ? options.find((o) => o.id === value) ?? null : null;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.sublabel ?? '').toLowerCase().includes(q)
        );
      })
    : options;

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(id: number) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
    setQuery('');
  }

  const triggerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    padding: '6px 10px',
    border: `1px solid ${open ? '#1A7EE8' : '#d4d4d8'}`,
    borderRadius: 'var(--radius-input)',
    background: disabled ? '#f9fafb' : '#fff',
    color: selected ? '#18181b' : '#9ca3af',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
    minHeight: 34,
    userSelect: 'none',
    position: 'relative',
    transition: 'border-color 0.15s',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'var(--color-surface)',
    border: '1px solid #d4d4d8',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-md)',
    marginTop: 2,
    maxHeight: 260,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <div
        style={triggerStyle}
        onClick={handleOpen}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        aria-label={selected ? selected.label : placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(); }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? (
            <span>
              {selected.label}
              {selected.sublabel && (
                <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 11 }}>{selected.sublabel}</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        {selected && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            title="Clear selection"
            aria-label="Clear selection"
            style={{
              display: 'flex', alignItems: 'center', padding: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        ) : (
          <Search size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={dropdownStyle}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Search size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search…"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  fontSize: 13, background: 'transparent', color: '#18181b',
                }}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div role="listbox" style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                No results found
              </div>
            ) : (
              filtered.slice(0, 200).map((o) => (
                <div
                  key={o.id}
                  onClick={() => handleSelect(o.id)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: o.id === value ? '#1A7EE8' : '#18181b',
                    background: o.id === value ? '#E8F2FD' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (o.id !== value) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = o.id === value ? '#E8F2FD' : 'transparent';
                  }}
                >
                  <div style={{ fontWeight: o.id === value ? 600 : 400 }}>{o.label}</div>
                  {o.sublabel && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{o.sublabel}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Clear option */}
          {value != null && (
            <div
              onClick={handleClear}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                color: '#ef4444',
                borderTop: '1px solid #f3f4f6',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <X size={12} /> Clear selection
            </div>
          )}
        </div>
      )}
    </div>
  );
}
