/**
 * LogCallModal — log a call that already happened (ALT-269 / owner feedback #6).
 *
 * The SIBLING of CreateTaskModal: that modal SCHEDULES a future call (a Task with
 * a due time + reminder); THIS modal RECORDS a call that already took place, with
 * its outcome (disposition), direction, duration, when it happened, notes, and an
 * optional record association passed in by the launcher.
 *
 * Reuses the shared admin Modal + form primitives + global Toast — same shape as
 * CreateTaskModal, including the focus-safe `open`-only re-seed effect (the focus
 * bug fixed in CreateTaskModal is NOT reintroduced here).
 *
 * Owner defaults to the current user (profile.user_id). On save it calls logCall,
 * toasts, then fires `onLogged` so the caller can refresh its call history.
 *
 * FUTURE calling-tool seam: recording_url / transcript are NOT entered here —
 * they are filled by a real calling integration later (see data/calls.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Field,
  SelectInput,
  PrimaryButton,
  GhostButton,
} from '../admin/Modal';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import {
  logCall,
  parseDuration,
  CALL_DISPOSITIONS,
  CALL_DIRECTIONS,
  type CallLog,
  type LogCallInput,
  type CallDirection,
  type CallDisposition,
} from '../../data/calls';
import { isoToISTLocalInput, istLocalInputToISO } from '../tasks/taskScheduling';

/** Association the call should be tied to (any subset). Passed by the launcher. */
export interface CallAssociation {
  leadId?: number | null;
  companyId?: number | null;
  contactId?: number | null;
  meetingId?: number | null;
  /** Human label for the linked record (denormalized for cheap list rows). */
  assocLabel?: string | null;
  /** Phone dialled / shown on the call row. */
  assocPhone?: string | null;
}

interface LogCallModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the logged call after a successful save. */
  onLogged?: (call: CallLog) => void;
  /** Optional pre-filled association (from a lead/company/contact/meeting page). */
  association?: CallAssociation;
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

export function LogCallModal({ open, onClose, onLogged, association }: LogCallModalProps) {
  const { profile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [direction, setDirection] = useState<CallDirection>('OUTBOUND');
  const [disposition, setDisposition] = useState<CallDisposition>('CONNECTED');
  const [durationRaw, setDurationRaw] = useState(''); // "mm:ss" or seconds
  const [whenLocal, setWhenLocal] = useState(''); // datetime-local (IST wall-clock)
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  /** Inline error shown below the Duration field on blur (Fix 3 — ALT-UX). */
  const [durationBlurError, setDurationBlurError] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      direction !== 'OUTBOUND' ||
      disposition !== 'CONNECTED' ||
      durationRaw.trim() !== '' ||
      notes.trim() !== '',
    [direction, disposition, durationRaw, notes],
  );

  function reset() {
    setDirection('OUTBOUND');
    setDisposition('CONNECTED');
    setDurationRaw('');
    setDurationBlurError(null);
    // Default "when" to now (IST wall-clock) each time the modal opens.
    setWhenLocal(isoToISTLocalInput(new Date().toISOString()));
    setNotes('');
  }

  // Re-seed from current props each time the modal OPENS. Depend on `open` ONLY
  // (NOT on association/onClose) so the parent re-rendering on each keystroke
  // can't re-run this and steal focus from inputs (the CreateTaskModal focus
  // discipline — do not reintroduce that bug).
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleClose() {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Discard this call log?',
        message: 'You have unsaved changes. Close without logging the call?',
        tone: 'danger',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
      });
      if (!ok) return;
    }
    reset();
    onClose();
  }

  async function handleSave() {
    const ownerId = profile?.user_id;
    if (ownerId == null) {
      toast.error('Could not determine your user — please re-login and try again.');
      return;
    }

    // "When" → ISO; default to now if the user cleared the field.
    const calledAtISO = whenLocal
      ? istLocalInputToISO(whenLocal)
      : new Date().toISOString();
    if (!calledAtISO) {
      toast.error('Please pick a valid date and time for the call.');
      return;
    }

    // Duration: accept "mm:ss" or plain seconds; blank = unknown (null).
    let durationSeconds: number | null = null;
    if (durationRaw.trim()) {
      durationSeconds = parseDuration(durationRaw);
      if (durationSeconds == null) {
        toast.error('Duration must be mm:ss (e.g. 3:45) or a number of seconds.');
        return;
      }
    }

    const input: LogCallInput = {
      direction,
      disposition,
      notes: notes.trim() ? notes.trim() : null,
      duration_seconds: durationSeconds,
      called_at: calledAtISO,
      owner_user_id: ownerId,
      created_by: ownerId,
      lead_id: association?.leadId ?? null,
      company_id: association?.companyId ?? null,
      contact_id: association?.contactId ?? null,
      meeting_id: association?.meetingId ?? null,
      assoc_label: association?.assocLabel ?? null,
      assoc_phone: association?.assocPhone ?? null,
    };

    setSaving(true);
    const { call, error } = await logCall(input);
    setSaving(false);

    if (error || !call) {
      toast.error(error ?? 'Could not log the call.');
      return;
    }
    toast.success('Call logged');
    reset();
    onLogged?.(call);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Log a call"
      onClose={handleClose}
      width={500}
      footer={
        <>
          <GhostButton onClick={handleClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? 'Logging…' : 'Log call'}
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
            Logged against <strong style={{ color: '#111827' }}>{association.assocLabel}</strong>
            {association.assocPhone ? ` · ${association.assocPhone}` : ''}
          </div>
        )}

        <Field label="Outcome">
          <SelectInput value={disposition} onChange={(v) => setDisposition(v as CallDisposition)}>
            {CALL_DISPOSITIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Direction">
              <SelectInput value={direction} onChange={(v) => setDirection(v as CallDirection)}>
                {CALL_DIRECTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Duration (mm:ss)">
              {/* Inline input (not TextInput) so we can add onBlur validation (Fix 3 — ALT-UX). */}
              <input
                type="text"
                value={durationRaw}
                onChange={(e) => {
                  setDurationRaw(e.target.value);
                  // Clear the blur error as soon as the value becomes valid or empty.
                  if (!e.target.value.trim() || parseDuration(e.target.value) != null) {
                    setDurationBlurError(null);
                  }
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && parseDuration(v) == null) {
                    setDurationBlurError('Use mm:ss (e.g. 3:45) or plain seconds.');
                  } else {
                    setDurationBlurError(null);
                  }
                }}
                placeholder="e.g. 3:45"
                style={{
                  fontSize: 13,
                  padding: '7px 10px',
                  border: `1px solid ${durationBlurError ? '#EF4444' : '#D1D5DB'}`,
                  borderRadius: 6,
                  background: '#fff',
                  color: '#374151',
                  outline: 'none',
                  height: 36,
                  width: '100%',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#1A7EE8';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,149,106,0.1)';
                }}
              />
            </Field>
            {durationBlurError && (
              <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3, marginBottom: 0 }}>
                {durationBlurError}
              </p>
            )}
          </div>
        </div>

        <Field label="When (India time)">
          <input
            type="datetime-local"
            value={whenLocal}
            onChange={(e) => setWhenLocal(e.target.value)}
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
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — what was discussed, objections, and the next step…"
            style={textareaStyle}
          />
        </Field>

        {/* Future calling-tool seam — recording / transcript attach automatically
            once a calling integration is wired; nothing to enter here today. */}
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
          Recording &amp; transcript will attach automatically once a calling tool is connected.
        </p>
      </div>
    </Modal>
  );
}
