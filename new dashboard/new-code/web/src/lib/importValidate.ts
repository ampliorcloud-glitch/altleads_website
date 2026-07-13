/**
 * importValidate — turn parsed source rows + a column mapping into the
 * "mapped, validated" set the Import Wizard previews (ALT-399 / ALT-418).
 *
 * Pure functions, no writes. Every row is projected onto its target fields,
 * then checked for: at least one required identifier present, plus basic
 * email / phone / url format on fields that declare it. Rows that fail land in
 * `skipped` with per-row reasons — the surface ALT-418 asked for.
 */
import {
  IGNORE_FIELD,
  type ColumnMapping,
  type EntityDef,
  type TargetField,
} from './importMapping';

/** A source row projected onto target-field keys. */
export type MappedRow = Record<string, string>;

export interface SkippedRow {
  /** 0-based index into the parsed data rows (caller can +1 for display). */
  rowIndex: number;
  /** The mapped values, so the UI/download can echo what was skipped. */
  values: MappedRow;
  errors: string[];
}

export interface ValidationResult {
  /** Target field keys that are actually mapped (for column ordering). */
  mappedFieldKeys: string[];
  validRows: MappedRow[];
  skipped: SkippedRow[];
}

// Deliberately lenient, presentational checks — the authoritative validation
// belongs to the server import endpoint. These only catch obvious junk so the
// preview is honest.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts +, spaces, dashes, parens, dots; needs at least 7 digits overall.
const PHONE_DIGITS_RE = /\d/g;
const URL_RE = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i;

function fieldError(field: TargetField, value: string): string | null {
  if (!value) return null; // emptiness is handled by the required-identifier check
  switch (field.validate) {
    case 'email':
      return EMAIL_RE.test(value) ? null : `Invalid email "${value}" in ${field.label}`;
    case 'phone': {
      const digits = (value.match(PHONE_DIGITS_RE) ?? []).length;
      return digits >= 7 ? null : `Invalid phone "${value}" in ${field.label}`;
    }
    case 'url':
      return URL_RE.test(value) ? null : `Invalid URL "${value}" in ${field.label}`;
    default:
      return null;
  }
}

/**
 * Project + validate. `rows` are the parsed source rows (keyed by source
 * header); `mappings` says which header feeds which target field.
 */
export function validateRows(
  rows: Record<string, string>[],
  mappings: ColumnMapping[],
  entity: EntityDef,
): ValidationResult {
  const active = mappings.filter((m) => m.targetField !== IGNORE_FIELD);
  const mappedFieldKeys = active.map((m) => m.targetField);

  const fieldByKey = new Map<string, TargetField>(entity.fields.map((f) => [f.key, f]));
  const requiredFields = entity.fields.filter((f) => f.required);
  // Which required fields are actually mapped — if none are, every row will be
  // skipped, and the wizard warns the user up front via this signal.
  const mappedRequired = requiredFields.filter((f) => mappedFieldKeys.includes(f.key));

  const validRows: MappedRow[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((srcRow, rowIndex) => {
    const values: MappedRow = {};
    for (const m of active) {
      values[m.targetField] = srcRow[m.sourceHeader] ?? '';
    }

    const errors: string[] = [];

    // Required-identifier presence: at least one mapped required field non-blank.
    if (mappedRequired.length === 0) {
      errors.push(
        requiredFields.length
          ? `No identifier column mapped (need ${requiredFields.map((f) => f.label).join(' or ')})`
          : 'No columns mapped',
      );
    } else {
      const hasIdentifier = mappedRequired.some((f) => (values[f.key] ?? '').trim() !== '');
      if (!hasIdentifier) {
        errors.push(`Missing ${mappedRequired.map((f) => f.label).join(' / ')}`);
      }
    }

    // Format checks on every mapped field that declares a validator.
    for (const key of mappedFieldKeys) {
      const field = fieldByKey.get(key);
      if (!field) continue;
      const err = fieldError(field, (values[key] ?? '').trim());
      if (err) errors.push(err);
    }

    if (errors.length) {
      skipped.push({ rowIndex, values, errors });
    } else {
      validRows.push(values);
    }
  });

  return { mappedFieldKeys, validRows, skipped };
}
