/**
 * PreviewCallLogger — compact "Log a call" block for the right-hand record
 * previews (ALT-337). The previews show recent calls via CallLogPreview but, until
 * now, offered no way to LOG one (you had to open the full record). This wraps the
 * proven DispositionForm — which writes to the LIVE `interaction` table via
 * logDisposition() (the exact same path the full record uses) — in a collapsible,
 * drawer-friendly shell so the narrow panel stays tidy.
 *
 * It deliberately does NOT use the staged `call_log` path (data/calls.ts /
 * LogCallModal); that table's migration isn't applied, so its log-call path errors.
 *
 * On a successful log, DispositionForm fires its own success toast and calls
 * onLogged — the parent bumps a `logVersion` it passes to CallLogPreview as
 * `refreshSignal`, so the "Recent calls" list re-fetches and shows the new call.
 *
 * Props mirror DispositionForm's, plus an onLogged callback the parent uses to
 * bump its refresh signal.
 */
import { useState } from 'react';
import { Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { DispositionForm } from '../ui/DispositionForm';
import type { RecordType } from '../../data/projectStatus';

export function PreviewCallLogger({
  recordType,
  recordId,
  projectId,
  ownerUserId,
  actorId,
  onLogged,
}: {
  recordType: RecordType;
  recordId: number;
  projectId: number | null;
  ownerUserId: number | null;
  actorId: string | null;
  /** Called after a successful log so the parent can refresh "Recent calls". */
  onLogged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Remount DispositionForm after each successful log so its draft fully resets.
  const [formKey, setFormKey] = useState(0);

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', padding: '9px 12px', background: 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151' }}>
          <Phone size={13} style={{ color: '#1A7EE8' }} /> Log a call
        </span>
        {open
          ? <ChevronUp size={14} style={{ color: '#9CA3AF' }} />
          : <ChevronDown size={14} style={{ color: '#9CA3AF' }} />}
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ paddingTop: 10 }}>
            <DispositionForm
              key={formKey}
              recordType={recordType}
              recordId={recordId}
              projectId={projectId}
              ownerUserId={ownerUserId}
              actorId={actorId}
              onLogged={() => {
                setFormKey((k) => k + 1);
                onLogged?.();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PreviewCallLogger;
