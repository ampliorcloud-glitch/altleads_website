/**
 * Wishlist — request a target company for Amplior to pursue.
 *
 * Faithful to the legacy mobile app + the CRM web app's ALT-276 add form:
 *   - Company: typeahead over EXISTING CRM companies (searchCompanies) OR free text.
 *   - Contact (lead): picked from that company's existing CRM leads (auto-fills
 *     designation + phone) OR free-typed.
 *   - State → City real cascade; Address line 1/2, Pincode, Notes.
 * The Amplior CRM agent settles the match / dedup when converting to a Lead, so a
 * free-typed company/contact is fine.
 *
 * Writes to the live `wishlist` table are GATED (VITE_PORTAL_WRITES). When off,
 * submissions stage locally (shown with a "Draft" tag) so the whole flow is
 * reviewable without touching the CRM DB.
 */
import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  PlusCircle, X, Check, Building2, Search, CheckCircle, ChevronDown, Loader2,
} from 'lucide-react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PageHeader, PageBody, EmptyState } from '../components/ui'
import { DEMO } from '../demo/demoData'
import {
  WRITES_ENABLED, STATUS_CONVERTED,
  fetchWishlist, addWishlist, searchCompanies, leadsByCompany, listStates, listCitiesByState,
  type WishlistItem, type CompanySearchOption, type CompanyLeadOption, type StateOption, type CityOption,
} from '../data/wishlist'

const TABS = ['All', 'Sent', 'Converted'] as const
type Tab = (typeof TABS)[number]

const demoSeed: WishlistItem[] = [
  { wishlistId: 1, company: 'Adani Group', contactName: 'R. Nair', designation: 'GM — Admin', city: 'Ahmedabad', state: 'Gujarat', status: 'WishList', phone: '', pincode: '', description: 'Large facilities footprint — worth targeting.', createdDate: new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10) },
  { wishlistId: 2, company: 'Zomato', contactName: 'S. Kapoor', designation: 'Head — Workplace', city: 'Gurugram', state: 'Haryana', status: STATUS_CONVERTED, phone: '', pincode: '', description: 'Tech HQ, big cafeteria.', createdDate: new Date(Date.now() - 9 * 86_400_000).toISOString().slice(0, 10) },
]

function StatusTag({ status, draft }: { status: string; draft?: boolean }) {
  if (draft) return <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200 whitespace-nowrap">Draft</span>
  const converted = status.toLowerCase() === STATUS_CONVERTED.toLowerCase()
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-inset whitespace-nowrap ${
      converted ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}>
      {converted ? 'Converted' : 'Sent'}
    </span>
  )
}

const inputCls = 'w-full border border-line rounded-lg px-3 py-2.5 text-sm bg-surface focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none'
const labelCls = 'text-xs font-semibold text-ink-faint uppercase tracking-wide mb-1 block'

export default function Wishlist() {
  const { account, scope } = usePortalAuth()
  const actor = account?.userId != null ? String(account.userId) : null

  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('All')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  /* form state */
  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [companyOpts, setCompanyOpts] = useState<CompanySearchOption[]>([])
  const [companyOpen, setCompanyOpen] = useState(false)
  const [searchingCo, setSearchingCo] = useState(false)

  const [leadName, setLeadName] = useState('')
  const [leadOpts, setLeadOpts] = useState<CompanyLeadOption[]>([])
  const [leadOpen, setLeadOpen] = useState(false)
  const [mobile, setMobile] = useState('')
  const [designation, setDesignation] = useState('')

  const [states, setStates] = useState<StateOption[]>([])
  const [stateId, setStateId] = useState<number | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
  const [cityId, setCityId] = useState<number | null>(null)

  const [addr1, setAddr1] = useState('')
  const [addr2, setAddr2] = useState('')
  const [pincode, setPincode] = useState('')
  const [description, setDescription] = useState('')

  const companyBox = useRef<HTMLDivElement>(null)
  const leadBox = useRef<HTMLDivElement>(null)

  /* load list */
  useEffect(() => {
    if (DEMO) { setItems(demoSeed); setLoading(false); return }
    if (!account) return
    setLoading(true)
    fetchWishlist(scope).then((rows) => { setItems(rows); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account])

  /* load states once the form opens */
  useEffect(() => {
    if (showForm && !DEMO && states.length === 0) listStates().then(setStates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

  /* company typeahead (debounced, >= 2 chars, mobile parity) */
  useEffect(() => {
    if (DEMO) return
    if (companyName.trim().length < 2 || companyName === companyOpts.find((c) => c.companyId === companyId)?.companyName) {
      return
    }
    setSearchingCo(true)
    const t = setTimeout(async () => {
      const res = await searchCompanies(companyName)
      setCompanyOpts(res)
      setCompanyOpen(true)
      setSearchingCo(false)
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName])

  /* close dropdowns on outside click */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (companyBox.current && !companyBox.current.contains(e.target as Node)) setCompanyOpen(false)
      if (leadBox.current && !leadBox.current.contains(e.target as Node)) setLeadOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const pickCompany = async (c: CompanySearchOption) => {
    setCompanyName(c.companyName)
    setCompanyId(c.companyId)
    setCompanyOpen(false)
    // load that company's contacts for the Lead picker (mobile getLeadList parity)
    setLeadName(''); setDesignation(''); setMobile('')
    const leads = await leadsByCompany(c.companyId)
    setLeadOpts(leads)
  }

  const onCompanyType = (v: string) => {
    setCompanyName(v)
    if (companyId != null) { setCompanyId(null); setLeadOpts([]) } // free-typed again → unlink
  }

  const pickLead = (l: CompanyLeadOption) => {
    setLeadName(l.leadName)
    if (l.designation) setDesignation(l.designation)
    if (l.mobileNo) setMobile(l.mobileNo)
    setLeadOpen(false)
  }

  const onStateChange = async (id: number | null) => {
    setStateId(id); setCityId(null); setCities([])
    if (id != null) setCities(await listCitiesByState(id))
  }

  const resetForm = () => {
    setCompanyName(''); setCompanyId(null); setCompanyOpts([]); setLeadName(''); setLeadOpts([])
    setMobile(''); setDesignation(''); setStateId(null); setCities([]); setCityId(null)
    setAddr1(''); setAddr2(''); setPincode(''); setDescription('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) { setSubmitError('Company name is required.'); return }
    setSubmitError(null); setSubmitting(true)
    const res = await addWishlist({
      companyName, companyId, leadName, mobile, designation,
      addressLine1: addr1, addressLine2: addr2, cityId, pincode, description, actor,
    })
    setSubmitting(false)
    if (res.error) { setSubmitError(res.error); return }

    // Optimistic list update.
    const cityName = cityId != null ? cities.find((c) => c.cityId === cityId)?.cityName ?? '' : ''
    const stateName = stateId != null ? states.find((s) => s.stateId === stateId)?.stateName ?? '' : ''
    const newRow: WishlistItem = {
      wishlistId: res.id ?? Date.now(),
      company: companyName.trim(), contactName: leadName.trim(), designation: designation.trim(),
      city: cityName, state: stateName, status: 'WishList', phone: mobile.trim(), pincode: pincode.trim(),
      description: description.trim(), createdDate: new Date().toISOString().slice(0, 10),
      pendingLocal: res.staged,
    }
    setItems((prev) => [newRow, ...prev])
    resetForm(); setShowForm(false)
    setSuccess(res.staged
      ? 'Request captured (draft — writes are disabled). Enable VITE_PORTAL_WRITES to send it to the CRM.'
      : 'Request submitted. Our team will review and reach out.')
    setTimeout(() => setSuccess(null), 6000)
  }

  const filtered = items.filter((i) => {
    if (tab === 'Sent') return i.status.toLowerCase() !== STATUS_CONVERTED.toLowerCase()
    if (tab === 'Converted') return i.status.toLowerCase() === STATUS_CONVERTED.toLowerCase()
    return true
  })
  const counts = {
    All: items.length,
    Sent: items.filter((i) => i.status.toLowerCase() !== STATUS_CONVERTED.toLowerCase()).length,
    Converted: items.filter((i) => i.status.toLowerCase() === STATUS_CONVERTED.toLowerCase()).length,
  }

  return (
    <>
      <PageHeader
        breadcrumb={['Engagement', 'Wishlist']}
        title="Company Wishlist"
        subtitle="Request companies you'd like Amplior to reach out to."
        actions={
          <button
            onClick={() => { setShowForm((o) => !o); setSubmitError(null) }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <PlusCircle size={16} /> Request a company
          </button>
        }
      />
      <PageBody>
        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 mb-4 text-sm">
            <CheckCircle size={16} className="flex-shrink-0" /> {success}
          </div>
        )}
        {!WRITES_ENABLED && !DEMO && (
          <p className="text-xs text-ink-faint mb-4">
            Submissions are captured as drafts for review. Live submission to the CRM is turned off for now.
          </p>
        )}

        {/* Request form */}
        {showForm && (
          <div className="bg-surface border border-line rounded-xl shadow-card p-5 mb-5 max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink">New company request</h2>
              <button onClick={() => setShowForm(false)} className="text-ink-faint hover:text-ink"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company (typeahead + free text) */}
              <div className="sm:col-span-2" ref={companyBox}>
                <label className={labelCls}>Company *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                  <input
                    value={companyName} onChange={(e) => onCompanyType(e.target.value)}
                    onFocus={() => companyOpts.length && setCompanyOpen(true)}
                    placeholder="Search existing companies, or type a new one"
                    className={inputCls + ' pl-9'} required
                  />
                  {searchingCo && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint animate-spin" />}
                  {companyOpen && companyOpts.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-pop max-h-56 overflow-y-auto scrollbar-thin">
                      {companyOpts.map((c) => (
                        <button type="button" key={c.companyId} onClick={() => pickCompany(c)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-mist text-left">
                          <Building2 size={14} className="text-ink-faint flex-shrink-0" />
                          <span className="truncate">{c.companyName}</span>
                          {companyId === c.companyId && <Check size={14} className="ml-auto text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {companyId != null
                  ? <p className="text-[11px] text-emerald-600 mt-1">Matched an existing CRM company.</p>
                  : companyName.trim().length >= 2 && <p className="text-[11px] text-ink-faint mt-1">New company — our agent will match / dedup on conversion.</p>}
              </div>

              {/* Contact (lead picker + free text) */}
              <div ref={leadBox}>
                <label className={labelCls}>Contact name</label>
                <div className="relative">
                  <input
                    value={leadName} onChange={(e) => setLeadName(e.target.value)}
                    onFocus={() => leadOpts.length && setLeadOpen(true)}
                    placeholder={leadOpts.length ? 'Pick a known contact, or type' : 'Contact person'}
                    className={inputCls}
                  />
                  {leadOpts.length > 0 && (
                    <button type="button" onClick={() => setLeadOpen((o) => !o)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint">
                      <ChevronDown size={16} />
                    </button>
                  )}
                  {leadOpen && leadOpts.length > 0 && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-pop max-h-56 overflow-y-auto scrollbar-thin">
                      {leadOpts
                        .filter((l) => !leadName.trim() || l.leadName.toLowerCase().includes(leadName.toLowerCase()))
                        .map((l) => (
                          <button type="button" key={l.leadId} onClick={() => pickLead(l)}
                            className="w-full px-3 py-2 text-sm hover:bg-mist text-left">
                            <span className="text-ink">{l.leadName}</span>
                            {l.designation && <span className="text-ink-faint"> · {l.designation}</span>}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>Designation</label>
                <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. VP — Facilities" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Mobile number</label>
                <input value={mobile} onChange={(e) => /^\d*$/.test(e.target.value) && e.target.value.length <= 10 && setMobile(e.target.value)}
                  placeholder="10-digit mobile" className={inputCls} inputMode="numeric" />
              </div>

              <div>
                <label className={labelCls}>State</label>
                <select value={stateId ?? ''} onChange={(e) => onStateChange(e.target.value ? Number(e.target.value) : null)}
                  className={inputCls} disabled={DEMO}>
                  <option value="">Select state</option>
                  {states.map((s) => <option key={s.stateId} value={s.stateId}>{s.stateName}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>City</label>
                <select value={cityId ?? ''} onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : null)}
                  className={inputCls} disabled={stateId == null}>
                  <option value="">{stateId == null ? 'Pick a state first' : 'Select city'}</option>
                  {cities.map((c) => <option key={c.cityId} value={c.cityId}>{c.cityName}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Address line 1</label>
                <input value={addr1} onChange={(e) => setAddr1(e.target.value)} placeholder="Building, street" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Address line 2</label>
                <input value={addr2} onChange={(e) => setAddr2(e.target.value)} placeholder="Area, landmark" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Pincode</label>
                <input value={pincode} onChange={(e) => /^\d*$/.test(e.target.value) && e.target.value.length <= 6 && setPincode(e.target.value)}
                  placeholder="6-digit" className={inputCls} inputMode="numeric" />
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Why this company? (notes)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="Context: footprint, opportunity, a contact you know…"
                  className={inputCls + ' resize-none'} />
              </div>

              {submitError && (
                <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="text-sm font-medium text-ink-mute hover:text-ink px-4 py-2.5">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Submitting…</> : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                tab === t ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-mute border-line hover:border-primary/40 hover:text-primary'}`}>
              {t} ({counts[t]})
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="bg-surface border border-line rounded-xl shadow-card py-16 text-center text-ink-faint">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Building2 size={36} strokeWidth={1.5} />} title="No requests yet"
            sub="Use “Request a company” to suggest a company for us to pursue." />
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.wishlistId} className="bg-surface border border-line rounded-xl shadow-card p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink truncate">{item.company || '—'}</p>
                    {(item.city || item.state) && (
                      <span className="text-xs text-ink-faint">· {[item.city, item.state].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                  {(item.contactName || item.designation) && (
                    <p className="text-sm text-ink-mute mt-0.5">
                      {item.contactName}{item.designation && <span className="text-ink-faint"> · {item.designation}</span>}
                    </p>
                  )}
                  {item.description && <p className="text-sm text-ink-faint mt-1 line-clamp-2">{item.description}</p>}
                  <p className="text-xs text-ink-faint mt-1.5">
                    Requested {item.createdDate ? format(parseISO(item.createdDate), 'dd MMM yyyy') : '—'}
                  </p>
                </div>
                <StatusTag status={item.status} draft={item.pendingLocal} />
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}
