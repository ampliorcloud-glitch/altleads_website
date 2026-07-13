/**
 * Dashboard — a real-time, customizable leadership view of Amplior's outreach.
 *
 * Designed for senior sales / marketing / lead-gen reporting (what execs actually
 * want to see): headline KPIs + conversion, a status funnel, a month-over-month
 * trend, and ONE segmentation chart whose dimension the viewer picks (by vertical,
 * city, salesperson, mode, or project). Everything recomputes live from a single
 * filtered set of meetings, so every number on the page agrees.
 *
 * Filters (multi-field, all AND-combined):
 *   - Global project scope (top bar) · Date range · Status · Mode · Vertical · City · Rep
 * Customize: toggle which cards show + the breakdown's "Group by" dimension
 * (persisted per browser).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, Building2, MapPin, Target, Users2, SlidersHorizontal,
  RefreshCw, Check, Video, Layers,
} from 'lucide-react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { useProjectScope } from '../contexts/ProjectScope'
import { fetchRealMeetings } from '../data/crm'
import { PortalMeeting } from '../types/portal'
import { DEMO, demoClient, demoMeetings } from '../demo/demoData'
import { PageHeader, PageBody, Card, CardTitle, StatTile } from '../components/ui'
import MultiSelect from '../components/MultiSelect'

const STATUS_ORDER = ['Scheduled', 'Confirmed', 'Completed', 'Rescheduled', 'Cancelled', 'Missed']
const STATUS_COLOR: Record<string, string> = {
  Scheduled: '#1A7EE8', Confirmed: '#3B82F6', Completed: '#16A34A',
  Rescheduled: '#EA580C', Cancelled: '#B72025', Missed: '#D97706',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type GroupBy = 'vertical' | 'city' | 'rep' | 'mode' | 'project'
const GROUP_LABEL: Record<GroupBy, string> = {
  vertical: 'Vertical', city: 'City', rep: 'Salesperson', mode: 'Mode', project: 'Project',
}

interface DashFilters {
  from: string; to: string
  status: string[]; mode: string[]; vertical: string[]; city: string[]; rep: string[]
}
const EMPTY_FILTERS: DashFilters = { from: '', to: '', status: [], mode: [], vertical: [], city: [], rep: [] }

interface DashPrefs {
  groupBy: GroupBy
  cards: { kpis: boolean; status: boolean; trend: boolean; breakdown: boolean }
}
const DEFAULT_PREFS: DashPrefs = {
  groupBy: 'vertical',
  cards: { kpis: true, status: true, trend: true, breakdown: true },
}
const PREFS_KEY = 'amplior_portal_dash'

function uniq(vals: (string | null | undefined)[]): string[] {
  return [...new Set(vals.map((v) => (v ?? '').trim()).filter(Boolean))].sort()
}

/* ── chart primitives ─────────────────────────────────────────────────────── */

function StatusBars({ bars }: { bars: { stage: string; value: number; color: string }[] }) {
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <Card>
      <CardTitle icon={<Target size={18} />}>Meetings by status</CardTitle>
      {bars.length === 0 ? <p className="text-sm text-ink-faint">No data for the current filters.</p> : (
        <div className="space-y-3">
          {bars.map((s) => (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-ink-mute">{s.stage}</span>
                <span className="font-semibold text-ink">{s.value.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-6 rounded-md bg-mist overflow-hidden">
                <div className="h-full rounded-md transition-all" style={{ width: `${Math.max((s.value / max) * 100, 4)}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function MonthlyTrend({ monthly }: { monthly: { month: string; value: number }[] }) {
  const max = Math.max(...monthly.map((m) => m.value), 1)
  return (
    <Card>
      <CardTitle icon={<TrendingUp size={18} />}>Meetings delivered — by month</CardTitle>
      {monthly.length === 0 ? <p className="text-sm text-ink-faint">No data for the current filters.</p> : (
        <div className="flex items-end justify-between gap-3 h-40 pt-2">
          {monthly.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-ink-soft">{m.value}</span>
              <div className="w-full rounded-t-md bg-primary/85 transition-all" style={{ height: `${(m.value / max) * 100}%`, minHeight: 6 }} />
              <span className="text-xs text-ink-faint">{m.month}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Breakdown({
  title, icon, data, accent, groupBy, onGroupBy,
}: {
  title: string; icon: React.ReactNode; data: { label: string; value: number }[]; accent: string
  groupBy: GroupBy; onGroupBy: (g: GroupBy) => void
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h3 className="font-semibold text-ink">{title}</h3>
        </div>
        <select
          value={groupBy}
          onChange={(e) => onGroupBy(e.target.value as GroupBy)}
          className="text-xs font-medium border border-line rounded-lg px-2 py-1.5 bg-surface text-ink-soft outline-none focus:border-primary"
          title="Group by"
        >
          {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
            <option key={g} value={g}>By {GROUP_LABEL[g].toLowerCase()}</option>
          ))}
        </select>
      </div>
      {data.length === 0 ? <p className="text-sm text-ink-faint">No data for the current filters.</p> : (
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="text-sm text-ink-mute w-32 flex-shrink-0 truncate" title={d.label}>{d.label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-mist overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: accent }} />
              </div>
              <span className="text-sm font-semibold text-ink-soft w-8 text-right">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const { account, scope } = usePortalAuth()
  const { inScope, selectedIds, projects } = useProjectScope()

  const [meetings, setMeetings] = useState<PortalMeeting[]>(DEMO ? demoMeetings : [])
  const [loading, setLoading] = useState(!DEMO)
  const [asOf, setAsOf] = useState<Date>(() => new Date())
  const [reloadKey, setReloadKey] = useState(0)

  const [filters, setFilters] = useState<DashFilters>(EMPTY_FILTERS)
  const [prefs, setPrefs] = useState<DashPrefs>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
    } catch { return DEFAULT_PREFS }
  })
  const [showCustomize, setShowCustomize] = useState(false)

  const savePrefs = (next: DashPrefs) => {
    setPrefs(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (DEMO) { setMeetings(demoMeetings); setLoading(false); setAsOf(new Date()); return }
    if (!account) return
    setLoading(true)
    fetchRealMeetings(scope).then((ms) => { setMeetings(ms); setLoading(false); setAsOf(new Date()) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, reloadKey])

  const projectName = (id: number | null | undefined) =>
    (id != null ? projects.find((p) => p.project_id === id)?.project_name : '') || (id ? `Project #${id}` : 'Unassigned')

  // Filter option universes (from the full project-scoped set).
  const scoped = useMemo(
    () => (selectedIds.length ? meetings.filter((m) => inScope(m.project_id)) : meetings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetings, selectedIds],
  )
  const opts = useMemo(() => ({
    status: uniq(scoped.map((m) => m.meeting_status)),
    mode: uniq(scoped.map((m) => m.meeting_mode)),
    vertical: uniq(scoped.map((m) => m.company_industry)),
    city: uniq(scoped.map((m) => m.company_city)),
    rep: uniq(scoped.map((m) => m.assigned_rep_name)),
  }), [scoped])

  // Apply field filters.
  const rows = useMemo(() => {
    return scoped.filter((m) => {
      if (filters.from && (!m.meeting_date || m.meeting_date < filters.from)) return false
      if (filters.to && (!m.meeting_date || m.meeting_date > filters.to)) return false
      if (filters.status.length && !filters.status.includes(m.meeting_status ?? '')) return false
      if (filters.mode.length && !filters.mode.includes(m.meeting_mode ?? '')) return false
      if (filters.vertical.length && !filters.vertical.includes(m.company_industry ?? '')) return false
      if (filters.city.length && !filters.city.includes(m.company_city ?? '')) return false
      if (filters.rep.length && !filters.rep.includes(m.assigned_rep_name ?? '')) return false
      return true
    })
  }, [scoped, filters])

  // KPIs.
  const kpis = useMemo(() => {
    const total = rows.length
    const completed = rows.filter((m) => m.meeting_status === 'Completed').length
    const upcoming = rows.filter((m) => ['Scheduled', 'Confirmed'].includes(m.meeting_status ?? '')).length
    const dropped = rows.filter((m) => ['Cancelled', 'Missed'].includes(m.meeting_status ?? '')).length
    const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}% of total` : '—')
    return [
      { label: 'Meetings delivered', value: total, sub: 'matching filters', accent: '#1A7EE8' },
      { label: 'Completed', value: completed, sub: pct(completed), accent: '#16A34A' },
      { label: 'Upcoming', value: upcoming, sub: 'scheduled + confirmed', accent: '#3B82F6' },
      { label: 'Dropped / missed', value: dropped, sub: pct(dropped), accent: '#B72025' },
    ]
  }, [rows])

  const statusBars = useMemo(
    () => STATUS_ORDER
      .map((st) => ({ stage: st, value: rows.filter((m) => m.meeting_status === st).length, color: STATUS_COLOR[st] }))
      .filter((b) => b.value > 0),
    [rows],
  )

  const monthly = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((m) => { if (m.meeting_date) { const k = m.meeting_date.slice(0, 7); map.set(k, (map.get(k) ?? 0) + 1) } })
    return [...map.entries()].sort().slice(-6).map(([k, value]) => ({ month: MONTHS[Number(k.slice(5, 7)) - 1] ?? k, value }))
  }, [rows])

  const breakdown = useMemo(() => {
    const keyOf = (m: PortalMeeting): string => {
      switch (prefs.groupBy) {
        case 'vertical': return (m.company_industry ?? '').trim()
        case 'city': return (m.company_city ?? '').trim()
        case 'rep': return (m.assigned_rep_name ?? '').trim()
        case 'mode': return (m.meeting_mode ?? '').trim()
        case 'project': return projectName(m.project_id)
      }
    }
    const map = new Map<string, number>()
    rows.forEach((m) => { const k = keyOf(m); if (k) map.set(k, (map.get(k) ?? 0) + 1) })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, prefs.groupBy, projects])

  const breakdownIcon =
    prefs.groupBy === 'city' ? <MapPin size={18} />
      : prefs.groupBy === 'rep' ? <Users2 size={18} />
        : prefs.groupBy === 'mode' ? <Video size={18} />
          : prefs.groupBy === 'project' ? <Layers size={18} />
            : <Building2 size={18} />

  const activeFilterCount =
    filters.status.length + filters.mode.length + filters.vertical.length + filters.city.length + filters.rep.length +
    (filters.from ? 1 : 0) + (filters.to ? 1 : 0)

  const set = <K extends keyof DashFilters>(k: K, v: DashFilters[K]) => setFilters((p) => ({ ...p, [k]: v }))

  return (
    <>
      <PageHeader
        breadcrumb={[DEMO ? demoClient.companyName : 'Amplior', 'Dashboard']}
        title="Partnership Dashboard"
        subtitle="Real-time view of how Amplior is performing — across your projects."
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-ink-faint">
              as of {asOf.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 text-sm font-medium border border-line rounded-lg px-3 py-2 bg-surface text-ink-soft hover:border-primary/40"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <div className="relative">
              <button
                onClick={() => setShowCustomize((s) => !s)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium border rounded-lg px-3 py-2 bg-surface ${showCustomize ? 'border-primary text-primary' : 'border-line text-ink-soft hover:border-primary/40'}`}
              >
                <SlidersHorizontal size={14} /> Customize
              </button>
              {showCustomize && (
                <div className="absolute right-0 mt-1.5 w-60 bg-surface border border-line rounded-xl shadow-pop z-50 p-2">
                  <p className="px-2 py-1 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Cards</p>
                  {([
                    ['kpis', 'KPI tiles'], ['status', 'Status funnel'],
                    ['trend', 'Monthly trend'], ['breakdown', 'Segmentation'],
                  ] as [keyof DashPrefs['cards'], string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => savePrefs({ ...prefs, cards: { ...prefs.cards, [key]: !prefs.cards[key] } })}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-ink hover:bg-mist"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${prefs.cards[key] ? 'bg-primary border-primary text-white' : 'border-line'}`}>
                        {prefs.cards[key] && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="flex-1 text-left">{label}</span>
                    </button>
                  ))}
                  <div className="h-px bg-line my-1.5" />
                  <p className="px-2 py-1 text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Segment by</p>
                  <select
                    value={prefs.groupBy}
                    onChange={(e) => savePrefs({ ...prefs, groupBy: e.target.value as GroupBy })}
                    className="w-full text-sm border border-line rounded-lg px-2 py-1.5 bg-surface text-ink-soft outline-none focus:border-primary"
                  >
                    {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
                      <option key={g} value={g}>{GROUP_LABEL[g]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        }
      />
      <PageBody>
        {/* Filter bar */}
        <div className="bg-surface border border-line rounded-xl shadow-card p-3 mb-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)}
                className="border border-line rounded-lg px-2.5 h-9 text-sm bg-surface text-ink-mute outline-none focus:border-primary" title="From date" />
              <span className="text-ink-faint text-sm">–</span>
              <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)}
                className="border border-line rounded-lg px-2.5 h-9 text-sm bg-surface text-ink-mute outline-none focus:border-primary" title="To date" />
            </div>
            <MultiSelect label="Status" options={opts.status} selected={filters.status} onChange={(v) => set('status', v)} />
            <MultiSelect label="Mode" options={opts.mode} selected={filters.mode} onChange={(v) => set('mode', v)} />
            <MultiSelect label="Vertical" options={opts.vertical} selected={filters.vertical} onChange={(v) => set('vertical', v)} />
            <MultiSelect label="City" options={opts.city} selected={filters.city} onChange={(v) => set('city', v)} />
            <MultiSelect label="Salesperson" options={opts.rep} selected={filters.rep} onChange={(v) => set('rep', v)} />
            {activeFilterCount > 0 && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm font-medium text-ink-mute hover:text-ink px-2 h-9">
                Clear filters ({activeFilterCount})
              </button>
            )}
            <span className="ml-auto text-sm text-ink-faint">{rows.length} meeting{rows.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink-faint">Loading dashboard…</p>
        ) : (
          <>
            {prefs.cards.kpis && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {kpis.map((k) => <StatTile key={k.label} {...k} />)}
              </div>
            )}
            {(prefs.cards.status || prefs.cards.trend) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                {prefs.cards.status && <StatusBars bars={statusBars} />}
                {prefs.cards.trend && <MonthlyTrend monthly={monthly} />}
              </div>
            )}
            {prefs.cards.breakdown && (
              <Breakdown
                title={`Coverage by ${GROUP_LABEL[prefs.groupBy].toLowerCase()}`}
                icon={breakdownIcon}
                data={breakdown}
                accent="#1A7EE8"
                groupBy={prefs.groupBy}
                onGroupBy={(g) => savePrefs({ ...prefs, groupBy: g })}
              />
            )}
          </>
        )}
      </PageBody>
    </>
  )
}
