/**
 * CallLogPreview — compact, read-only list of recently LOGGED calls on a record,
 * for the right-hand record previews (ALT-335). Each row shows the disposition as
 * a small tinted badge, the comment/note, a relative date and (when resolvable)
 * who logged it — newest-first, capped so the preview stays short.
 *
 * DATA SOURCE: the LIVE `interaction` table via fetchCallLogs() (data/callLogs).
 * That is where the existing DispositionForm writes call dispositions + comments
 * today (type `call`). It deliberately does NOT read `public.call_log` /
 * data/calls.ts — that table is staged (migration not applied), so its Log-call
 * path errors and holds no production data.
 *
 * Self-contained: fetches on mount (and when entity/id/projectId change) with its
 * own loading / empty / error states. Visual language mirrors CallHistoryCard's
 * disposition badges, but the badge TONE is derived heuristically from the
 * disposition text (the values come from the `call_disposition` dropdown, not the
 * call_log enum, so we can't match enum constants exactly).
 *
 * Props:
 *   entity     'lead' | 'company' | 'contact' | 'meeting'
 *   id         numeric id of that record
 *   projectId  optional project scope (Company/Contact track a selected project)
 *   title      section heading (defaults to "Recent calls")
 *   refreshSignal  bump this number to force a re-fetch (e.g. after a parent logs
 *                  a new call via PreviewCallLogger) so the list updates instantly
 */
import { useEffect, useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { fetchCallLogs, type CallLogEntry, type CallLogEntity } from '../../data/callLogs';
import { formatRelativeTime } from '../../data/account';

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_STYLE: Record<Tone, { bg: string; color: string; border: string }> = {
  good: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  warn: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  bad: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  neutral: { bg: '#f3f4f6', color: '#4b5563', border: '#e5e7eb' },
};

/**
 * Heuristic tone for a disposition badge. The disposition values come from the
 * `call_disposition` dropdown (free-form per project), so we colour by keyword
 * rather than an exact enum match — green = positive, amber = follow-up/pending,
 * red = dead/negative, grey = neutral.
 */
function toneFor(disposition: string | null | undefined): Tone {
  const d = (disposition ?? '').toLowerCase();
  if (!d) return 'neutral';
  if (/(not\s*interest|wrong|do\s*not|dnc|dead|invalid|reject)/.test(d)) return 'bad';
  if (/(interest|connect|qualif|positive|meeting|demo|pitch|success)/.test(d)) return 'good';
  if (/(follow|callback|call\s*back|voicemail|pending|later|busy|reschedul)/.test(d)) return 'warn';
  return 'neutral';
}

function DispositionBadge({ disposition }: { disposition: string }) {
  const s = TONE_STYLE[toneFor(disposition)];
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
      {disposition}
    </span>
  );
}

export function CallLogPreview({
  entity,
  id,
  projectId,
  title = 'Recent calls',
  refreshSignal,
}: {
  entity: CallLogEntity;
  id: number;
  projectId?: number | null;
  title?: string;
  refreshSignal?: number;
}) {
  const [calls, setCalls] = useState<CallLogEntry[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCallLogs({ entity, id, projectId: projectId ?? null })
      .then((res) => {
        if (cancelled) return;
        setCalls(res.calls);
        setTruncated(res.truncated);
        setError(res.error);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load calls.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entity, id, projectId, refreshSignal]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Phone size={12} /> {title}
          </span>
        </h3>
        {!loading && !error && calls.length > 0 && (
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {calls.length}{truncated ? '+' : ''} logged
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9CA3AF', fontSize: 12.5, padding: '6px 0' }}>
          <Loader2 size={14} className="animate-spin" /> Loading calls…
        </div>
      ) : error ? (
        <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>{error || 'Could not load calls.'}</p>
      ) : calls.length === 0 ? (
        <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: 0 }}>No calls logged yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {calls.map((c, idx) => (
            <li
              key={c.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                padding: '8px 0',
                borderBottom: idx < calls.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {c.disposition ? (
                  <DispositionBadge disposition={c.disposition} />
                ) : (
                  <span style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 500 }}>Call logged</span>
                )}
                <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                  {formatRelativeTime(c.date)}
                </span>
                {c.by && (
                  <>
                    <span style={{ color: '#D1D5DB' }}>·</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.by}
                    </span>
                  </>
                )}
              </div>
              {c.comment && (
                <p style={{ fontSize: 12.5, color: '#52525b', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {c.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CallLogPreview;
