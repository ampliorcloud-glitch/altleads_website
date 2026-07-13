/**
 * GlobalSearchBar — always-visible top-bar search (ALT-213).
 *
 * An inline input that lives in the TopBar and shows grouped results in a
 * dropdown panel as you type. It REUSES the same in-memory search index as the
 * Cmd-K CommandPalette (`loadSearchIndex` / `searchIndex` from data/globalSearch),
 * so there is no second cache — the index is built lazily on first focus and the
 * existing clear-on-logout wiring (AuthContext → clearSearchIndex) still covers
 * it (ALT-220). Grouping + navigation mirror the palette (GROUP_ORDER, route nav).
 *
 * The Cmd-K palette is untouched and continues to work alongside this bar.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Target, Building2, User, CheckSquare, CalendarDays, CornerDownLeft, X } from 'lucide-react';
import {
  loadSearchIndex,
  searchIndex,
  type SearchItem,
  type SearchType,
} from '../../data/globalSearch';

// Mirrors CommandPalette's TYPE_META so both surfaces render groups identically.
const TYPE_META: Record<SearchType, { label: string; group: string; Icon: typeof Target; color: string }> = {
  lead: { label: 'Lead', group: 'Leads', Icon: Target, color: '#1A7EE8' },
  company: { label: 'Company', group: 'Companies', Icon: Building2, color: '#7C3AED' },
  contact: { label: 'Contact', group: 'Contacts', Icon: User, color: '#0E9F6E' },
  task: { label: 'Task', group: 'Tasks', Icon: CheckSquare, color: '#D97706' },
  meeting: { label: 'Meeting', group: 'Meetings', Icon: CalendarDays, color: '#0891B2' },
};

/** Fixed display order of result groups — mirrors CommandPalette.GROUP_ORDER. */
const GROUP_ORDER: SearchType[] = ['lead', 'company', 'contact', 'task', 'meeting'];

const DEBOUNCE_MS = 180;
const MIN_CHARS = 2;

export function GlobalSearchBar() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build (and cache) the shared index on first focus. Reuses the SAME module-scope
  // cache as the Cmd-K palette via loadSearchIndex — no second/uncleared cache.
  const ensureIndex = useCallback(() => {
    if (items !== null || loading) return;
    setLoading(true);
    loadSearchIndex()
      .then((idx) => setItems(idx))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [items, loading]);

  // Debounce the query (min length enforced) before it drives the result list.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(query.trim().length >= MIN_CHARS ? query : '');
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const results = useMemo(
    () => (items && debounced ? searchIndex(items, debounced) : []),
    [items, debounced],
  );

  // Group ranked results by type into fixed-order sections (mirrors the palette).
  // `flat` is the display-order list the keyboard navigates.
  const grouped = useMemo(() => {
    const m = new Map<SearchType, SearchItem[]>();
    for (const it of results) {
      const arr = m.get(it.type) ?? [];
      arr.push(it);
      m.set(it.type, arr);
    }
    return GROUP_ORDER.filter((t) => m.has(t)).map((t) => ({ type: t, items: m.get(t)! }));
  }, [results]);
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Reset highlight whenever the (debounced) result set changes.
  useEffect(() => { setSelected(0); }, [debounced]);

  // Click-outside closes the dropdown (keeps the typed query in the input).
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Scroll the active row into view as the highlight moves.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  const go = useCallback(
    (item: SearchItem | undefined) => {
      if (!item) return;
      setOpen(false);
      navigate(item.route);
    },
    [navigate],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setSelected((s) => Math.min(s + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
        setDebounced('');
      }
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showPanel = open && query.trim().length >= MIN_CHARS;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          width: '100%',
          minWidth: 180,
          maxWidth: 320,
          padding: '0 10px',
          borderRadius: 8,
          border: `1px solid ${open ? 'var(--color-brand)' : 'var(--border-color)'}`,
          background: 'var(--color-gray-50)',
          transition: 'border-color 0.12s',
        }}
      >
        <Search size={14} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--color-gray-400)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { ensureIndex(); setOpen(true); }}
          onKeyDown={onInputKeyDown}
          placeholder="Search…"
          aria-label="Search leads, companies, contacts, tasks and meetings"
          aria-expanded={showPanel}
          role="combobox"
          aria-autocomplete="list"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: 'var(--color-gray-900)',
            background: 'transparent',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false); }}
            aria-label="Clear search"
            style={{
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-gray-400)', padding: 0, display: 'inline-flex', lineHeight: 0,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showPanel && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 10000,
            width: 360,
            maxWidth: '85vw',
            marginTop: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '60vh',
          }}
        >
          <div ref={listRef} style={{ overflowY: 'auto' }}>
            {loading && items === null ? (
              <div className="flex items-center justify-center gap-2 text-stone-400" style={{ fontSize: 13, padding: '24px 16px' }}>
                <Loader2 size={15} className="animate-spin" /> Loading search…
              </div>
            ) : flat.length === 0 ? (
              <div className="text-stone-400" style={{ fontSize: 13, padding: '24px 18px', textAlign: 'center' }}>
                No matches for “{query.trim()}”.
              </div>
            ) : (
              (() => {
                // Running index across groups so keyboard selection maps to display order.
                let idx = -1;
                return grouped.map((g) => (
                  <div key={g.type}>
                    <div style={{
                      padding: '10px 14px 4px', fontSize: 11, fontWeight: 600,
                      color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {TYPE_META[g.type].group}
                      <span style={{ marginLeft: 6, color: 'var(--color-gray-300)', fontWeight: 500 }}>
                        {g.items.length}
                      </span>
                    </div>
                    {g.items.map((item) => {
                      idx += 1;
                      const i = idx;
                      const meta = TYPE_META[item.type];
                      const active = i === selected;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          data-idx={i}
                          role="option"
                          aria-selected={active}
                          tabIndex={-1}
                          aria-label={`${meta.label}: ${item.title}`}
                          onMouseEnter={() => setSelected(i)}
                          onClick={() => go(item)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 14px', cursor: 'pointer',
                            background: active ? 'var(--color-brand-light)' : 'transparent',
                          }}
                        >
                          <span style={{
                            flexShrink: 0, width: 26, height: 26, borderRadius: 6,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#F4F4F5',
                          }}>
                            <meta.Icon size={14} style={{ color: meta.color }} />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-gray-900)' }}>
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="truncate" style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                          {active && <CornerDownLeft size={13} className="text-stone-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalSearchBar;
