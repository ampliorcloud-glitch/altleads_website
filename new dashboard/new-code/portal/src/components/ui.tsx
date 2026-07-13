/**
 * Odoo-clean UI primitives for the Amplior Client Portal.
 * Light, enterprise look using the exact CRM palette (#1A7EE8 + gray scale).
 */
import { ReactNode } from 'react'

/* ---- Page header (top bar with breadcrumb + title + actions) ---- */
export function PageHeader({
  title, subtitle, breadcrumb, actions,
}: { title: string; subtitle?: string; breadcrumb?: string[]; actions?: ReactNode }) {
  return (
    <div className="bg-surface border-b border-line px-5 sm:px-8 py-4 sticky top-0 z-10">
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-ink-faint mb-1">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-line">/</span>}
              <span className={i === breadcrumb.length - 1 ? 'text-ink-mute' : ''}>{b}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-mute mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

/* ---- Content shell (page padding) ---- */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-5 sm:px-8 py-6 max-w-[1400px] mx-auto w-full">{children}</div>
}

/* ---- Card ---- */
export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={`bg-surface border border-line rounded-xl shadow-card ${pad ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && <span className="text-primary">{icon}</span>}
      <h3 className="font-semibold text-ink">{children}</h3>
    </div>
  )
}

/* ---- KPI / stat tile ---- */
export function StatTile({
  label, value, sub, trend, accent = '#1A7EE8',
}: { label: string; value: string | number; sub?: string; trend?: string; accent?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide">{label}</p>
        <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
      </div>
      <div className="flex items-end justify-between mt-1.5">
        <p className="text-2xl font-bold text-ink">{value}</p>
        {trend && (
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-ink-faint mt-0.5">{sub}</p>}
    </div>
  )
}

/* ---- Status pill ---- */
const PILL: Record<string, string> = {
  Scheduled: 'bg-blue-50 text-blue-700 ring-blue-200',
  Confirmed: 'bg-blue-50 text-blue-700 ring-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Rescheduled: 'bg-orange-50 text-orange-700 ring-orange-200',
  Cancelled: 'bg-red-50 text-red-700 ring-red-200',
  Dropped: 'bg-red-50 text-red-700 ring-red-200',
  Missed: 'bg-amber-50 text-amber-700 ring-amber-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  'In Review': 'bg-blue-50 text-blue-700 ring-blue-200',
  Added: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Due: 'bg-amber-50 text-amber-700 ring-amber-200',
  Overdue: 'bg-red-50 text-red-700 ring-red-200',
}
export function Pill({ children }: { children: string }) {
  const cls = PILL[children] ?? 'bg-mist text-ink-mute ring-line'
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset whitespace-nowrap ${cls}`}>
      {children}
    </span>
  )
}

/* ---- Simple data table ---- */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-line rounded-xl bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-mist border-b border-line">
            {head.map((h) => (
              <th key={h} className="text-left font-semibold text-ink-mute text-xs uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function Btn({
  children, onClick, variant = 'primary', size = 'md', as, href,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md'; as?: 'a'; href?: string
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors'
  const sz = size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2'
  const v =
    variant === 'primary' ? 'bg-primary hover:bg-primary-hover text-white'
    : variant === 'outline' ? 'border border-line text-ink-soft hover:bg-mist bg-surface'
    : 'text-ink-mute hover:text-ink hover:bg-mist'
  const cls = `${base} ${sz} ${v}`
  if (as === 'a') return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>
  return <button onClick={onClick} className={cls}>{children}</button>
}

export function EmptyState({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-card py-16 text-center">
      {icon && <div className="text-ink-faint mb-3 flex justify-center">{icon}</div>}
      <p className="font-medium text-ink-soft">{title}</p>
      {sub && <p className="text-sm text-ink-faint mt-1">{sub}</p>}
    </div>
  )
}
