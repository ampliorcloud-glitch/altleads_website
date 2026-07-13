import { PageHeader, PageBody, Btn, EmptyState } from '../components/ui'
import { DEMO, demoDocuments, DemoDoc } from '../demo/demoData'
import { FileText, FileSpreadsheet, Presentation, File, Download, FolderOpen } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const CATEGORIES: DemoDoc['category'][] = ['ICP & Criteria', 'Proposals & Decks', 'Process', 'Reports']

function typeIcon(t: DemoDoc['type']) {
  if (t === 'XLS') return <FileSpreadsheet size={20} className="text-emerald-600" />
  if (t === 'PPT') return <Presentation size={20} className="text-orange-600" />
  if (t === 'DOC') return <FileText size={20} className="text-blue-600" />
  return <File size={20} className="text-red-600" />
}

export default function Documents() {
  if (!DEMO) return (
    <>
      <PageHeader breadcrumb={['Governance', 'Documents']} title="Documents & Criteria" subtitle="ICP, proposals, process docs and review decks shared by Amplior." />
      <PageBody><EmptyState icon={<FolderOpen size={36} strokeWidth={1.5} />} title="No documents shared yet" sub="ICP, proposals and decks Amplior publishes for you will appear here." /></PageBody>
    </>
  )
  return (
    <>
      <PageHeader
        breadcrumb={['Governance', 'Documents']}
        title="Documents & Criteria"
        subtitle="ICP, proposals, process docs and review decks shared by Amplior."
      />
      <PageBody>
        {CATEGORIES.map((cat) => {
          const docs = demoDocuments.filter((d) => d.category === cat)
          if (!docs.length) return null
          return (
            <div key={cat} className="mb-8">
              <h2 className="text-sm font-semibold text-ink-mute uppercase tracking-wide mb-3">{cat}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {docs.map((d) => (
                  <div key={d.id} className="bg-surface border border-line rounded-xl shadow-card p-4 flex items-start gap-3 hover:border-primary/40 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-mist flex items-center justify-center flex-shrink-0">{typeIcon(d.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink text-sm leading-snug">{d.name}</p>
                      <p className="text-xs text-ink-faint mt-1">{d.type} · {d.size} · {format(parseISO(d.updated), 'dd MMM yyyy')}</p>
                    </div>
                    <Btn variant="ghost" size="sm"><Download size={15} /></Btn>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </PageBody>
    </>
  )
}
