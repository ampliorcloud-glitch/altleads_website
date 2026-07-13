/**
 * MeetingStatusBadge — muted tinted status pill, shared by the Meetings list and
 * detail pages. Matches the premium-light UI (muted backgrounds, hairline ring).
 */
import React from 'react';

const statusStyles: Record<string, { bg: string; text: string; ring: string }> = {
  Completed:   { bg: '#f0fdf4', text: '#15803d', ring: '#bbf7d0' },
  Confirmed:   { bg: '#f0fdf4', text: '#15803d', ring: '#bbf7d0' },
  Scheduled:   { bg: '#f5f3ff', text: '#6d28d9', ring: '#ddd6fe' },
  Rescheduled: { bg: '#fffbeb', text: '#b45309', ring: '#fde68a' },
  Cancelled:   { bg: '#fef2f2', text: '#b91c1c', ring: '#fecaca' },
  Missed:      { bg: '#fef2f2', text: '#b91c1c', ring: '#fecaca' },
};
const defaultStatusStyle = { bg: '#f4f4f5', text: '#52525b', ring: '#d4d4d8' };

export function MeetingStatusBadge({
  status,
  size = 'sm',
}: {
  status: string;
  size?: 'sm' | 'md';
}) {
  if (!status) return <span className="text-stone-300" style={{ fontSize: 13 }}>—</span>;
  const s = statusStyles[status] ?? defaultStatusStyle;
  const fontSize = size === 'md' ? 12 : 11;
  const padding = size === 'md' ? '3px 8px' : '2px 6px';
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        boxShadow: `inset 0 0 0 1px ${s.ring}`,
        fontSize,
        fontWeight: 500,
        borderRadius: 4,
        padding,
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  );
}

export default MeetingStatusBadge;
