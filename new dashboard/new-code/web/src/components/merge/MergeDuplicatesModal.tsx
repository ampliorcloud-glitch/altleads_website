/**
 * Merge-duplicates modal (ALT-293) — admin-only.
 *
 * Side-by-side comparison of two duplicate records (companies OR contacts), a
 * radio to pick the SURVIVOR, a plain-language warning of what merging does
 * (loser is soft-deleted, all its children re-pointed to the survivor), and a
 * type-to-confirm gate before it runs.
 *
 * Admin-only is enforced by the CALLER (this modal should only be opened for an
 * admin). We still take `actor` (the acting user_id as TEXT) and pass it through
 * to the merge fn, which maps a 42501 RLS rejection to a friendly "admin only".
 *
 * Reuses the app's ModalShell (backdrop + focus-trap + title) and Toast.
 * Dependency-free beyond what the app already uses (React + lucide-react).
 */
import React, { useMemo, useState } from 'react';
import { GitMerge, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { ModalShell } from '../wishlist/AssignModal';
import { useToast } from '../ui/Toast';
import { mergeCompanies, mergeContacts, type MergeResult } from '../../data/merge';

/* The fields we know how to show for each record type. Records are passed in by
   the caller (Company from companies.ts, Contact from contacts.ts) — we only
   read fields, so we accept a permissive shape and pull what we recognise. */
type AnyRecord = Record<string, unknown>;

export interface MergeDuplicatesModalProps {
  type: 'company' | 'contact';
  recordA: AnyRecord;
  recordB: AnyRecord;
  /** Acting user_id as TEXT (audit + RLS). Caller has already gated to admins. */
  actor: string | null;
  onClose: () => void;
  /** Called after a successful merge with the survivor's id (string). */
  onMerged: (survivorId: string) => void;
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** id for a record — companies expose `id`, contacts expose `contact_id`. */
function recordId(type: 'company' | 'contact', r: AnyRecord): string {
  if (type === 'company') return str(r.id ?? r.company_id);
  return str(r.contact_id ?? r.id);
}

/** Display name — companies use `name`, contacts use `full_name`. */
function recordName(type: 'company' | 'contact', r: AnyRecord): string {
  const n = type === 'company' ? r.name : r.full_name;
  return str(n) || '(no name)';
}

/** The labelled fields we line up side-by-side, per record type. */
function comparisonFields(type: 'company' | 'contact'): Array<{ label: string; key: string }> {
  if (type === 'company') {
    return [
      { label: 'Name', key: 'name' },
      { label: 'Website', key: 'webUrl' },
      { label: 'Domain', key: 'domainClean' },
      { label: 'CIN', key: 'cin' },
      { label: 'Industry', key: 'industry' },
      { label: 'City', key: 'city' },
      { label: 'Email', key: 'email' },
      { label: 'LinkedIn', key: 'linkedin' },
      { label: 'Created', key: 'createdDate' },
    ];
  }
  return [
    { label: 'Name', key: 'full_name' },
    { label: 'Designation', key: 'designation' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'mobile_no' },
    { label: 'Alt phone', key: 'alt_mobile_no' },
    { label: 'LinkedIn', key: 'linkedin_url' },
    { label: 'Company', key: 'company_name' },
    { label: 'City', key: 'city_name' },
    { label: 'Created', key: 'created_date' },
  ];
}

/* ── component ─────────────────────────────────────────────────────────────── */

const CONFIRM_PHRASE = 'MERGE';

export function MergeDuplicatesModal({
  type,
  recordA,
  recordB,
  actor,
  onClose,
  onMerged,
}: MergeDuplicatesModalProps) {
  const toast = useToast();

  const idA = recordId(type, recordA);
  const idB = recordId(type, recordB);

  // Default survivor = the FIRST record passed in.
  const [survivorId, setSurvivorId] = useState<string>(idA);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => comparisonFields(type), [type]);

  const survivorRec = survivorId === idA ? recordA : recordB;
  const loserId = survivorId === idA ? idB : idA;
  const loserRec = survivorId === idA ? recordB : recordA;

  const sameRecord = idA === idB;
  const phraseOk = typed.trim().toUpperCase() === CONFIRM_PHRASE;
  const canMerge = !busy && !sameRecord && phraseOk && survivorId !== loserId;

  const noun = type === 'company' ? 'company' : 'contact';

  async function handleMerge() {
    if (!canMerge) return;
    setBusy(true);
    setError(null);
    let res: MergeResult;
    if (type === 'company') {
      res = await mergeCompanies({ survivorId, loserId, actor });
    } else {
      res = await mergeContacts({ survivorId, loserId, actor });
    }
    setBusy(false);

    if (!res.ok) {
      setError(res.error ?? 'Merge failed.');
      toast.error(res.error ?? 'Merge failed.');
      return;
    }

    const moved = Object.values(res.repointed).reduce((a, b) => a + b, 0);
    toast.success(
      `Merged. Re-pointed ${moved} linked ${moved === 1 ? 'record' : 'records'} and removed the duplicate ${noun}.`,
    );
    onMerged(survivorId);
  }

  return (
    <ModalShell
      title={`Merge duplicate ${noun === 'company' ? 'companies' : 'contacts'}`}
      icon={<GitMerge size={16} />}
      onClose={busy ? () => {} : onClose}
      width={640}
    >
      {sameRecord ? (
        <p className="text-red-600" style={{ fontSize: 13 }}>
          These are the same {noun}. Pick two different records to merge.
        </p>
      ) : (
        <>
          <p className="text-stone-500 mb-4" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            Choose which {noun} to <strong>keep</strong>. Everything linked to the other one
            (its contacts, deals, statuses and activity) is moved onto the one you keep, and the
            duplicate is then removed.
          </p>

          {/* ── side-by-side comparison ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[recordA, recordB].map((rec) => {
              const id = recordId(type, rec);
              const isSurvivor = id === survivorId;
              return (
                <label
                  key={id}
                  className="block rounded-lg border cursor-pointer transition-colors"
                  style={{
                    borderColor: isSurvivor ? 'var(--color-brand)' : '#e4e4e7',
                    borderWidth: isSurvivor ? 2 : 1,
                    background: isSurvivor ? 'rgba(0,0,0,0.015)' : '#fff',
                    padding: isSurvivor ? 11 : 12, // keep box size stable across border width
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="radio"
                      name="merge-survivor"
                      value={id}
                      checked={isSurvivor}
                      disabled={busy}
                      onChange={() => setSurvivorId(id)}
                      style={{ accentColor: 'var(--color-brand)' }}
                    />
                    <span className="font-semibold text-stone-900 truncate" style={{ fontSize: 13 }}>
                      {recordName(type, rec)}
                    </span>
                    {isSurvivor && (
                      <span
                        className="ml-auto shrink-0 rounded px-1.5 py-0.5 font-medium"
                        style={{ fontSize: 10, background: 'var(--color-brand)', color: '#fff' }}
                      >
                        KEEP
                      </span>
                    )}
                  </div>
                  <dl className="space-y-1">
                    {fields.map((f) => {
                      const val = str(rec[f.key]);
                      return (
                        <div key={f.key} className="flex gap-2" style={{ fontSize: 11.5 }}>
                          <dt className="text-stone-400 shrink-0" style={{ width: 78 }}>
                            {f.label}
                          </dt>
                          <dd className="text-stone-700 truncate min-w-0" title={val}>
                            {val || <span className="text-stone-300">—</span>}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </label>
              );
            })}
          </div>

          {/* ── what-will-happen warning ────────────────────────────────── */}
          <div
            className="flex gap-2.5 rounded-lg p-3 mb-4"
            style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
          >
            <AlertTriangle size={16} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
              <div className="flex items-center gap-1.5 flex-wrap mb-1 font-medium" style={{ color: '#78350F' }}>
                <span className="truncate" style={{ maxWidth: 200 }}>{recordName(type, loserRec)}</span>
                <ArrowRight size={13} />
                <span className="truncate" style={{ maxWidth: 200 }}>{recordName(type, survivorRec)}</span>
              </div>
              All of <strong>{recordName(type, loserRec)}</strong>'s linked{' '}
              {type === 'company' ? 'contacts, deals, statuses and activity' : 'deals, statuses and activity'}{' '}
              will be re-pointed to <strong>{recordName(type, survivorRec)}</strong>, then the
              duplicate is soft-deleted. <strong>This can't be undone yet</strong> — there is no
              restore UI for a merged-away {noun}. Export both records first if you're unsure.
            </div>
          </div>

          {/* ── type-to-confirm ─────────────────────────────────────────── */}
          <label className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
            Type <span className="font-mono" style={{ color: 'var(--color-brand)' }}>{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            placeholder={`Type "${CONFIRM_PHRASE}"`}
            className="input-brand-focus w-full"
            style={{
              height: 36,
              padding: '0 10px',
              border: '1px solid var(--border-input, #d4d4d8)',
              borderRadius: 6,
              fontSize: 13,
            }}
          />

          {error && (
            <p className="text-red-600 mt-3" style={{ fontSize: 12 }}>
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="border border-stone-300 hover:border-stone-400 bg-white text-stone-700 font-medium rounded-md transition-colors disabled:opacity-50"
              style={{ fontSize: 13, padding: '7px 14px', height: 34 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMerge}
              disabled={!canMerge}
              className="inline-flex items-center gap-1.5 text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed"
              style={{
                fontSize: 13,
                padding: '7px 14px',
                height: 34,
                background: '#DC2626',
                opacity: canMerge ? 1 : 0.5,
              }}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              <GitMerge size={14} />
              Merge {noun === 'company' ? 'companies' : 'contacts'}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

export default MergeDuplicatesModal;
