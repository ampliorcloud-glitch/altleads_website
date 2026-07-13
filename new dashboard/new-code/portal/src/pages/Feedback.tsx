import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePortalAuth } from '../hooks/usePortalAuth'
import { PortalMeeting } from '../types/portal'
import { fetchRealMeetingDetail } from '../data/crm'
import { DEMO, getDemoMeeting } from '../demo/demoData'
import { isAfter, isSameDay, parseISO } from 'date-fns'
import { CheckCircle, ArrowLeft } from 'lucide-react'

const RATINGS = [1, 2, 3, 4, 5]

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

export default function Feedback() {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { account } = usePortalAuth()

  const [meeting, setMeeting] = useState<PortalMeeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)

  const [overallRating, setOverallRating] = useState<number | null>(null)
  const [repRating, setRepRating] = useState<number | null>(null)
  const [comments, setComments] = useState('')
  const [followUp, setFollowUp] = useState<'yes' | 'no' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const gate = (m: PortalMeeting | null) => {
      setMeeting(m)
      if (m?.started_at) {
        const start = parseISO(m.started_at)
        const now = new Date()
        if (!isAfter(now, start) && !isSameDay(now, start)) setBlocked(true)
      } else {
        setBlocked(true)
      }
      setLoading(false)
    }
    if (DEMO) {
      gate(meetingId ? getDemoMeeting(Number(meetingId)) ?? null : null)
      return
    }
    if (!account || !meetingId) return
    fetchRealMeetingDetail(Number(meetingId)).then((m) => gate(m))
  }, [meetingId, account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overallRating) { setError('Please give an overall rating.'); return }
    setError(null)
    setSubmitting(true)
    // Demo + real both confirm locally. Writing feedback back into the CRM
    // (feedback_answer) is the deliberate next step (needs the CRM write path).
    setSubmitting(false)
    setSubmitted(true)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (blocked) return (
    <div className="max-w-lg mx-auto px-4 py-10 text-center">
      <p className="text-gray-500 font-medium">Feedback is available after the meeting has started.</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto">
        <ArrowLeft size={14} /> Back
      </button>
    </div>
  )

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <CheckCircle size={52} className="text-green-500 mx-auto" />
      <h2 className="text-xl font-bold text-gray-900">Thank you for your feedback!</h2>
      <p className="text-gray-500 text-sm">Your response helps us improve your experience.</p>
      <button onClick={() => navigate(`/meetings/${meetingId}`)}
        className="mt-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
        Back to Meeting
      </button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-1">Meeting Feedback</h1>
      {meeting?.company_name && (
        <p className="text-sm text-gray-500 mb-6">{meeting.company_name}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Overall rating */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-800 mb-3">How was the overall meeting experience?</p>
          <div className="flex gap-3">
            {RATINGS.map(r => (
              <button
                key={r} type="button"
                onClick={() => setOverallRating(r)}
                className={`w-11 h-11 rounded-full text-sm font-bold border-2 transition-all ${
                  overallRating === r
                    ? 'bg-blue-600 text-white border-blue-600 scale-110'
                    : 'text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {overallRating && (
            <p className="text-xs text-blue-600 font-medium mt-2">{RATING_LABELS[overallRating]}</p>
          )}
        </div>

        {/* Rep rating */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-800 mb-3">How would you rate our representative?</p>
          <div className="flex gap-3">
            {RATINGS.map(r => (
              <button
                key={r} type="button"
                onClick={() => setRepRating(r)}
                className={`w-11 h-11 rounded-full text-sm font-bold border-2 transition-all ${
                  repRating === r
                    ? 'bg-blue-600 text-white border-blue-600 scale-110'
                    : 'text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {repRating && (
            <p className="text-xs text-blue-600 font-medium mt-2">{RATING_LABELS[repRating]}</p>
          )}
        </div>

        {/* Follow-up */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-800 mb-3">Would you like a follow-up from us?</p>
          <div className="flex gap-3">
            {(['yes', 'no'] as const).map(v => (
              <button
                key={v} type="button"
                onClick={() => setFollowUp(v)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold border-2 transition-all capitalize ${
                  followUp === v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
              >
                {v === 'yes' ? 'Yes, please' : 'No thanks'}
              </button>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <label className="font-semibold text-gray-800 block mb-2">Any comments or suggestions?</label>
          <textarea
            rows={4}
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Share your thoughts…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  )
}
