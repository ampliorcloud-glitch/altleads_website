import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, CalendarOff } from 'lucide-react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { useProjectScope } from '../contexts/ProjectScope'
import { PortalMeeting } from '../types/portal'
import { fetchRealMeetings } from '../data/crm'
import { PageHeader, PageBody, EmptyState } from '../components/ui'
import { ViewSwitcher, ListView, BoardView, CalendarView, MeetingView } from '../components/meetings/MeetingViews'
import { DEMO, demoMeetings } from '../demo/demoData'

const STATUS_TABS = ['All', 'Scheduled', 'Completed', 'Rescheduled', 'Dropped', 'Missed'] as const
type TabLabel = (typeof STATUS_TABS)[number]

function tabToStatus(tab: TabLabel): string[] {
  if (tab === 'All') return []
  if (tab === 'Dropped') return ['Cancelled']
  if (tab === 'Scheduled') return ['Scheduled', 'Confirmed']
  return [tab]
}
function statusToTab(status: string | null): TabLabel {
  if (!status) return 'All'
  if (status === 'Cancelled') return 'Dropped'
  if (status === 'Confirmed') return 'Scheduled'
  if (STATUS_TABS.includes(status as TabLabel)) return status as TabLabel
  return 'All'
}

export default function Meetings() {
  const { account, scope } = usePortalAuth()
  const { inScope, selectedIds } = useProjectScope()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [view, setView] = useState<MeetingView>('list')
  const [meetings, setMeetings] = useState<PortalMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabLabel>(statusToTab(searchParams.get('status')))
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (DEMO) { setMeetings(demoMeetings); setLoading(false); return }
    if (!account) return
    setLoading(true)
    fetchRealMeetings(scope).then((ms) => { setMeetings(ms); setLoading(false) })
  }, [account])

  function handleTabChange(tab: TabLabel) {
    setActiveTab(tab)
    setSearchParams(tab === 'All' ? {} : { status: tab === 'Dropped' ? 'Cancelled' : tab })
  }

  // Board view groups by status itself, so the status tab filter only applies to list/calendar.
  const filtered = useMemo(() => {
    let list = meetings
    // Global project scope (empty selection = all projects).
    if (selectedIds.length) list = list.filter((m) => inScope(m.project_id))
    if (view !== 'board') {
      const statuses = tabToStatus(activeTab)
      if (statuses.length) list = list.filter((m) => statuses.includes(m.meeting_status ?? ''))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((m) =>
        (m.company_name ?? '').toLowerCase().includes(q) ||
        (m.meeting_name ?? '').toLowerCase().includes(q) ||
        (m.lead_name ?? '').toLowerCase().includes(q))
    }
    if (dateFrom) list = list.filter((m) => m.meeting_date && m.meeting_date >= dateFrom)
    if (dateTo) list = list.filter((m) => m.meeting_date && m.meeting_date <= dateTo)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings, view, activeTab, searchQuery, dateFrom, dateTo, selectedIds])

  const open = (id: number) => navigate(`/meetings/${id}`)

  return (
    <>
      <PageHeader
        breadcrumb={['Engagement', 'Meetings']}
        title="Meetings"
        subtitle="Meetings Amplior has booked for you."
        actions={<ViewSwitcher view={view} onChange={setView} />}
      />
      <PageBody>
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, meeting, contact…"
              className="w-full border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-line rounded-lg px-2.5 py-2 text-sm bg-surface text-ink-mute focus:ring-2 focus:ring-primary/30 outline-none" />
            <span className="text-ink-faint text-sm">–</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-line rounded-lg px-2.5 py-2 text-sm bg-surface text-ink-mute focus:ring-2 focus:ring-primary/30 outline-none" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-sm text-ink-mute hover:text-ink px-2">Clear</button>
            )}
          </div>
        </div>

        {/* Status tabs (list + calendar only; board groups by status) */}
        {view !== 'board' && (
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
              {STATUS_TABS.map((tab) => (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    activeTab === tab ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-mute border-line hover:border-primary/40 hover:text-primary'}`}>
                  {tab}
                </button>
              ))}
            </div>
            {!loading && <p className="text-sm text-ink-faint">{filtered.length} {filtered.length === 1 ? 'meeting' : 'meetings'}</p>}
          </div>
        )}

        {/* Active view */}
        {loading ? (
          <div className="bg-surface border border-line rounded-xl shadow-card py-20 text-center text-ink-faint">Loading meetings…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<CalendarOff size={36} strokeWidth={1.5} />} title="No meetings found" sub="Try adjusting search or filters." />
        ) : view === 'list' ? (
          <ListView meetings={filtered} onOpen={open} />
        ) : view === 'board' ? (
          <BoardView meetings={filtered} onOpen={open} />
        ) : (
          <CalendarView meetings={filtered} onOpen={open} />
        )}
      </PageBody>
    </>
  )
}
