import React from 'react';
import { MapPin, User } from 'lucide-react';
import type { RealLead } from '../../data/realLeads';

/**
 * KanbanCard — one lead rendered as a draggable/clickable card inside a stage column.
 *
 * - Clicking (or Enter/Space) navigates to the lead detail page (handled by the
 *   parent via onOpen) — mirrors LeadsPage's row `role="link"` + keyboard pattern.
 * - Drag is OPTIONAL: only enabled when the parent passes `draggable` (the board is
 *   read-only today because RealLead lacks report_id/stage_id — see KanbanColumn /
 *   LeadsKanbanPage TODO(ALT-292)). When enabled, native HTML5 DnD sets the lead id
 *   as drag data so the destination column can update the stage.
 */

/* Same deterministic avatar tinting as LeadsPage so a company keeps a stable color. */
const AVATAR_TINTS: { bg: string; text: string }[] = [
  { bg: '#E8F2FD', text: '#1A7EE8' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFEFF', text: '#0891B2' },
  { bg: '#F0FDF4', text: '#16A34A' },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: 'rgba(196,77,77,0.06)', text: '#DC2626' },
  { bg: '#FFFBEB', text: '#D97706' },
  { bg: '#EFF6FF', text: '#1D4ED8' },
];

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function avatarTint(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

interface KanbanCardProps {
  lead: RealLead;
  /** Navigate to the lead (parent owns routing so this component stays presentational). */
  onOpen: (leadId: string) => void;
  /** When true, the card is a native HTML5 drag source. Off = read-only board. */
  draggable?: boolean;
  /** Native drag handlers (only wired when draggable). */
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, leadId: string) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** True while this card is the one being dragged (dims it). */
  dragging?: boolean;
}

export function KanbanCard({
  lead,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
}: KanbanCardProps) {
  const title = lead.company || lead.contactName || 'Untitled lead';
  const tint = title ? avatarTint(title) : { bg: 'var(--color-gray-100)', text: 'var(--color-gray-400)' };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open ${title}`}
      draggable={draggable}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen(lead.id);
        }
      }}
      onDragStart={draggable ? (e) => onDragStart?.(e, lead.id) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-card, 8px)',
        padding: 10,
        cursor: draggable ? 'grab' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: dragging ? 0.4 : 1,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(16,24,40,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(16,24,40,0.04)';
      }}
      onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)'; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
    >
      {/* Title row: avatar + company/lead name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: tint.bg,
            color: tint.text,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.2,
          }}
        >
          {companyInitials(title)}
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            className="font-medium text-stone-900 truncate"
            style={{ fontSize: 13, lineHeight: '17px' }}
            title={title}
          >
            {title}
          </p>
          {lead.company && lead.contactName && (
            <p className="text-stone-400 truncate" style={{ fontSize: 11 }} title={lead.contactName}>
              {lead.contactName}
            </p>
          )}
        </div>
      </div>

      {/* Key details: city + salesperson/agent */}
      {(lead.city || lead.agent) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {lead.city && (
            <span className="text-stone-500 truncate" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }} title={lead.city}>
              <MapPin size={11} className="text-stone-400" style={{ flexShrink: 0 }} />
              {lead.city}
            </span>
          )}
          {lead.agent && (
            <span className="text-stone-500 truncate" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }} title={lead.agent}>
              <User size={11} className="text-stone-400" style={{ flexShrink: 0 }} />
              {lead.agent}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default KanbanCard;
