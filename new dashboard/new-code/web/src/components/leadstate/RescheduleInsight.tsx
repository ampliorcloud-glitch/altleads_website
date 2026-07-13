/**
 * RescheduleInsight — ALT-480. Compact, read-only "this prospect rescheduled N
 * times" banner on a lead, computed from existing meeting_reschedule data.
 *
 * Rendered ONLY when RESCHEDULE_INSIGHT is true. No migration — real working
 * feature over existing data. Shows nothing until loaded; renders a neutral chip
 * for 0, an amber warning for repeated reschedules (>= 2).
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { RESCHEDULE_INSIGHT } from '../../lib/rescheduleFlag';
import { fetchLeadRescheduleSummary, type RescheduleSummary } from '../../data/reschedule';

interface Props {
  reportId: number | null;
}

export function RescheduleInsight({ reportId }: Props) {
  const [summary, setSummary] = useState<RescheduleSummary | null>(null);

  useEffect(() => {
    if (!RESCHEDULE_INSIGHT || reportId == null) return;
    let cancelled = false;
    (async () => {
      const s = await fetchLeadRescheduleSummary(reportId);
      if (!cancelled) setSummary(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (!RESCHEDULE_INSIGHT || summary == null || summary.count === 0) return null;

  const repeated = summary.count >= 2;
  const bg = repeated ? '#FFFBEB' : '#F3F4F6';
  const fg = repeated ? '#B45309' : '#6B7280';
  const border = repeated ? '#FDE68A' : '#E5E7EB';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontSize: 12.5,
      }}
    >
      <RotateCcw size={14} />
      <span style={{ fontWeight: 600 }}>
        Rescheduled {summary.count} time{summary.count === 1 ? '' : 's'}
      </span>
      {summary.lastReason && (
        <span style={{ color: fg, opacity: 0.85 }}>· last: {summary.lastReason}</span>
      )}
    </div>
  );
}
