/**
 * streamFlag.ts — ALT-476 (record stream / chatter + follow).
 *
 * While STREAM_V1 is false the StreamPanel never mounts and stream_note /
 * record_follow are never queried, so production is unchanged.
 *
 * Enable: apply `apply-record-stream.cjs` (after sign-off) → flip this flag →
 * rebuild. @mention / follower notifications additionally require the
 * NOTIFICATIONS flag (createNotification no-ops otherwise — graceful degradation).
 */
export const STREAM_V1 = false;

/** Map a record type to its client-side detail route base. */
export function recordRouteBase(entityType: 'lead' | 'contact' | 'company' | 'meeting'): string {
  switch (entityType) {
    case 'lead':
      return '/leads';
    case 'contact':
      return '/contacts';
    case 'company':
      return '/companies';
    case 'meeting':
      return '/meetings';
  }
}
