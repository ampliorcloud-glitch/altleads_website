import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PortalMeeting, PreSalesQA } from '../types/portal'
import { fetchRealMeetingDetail } from '../data/crm'
import { DEMO, getDemoMeeting } from '../demo/demoData'
import { Card, CardTitle, Pill, Btn } from '../components/ui'
import { format, parseISO, isAfter, isSameDay } from 'date-fns'
import {
  ArrowLeft, Building2, User, Mail, Phone, Linkedin, Globe, MapPin, CalendarDays,
  Clock, Video, Users, Briefcase, Lightbulb, HelpCircle, MessageSquare, ExternalLink,
  CheckCircle2, Circle, Info,
} from 'lucide-react'

const PIPELINE = ['Scheduled', 'Confirmed', 'Completed']

function fmtDate(d?: string | null) { try { return d ? format(parseISO(d), 'EEE, dd MMM yyyy') : '' } catch { return d ?? '' } }
function fmtTime(t?: string | null) {
  if (!t) return ''
  try { const [h, m] = t.split(':').map(Number); const dt = new Date(); dt.setHours(h, m); return format(dt, 'h:mm a') } catch { return t }
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="py-1.5">
      <p className="text-[11px] text-ink-faint font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm text-ink-soft mt-0.5">{value}</p>
    </div>
  )
}

function StatusPipeline({ status }: { status: string }) {
  const idx = PIPELINE.indexOf(status)
  const offPipeline = idx === -1 // Rescheduled / Missed / Cancelled
  return (
    <div className="flex items-center gap-1.5">
      {PIPELINE.map((stage, i) => {
        const done = !offPipeline && i <= idx
        return (
          <div key={stage} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              done ? 'bg-primary text-white' : 'bg-mist text-ink-faint'}`}>
              {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}{stage}
            </span>
            {i < PIPELINE.length - 1 && <span className={`w-4 h-px ${done && i < idx ? 'bg-primary' : 'bg-line'}`} />}
          </div>
        )
      })}
      {offPipeline && status && <span className="ml-1"><Pill>{status === 'Cancelled' ? 'Dropped' : status}</Pill></span>}
    </div>
  )
}

export default function MeetingDetail() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { account } = usePortalAuth()
  const [meeting, setMeeting] = useState<PortalMeeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (DEMO) {
      const m = meetingId ? getDemoMeeting(Number(meetingId)) : undefined
      if (m) setMeeting(m); else setError('Meeting not found.')
      setLoading(false); return
    }
    if (!account || !meetingId) return
    fetchRealMeetingDetail(Number(meetingId)).then((m) => {
      if (m) setMeeting(m); else setError('Meeting not found.')
      setLoading(false)
    })
  }, [meetingId, account])

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (error || !meeting) return <div className="p-8 text-center text-ink-mute">{error ?? 'Meeting not found.'}</div>

  const m = meeting
  const qa: PreSalesQA[] = Array.isArray(m.pre_sales_qa) ? m.pre_sales_qa : []
  const agendaQA = qa.filter((q) => q.short_question === 'Discussion')
  const otherQA = qa.filter((q) => q.short_question !== 'Discussion')
  const addr = [m.address_line_one, m.address_line_two, m.address_city, m.address_state, m.address_country].filter(Boolean).join(', ')

  const canFeedback = (() => {
    if (!m.started_at) return false
    const s = parseISO(m.started_at); const now = new Date()
    return isAfter(now, s) || isSameDay(now, s)
  })()

  return (
    <div className="bg-canvas min-h-full">
      {/* Top bar */}
      <div className="bg-surface border-b border-line px-5 sm:px-8 py-4 sticky top-0 z-10">
        <button onClick={() => navigate('/meetings')} className="flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink mb-2 transition-colors">
          <ArrowLeft size={14} /> Meetings
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">{m.company_name ?? 'Meeting'}</h1>
            {m.meeting_name && <p className="text-sm text-ink-mute mt-0.5">{m.meeting_name}</p>}
          </div>
          <div className="flex items-center gap-2">
            {m.meeting_url && <Btn as="a" href={m.meeting_url} size="sm"><Video size={14} /> Join</Btn>}
            {canFeedback && <Btn as="a" href={`/meetings/${meetingId}/feedback`} variant="outline" size="sm"><MessageSquare size={14} /> Feedback</Btn>}
          </div>
        </div>
        {/* Status pipeline */}
        <div className="mt-3"><StatusPipeline status={m.meeting_status ?? ''} /></div>
        {/* Key facts strip */}
        <div className="flex items-center gap-5 mt-3 text-sm text-ink-mute flex-wrap">
          {m.meeting_date && <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-ink-faint" />{fmtDate(m.meeting_date)}</span>}
          {m.meeting_time && <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-ink-faint" />{fmtTime(m.meeting_time)}{m.meeting_duration && ` · ${m.meeting_duration}h`}</span>}
          {m.meeting_mode && <span className="inline-flex items-center gap-1.5">{m.meeting_mode === 'Online' ? <Video size={14} className="text-ink-faint" /> : <Users size={14} className="text-ink-faint" />}{m.meeting_mode}</span>}
          {m.assigned_rep_name && <span className="inline-flex items-center gap-1.5"><User size={14} className="text-ink-faint" />{m.assigned_rep_name}</span>}
        </div>
      </div>

      {/* Feedback gate link (when started) */}
      {m.meeting_reason && (
        <div className="px-5 sm:px-8 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
            <span className="font-medium">Reason:</span> {m.meeting_reason}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-5 sm:px-8 py-5 grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-[1200px]">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {otherQA.length > 0 && (
            <Card>
              <CardTitle icon={<HelpCircle size={18} />}>Pre-Sales Questions</CardTitle>
              <div className="space-y-3">
                {otherQA.map((q, i) => (
                  <div key={i} className="bg-mist/60 rounded-lg p-3">
                    <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wide mb-1">{q.short_question || q.question}</p>
                    <p className="text-sm text-ink-soft">{q.answer || '—'}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardTitle icon={<MessageSquare size={18} />}>Agenda & Notes</CardTitle>
            <div className="space-y-3">
              {m.meeting_description && (
                <div><p className="text-[11px] text-ink-faint font-medium uppercase tracking-wide mb-1">Agenda</p>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap">{m.meeting_description}</p></div>
              )}
              {agendaQA.map((q, i) => (
                <div key={i}><p className="text-[11px] text-ink-faint font-medium uppercase tracking-wide mb-1">Discussion</p>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap">{q.answer}</p></div>
              ))}
              {m.agenda_discussion && !agendaQA.length && (
                <div><p className="text-[11px] text-ink-faint font-medium uppercase tracking-wide mb-1">Discussion</p>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap">{m.agenda_discussion}</p></div>
              )}
              {!m.meeting_description && !agendaQA.length && !m.agenda_discussion && <p className="text-sm text-ink-faint italic">No notes recorded.</p>}
            </div>
          </Card>

          {(m.opportunity_title || m.opportunity_value || m.opportunity_description) && (
            <Card>
              <CardTitle icon={<Briefcase size={18} />}>Opportunity</CardTitle>
              <div className="space-y-1">
                <Field label="Title" value={m.opportunity_title} />
                <Field label="Value" value={m.opportunity_value} />
                <Field label="Description" value={m.opportunity_description} />
              </div>
            </Card>
          )}

          {m.sales_intelligence && (
            <Card>
              <CardTitle icon={<Lightbulb size={18} />}>Sales Intelligence</CardTitle>
              <p className="text-sm text-ink-soft whitespace-pre-wrap">{m.sales_intelligence}</p>
            </Card>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Contact */}
          <Card>
            <CardTitle icon={<User size={18} />}>Contact</CardTitle>
            <p className="font-semibold text-ink">{m.lead_name ?? '—'}</p>
            {m.lead_designation && <p className="text-sm text-ink-mute">{m.lead_designation}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {m.lead_email && <a href={`mailto:${m.lead_email}`} className="inline-flex items-center gap-1.5 bg-primary-light text-primary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/15"><Mail size={13} /> Email</a>}
              {m.lead_mobile_no && <a href={`tel:${m.lead_mobile_no}`} className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-100"><Phone size={13} /> Call</a>}
              {m.lead_linkedin_url && <a href={m.lead_linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-sky-100"><Linkedin size={13} /> LinkedIn</a>}
            </div>
            <div className="mt-2 divide-y divide-line">
              <Field label="Role & responsibility" value={m.lead_role_and_resp} />
              <Field label="Area of interest" value={m.lead_area_of_interest} />
              <Field label="Alt. mobile" value={m.lead_alt_mobile_no} />
            </div>
          </Card>

          {/* Company */}
          <Card>
            <CardTitle icon={<Building2 size={18} />}>Company</CardTitle>
            <p className="font-semibold text-ink">{m.company_name ?? '—'}</p>
            <div className="mt-1 divide-y divide-line">
              <Field label="Industry" value={m.company_industry} />
              <Field label="Sector" value={m.company_sector} />
              <Field label="Turnover" value={m.company_turnover} />
              <Field label="Size" value={m.company_size} />
              <Field label="City" value={m.company_city} />
            </div>
            {addr && (
              <div className="flex items-start gap-2 mt-2 pt-2 border-t border-line">
                <p className="text-sm text-ink-soft flex-1">{addr}</p>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noreferrer" className="text-primary"><MapPin size={16} /></a>
              </div>
            )}
            <div className="flex gap-3 mt-3">
              {m.company_web_url && <a href={m.company_web_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Globe size={13} /> Website</a>}
              {m.company_linkedin_url && <a href={m.company_linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Linkedin size={13} /> LinkedIn</a>}
            </div>
          </Card>

          {/* Meeting info */}
          <Card>
            <CardTitle icon={<Info size={18} />}>Meeting info</CardTitle>
            <div className="divide-y divide-line">
              <Field label="Status" value={m.meeting_status} />
              <Field label="Scheduled by" value={m.scheduled_by_name} />
              <Field label="Assigned rep" value={m.assigned_rep_name} />
            </div>
            {m.meeting_url && (
              <a href={m.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"><Video size={13} /> Meeting link <ExternalLink size={11} /></a>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
