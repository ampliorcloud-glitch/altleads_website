import { PageHeader, PageBody, Card, Pill, Btn, EmptyState } from '../components/ui'
import { DEMO, demoGovernance } from '../demo/demoData'
import { CalendarCheck, Users, Video, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function Governance() {
  if (!DEMO) return (
    <>
      <PageHeader breadcrumb={['Governance', 'Review Meetings']} title="Governance & Reviews" subtitle="Scheduled business reviews between Amplior leadership and your team." />
      <PageBody><EmptyState icon={<CalendarCheck size={36} strokeWidth={1.5} />} title="No reviews scheduled yet" sub="Amplior will schedule and publish your business reviews here." /></PageBody>
    </>
  )
  const upcoming = demoGovernance.filter((g) => g.status === 'Upcoming')
  const past = demoGovernance.filter((g) => g.status === 'Completed')

  const Row = ({ g }: { g: typeof demoGovernance[number] }) => (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-light text-primary flex-shrink-0">
        <CalendarCheck size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-ink">{g.title}</h3>
          <Pill>{g.status === 'Upcoming' ? 'Scheduled' : 'Completed'}</Pill>
        </div>
        <p className="text-sm text-ink-mute mt-1">{g.agenda}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-ink-faint flex-wrap">
          <span className="flex items-center gap-1"><Clock size={13} /> {format(parseISO(g.date), 'EEE, dd MMM yyyy')} · {g.time}</span>
          <span className="flex items-center gap-1"><Users size={13} /> {g.attendees}</span>
        </div>
      </div>
      {g.status === 'Upcoming' && g.joinUrl && (
        <Btn as="a" href={g.joinUrl} size="sm"><Video size={14} /> Join</Btn>
      )}
    </Card>
  )

  return (
    <>
      <PageHeader
        breadcrumb={['Governance', 'Review Meetings']}
        title="Governance & Reviews"
        subtitle="Scheduled business reviews between Amplior leadership and your team."
      />
      <PageBody>
        <h2 className="text-sm font-semibold text-ink-mute uppercase tracking-wide mb-3">Upcoming</h2>
        <div className="space-y-3 mb-8">
          {upcoming.map((g) => <Row key={g.id} g={g} />)}
          {upcoming.length === 0 && <p className="text-sm text-ink-faint">No upcoming reviews scheduled.</p>}
        </div>

        <h2 className="text-sm font-semibold text-ink-mute uppercase tracking-wide mb-3">Past reviews</h2>
        <div className="space-y-3">
          {past.map((g) => <Row key={g.id} g={g} />)}
        </div>
      </PageBody>
    </>
  )
}
