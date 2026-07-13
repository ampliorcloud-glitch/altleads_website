/**
 * validators.ts — shared, pure form-validation helpers (ALT-199 foundation).
 *
 * No React, no I/O — just predicates and message builders that forms call for
 * on-blur inline feedback. Messages are friendly and non-technical (the people
 * filling these forms are not engineers).
 *
 * Predicates (`isEmail`, `isPhone`, `isUrl`, `isRequired`) answer true/false.
 * `validateField` / `validateForm` turn rule sets into human-readable errors.
 *
 * Usage:
 *   const err = validateField(form.email, { required: true, email: true }, 'Email');
 *   // err === 'Email looks invalid'  (or null when fine)
 *
 *   const errors = validateForm(form, {
 *     name:  { required: true },
 *     email: { required: true, email: true },
 *     phone: { phone: true },
 *   });
 *   // errors === { name: 'Name is required' }  (only the invalid fields)
 */

/* ── Predicates ──────────────────────────────────────────────────── */

/**
 * RFC-ish email check: tolerant of normal addresses but rejects obvious junk
 * (missing @, spaces, no dot in the domain, dangling dots). Not a full RFC 5322
 * parser on purpose — that would reject perfectly good addresses people type.
 */
export function isEmail(v: string): boolean {
  const s = (v ?? '').trim();
  if (!s || s.length > 254) return false;
  // local-part @ domain.tld — no spaces, no consecutive/leading/trailing dots in
  // the local-part, and a TLD of at least two letters.
  const re =
    /^[^\s@.]+(?:\.[^\s@.]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return re.test(s);
}

/**
 * Phone check tolerant of Indian + international formats. Allows a leading +,
 * spaces, hyphens, parentheses and dots as separators, and requires 7–15
 * actual digits (the E.164 cap is 15). Letters or other symbols fail.
 */
export function isPhone(v: string): boolean {
  const s = (v ?? '').trim();
  if (!s) return false;
  // Only digits and the allowed separators may appear.
  if (!/^[+\d\s().-]+$/.test(s)) return false;
  // A '+' is only meaningful at the very start.
  if (s.includes('+') && s.indexOf('+') !== 0) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * URL check that accepts full http(s) URLs *and* bare domains (example.com,
 * www.example.co.in/path). Tries the URL constructor first; if that fails
 * (because there's no scheme), falls back to a domain-shaped regex.
 */
export function isUrl(v: string): boolean {
  const s = (v ?? '').trim();
  if (!s || /\s/.test(s)) return false;

  // Full URLs: must be http/https and have a dotted host.
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(u.hostname) || u.hostname === 'localhost';
    }
    return false;
  } catch {
    // Not a parseable URL — fall through to the bare-domain check below.
  }

  // Bare domain like example.com or sub.example.co.in, optionally with a path.
  const re =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:[/?#]\S*)?$/;
  return re.test(s);
}

/**
 * True when a value is meaningfully present. Null, undefined, empty strings and
 * whitespace-only strings are all considered "missing".
 */
export function isRequired(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/* ── Rule types ──────────────────────────────────────────────────── */

/** A custom validator: return an error message, or null when the value is fine. */
export type Validator = (value: string) => string | null;

/** Declarative rule set for a single field. Rules are applied in a fixed order. */
export interface FieldRules {
  required?: boolean;
  email?: boolean;
  phone?: boolean;
  url?: boolean;
  minLen?: number;
  maxLen?: number;
  custom?: Validator;
}

/* ── Field + form validation ─────────────────────────────────────── */

/**
 * Validate one value against its rules and return the FIRST problem as a
 * friendly message, or null when everything checks out.
 *
 * Order: required → minLen → maxLen → email → phone → url → custom.
 * Format checks (email/phone/url) are skipped when the value is blank so an
 * optional-but-must-be-valid field doesn't nag before the user types anything.
 */
export function validateField(
  value: string,
  rules: FieldRules,
  label = 'This field',
): string | null {
  const v = value ?? '';

  if (rules.required && !isRequired(v)) {
    return `${label} is required`;
  }

  const trimmed = v.trim();

  // Length rules apply to the trimmed value when it isn't empty. (If a value is
  // blank and not required, length checks are pointless.)
  if (trimmed) {
    if (typeof rules.minLen === 'number' && trimmed.length < rules.minLen) {
      return `${label} must be at least ${rules.minLen} characters`;
    }
    if (typeof rules.maxLen === 'number' && trimmed.length > rules.maxLen) {
      return `${label} must be ${rules.maxLen} characters or fewer`;
    }
  }

  // Format checks only run when there's something to check.
  if (trimmed) {
    if (rules.email && !isEmail(trimmed)) {
      return 'Email looks invalid';
    }
    if (rules.phone && !isPhone(trimmed)) {
      return 'Phone number looks invalid';
    }
    if (rules.url && !isUrl(trimmed)) {
      return 'Web address looks invalid';
    }
  }

  if (rules.custom) {
    return rules.custom(v);
  }

  return null;
}

/**
 * Validate a whole form. Runs each value through `validateField` using the
 * matching rule set and returns a map containing ONLY the fields that failed
 * (so `Object.keys(errors).length === 0` means the form is valid).
 */
export function validateForm<T extends Record<string, string>>(
  values: T,
  schema: Partial<Record<keyof T, FieldRules>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};

  (Object.keys(schema) as Array<keyof T>).forEach((key) => {
    const rules = schema[key];
    if (!rules) return;
    const error = validateField(values[key] ?? '', rules, undefined);
    if (error) errors[key] = error;
  });

  return errors;
}
