/**
 * CommandPalette — global Cmd-K / Ctrl-K search (ALT-188 / ALT-213).
 *
 * Press Cmd/Ctrl-K (or fire the `altleads:open-search` window event from a search
 * button) to open a search-anything box across leads, companies and contacts,
 * with full keyboard navigation (↑/↓ to move, Enter to open, Esc to close) and
 * deep-link navigation. Mounted once at the app root; only active for a
 * logged-in internal user. The search index is built on first open and cached.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Target, Building2, User, CheckSquare, CalendarDays, CornerDownLeft, LayoutDashboard, Bell, Settings, Star, Columns3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  loadSearchIndex,
  searchIndex,
  type SearchItem,
  type SearchType,
} from '../../data/globalSearch';
import { getRecent, type RecentItem } from '../../lib/useRecentlyViewed';

const TYPE_META: Record<SearchType, { label: string; group: string; Icon: typeof Target; color: string }> = {
  lead: { label: 'Lead', group: 'Leads', Icon: Target, color: '#1A7EE8' },
  company: { label: 'Company', group: 'Companies', Icon: Building2, color: '#7C3AED' },
  contact: { label: 'Contact', group: 'Contacts', Icon: User, color: '#0E9F6E' },
  task: { label: 'Task', group: 'Tasks', Icon: CheckSquare, color: '#D97706' },
  meeting: { label: 'Meeting', group: 'Meetings', Icon: CalendarDays, color: '#0891B2' },
};

/** Fixed display order of result groups (Zoho/HubSpot-style sections). */
const GROUP_ORDER: SearchType[] = ['lead', 'company', 'contact', 'task', 'meeting'];

/** Icon + colour for each entity type that can appear in "Recently viewed". */
const RECENT_TYPE_META: Record<string, { label: string; Icon: typeof Target; color: string }> = {
  lead:    { label: 'Lead',     Icon: Target,       color: '#1A7EE8' },
  company: { label: 'Company',  Icon: Building2,    color: '#7C3AED' },
  contact: { label: 'Contact',  Icon: User,         color: '#0E9F6E' },
  meeting: { label: 'Meeting',  Icon: CalendarDays, color: '#0891B2' },
  wishlist: { label: 'Wishlist', Icon: Star,        color: '#D97706' },
  task:    { label: 'Task',     Icon: CheckSquare,  color: '#D97706' },
};

/** Quick navigation actions — shown when the box is empty, filtered as you type.
 *  Routes verified against App.tsx. They lead the result list so a power user can
 *  jump anywhere with the keyboard (the Cmd-K-as-command-bar pattern). */
interface QuickAction {
  id: string;
  label: string;
  route: string;
  Icon: typeof Target;
  color: string;
  keywords: string[];
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'go-dashboard', label: 'Go to Dashboard', route: '/dashboard', Icon: LayoutDashboard, color: '#1A7EE8', keywords: ['home', 'overview', 'dashboard'] },
  { id: 'go-leads', label: 'Go to Leads', route: '/leads', Icon: Target, color: '#1A7EE8', keywords: ['leads', 'pipeline'] },
  { id: 'go-leads-board', label: 'Go to Leads — Board', route: '/leads/board', Icon: Columns3, color: '#1A7EE8', keywords: ['kanban', 'board', 'stage'] },
  { id: 'go-companies', label: 'Go to Companies', route: '/companies', Icon: Building2, color: '#7C3AED', keywords: ['companies', 'accounts'] },
  { id: 'go-contacts', label: 'Go to Contacts', route: '/contacts', Icon: User, color: '#0E9F6E', keywords: ['contacts', 'people'] },
  { id: 'go-meetings', label: 'Go to Meetings', route: '/meetings', Icon: CalendarDays, color: '#0891B2', keywords: ['meetings', 'calls'] },
  { id: 'go-tasks', label: 'Go to Tasks', route: '/tasks', Icon: CheckSquare, color: '#D97706', keywords: ['tasks', 'todo', 'follow up'] },
  { id: 'go-wishlist', label: 'Go to Wishlist', route: '/wishlist', Icon: Star, color: '#D97706', keywords: ['wishlist', 'prospects'] },
  { id: 'go-notifications', label: 'Go to Notifications', route: '/notifications', Icon: Bell, color: '#0891B2', keywords: ['notifications', 'alerts'] },
  { id: 'go-settings', label: 'Go to Settings', route: '/settings', Icon: Settings, color: '#52525B', keywords: ['settings', 'preferences', 'account'] },
];

const kbdStyle = {
  fontSize: 10, color: 'var(--color-gray-500)', border: '1px solid var(--border-color)',
  borderRadius: 4, padding: '2px 6px', background: 'var(--color-surface)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  fontFamily: 'inherit'
};

export function CommandPalette() {
  const { session, isInternalUser, profile } = useAuth();
  const navigate = useNavigate();
  const enabled = Boolean(session && isInternalUser);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  // Re-read recents from localStorage each time the palette opens so any visit
  // recorded since the last open is reflected immediately.
  const [recents, setRecents] = useState<RecentItem[]>([]);
  useEffect(() => {
    if (open) setRecents(getRecent(profile?.user_id));
  }, [open, profile?.user_id]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Open via Cmd/Ctrl-K or the global search-button event; close on Escape.
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('altleads:open-search', onOpenEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('altleads:open-search', onOpenEvent);
    };
  }, [enabled]);

  // Load (and cache) the index the first time the palette opens.
  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    setLoading(true);
    loadSearchIndex().then((idx) => {
      if (!cancelled) {
        setItems(idx);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [open, items]);

  // Focus the input whenever it opens.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    // Reset transient state on close with a slight delay to allow exit animation
    const t = window.setTimeout(() => {
      setQuery('');
      setSelected(0);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo(
    () => (items ? searchIndex(items, query) : []),
    [items, query],
  );

  // Group the ranked results by type into Zoho/HubSpot-style sections, in a fixed
  // order. `flat` is the display-order list the keyboard navigates (so ↑/↓ walks
  // groups top-to-bottom and Enter opens the highlighted row).
  const grouped = useMemo(() => {
    const m = new Map<SearchType, SearchItem[]>();
    for (const it of results) {
      const arr = m.get(it.type) ?? [];
      arr.push(it);
      m.set(it.type, arr);
    }
    return GROUP_ORDER.filter((t) => m.has(t)).map((t) => ({ type: t, items: m.get(t)! }));
  }, [results]);
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Quick actions — all when the box is empty, filtered as you type. They lead
  // the result list so power users can jump anywhere without the mouse.
  const actionResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter(
      (a) => a.label.toLowerCase().includes(q) || a.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  // The display-order routes the keyboard walks (actions first, then recents
  // when the box is empty, then record results when the user types).
  const flatRoutes = useMemo(
    () => [
      ...actionResults.map((a) => a.route),
      ...(query.trim() === '' ? recents.map((r) => r.route) : []),
      ...(query.trim() !== '' ? flatItems.map((i) => i.route) : []),
    ],
    [actionResults, recents, flatItems, query],
  );

  // Keep the selection in range as results change.
  useEffect(() => { setSelected(0); }, [query]);

  const close = useCallback(() => setOpen(false), []);

  const navigateTo = useCallback(
    (route: string | undefined) => {
      if (!route) return;
      setOpen(false);
      navigate(route);
    },
    [navigate],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, Math.max(flatRoutes.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigateTo(flatRoutes[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Scroll the active row into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  if (!enabled) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 11000,
            background: 'rgba(17,24,39,0.3)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '12vh 16px 16px',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%', maxWidth: 640, background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '70vh',
            }}
          >
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <Search size={20} className="text-stone-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search leads, companies, contacts, tasks, meetings…"
                aria-label="Search leads, companies, contacts, tasks and meetings"
                style={{
                  flex: 1, border: 'none', outline: 'none', fontSize: 16,
                  color: 'var(--color-gray-900)', background: 'transparent',
                }}
              />
              <kbd style={kbdStyle}>Esc</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} style={{ overflowY: 'auto', padding: '8px 0' }}>
              {loading ? (
                <div className="flex items-center justify-center gap-2 text-stone-400" style={{ fontSize: 14, padding: '40px 20px' }}>
                  <Loader2 size={16} className="animate-spin" /> Loading search…
                </div>
              ) : actionResults.length === 0 && flatItems.length === 0 ? (
                <div className="text-stone-400" style={{ fontSize: 14, padding: '36px 20px', textAlign: 'center' }}>
                  No matches for “{query.trim()}”.
                </div>
              ) : (
                (() => {
                  let idx = -1;
                  const sections: React.ReactNode[] = [];

                  const groupHeader = (label: string, count: number) => (
                    <div style={{
                      padding: '12px 24px 6px', fontSize: 11, fontWeight: 600,
                      color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>
                      {label}
                      <span style={{ marginLeft: 6, color: 'var(--color-gray-300)', fontWeight: 500 }}>{count}</span>
                    </div>
                  );

                  const row = (
                    key: string,
                    i: number,
                    Icon: typeof Target,
                    color: string,
                    title: string,
                    subtitle: string | undefined,
                    tag: string,
                    onClick: () => void,
                    ariaLabel: string,
                  ) => {
                    const active = i === selected;
                    return (
                      <div
                        key={key}
                        data-idx={i}
                        role="button"
                        tabIndex={-1}
                        aria-label={ariaLabel}
                        onMouseEnter={() => setSelected(i)}
                        onClick={onClick}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '12px 16px', cursor: 'pointer',
                          background: active ? 'var(--color-surface-hover)' : 'transparent',
                          margin: '2px 12px',
                          borderRadius: 'var(--radius-md)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--color-gray-50)',
                          border: '1px solid var(--border-color)',
                        }}>
                          <Icon size={16} style={{ color }} />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="truncate" style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-gray-900)' }}>
                            {title}
                          </div>
                          {subtitle && (
                            <div className="truncate" style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 2 }}>
                              {subtitle}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-gray-400)', flexShrink: 0 }}>{tag}</span>
                        {active && <CornerDownLeft size={14} className="text-stone-400 shrink-0 ml-2" />}
                      </div>
                    );
                  };

                  if (actionResults.length > 0) {
                    sections.push(
                      <div key="__actions" style={{ marginBottom: 8 }}>
                        {groupHeader('Quick actions', actionResults.length)}
                        {actionResults.map((a) => {
                          idx += 1;
                          return row(a.id, idx, a.Icon, a.color, a.label, undefined, 'Go', () => navigateTo(a.route), a.label);
                        })}
                      </div>,
                    );
                  }

                  if (query.trim() === '') {
                    if (recents.length > 0) {
                      sections.push(
                        <div key="__recents" style={{ marginBottom: 8 }}>
                          {groupHeader('Recently viewed', recents.length)}
                          {recents.map((r) => {
                            idx += 1;
                            const meta = RECENT_TYPE_META[r.type] ?? RECENT_TYPE_META['lead'];
                            return row(
                              `recent-${r.type}-${r.id}`,
                              idx,
                              meta.Icon,
                              meta.color,
                              r.label,
                              undefined,
                              meta.label,
                              () => navigateTo(r.route),
                              `${meta.label}: ${r.label}`,
                            );
                          })}
                        </div>,
                      );
                    }
                    sections.push(
                      <div key="__hint" className="text-stone-400" style={{ fontSize: 13, padding: '16px 20px 24px', textAlign: 'center' }}>
                        …or type to search leads, companies, contacts, tasks and meetings.
                      </div>,
                    );
                  } else {
                    for (const g of grouped) {
                      sections.push(
                        <div key={g.type} style={{ marginBottom: 8 }}>
                          {groupHeader(TYPE_META[g.type].group, g.items.length)}
                          {g.items.map((item) => {
                            idx += 1;
                            const meta = TYPE_META[item.type];
                            return row(
                              `${item.type}-${item.id}`,
                              idx,
                              meta.Icon,
                              meta.color,
                              item.title,
                              item.subtitle,
                              meta.label,
                              () => navigateTo(item.route),
                              `${meta.label}: ${item.title}`,
                            );
                          })}
                        </div>,
                      );
                    }
                  }

                  return sections;
                })()
              )}
            </div>

            {/* Footer hint */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
              borderTop: '1px solid var(--border-color)', background: 'var(--color-gray-50)',
              fontSize: 12, color: 'var(--color-gray-500)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> to navigate
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <kbd style={kbdStyle}>↵</kbd> to open
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <kbd style={kbdStyle}>Esc</kbd> to close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default CommandPalette;
