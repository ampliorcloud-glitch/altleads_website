import { PageHeader, PageBody, Table, Pill, Btn, StatTile, EmptyState } from '../components/ui'
import { DEMO, demoInvoices } from '../demo/demoData'
import { Download, Receipt } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function Invoices() {
  if (!DEMO) return (
    <>
      <PageHeader breadcrumb={['Governance', 'Invoices']} title="Invoices" subtitle="Billing history for your Amplior engagement." />
      <PageBody><EmptyState icon={<Receipt size={36} strokeWidth={1.5} />} title="No invoices yet" sub="Your monthly invoices from Amplior will appear here." /></PageBody>
    </>
  )
  const paid = demoInvoices.filter((i) => i.status === 'Paid').length
  const due = demoInvoices.filter((i) => i.status !== 'Paid').length

  return (
    <>
      <PageHeader
        breadcrumb={['Governance', 'Invoices']}
        title="Invoices"
        subtitle="Billing history for your Amplior engagement."
      />
      <PageBody>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatTile label="Total invoices" value={demoInvoices.length} />
          <StatTile label="Paid" value={paid} accent="#16A34A" />
          <StatTile label="Outstanding" value={due} accent="#D97706" />
          <StatTile label="This month" value="₹3,50,000" sub="Jun 2026" />
        </div>

        <Table head={['Invoice #', 'Period', 'Amount', 'Status', 'Date', '']}>
          {demoInvoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-mist/60 transition-colors">
              <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">{inv.number}</td>
              <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{inv.period}</td>
              <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{inv.amount}</td>
              <td className="px-4 py-3"><Pill>{inv.status}</Pill></td>
              <td className="px-4 py-3 text-ink-faint whitespace-nowrap">{format(parseISO(inv.date), 'dd MMM yyyy')}</td>
              <td className="px-4 py-3 text-right"><Btn variant="ghost" size="sm"><Download size={15} /> PDF</Btn></td>
            </tr>
          ))}
        </Table>
      </PageBody>
    </>
  )
}
