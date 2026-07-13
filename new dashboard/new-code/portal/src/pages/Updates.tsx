import { PageHeader, PageBody, Card, EmptyState } from '../components/ui'
import { DEMO, demoUpdates } from '../demo/demoData'
import { Megaphone } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function Updates() {
  if (!DEMO) return (
    <>
      <PageHeader breadcrumb={['Governance', 'Updates']} title="Updates" subtitle="What Amplior has been doing for you — one running log." />
      <PageBody><EmptyState icon={<Megaphone size={36} strokeWidth={1.5} />} title="No updates yet" sub="Amplior will post engagement updates here." /></PageBody>
    </>
  )
  return (
    <>
      <PageHeader
        breadcrumb={['Governance', 'Updates']}
        title="Updates"
        subtitle="What Amplior has been doing for you — one running log."
      />
      <PageBody>
        <div className="relative">
          {/* timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-line hidden sm:block" />
          <div className="space-y-4">
            {demoUpdates.map((u) => (
              <div key={u.id} className="flex gap-4">
                <div className="hidden sm:flex w-10 h-10 rounded-full bg-primary-light text-primary items-center justify-center flex-shrink-0 ring-4 ring-canvas z-10">
                  <Megaphone size={17} />
                </div>
                <Card className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-ink">{u.title}</h3>
                    <span className="text-xs text-ink-faint whitespace-nowrap">{format(parseISO(u.date), 'dd MMM, h:mm a')}</span>
                  </div>
                  <p className="text-sm text-ink-mute mt-1">{u.body}</p>
                  <p className="text-xs text-ink-faint mt-2">— {u.author}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </PageBody>
    </>
  )
}
