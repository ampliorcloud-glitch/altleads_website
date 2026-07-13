/**
 * RecordActivityHub — in-record panel showing open tasks + call/activity timeline
 * (ALT-430, §4.3).
 *
 * Rendered on LeadDetailPage (tasks tab), ContactDetailPage (tasks tab), and
 * CompanyDetailPage (tasks tab).
 *
 * When TASKS_V2 = false: returns null — zero change to existing pages.
 * When TASKS_V2 = true: full hub with:
 *  - Quick-action bar: Log call / Add task / Add note (stub)
 *  - Open tasks list with per-type action buttons:
 *      CALL task  → "Log call" → LogDispositionModal → on onLogged(interactionId)
 *                   → completeTask(taskId, { linked_interaction_id: interactionId })
 *      TODO/MEETING → "Complete" → CompleteTodoPopup
 *  - Completed tasks (collapsible)
 *
 * Auto-complete wiring:
 *   RecordActivityHub manages `activeTask` state. When the user clicks "Log call"
 *   on a CALL task, it opens LogDispositionModal and holds the task id. On
 *   onLogged(interactionId), it calls completeTask(activeTask.task_id, { linked_interaction_id: interactionId })
 *   then refreshes the task list.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, CalendarDays, CheckSquare, Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { TASKS_V2 } from '../../lib/tasksFlags';
import {
  listTasksForRecord,
  completeTask,
  skipTask,
  type Task,
  type TaskType,
} from '../../data/tasks';
import { LogDispositionModal } from '../calls/LogDispositionModal';
import { CreateTaskModal } from './CreateTaskModal';
import { CompleteTodoPopup } from './CompleteTodoPopup';
import { useToast } from '../ui/Toast';
import type { RecordType } from '../../data/projectStatus';

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

export interface RecordActivityHubProps {
  recordType: 'lead' | 'contact' | 'company';
  recordId: number | string;
  recordName?: string | null;
  /** Project scope — passed to LogDispositionModal */
  projectId?: number | null;
  /** Owner user_id — passed to LogDispositionModal */
  ownerUserId?: number | null;
  /** Current user's id as text — passed to LogDispositionModal */
  actorId?: string | null;
  /** Phone number — pre-fills tasks created via Add task */
  assocPhone?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Type icon map                                                       */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<TaskType, { Icon: typeof Phone; label: string; color: string }> = {
  CALL:    { Icon: Phone,        label: 'Call',    color: '#1A7EE8' },
  MEETING: { Icon: CalendarDays, label: 'Meeting', color: '#7C3AED' },
  TODO:    { Icon: CheckSquare,  label: 'To-do',   color: '#059669' },
};

/* ------------------------------------------------------------------ */
/*  Small button style                                                  */
/* ------------------------------------------------------------------ */

const smBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 9px',
  fontSize: 11,
  fontWeight: 500,
  borderRadius: 5,
  border: '1px solid #D1D5DB',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function RecordActivityHub({
  recordType,
  recordId,
  recordName,
  projectId = null,
  ownerUserId = null,
  actorId = null,
  assocPhone = null,
}: RecordActivityHubProps) {
  // When TASKS_V2 is false, this component is completely invisible.
  if (!TASKS_V2) return null;

  return (
    <RecordActivityHubInner
      recordType={recordType}
      recordId={recordId}
      recordName={recordName}
      projectId={projectId}
      ownerUserId={ownerUserId}
      actorId={actorId}
      assocPhone={assocPhone}
    />
  );
}

/**
 * Inner component — only mounted when TASKS_V2 = true (keeps hooks clean).
 */
function RecordActivityHubInner({
  recordType,
  recordId,
  recordName,
  projectId,
  ownerUserId,
  actorId,
  assocPhone,
}: RecordActivityHubProps) {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doneExpanded, setDoneExpanded] = useState(false);

  // Active task for the auto-complete flow
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [completeTodoTask, setCompleteTodoTask] = useState<Task | null>(null);
  const completeTodoRef = useRef<HTMLDivElement>(null);

  // Create task modal
  const [createOpen, setCreateOpen] = useState(false);

  // Reload token (prevents stale callbacks clobbering fresh data)
  const reloadTokenRef = useRef(0);

  const load = useCallback(async () => {
    const token = ++reloadTokenRef.current;
    setLoading(true);
    setLoadError(null);
    const { tasks: fetched, error } = await listTasksForRecord(recordType, recordId);
    if (token !== reloadTokenRef.current) return;
    setTasks(fetched);
    setLoadError(error);
    setLoading(false);
  }, [recordType, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  const openTasks = tasks.filter((t) => t.status === 'OPEN');
  const doneTasks = tasks.filter((t) => t.status !== 'OPEN');

  /* ----- handlers ----- */

  function handleLogCall(task: Task) {
    setActiveTask(task);
    setLogCallOpen(true);
  }

  async function handleLogCallLogged(interactionId?: number | null) {
    setLogCallOpen(false);
    if (activeTask) {
      const opts = interactionId != null ? { linked_interaction_id: interactionId } : {};
      const { error } = await completeTask(activeTask.task_id, opts);
      if (error) {
        toast.error(error);
      } else {
        toast.success('Call logged — task marked done');
      }
      setActiveTask(null);
      load();
    }
  }

  async function handleSkip(task: Task) {
    const { error } = await skipTask(task.task_id);
    if (error) toast.error(error);
    else { toast.success('Task skipped'); load(); }
  }

  const numericId = typeof recordId === 'string' ? parseInt(recordId, 10) : recordId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Quick-action bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...smBtn, color: '#1A7EE8', borderColor: '#BFDBFE' }}
          onClick={() => setLogCallOpen(true)}
        >
          <Phone size={12} /> Log call
        </button>
        <button
          type="button"
          style={smBtn}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={12} /> Add task
        </button>
        <button
          type="button"
          style={{ ...smBtn, color: '#9CA3AF' }}
          disabled
          title="Add note — leads only, coming soon"
        >
          <Plus size={12} /> Add note
          {/* TODO(ALT-430 v2): wire addActivityComment for leads; contact/company deferred */}
        </button>
      </div>

      {/* Open tasks */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Open tasks ({loading ? '…' : openTasks.length})
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>Loading…</div>
        ) : loadError ? (
          <div style={{ fontSize: 12, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loadError}
            <button type="button" onClick={load} style={{ ...smBtn, fontSize: 11 }}>
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        ) : openTasks.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 0' }}>
            No open tasks for this record.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {openTasks.map((task) => {
              const meta = TYPE_META[task.task_type];
              const isOverdue = new Date(task.due_at).getTime() < Date.now();
              return (
                <div
                  key={task.task_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  {/* Type icon */}
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: 'rgba(0,0,0,0.04)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: meta.color,
                    }}
                  >
                    <meta.Icon size={13} />
                  </span>

                  {/* Subject + due date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.subject}
                    </div>
                    <div style={{ fontSize: 11, color: isOverdue ? '#B91C1C' : '#9CA3AF' }}>
                      {isOverdue ? 'Overdue' : 'Due'}{' '}
                      {new Date(task.due_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ flexShrink: 0, display: 'flex', gap: 5, position: 'relative' }}>
                    {task.task_type === 'CALL' ? (
                      <button
                        type="button"
                        style={{ ...smBtn, color: '#1A7EE8', borderColor: '#BFDBFE' }}
                        onClick={() => handleLogCall(task)}
                      >
                        <Phone size={11} /> Log call
                      </button>
                    ) : (
                      <div style={{ position: 'relative' }} ref={completeTodoTask?.task_id === task.task_id ? completeTodoRef : undefined}>
                        <button
                          type="button"
                          style={{ ...smBtn, color: '#059669', borderColor: '#A7F3D0' }}
                          onClick={() => setCompleteTodoTask(completeTodoTask?.task_id === task.task_id ? null : task)}
                        >
                          <CheckSquare size={11} /> Complete
                        </button>
                        {completeTodoTask?.task_id === task.task_id && (
                          <CompleteTodoPopup
                            task={task}
                            onClose={() => setCompleteTodoTask(null)}
                            onCompleted={() => { setCompleteTodoTask(null); load(); }}
                          />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      style={smBtn}
                      onClick={() => handleSkip(task)}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed / skipped tasks (collapsible) */}
      {!loading && doneTasks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setDoneExpanded((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: 11,
              fontWeight: 700,
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: doneExpanded ? 6 : 0,
            }}
          >
            {doneExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Completed / skipped ({doneTasks.length})
          </button>
          {doneExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {doneTasks.map((task) => {
                const meta = TYPE_META[task.task_type];
                return (
                  <div
                    key={task.task_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      border: '1px solid #F3F4F6',
                      borderRadius: 8,
                      background: '#FAFAFA',
                      opacity: 0.7,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: 'rgba(0,0,0,0.04)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9CA3AF',
                      }}
                    >
                      <meta.Icon size={11} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#6B7280', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.subject}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
                      {task.status === 'DONE' ? 'Done' : 'Skipped'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LogDispositionModal — for CALL task auto-complete and standalone "Log call" */}
      <LogDispositionModal
        open={logCallOpen}
        onClose={() => { setLogCallOpen(false); setActiveTask(null); }}
        recordType={recordType as RecordType}
        recordId={numericId}
        projectId={projectId}
        ownerUserId={ownerUserId}
        actorId={actorId}
        onLogged={handleLogCallLogged}
      />

      {/* CreateTaskModal */}
      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
        association={{
          [recordType === 'lead' ? 'leadId' : recordType === 'contact' ? 'contactId' : 'companyId']: numericId,
          assocLabel: recordName ?? undefined,
          assocPhone: assocPhone ?? undefined,
        }}
      />
    </div>
  );
}

export default RecordActivityHub;
