/**
 * shared/normalizeLinkedin.ts
 *
 * Produces the canonical linkedin_clean slug that the CRM stores in
 * contact_master.linkedin_clean.  The match RPC (find_contact_dup) does an
 * EXACT `=` comparison, so the slug this function outputs must be byte-identical
 * to what the migration stored via `lower(regexp_replace(...))`.
 *
 * Algorithm (locked in docs/chrome-extension-rebuild/02-MIGRATION-BLUEPRINT.md §4):
 *   1. trim whitespace
 *   2. lowercase the whole string             ← the fix vs the old deriveLinkedinClean()
 *   3. strip leading "https://" or "http://"
 *   4. strip leading "www."
 *   5. strip leading "linkedin.com/in/"
 *   6. cut at the first "?" or "#" (drop query string / fragment)
 *   7. split on "/" and keep ONLY the first segment
 *      (so ".../in/john-doe/details/experience" → "john-doe")
 *   8. strip any trailing "/"
 *   9. trim again
 *
 * Returns '' (empty string) if the URL is not a /in/ profile URL.
 * Returns '' for null / undefined / empty input.
 *
 * Self-test examples (inline — these are NOT runtime tests, just documentation):
 *
 *   normalizeLinkedinSlug('https://www.linkedin.com/in/John-Doe/')
 *   → 'john-doe'
 *
 *   normalizeLinkedinSlug('https://linkedin.com/in/john-doe?trk=nav_responsive_tab_profile')
 *   → 'john-doe'
 *
 *   normalizeLinkedinSlug('https://www.linkedin.com/in/john-doe/details/experience/')
 *   → 'john-doe'
 *
 *   normalizeLinkedinSlug('https://www.linkedin.com/in/JANE-SMITH/')
 *   → 'jane-smith'
 *
 *   normalizeLinkedinSlug('https://www.linkedin.com/company/acme-corp/')
 *   → ''   (company page, not a /in/ profile)
 *
 *   normalizeLinkedinSlug('')
 *   → ''
 *
 *   normalizeLinkedinSlug(null)
 *   → ''
 */
export function normalizeLinkedinSlug(url: string | null | undefined): string {
  if (!url) return '';

  let s = url.trim().toLowerCase();

  // Must contain linkedin.com/in/ to be a person profile
  if (!s.includes('linkedin.com/in/')) return '';

  // Strip protocol
  s = s.replace(/^https?:\/\//, '');

  // Strip www.
  s = s.replace(/^www\./, '');

  // Strip "linkedin.com/in/"
  s = s.replace(/^linkedin\.com\/in\//, '');

  // Drop query string and fragment
  const qIdx = s.indexOf('?');
  if (qIdx !== -1) s = s.substring(0, qIdx);
  const hIdx = s.indexOf('#');
  if (hIdx !== -1) s = s.substring(0, hIdx);

  // Keep only the first path segment (handles sub-paths like /details/experience)
  const segments = s.split('/');
  s = segments[0] ?? '';

  // Strip trailing slash (belt-and-braces after split) and trim
  s = s.replace(/\/$/, '').trim();

  return s;
}
