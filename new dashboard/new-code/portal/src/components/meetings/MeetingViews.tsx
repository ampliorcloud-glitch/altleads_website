/**
 * Meetings multi-view set — engineered from CRM patterns:
 *  - ListView   (Odoo list / HubSpot table): dense sortable rows
 *  - BoardView  (Odoo kanban / Zoho): columns by meeting status, colored headers + counts
 *  - CalendarView (Odoo calendar): month grid with meeting chips
 * Plus ViewSwitcher (Odoo control-panel segmented switch).
 */
import { useState, useMemo } from 'react'
import { PortalMeeting } from '../../types/portal'
import { Pill } from '../ui'
import {
  List as ListIcon, LayoutGrid, CalendarDays, Video, Users, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, Clock,
} from 'lucide-react'
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns'

export type MeetingView = 'list' | 'board' | 'calendar'

/* status order + accent for board columns / chips */
const STATUS_ORDER = ['Scheduled', 'Confirmed', 'Completed', 'Rescheduled', 'Missed', 'Cancelled']
const STATUS_ACCENT: Record<string, string> = {
  Scheduled: '#1A7EE8', Confirmed: '#3B82F6', Completed: '#16A34A',
  Rescheduled: '#EA580C', Missed: '#D97706', Cancelled: '#B72025',
}

function fmtDate(d?: string | null) { try { return d ? format(parseISO(d), 'dd MMM yyyy') : '' } catch { return d ?? '' } }
function fmtTime(t?: string | null) {
  if (!t) return ''
  try { const [h, m] = t.split(':').map(Number); const dt = new Date(); dt.setHours(h, m); return format(dt, 'h:mm a') } catch { return t }
}
function ModeIcon({ mode }: { mode?: string | null }) {
  return mode === 'Online' ? <Video size={13} /> : mode === 'Offline' ? <Users size={13} /> : <Clock size={13} />
}

/* ───────────────────────── View switcher ───────────────────────── */
export function ViewSwitcher({ view, onChange }: { view: MeetingView; onChange: (v: MeetingView) => void }) {
  const opts: { v: MeetingView; icon: React.ReactNode; label: string }[] = [
    { v: 'list', icon: <ListIcon size={15} />, label: 'List' },
    { v: 'board', icon: <LayoutGrid size={15} />, label: 'Board' },
    { v: 'calendar', icon: <CalendarDays size={15} />, label: 'Calendar' },
  ]
  return (
    <div className="inline-flex items-center bg-mist rounded-lg p-0.5 border border-line">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === o.v ? 'bg-surface text-primary shadow-card' : 'text-ink-mute hover:text-ink'
          }`}
        >
          {o.icon}<span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ───────────────────────── List view ───────────────────────── */
type SortKey = 'company_name' | 'meeting_date' | 'meeting_status' | 'assigned_rep_name'
export function ListView({ meetings, onOpen }: { meetings: PortalMeeting[]; onOpen: (id: number) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'meeting_date', dir: -1 })
  const rows = useMemo(() => {
    const arr = [...meetings]
    arr.sort((a, b) => {
      const av = (a[sort.key] ?? '') as string, bv = (b[sort.key] ?? '') as string
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0
    })
    return arr
  }, [meetings, sort])
  const th = (key: SortKey, label: string, extra = '') => (
    <th
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === -1 ? 1 : -1 }))}
      className={`text-left font-semibold text-ink-mute text-xs uppercase tracking-wide px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:text-ink ${extra}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort.key === key && (sort.dir === -1 ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </span>
    </th>
  )
  return (
    <div className="overflow-x-auto border border-line rounded-xl bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-mist border-b border-line sticky top-0">
          <tr>
            {th('company_name', 'Company')}
            <th className="text-left font-semibold text-ink-mute text-xs uppercase tracking-wide px-4 py-3">Meeting</th>
            <th className="text-left font-semibold text-ink-mute text-xs uppercase tracking-wide px-4 py-3">Contact</th>
            {th('meeting_date', 'Date')}
            <th className="text-left font-semibold text-ink-mute text-xs uppercase tracking-wide px-4 py-3">Mode</th>
            {th('assigned_rep_name', 'Rep')}
            {th('meeting_status', 'Status')}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((m) => (
            <tr key={m.meeting_id} onClick={() => onOpen(m.meeting_id)} className="hover:bg-mist/60 cursor-pointer transition-colors">
              <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{m.company_name ?? '—'}</td>
              <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{m.meeting_name ?? '—'}</td>
              <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{m.lead_name ?? '—'}</td>
              <td className="px-4 py-3 text-ink-mute whitespace-nowrap">
                {fmtDate(m.meeting_date)}{m.meeting_time && <span className="text-ink-faint"> · {fmtTime(m.meeting_time)}</span>}
              </td>
              <td className="px-4 py-3 text-ink-mute whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><ModeIcon mode={m.meeting_mode} />{m.meeting_mode ?? '—'}</span></td>
              <td className="px-4 py-3 text-ink-mute whitespace-nowrap">{m.assigned_rep_name ?? '—'}</td>
              <td className="px-4 py-3">{m.meeting_status ? <Pill>{m.meeting_status === 'Cancelled' ? 'Dropped' : m.meeting_status}</Pill> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ───────────────────────── Board (kanban) view ───────────────────────── */
export function BoardView({ meetings, onOpen }: { meetings: PortalMeeting[]; onOpen: (id: number) => void }) {
  const grouped = useMemo(() => {
    const g: Record<string, PortalMeeting[]> = {}
    STATUS_ORDER.forEach((s) => (g[s] = []))
    meetings.forEach((m) => { const s = m.meeting_status ?? ''; if (g[s]) g[s].push(m) })
    return g
  }, [meetings])
  return (
    <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
      {STATUS_ORDER.map((status) => {
        const list = grouped[status]
        const accent = STATUS_ACCENT[status]
        return (
          <div key={status} className="flex-shrink-0 w-72">
            <div className="bg-surface border border-line rounded-t-xl px-3 py-2.5 flex items-center justify-between" style={{ borderTop: `3px solid ${accent}` }}>
              <span className="text-sm font-semibold text-ink">{status === 'Cancelled' ? 'Dropped' : status}</span>
              <span className="text-xs font-semibold text-ink-mute bg-mist rounded-full px-2 py-0.5">{list.length}</span>
            </div>
            <div className="bg-canvas border border-t-0 border-line rounded-b-xl p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto scrollbar-thin">
              {list.length === 0 ? (
                <p className="text-xs text-ink-faint text-center py-6">No meetings</p>
              ) : list.map((m) => (
                <button key={m.meeting_id} onClick={() => onOpen(m.meeting_id)}
                  className="w-full text-left bg-surface border border-line rounded-lg p-3 shadow-card hover:border-primary/40 transition-colors">
                  <p className="font-semibold text-ink text-sm leading-snug">{m.company_name ?? '—'}</p>
                  {m.meeting_name && <p className="text-xs text-ink-mute mt-0.5">{m.meeting_name}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-ink-faint">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{fmtDate(m.meeting_date)}</span>
                    {m.meeting_time && <span>· {fmtTime(m.meeting_time)}</span>}
                  </div>
                  {m.assigned_rep_name && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-line">
                      <span className="w-5 h-5 rounded-full bg-primary-light text-primary text-[10px] font-bold flex items-center justify-center">
                        {m.assigned_rep_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs text-ink-mute truncate">{m.assigned_rep_name}</span>
                      <span className="ml-auto text-ink-faint"><ModeIcon mode={m.meeting_mode} /></span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── Calendar view ───────────────────────── */
export function CalendarView({ meetings, onOpen }: { meetings: PortalMeeting[]; onOpen: (id: number) => void }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const byDate = useMemo(() => {
    const m = new Map<string, PortalMeeting[]>()
    meetings.forEach((mt) => { if (mt.meeting_date) { const k = mt.meeting_date.slice(0, 10); m.set(k, [...(m.get(k) ?? []), mt]) } })
    return m
  }, [meetings])

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) })
  const today = new Date()

  return (
    <div className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h3 className="font-semibold text-ink">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor((c) => subMonths(c, 1))} className="p-1.5 rounded-md hover:bg-mist text-ink-mute"><ChevronLeft size={16} /></button>
          <button onClick={() => setCursor(startOfMonth(new Date()))} className="px-2.5 py-1 text-xs font-medium rounded-md hover:bg-mist text-ink-mute border border-line">Today</button>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} className="p-1.5 rounded-md hover:bg-mist text-ink-mute"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-line bg-mist">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-ink-faint uppercase tracking-wide py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const list = byDate.get(key) ?? []
          const inMonth = isSameMonth(day, cursor)
          const isToday = isSameDay(day, today)
          return (
            <div key={key} className={`min-h-[96px] border-b border-r border-line p-1.5 ${inMonth ? '' : 'bg-canvas'}`}>
              <div className={`text-xs mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${
                isToday ? 'bg-primary text-white font-bold' : inMonth ? 'text-ink-soft' : 'text-ink-faint'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {list.slice(0, 3).map((m) => (
                  <button key={m.meeting_id} onClick={() => onOpen(m.meeting_id)}
                    className="w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded truncate text-white"
                    style={{ background: STATUS_ACCENT[m.meeting_status ?? ''] ?? '#6B7280' }}
                    title={`${m.company_name} · ${fmtTime(m.meeting_time)}`}>
                    {fmtTime(m.meeting_time)} {m.company_name}
                  </button>
                ))}
                {list.length > 3 && <p className="text-[10px] text-ink-faint pl-1">+{list.length - 3} more</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
