import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PortalNotification } from '../types/portal'
import { DEMO, demoNotifications } from '../demo/demoData'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { BellOff } from 'lucide-react'

function groupByDate(notifications: PortalNotification[]) {
  const groups: Record<string, PortalNotification[]> = {}
  for (const n of notifications) {
    const d = parseISO(n.created_date)
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'dd MMM yyyy')
    groups[label] = groups[label] ? [...groups[label], n] : [n]
  }
  return groups
}

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Demo seeds sample notifications; real notifications are a portal-owned feature
    // not yet wired to the CRM, so real mode shows an (honest) empty feed.
    setNotifications(DEMO ? demoNotifications : [])
    setLoading(false)
  }, [])

  const markRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleClick = (n: PortalNotification) => {
    markRead(n.notification_id)
    if (n.route) navigate(n.route)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const groups = groupByDate(notifications)

  if (loading) return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BellOff size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm mt-1">You&apos;ll see updates about your meetings here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
              <div className="space-y-2">
                {items.map(n => (
                  <button
                    key={n.notification_id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors ${
                      n.is_read
                        ? 'bg-white border-gray-100'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        {n.kind && (
                          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{n.kind.replace(/_/g, ' ')}</span>
                        )}
                        <p className="text-sm text-gray-800 mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(parseISO(n.created_date), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
