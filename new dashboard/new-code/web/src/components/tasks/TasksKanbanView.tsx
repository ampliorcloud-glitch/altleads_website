/**
 * TasksKanbanView — Kanban board view for My Tasks (ALT-430).
 *
 * Uses GenericKanban<Task> with four columns bucketed by due date:
 *  - Overdue (red)
 *  - Today (amber)
 *  - This Week / Later (blue)  [Upcoming bucket]
 *  - Done (gray)
 *
 * When TASKS_V2 = false: renders a "Task board coming soon" placeholder.
 * When TASKS_V2 = true: full kanban using the tasks already loaded by MyTasksPage.
 *
 * Read-only: clicking a card fires onCardClick (opens the linked record or the
 * complete flow). No drag-and-drop in v1 (same decision as LeadsKanbanPage).
 */
import React, { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { TASKS_V2 } from '../../lib/tasksFlags';
import { type Task, type GroupedTasks } from '../../data/tasks';
import { GenericKanban, type KanbanColumnDef } from '../kanban/GenericKanban';
import { TaskKanbanCard } from './TaskKanbanCard';

interface TasksKanbanViewProps {
  groups: GroupedTasks;
  onCardClick: (task: Task) => void;
}

const COLUMNS: KanbanColumnDef[] = [
  { key: 'OVERDUE',  label: 'Overdue' },
  { key: 'TODAY',    label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'DONE',     label: 'Done' },
];

export function TasksKanbanView({ groups, onCardClick }: TasksKanbanViewProps) {
  // Guard: render placeholder when the flag is off (migration not run yet)
  if (!TASKS_V2) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 280,
          border: '1px dashed #D1D5DB',
          borderRadius: 10,
          background: '#FAFAFA',
          color: '#9CA3AF',
        }}
      >
        <LayoutGrid size={28} style={{ color: '#D1D5DB' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>Task board coming soon</div>
        <div style={{ fontSize: 12 }}>
          Board view will be enabled after the task-enhancements migration runs.
        </div>
      </div>
    );
  }

  // Build the itemsByColumn map from the already-grouped tasks
  const itemsByColumn = useMemo(() => {
    const map = new Map<string, Task[]>([
      ['OVERDUE',  groups.Overdue],
      ['TODAY',    groups.Today],
      ['UPCOMING', groups.Upcoming],
      ['DONE',     groups.Completed],
    ]);
    return map;
  }, [groups]);

  return (
    <GenericKanban<Task>
      columns={COLUMNS}
      itemsByColumn={itemsByColumn}
      getKey={(t) => t.task_id}
      renderCard={(t) => <TaskKanbanCard task={t} />}
      onCardClick={onCardClick}
      getCardLabel={(t) => `${t.task_type}: ${t.subject}`}
      emptyColumnLabel="Nothing here"
    />
  );
}

export default TasksKanbanView;
