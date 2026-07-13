/**
 * ActiveFilters — a removable-chip bar showing exactly what's filtering the
 * current list, with a one-click "Clear all". A data team filters all day; this
 * makes "why am I only seeing 12 rows?" answerable at a glance and reversible in
 * one click (HubSpot/Zoho/Airtable all show active filters as chips).
 *
 * Dumb + reusable: each page computes its own chips from its filter shape and
 * passes them in (a multi-select facet => one chip per value; a date range =>
 * one chip; free-text search is excluded — it has its own clear affordance).
 */

import React from 'react';
import { X } from 'lucide-react';

export interface FilterChip {
  /** Stable key (e.g. `city:Pune`). */
  key: string;
  /** Human label shown on the chip (e.g. "City: Pune"). */
  label: string;
  /** Remove just this filter value. */
  onRemove: () => void;
}

export function ActiveFilters({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '6px 0 2px',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {chips.length} filter{chips.length > 1 ? 's' : ''}
      </span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          title={`Remove ${c.label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 500,
            color: '#1A56DB',
            background: '#E8F2FD',
            border: '1px solid #BFD6F6',
            borderRadius: 14,
            padding: '2px 8px',
            cursor: 'pointer',
            lineHeight: '18px',
          }}
        >
          <span className="truncate" style={{ maxWidth: 220 }}>{c.label}</span>
          <X size={12} style={{ flexShrink: 0 }} />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#6b7280',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          marginLeft: 2,
        }}
      >
        Clear all
      </button>
    </div>
  );
}

export default ActiveFilters;
