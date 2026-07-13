import { STATUS_COLORS } from '../types/portal'

interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' }
  const label = status === 'Cancelled' ? 'Dropped' : status

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: colors.border,
      }}
    >
      {label}
    </span>
  )
}
