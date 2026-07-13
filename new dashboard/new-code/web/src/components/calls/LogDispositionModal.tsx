/**
 * LogDispositionModal — "Log a call" modal that writes to the live
 * `interaction` table via DispositionForm / logDisposition().
 *
 * Drop-in replacement for LogCallModal on detail pages. LogCallModal writes to
 * `public.call_log` which was never migrated to production, so every save
 * attempt errored. This modal uses the same write-path as DispositionForm
 * (interaction rows of type `call`) — the same path the entire preview system
 * reads from (CallLogPreview / fetchCallLogs / callLogs.ts).
 *
 * Props:
 *   open          whether the modal is open
 *   onClose       close callback (modal handles dirty-check internally)
 *   recordType    'lead' | 'company' | 'contact' | 'meeting'
 *   recordId      numeric id of the record being logged against
 *   projectId     project scope (null = unscoped)
 *   ownerUserId   owner user_id stamped on the interaction row
 *   actorId       acting user_id as text (created_by); from auth profile
 *   onLogged      called after a successful save (no payload — caller bumps
 *                 a refresh signal)
 */
import { useEffect, useState } from 'react';
import { Modal, GhostButton } from '../admin/Modal';
import { DispositionForm } from '../ui/DispositionForm';
import type { RecordType } from '../../data/projectStatus';

export interface LogDispositionModalProps {
  open: boolean;
  onClose: () => void;
  recordType: RecordType;
  recordId: number;
  projectId?: number | null;
  ownerUserId?: number | null;
  actorId?: string | null;
  /**
   * Called after the call is successfully logged.
   * Receives the interactionId of the new interaction row so callers can
   * link it to a task (ALT-430 auto-complete flow). May be undefined when
   * the interaction row's id is unavailable.
   */
  onLogged?: (interactionId?: number | null) => void;
}

export function LogDispositionModal({
  open,
  onClose,
  recordType,
  recordId,
  projectId = null,
  ownerUserId = null,
  actorId = null,
  onLogged,
}: LogDispositionModalProps) {
  // Remount DispositionForm each time the modal opens so draft state is fresh.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) setFormKey((k) => k + 1);
  }, [open]);

  return (
    <Modal
      open={open}
      title="Log a call"
      onClose={onClose}
      width={460}
      footer={
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      }
    >
      <DispositionForm
        key={formKey}
        recordType={recordType}
        recordId={recordId}
        projectId={projectId}
        ownerUserId={ownerUserId}
        actorId={actorId}
        onLogged={({ interactionId }) => {
          onLogged?.(interactionId);
          onClose();
        }}
      />
    </Modal>
  );
}

export default LogDispositionModal;
