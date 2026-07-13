import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PortalMeeting } from '../types/portal'
import { fetchRealMeetings, metricsFromMeetings } from '../data/crm'
import MeetingCard from '../components/MeetingCard'
import { PageHeader, PageBody, Card } from '../components/ui'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { DEMO, demoMetrics, demoMeetings, demoClient } from '../demo/demoData'

interface SummedMetrics { scheduled: number; completed: number; rescheduled: number; dropped: number; missed: number }

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function todayISO(): string { return new Date().toISOString().split('T')[0] }

const STATUS_META = [
  { label: 'Scheduled', key: 'scheduled' as const, param: 'Scheduled', accent: '#1A7EE8' },
  { label: 'Completed', key: 'completed' as const, param: 'Completed', accent: '#16A34A' },
  { label: 'Rescheduled', key: 'rescheduled' as const, param: 'Rescheduled', accent: '#EA580C' },
  { label: 'Dropped', key: 'dropped' as const, param: 'Cancelled', accent: '#B72025' },
  { label: 'Missed', key: 'missed' as const, param: 'Missed', accent: '#D97706' },
]

export default function Home() {
  const { account, scope } = usePortalAuth()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<SummedMetrics | null>(null)
  const [todayMeetings, setTodayMeetings] = useState<PortalMeeting[]>([])
  const [loading, setLoading] = useState(true)

  const firstName = DEMO
    ? demoClient.adminName.split(' ')[0]
    : account?.fullName?.split(' ')[0] ?? 'there'

  useEffect(() => {
    if (DEMO) {
      setMetrics(demoMetrics)
      setTodayMeetings(demoMeetings.filter((m) => m.meeting_date === todayISO()))
      setLoading(false)
      return
    }
    if (!account) return
    fetchRealMeetings(scope).then((ms) => {
      setMetrics(metricsFromMeetings(ms))
      const today = todayISO()
      setTodayMeetings(ms.filter((m) => m.meeting_date === today).slice(0, 6))
      setLoading(false)
    })
  }, [account])

  return (
    <>
      <PageHeader
        breadcrumb={[DEMO ? demoClient.companyName : 'Amplior', 'Overview']}
        title={`${getGreeting()}, ${firstName}`}
        subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />
      <PageBody>
        {/* Status tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
          {STATUS_META.map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(`/meetings?status=${s.param}`)}
              className="bg-surface border border-line rounded-xl shadow-card p-4 text-left hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="w-2 h-2 rounded-full" style={{ background: s.accent }} />
                <ArrowRight size={14} className="text-ink-faint" />
              </div>
              <p className="text-2xl font-bold text-ink mt-2">{loading ? '—' : metrics?.[s.key] ?? 0}</p>
              <p className="text-sm text-ink-mute">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Today's meetings */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Today's meetings</h2>
          <button onClick={() => navigate('/meetings')} className="text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1">
            View all <ArrowRight size={14} />
          </button>
        </div>
        {loading ? (
          <Card><p className="text-sm text-ink-faint">Loading…</p></Card>
        ) : todayMeetings.length === 0 ? (
          <Card className="text-center py-10">
            <CalendarDays size={32} className="text-ink-faint mx-auto mb-2" strokeWidth={1.5} />
            <p className="font-medium text-ink-soft">No meetings today</p>
            <p className="text-sm text-ink-faint mt-1">Upcoming meetings appear under Meetings.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {todayMeetings.map((m) => (
              <MeetingCard key={m.meeting_id} meeting={m} onClick={() => navigate(`/meetings/${m.meeting_id}`)} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}
