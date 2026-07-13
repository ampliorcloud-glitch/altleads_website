import { Calendar, Clock, MapPin, Video, Phone, User } from 'lucide-react'
import { PortalMeeting, STATUS_COLORS } from '../types/portal'

interface MeetingCardProps {
  meeting: PortalMeeting
  onClick?: () => void
}

function formatMeetingDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatMeetingTime(timeStr: string | null): string {
  if (!timeStr) return '—'
  try {
    const [h, m] = timeStr.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  } catch {
    return timeStr
  }
}

function getModeIcon(mode: string | null) {
  if (!mode) return null
  const lower = mode.toLowerCase()
  if (lower.includes('f2f') || lower.includes('face')) return <MapPin className="w-3.5 h-3.5" />
  if (lower.includes('online') || lower.includes('virtual')) return <Video className="w-3.5 h-3.5" />
  if (lower.includes('tele') || lower.includes('phone') || lower.includes('call')) return <Phone className="w-3.5 h-3.5" />
  return null
}

export default function MeetingCard({ meeting, onClick }: MeetingCardProps) {
  const status = meeting.meeting_status || 'Scheduled'
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS['Scheduled']

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Status + Mode row */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full border"
          style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
        >
          {status}
        </span>
        {meeting.meeting_mode && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            {getModeIcon(meeting.meeting_mode)}
            {meeting.meeting_mode}
          </span>
        )}
      </div>

      {/* Company name */}
      <h3 className="text-base font-semibold text-gray-800 leading-tight mb-0.5 truncate">
        {meeting.company_name || 'Unknown Company'}
      </h3>

      {/* Meeting name */}
      {meeting.meeting_name && (
        <p className="text-sm text-gray-500 mb-2 truncate">{meeting.meeting_name}</p>
      )}

      {/* Lead name + designation */}
      {meeting.lead_name && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">
            {meeting.lead_name}
            {meeting.lead_designation ? `, ${meeting.lead_designation}` : ''}
          </span>
        </div>
      )}

      {/* Date + Time */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {meeting.meeting_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatMeetingDate(meeting.meeting_date)}
          </span>
        )}
        {meeting.meeting_time && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatMeetingTime(meeting.meeting_time)}
          </span>
        )}
      </div>

      {/* Assigned rep */}
      {meeting.assigned_rep_name && (
        <p className="text-xs text-blue-500 mt-2 truncate">SP — {meeting.assigned_rep_name}</p>
      )}
    </div>
  )
}
