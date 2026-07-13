/**
 * ActivityTimeline — readable history list of interaction rows.
 *
 * Renders newest-first (callers typically already sort that way). Each item shows
 * an icon by type, a title (type + disposition), the note text, and a relative /
 * absolute timestamp. Dependency-free besides lucide-react + inline styles.
 *
 * Props:
 *   items  interaction rows (see Interaction in data/contacts.ts)
 */

import React from 'react';
import { Phone, RefreshCw, StickyNote, Activity } from 'lucide-react';
import type { Interaction } from '../../data/contacts';

interface Props {
  items: Interaction[];
  emptyText?: string;
}

function iconFor(type: string) {
  switch (type) {
    case 'call':
      return <Phone size={13} />;
    case 'status_change':
      return <RefreshCw size={13} />;
    case 'note':
      return <StickyNote size={13} />;
    default:
      return <Activity size={13} />;
  }
}

function titleFor(item: Interaction): string {
  const typeLabel = (item.type || 'activity').replace(/_/g, ' ');
  const cap = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
  return item.disposition ? `${cap} — ${item.disposition}` : cap;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ActivityTimeline({ items, emptyText = 'No activity yet.' }: Props) {
  if (!items || items.length === 0) {
    return (
      <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>{emptyText}</div>
    );
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, idx) => (
        <li
          key={item.interaction_id ?? idx}
          style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#f3f4f6',
              color: '#6b7280',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {iconFor(item.type)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{titleFor(item)}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                {formatWhen(item.occurred_at ?? item.created_at)}
              </span>
            </div>
            {item.note_text && (
              <div style={{ fontSize: 13, color: '#52525b', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                {item.note_text}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
