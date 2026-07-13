/**
 * Client Portal — BRAND SEAM (white-label, data-free).
 *
 * The Client Portal is **Amplior**-branded by default (the internal CRM stays
 * AltLeads). Brand is resolved from, in priority order:
 *   1. VITE_BRAND build-time env (set per deploy) — 'amplior' | 'altleads'.
 *   2. the hostname (e.g. an *.altleads.* host → altleads), else
 *   3. the default → 'amplior'.
 *
 * Brand isolation is absolute: a portal build never references the other brand's
 * assets/copy. This module carries NO data and NO queries — it is safe to share.
 */

export type BrandKey = 'amplior' | 'altleads';

export interface Brand {
  key: BrandKey;
  /** Display name used in copy / titles / emails. */
  name: string;
  /** Wordmark text for the header logo. */
  logoText: string;
  /** Accent colour (CSS hex) for primary actions / header. */
  accent: string;
}

const BRANDS: Record<BrandKey, Brand> = {
  amplior: {
    key: 'amplior',
    name: 'Amplior',
    logoText: 'Amplior',
    accent: '#1A7EE8',
  },
  altleads: {
    key: 'altleads',
    name: 'AltLeads',
    logoText: 'AltLeads',
    accent: '#1A7EE8',
  },
};

const DEFAULT_BRAND: BrandKey = 'amplior';

/** Normalise an arbitrary string into a known BrandKey, or null if unrecognised. */
function asBrandKey(value: string | null | undefined): BrandKey | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === 'amplior' || v === 'altleads') return v;
  return null;
}

/**
 * Resolve the active brand. Pure + deterministic per environment so it is safe to
 * call from render without a provider. (No React state needed; the result only
 * changes when the deploy/host changes.)
 */
function resolveBrand(): Brand {
  // 1. Build-time env wins (set per deploy). vite/client types env values as `any`.
  const envBrand = asBrandKey(import.meta.env.VITE_BRAND as string | undefined);
  if (envBrand) return BRANDS[envBrand];

  // 2. Hostname heuristic — an altleads host serves the AltLeads brand.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('altleads')) return BRANDS.altleads;
    if (host.includes('amplior')) return BRANDS.amplior;
  }

  // 3. Default → Amplior.
  return BRANDS[DEFAULT_BRAND];
}

/**
 * useBrand() — returns the resolved brand for the current deploy/host.
 * Stable for the lifetime of the page (brand cannot change mid-session).
 */
export function useBrand(): Brand {
  return resolveBrand();
}
