/**
 * DispositionForm — log a call disposition + note against a record.
 *
 * Loads call_disposition options via fetchOptions('call_disposition'), shows a
 * disposition <select> + note <textarea>, and on submit calls logDisposition
 * (projectStatus.ts) which appends an interaction row (type `call`). Calls
 * onLogged() after a successful write so the parent can refresh its timeline.
 *
 * Props:
 *   recordType    'contact' | 'company' | 'lead'
 *   recordId      numeric id of the record
 *   projectId     project scope (number | null)
 *   ownerUserId   owner user_id stamped on the interaction (number | null)
 *   actorId       acting user_id as text (created_by); from auth profile
 *   onLogged      called after a successful log
 */

import React, { useEffect, useState } from 'react';
import { fetchOptions, type DropdownOption } from '../../data/dropdowns';
import { logDisposition, type RecordType } from '../../data/projectStatus';
import { useToast } from './Toast';

interface Props {
  recordType: RecordType;
  recordId: number;
  projectId: number | null;
  ownerUserId: number | null;
  actorId: string | null;
  /**
   * Called after a successful log. Receives the disposition + note just logged
   * so a parent (e.g. the company view) can mirror it onto another feed, plus
   * the interactionId of the newly-created interaction row so callers can link
   * it to a task (ALT-430 auto-complete flow).
   */
  onLogged?: (logged: { disposition: string; noteText: string; interactionId: number | null }) => void;
}

export function DispositionForm({
  recordType,
  recordId,
  projectId,
  ownerUserId,
  actorId,
  onLogged,
}: Props) {
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [disposition, setDisposition] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    fetchOptions('call_disposition')
      .then((rows) => {
        if (!cancelled) {
          setOptions(rows);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load dispositions.');
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLog() {
    if (!disposition) {
      setError('Select a disposition.');
      return;
    }
    setSaving(true);
    setError(null);
    const { interactionId, error: err } = await logDisposition({
      recordType,
      recordId,
      projectId,
      disposition,
      noteText: noteText.trim(),
      ownerUserId,
      actorId,
    });
    setSaving(false);
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    const loggedDisposition = disposition;
    const loggedNote = noteText.trim();
    setDisposition('');
    setNoteText('');
    toast.success('Call logged');
    onLogged?.({ disposition: loggedDisposition, noteText: loggedNote, interactionId: interactionId ?? null });
  }

  const fieldStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '6px 10px',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    background: '#fff',
    color: '#18181b',
    width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select
        value={disposition}
        onChange={(e) => setDisposition(e.target.value)}
        aria-label="Call disposition"
        aria-required={true}
        style={{ ...fieldStyle, height: 34, appearance: 'none' }}
      >
        <option value="">Select disposition…</option>
        {options.map((o) => (
          <option key={o.option_id} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {loaded && options.length === 0 && (
        <div style={{ fontSize: 12, color: '#a16207' }}>
          No dispositions available. Please contact an admin.
        </div>
      )}
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Add a note (optional)…"
        aria-label="Call note"
        rows={3}
        style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />
      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
      <div>
        <button
          type="button"
          onClick={handleLog}
          disabled={saving || !disposition}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '7px 16px',
            border: 'none',
            borderRadius: 6,
            background: saving || !disposition ? '#93c5fd' : '#1A7EE8',
            color: '#fff',
            cursor: saving || !disposition ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Logging…' : 'Log call'}
        </button>
      </div>
    </div>
  );
}
