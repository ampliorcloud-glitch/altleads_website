/**
 * CompleteTodoPopup — lightweight inline popup for completing TODO/MEETING tasks
 * (ALT-430, auto-complete flow §5.3).
 *
 * Shows a small card anchored near its trigger with:
 *  - Task title
 *  - Optional outcome-note textarea
 *  - Cancel / Mark complete buttons
 *
 * When TASKS_V2 = true: calls completeTask() with the outcome note.
 * When TASKS_V2 = false: calls markDone() (existing behaviour — no outcome note).
 *
 * Same outside-click + Escape close pattern as SnoozeMenu in MyTasksPage.
 */
import React, { useEffect, useRef, useState } from 'react';
import { CheckSquare, X } from 'lucide-react';
import { TASKS_V2 } from '../../lib/tasksFlags';
import { completeTask, markDone, type Task } from '../../data/tasks';
import { useToast } from '../ui/Toast';

interface CompleteTodoPopupProps {
  task: Task;
  onClose: () => void;
  onCompleted: () => void;
}

export function CompleteTodoPopup({ task, onClose, onCompleted }: CompleteTodoPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Close on outside click or Escape key
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function handleComplete() {
    setSaving(true);
    if (TASKS_V2) {
      const { error } = await completeTask(task.task_id, {
        outcome_note: noteText.trim() || null,
      });
      setSaving(false);
      if (error) {
        toast.error(error);
        return;
      }
    } else {
      const { error } = await markDone(task.task_id);
      setSaving(false);
      if (error) {
        toast.error(error);
        return;
      }
    }
    toast.success('Task marked complete');
    onCompleted();
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Complete task: ${task.subject}`}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 6,
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 14,
        zIndex: 40,
        width: 280,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckSquare size={14} style={{ color: '#059669', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
            Complete — {task.subject}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Outcome note — only meaningful when TASKS_V2 is true; shown anyway for UX */}
      {TASKS_V2 && (
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="What happened? (optional)"
          rows={2}
          style={{
            width: '100%',
            fontSize: 12,
            padding: '6px 8px',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            background: '#fff',
            color: '#374151',
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            marginBottom: 10,
          }}
        />
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid #D1D5DB',
            background: '#fff',
            color: '#374151',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={saving}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 6,
            border: 'none',
            background: saving ? '#6EE7B7' : '#059669',
            color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Mark complete'}
        </button>
      </div>
    </div>
  );
}

export default CompleteTodoPopup;
