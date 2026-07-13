/**
 * LeadFreshnessInsight — ALT-484-lite. Compact "last activity N days ago" badge
 * on a lead, computed from existing data (report update + meeting dates).
 *
 * Rendered ONLY when FRESHNESS_INSIGHT is true. No migration — real working
 * signal over existing data. Neutral when fresh, amber when ≥ WARN_DAYS, red when
 * ≥ STALE_DAYS — so reps spot leads that have gone cold and need a follow-up.
 */

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { FRESHNESS_INSIGHT, WARN_DAYS, STALE_DAYS } from '../../lib/freshnessFlag';
import { fetchLeadFreshness, type FreshnessSummary } from '../../data/leadFreshness';

interface Props {
  reportId: number | null;
  /** lead_report.updated_date, already loaded on the page. */
  reportUpdatedDate: string | null | undefined;
}

function label(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function LeadFreshnessInsight({ reportId, reportUpdatedDate }: Props) {
  const [summary, setSummary] = useState<FreshnessSummary | null>(null);

  useEffect(() => {
    if (!FRESHNESS_INSIGHT) return;
    let cancelled = false;
    (async () => {
      const s = await fetchLeadFreshness(reportId, reportUpdatedDate, Date.now());
      if (!cancelled) setSummary(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, reportUpdatedDate]);

  if (!FRESHNESS_INSIGHT || summary == null || summary.daysSince == null) return null;

  const days = summary.daysSince;
  const stale = days >= STALE_DAYS;
  const warn = !stale && days >= WARN_DAYS;
  const bg = stale ? 'rgba(196,77,77,0.06)' : warn ? '#FFFBEB' : '#F0FDF4';
  const fg = stale ? '#B91C1C' : warn ? '#B45309' : '#15803D';
  const border = stale ? 'rgba(196,77,77,0.15)' : warn ? '#FDE68A' : '#BBF7D0';

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
      <Clock size={14} />
      <span style={{ fontWeight: 600 }}>Last activity {label(days)}</span>
      {(warn || stale) && (
        <span style={{ opacity: 0.85 }}>· {stale ? 'cold — needs a follow-up' : 'cooling off'}</span>
      )}
    </div>
  );
}
