/**
 * humanizeWriteError — turn a raw Supabase/Postgres write error into a friendly,
 * user-safe message. One source so every write path (data layer, previews,
 * detail pages, modals) shows the same plain-language line instead of leaking
 * "new row violates row-level security policy … 42501" or "Could not find the
 * table 'public.call_log' in the schema cache" to an outreach user.
 *
 * - RLS / permission (42501) → "you can only edit records assigned to you"
 * - Missing table / schema-cache (42P01 / PGRST205) → "not enabled yet"
 * - Anything already-friendly (our data layer returns plain strings) passes through.
 *
 * Pass either the raw error string or an Error/PostgrestError-like object.
 */
export function humanizeWriteError(
  err: string | { message?: string; code?: string } | null | undefined,
): string | null {
  if (!err) return null;
  const code = typeof err === 'object' ? (err.code ?? '') : '';
  const msg = typeof err === 'string' ? err : (err.message ?? '');
  const hay = `${code} ${msg}`;

  if (/\b42501\b|row-level security|violates row-level security|permission denied/i.test(hay)) {
    return 'You can only edit records assigned to you.';
  }
  if (/\b42P01\b|PGRST205|schema cache|could not find the table|relation .* does not exist/i.test(hay)) {
    return "This feature isn't enabled yet — please contact an admin.";
  }
  // Already a friendly, app-authored message (our writers return plain strings).
  return msg || 'Something went wrong. Please try again.';
}

export default humanizeWriteError;
