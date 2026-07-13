/**
 * CallHistoryCard — read-only list of recently LOGGED calls on a record
 * (ALT-269 / owner feedback #6).
 *
 * Reads via listCallsForRecord and renders each call as a row: disposition badge
 * + notes + duration + when. Simple and read-only — logging happens through the
 * "Log call" action (LogCallModal). Pass `refreshKey` and bump it after a new
 * call is logged to re-fetch.
 *
 * Mirrors the lightweight card styling used across the detail pages.
 */
import { useEffect, useState } from 'react';
import { PhoneOutgoing, PhoneIncoming, Loader2 } from 'lucide-react';
import {
  listCallsForRecord,
  dispositionLabel,
  dispositionTone,
  formatDuration,
  type CallLog,
  type CallRecordRef,
} from '../../data/calls';
import { formatISTDateTime } from '../tasks/taskScheduling';

const TONE_STYLE: Record<
  ReturnType<typeof dispositionTone>,
  { bg: string; color: string; border: string }
> = {
  good: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  warn: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  bad: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  neutral: { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' },
};

function DispositionBadge({ disposition }: { disposition: string }) {
  const s = TONE_STYLE[dispositionTone(disposition)];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {dispositionLabel(disposition)}
    </span>
  );
}

export function CallHistoryCard({
  recordRef,
  refreshKey = 0,
  title = 'Call history',
}: {
  recordRef: CallRecordRef;
  /** Bump to force a re-fetch (e.g. after a new call is logged). */
  refreshKey?: number;
  title?: string;
}) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refKey = JSON.stringify(recordRef);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCallsForRecord(recordRef).then(({ calls, error }) => {
      if (cancelled) return;
      setCalls(calls);
      setError(error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, refreshKey]);

  return (
    <div
      className="bg-white border border-stone-200 rounded-lg"
      style={{ overflow: 'hidden' }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid #f3f4f6' }}
      >
        <h3 className="font-medium text-stone-700" style={{ fontSize: 13, margin: 0 }}>
          {title}
        </h3>
        {!loading && calls.length > 0 && (
          <span className="text-stone-400" style={{ fontSize: 12 }}>
            {calls.length} logged
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center gap-2 text-stone-400 py-6"
          style={{ fontSize: 13 }}
        >
          <Loader2 size={15} className="animate-spin" />
          Loading calls…
        </div>
      ) : error ? (
        <p className="text-stone-400 text-center py-6" style={{ fontSize: 13 }}>
          Could not load calls.
        </p>
      ) : calls.length === 0 ? (
        <p className="text-stone-400 text-center py-6" style={{ fontSize: 13 }}>
          No calls logged yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {calls.map((c) => (
            <li
              key={c.call_id}
              className="px-4 py-3"
              style={{ borderBottom: '1px solid #f9fafb' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {c.direction === 'INBOUND' ? (
                  <PhoneIncoming size={13} className="text-stone-400 shrink-0" />
                ) : (
                  <PhoneOutgoing size={13} className="text-stone-400 shrink-0" />
                )}
                <DispositionBadge disposition={c.disposition} />
                <span className="text-stone-400" style={{ fontSize: 12 }}>
                  {formatISTDateTime(c.called_at)}
                </span>
                {c.duration_seconds != null && (
                  <>
                    <span className="text-stone-300">·</span>
                    <span className="text-stone-500" style={{ fontSize: 12 }}>
                      {formatDuration(c.duration_seconds)}
                    </span>
                  </>
                )}
              </div>
              {c.notes && (
                <p
                  className="text-stone-600"
                  style={{ fontSize: 12, margin: '4px 0 0', whiteSpace: 'pre-wrap' }}
                >
                  {c.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
