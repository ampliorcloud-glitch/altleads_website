/**
 * BulkProgressBar — thin determinate "N of M" bar for long bulk jobs.
 *
 * Presentation only. Shown by the shared bulk modals (Reassign / Project /
 * Status) while a multi-record write is in flight, beside a Cancel button.
 */
export function BulkProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="mt-4" aria-live="polite">
      <div className="flex items-center justify-between mb-1 text-stone-600" style={{ fontSize: 12 }}>
        <span>Processing…</span>
        <span>
          {done} of {total}
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 6, background: 'var(--color-zinc-200, #e4e4e7)' }}
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--color-brand)',
            transition: 'width 120ms linear',
          }}
        />
      </div>
    </div>
  );
}
