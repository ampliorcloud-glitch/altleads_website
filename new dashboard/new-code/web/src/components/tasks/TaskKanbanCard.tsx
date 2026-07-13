/**
 * TaskKanbanCard — a single card in the TasksKanbanView (ALT-430).
 *
 * Displays:
 *  - Type icon (Phone / CalendarDays / CheckSquare) top-left
 *  - Subject (truncated, 2 lines)
 *  - Association label + phone in small gray text
 *  - Priority chip
 *  - Relative due-date label bottom-right (red when overdue)
 */
import React from 'react';
import { Phone, CalendarDays, CheckSquare } from 'lucide-react';
import { type Task, type TaskType, type TaskPriority } from '../../data/tasks';
import { relativeDueLabel } from './taskScheduling';

const TYPE_META: Record<TaskType, { Icon: typeof Phone; label: string; color: string }> = {
  CALL:    { Icon: Phone,        label: 'Call',    color: '#1A7EE8' },
  MEETING: { Icon: CalendarDays, label: 'Meeting', color: '#7C3AED' },
  TODO:    { Icon: CheckSquare,  label: 'To-do',   color: '#059669' },
};

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; fg: string; label: string }> = {
  HIGH:   { bg: 'rgba(196,77,77,0.06)', fg: '#B91C1C', label: 'High' },
  NORMAL: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Normal' },
  LOW:    { bg: '#F3F4F6', fg: '#6B7280', label: 'Low' },
};

interface TaskKanbanCardProps {
  task: Task;
}

export function TaskKanbanCard({ task }: TaskKanbanCardProps) {
  const meta = TYPE_META[task.task_type];
  const prio = PRIORITY_STYLE[task.priority];
  const isOverdue = task.status === 'OPEN' && new Date(task.due_at).getTime() < Date.now();
  const relLabel = relativeDueLabel(task.due_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Type icon + subject */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'rgba(0,0,0,0.04)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: meta.color,
            marginTop: 1,
          }}
        >
          <meta.Icon size={12} />
        </span>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#111827',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
            opacity: task.status !== 'OPEN' ? 0.65 : 1,
          }}
        >
          {task.subject}
        </div>
      </div>

      {/* Association label + phone */}
      {(task.assoc_label || task.assoc_phone) && (
        <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.assoc_label}
          {task.assoc_label && task.assoc_phone ? ' · ' : ''}
          {task.assoc_phone}
        </div>
      )}

      {/* Priority + due label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 999,
            background: prio.bg,
            color: prio.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {prio.label}
        </span>
        {relLabel && (
          <span style={{ fontSize: 10, color: isOverdue ? '#B91C1C' : '#9CA3AF', whiteSpace: 'nowrap' }}>
            {relLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default TaskKanbanCard;
