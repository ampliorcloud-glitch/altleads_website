/**
 * CreateTaskModal — the create form for a task (ALT-160, build slice 3).
 *
 * Reuses the shared admin Modal + form primitives + global Toast. Fields: type
 * (Call / Meeting / To-do), subject, optional notes, due date+time with IST
 * quick-schedule preset chips, and priority. An optional association
 * (lead/company/contact/meeting + assoc_label/assoc_phone) is passed in via
 * props — when launched from a record, the new task is auto-tied to it.
 *
 * Owner defaults to the current user (profile.user_id). On save it calls
 * createTask, toasts, then fires `onCreated` so the caller can refresh.
 *
 * There is no `useUnsavedChanges` hook in this codebase yet, so we guard close
 * with a simple confirm when the form has unsaved edits.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Field,
  TextInput,
  SelectInput,
  PrimaryButton,
  GhostButton,
} from '../admin/Modal';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { createTask, type Task, type TaskInput, type TaskType, type TaskPriority } from '../../data/tasks';
import {
  SCHEDULE_PRESETS,
  presetToISO,
  isoToISTLocalInput,
  istLocalInputToISO,
  type PresetKey,
} from './taskScheduling';

/** Association the task should be tied to (any subset). Passed by the launcher. */
export interface TaskAssociation {
  leadId?: number | null;
  companyId?: number | null;
  contactId?: number | null;
  meetingId?: number | null;
  /** Human label for the linked record (denormalized for cheap list rows). */
  assocLabel?: string | null;
  /** Phone to show on "call back" rows. */
  assocPhone?: string | null;
}

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created task after a successful save. */
  onCreated?: (task: Task) => void;
  /** Optional pre-filled association (from a lead/company/contact page). */
  association?: TaskAssociation;
  /** Optional initial type (e.g. "Call back" pre-selects CALL). */
  initialType?: TaskType;
  /** Optional initial subject (e.g. "Call back — Acme"). */
  initialSubject?: string;
}

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'TODO', label: 'To-do' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
];

const chipBase: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  padding: '5px 10px',
  borderRadius: 999,
  border: '1px solid #D1D5DB',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function CreateTaskModal({
  open,
  onClose,
  onCreated,
  association,
  initialType = 'TODO',
  initialSubject = '',
}: CreateTaskModalProps) {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [type, setType] = useState<TaskType>(initialType);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueLocal, setDueLocal] = useState(''); // datetime-local value (IST wall-clock)
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () =>
      subject.trim() !== initialSubject.trim() ||
      body.trim() !== '' ||
      dueLocal !== '' ||
      type !== initialType ||
      priority !== 'NORMAL',
    [subject, body, dueLocal, type, priority, initialSubject, initialType],
  );

  function reset() {
    setType(initialType);
    setSubject(initialSubject);
    setBody('');
    setPriority('NORMAL');
    setDueLocal('');
    setActivePreset(null);
  }

  // Re-seed the form from the current props each time the modal OPENS. State is
  // otherwise seeded once at mount and the modal stays mounted across opens, so
  // without this a second open (e.g. 'Call back' then 'Schedule meeting' on the
  // same record) would show the previous prefill and a wrong `dirty` baseline
  // (review ALT-273B: stale prefill on reopen). reset() reads current props.
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleClose() {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard this task?',
        message: 'You have unsaved changes. Close without creating the task?',
        tone: 'danger',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      });
      if (!ok) return;
    }
    reset();
    onClose();
  }

  function applyPreset(key: PresetKey) {
    setActivePreset(key);
    if (key === 'custom') return; // leave the datetime-local field for the user
    const iso = presetToISO(key);
    if (iso) setDueLocal(isoToISTLocalInput(iso));
  }

  async function handleSave() {
    const ownerId = profile?.user_id;
    if (ownerId == null) {
      toast.error('Could not determine your user — please re-login and try again.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a subject.');
      return;
    }
    const dueISO = istLocalInputToISO(dueLocal);
    if (!dueISO) {
      toast.error('Please pick a due date and time.');
      return;
    }

    const input: TaskInput = {
      task_type: type,
      subject: subject.trim(),
      body: body.trim() ? body.trim() : null,
      priority,
      owner_user_id: ownerId,
      created_by: ownerId,
      lead_id: association?.leadId ?? null,
      company_id: association?.companyId ?? null,
      contact_id: association?.contactId ?? null,
      meeting_id: association?.meetingId ?? null,
      assoc_label: association?.assocLabel ?? null,
      assoc_phone: association?.assocPhone ?? null,
      due_at: dueISO,
      remind_offset_minutes: 0,
    };

    setSaving(true);
    const { task, error } = await createTask(input);
    setSaving(false);

    if (error || !task) {
      toast.error(error ?? 'Could not create the task.');
      return;
    }
    toast.success('Task created');
    reset();
    onCreated?.(task);
    onClose();
  }

  const textareaStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '7px 10px',
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    outline: 'none',
    width: '100%',
    minHeight: 64,
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <Modal
      open={open}
      title="New task"
      onClose={handleClose}
      width={500}
      footer={
        <>
          <GhostButton onClick={handleClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? 'Creating…' : 'Create task'}
          </PrimaryButton>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {association?.assocLabel && (
          <div
            style={{
              fontSize: 12,
              color: '#4B5563',
              background: '#F3F4F6',
              borderRadius: 6,
              padding: '6px 10px',
            }}
          >
            Linked to <strong style={{ color: '#111827' }}>{association.assocLabel}</strong>
            {association.assocPhone ? ` · ${association.assocPhone}` : ''}
          </div>
        )}

        <Field label="Type">
          <SelectInput value={type} onChange={(v) => setType(v as TaskType)}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Subject">
          <TextInput
            value={subject}
            onChange={setSubject}
            placeholder="e.g. Call back re: pricing"
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Anything to remember for this follow-up…"
            style={textareaStyle}
          />
        </Field>

        <Field label="Due (India time)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SCHEDULE_PRESETS.map((p) => {
                const active = activePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    style={{
                      ...chipBase,
                      borderColor: active ? '#1A7EE8' : '#D1D5DB',
                      color: active ? '#1A7EE8' : '#374151',
                      background: active ? 'rgba(196,149,106,0.08)' : '#fff',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => {
                setDueLocal(e.target.value);
                setActivePreset('custom');
              }}
              style={{
                fontSize: 13,
                padding: '7px 10px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                background: '#fff',
                color: '#374151',
                outline: 'none',
                height: 36,
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </Field>

        <Field label="Priority">
          <SelectInput value={priority} onChange={(v) => setPriority(v as TaskPriority)}>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
    </Modal>
  );
}
