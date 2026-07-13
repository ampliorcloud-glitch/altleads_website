/**
 * DuplicatesButton — a toolbar button + modal that surfaces likely duplicate
 * records in the current list (read-only). Self-contained so a page just drops
 * it next to Export. Merging is intentionally NOT here — that's a write under
 * the ownership/RLS work (ALT-379); this is the safe, immediately-useful half.
 */

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, X, ExternalLink } from 'lucide-react';
import { findDuplicateGroups, type DuplicateSignal } from '../../lib/findDuplicates';

interface Props<Row> {
  /** The rows to scan (pass the filtered set; "clear filters" then scans more). */
  rows: Row[];
  signals: DuplicateSignal<Row>[];
  getId: (row: Row) => string | number;
  getTitle: (row: Row) => string;
  getSubtitle?: (row: Row) => string;
  /** Link target for a record (opened in a new tab so the list stays open). */
  getHref: (row: Row) => string;
  /** Plural entity name, e.g. "companies". */
  entityLabel: string;
}

export function DuplicatesButton<Row>({
  rows,
  signals,
  getId,
  getTitle,
  getSubtitle,
  getHref,
  entityLabel,
}: Props<Row>) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => findDuplicateGroups(rows, signals), [rows, signals]);
  const affected = useMemo(
    () => new Set(groups.flatMap((g) => g.rows.map((r) => getId(r)))).size,
    [groups, getId],
  );

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
    padding: '6px 12px', border: '1px solid #d4d4d8', borderRadius: 6, background: '#fff',
    color: '#374151', cursor: 'pointer', height: 32,
  };

  return (
    <>
      <button type="button" style={btnStyle} onClick={() => setOpen(true)} title={`Find potential duplicate ${entityLabel}`}>
        <Copy size={14} /> Duplicates
        {affected > 0 && (
          <span style={{
            marginLeft: 2, fontSize: 11, fontWeight: 600, color: '#B45309',
            background: '#FEF3C7', borderRadius: 10, padding: '0 6px', lineHeight: '16px',
          }}>
            {affected}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(17,24,39,0.40)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px 16px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Potential duplicate ${entityLabel}`}
            style={{
              width: '100%', maxWidth: 620, background: '#fff', borderRadius: 12,
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column',
              maxHeight: '78vh', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#18181b' }}>Potential duplicate {entityLabel}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {groups.length === 0
                    ? `Scanned ${rows.length} records in the current list.`
                    : `${groups.length} group${groups.length > 1 ? 's' : ''} · ${affected} records · matched by name, email or phone`}
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: groups.length === 0 ? '28px 18px' : '8px 0' }}>
              {groups.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                  No likely duplicates in the {rows.length} records shown. 🎉
                  <br />
                  <span style={{ color: '#9ca3af' }}>Tip: clear filters to scan the full list.</span>
                </div>
              ) : (
                groups.map((g, gi) => (
                  <div key={`${g.signal}-${gi}`} style={{ padding: '8px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9ca3af', marginBottom: 4 }}>
                      {g.label}:{' '}
                      <span style={{ color: '#6b7280', textTransform: 'none' }}>{g.value}</span>
                      <span style={{ color: '#d1d5db' }}> · {g.rows.length}</span>
                    </div>
                    <div style={{ border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
                      {g.rows.map((r, ri) => (
                        <a
                          key={String(getId(r))}
                          href={getHref(r)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                            textDecoration: 'none', color: '#18181b',
                            borderTop: ri ? '1px solid #f3f4f6' : 'none',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{getTitle(r) || '—'}</div>
                            {getSubtitle && (
                              <div className="truncate" style={{ fontSize: 11, color: '#9ca3af' }}>{getSubtitle(r)}</div>
                            )}
                          </div>
                          <ExternalLink size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '10px 18px', borderTop: '1px solid #F3F4F6', background: '#f9fafb', fontSize: 11.5, color: '#6b7280' }}>
              Read-only — open each record (new tab) to reconcile. One-click <strong>merge</strong> is on the roadmap (needs sign-off): ALT-379.
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default DuplicatesButton;
