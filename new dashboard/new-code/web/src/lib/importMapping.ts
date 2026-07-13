/**
 * importMapping — auto-match a parsed file's source columns to a target
 * entity's fields for the in-app Import Wizard (ALT-399). Pure data, no writes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER FIELD CATALOG
 * The per-entity field lists below are an OBVIOUS, hand-written placeholder so
 * the wizard is usable end-to-end today. The REAL, authoritative field metadata
 * (full column set, types, which fields are writable, the match key, lookups for
 * project/owner, etc.) will come later from the server-side import endpoint /
 * schema introspection — once that exists, swap ENTITY_CATALOGS for the real
 * catalog and the rest of the wizard keeps working unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** The sentinel target meaning "leave this source column out of the import". */
export const IGNORE_FIELD = '__ignore__';

export type ValidationKind = 'email' | 'phone' | 'url' | 'text';

export interface TargetField {
  /** Stable key written to the import payload (placeholder names for now). */
  key: string;
  /** Human label shown in the mapping dropdown. */
  label: string;
  /** Whether at least one of the entity's `required` fields must be present. */
  required?: boolean;
  /** Drives per-cell validation in importValidate. */
  validate?: ValidationKind;
  /** Extra header spellings that should auto-match to this field. */
  aliases?: string[];
}

export interface EntityDef {
  key: string;
  label: string;
  fields: TargetField[];
}

/** PLACEHOLDER catalogs — see file header. Keep fields obvious + easy to extend. */
// FIELD KEYS = REAL DB COLUMNS (fixed 2026-07-02). The import engine whitelists
// by actual column name (importEngine.js WRITABLE_COLUMNS) and silently drops
// anything else — the earlier friendly keys ('name', 'phone', 'website') never
// reached the DB. Keys below are the writable columns; labels stay friendly.
// Special NON-COLUMN keys resolved server-side by the engine:
//   company     → company_id   (bulk name match; unresolved = warning)
//   project     → project_id   (leads; bulk project_name match; REQUIRED for new leads)
//   assigned_to → lead_report.user_id (ALT-499; user id | email | full name)
export const ENTITY_CATALOGS: EntityDef[] = [
  {
    key: 'companies',
    label: 'Companies',
    fields: [
      { key: 'company_name', label: 'Company name', required: true, aliases: ['name', 'company', 'company name', 'organisation', 'organization', 'account'] },
      { key: 'company_web_url', label: 'Website', validate: 'url', aliases: ['website', 'url', 'site', 'web'] },
      { key: 'domain_clean', label: 'Domain', aliases: ['domain'] },
      { key: 'email', label: 'Email', validate: 'email', aliases: ['email address'] },
      { key: 'linkedin_url', label: 'LinkedIn URL', validate: 'url', aliases: ['linkedin', 'linkedin page'] },
      { key: 'company_size', label: 'Employees', aliases: ['headcount', 'size', 'employee count', 'employees'] },
      { key: 'cin_number', label: 'CIN number', aliases: ['cin'] },
      { key: 'description', label: 'Description', aliases: ['about', 'notes'] },
      // ALT-505 (ADR-32: beta imports COMPANIES): project bucket + owner at import
      // time — seeds company_project_status server-side; not company_master columns.
      { key: 'project', label: 'Project (name — links & buckets the company)', aliases: ['project name', 'campaign'] },
      { key: 'assigned_to', label: 'Assigned To (user id, email or full name)', aliases: ['owner', 'assignee', 'agent', 'assigned'] },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    fields: [
      { key: 'full_name', label: 'Full name', required: true, aliases: ['name', 'contact', 'contact name', 'person', 'first name', 'last name'] },
      { key: 'email', label: 'Email', validate: 'email', aliases: ['email address', 'e-mail'] },
      { key: 'mobile_no', label: 'Phone', validate: 'phone', aliases: ['phone', 'mobile', 'telephone', 'contact number'] },
      { key: 'alt_mobile_no', label: 'Alt phone', validate: 'phone', aliases: ['alt mobile', 'alternate phone', 'phone 2'] },
      { key: 'company', label: 'Company (name → linked)', aliases: ['company name', 'organisation', 'organization', 'account'] },
      // Ankit 2026-07-02: export→import round-trip linking — map the exported
      // company Record ID directly (exact, collision-proof; beats name match).
      { key: 'company_id', label: 'Company Record ID', aliases: ['company id', 'company record id', 'companyid'] },
      { key: 'designation', label: 'Designation', aliases: ['title', 'job title', 'role', 'position'] },
      { key: 'linkedin_url', label: 'LinkedIn URL', validate: 'url', aliases: ['linkedin', 'linkedin profile'] },
    ],
  },
  {
    key: 'leads',
    label: 'Leads',
    fields: [
      { key: 'lead_name', label: 'Lead / contact name', required: true, aliases: ['name', 'contact', 'contact name', 'person', 'prospect', 'lead'] },
      { key: 'project', label: 'Project (name → linked)', aliases: ['project name', 'client project', 'campaign project'] },
      { key: 'company', label: 'Company (name → linked)', aliases: ['company name', 'organisation', 'organization', 'account'] },
      { key: 'company_id', label: 'Company Record ID', aliases: ['company id', 'company record id', 'companyid'] },
      { key: 'email', label: 'Email', validate: 'email', aliases: ['email address', 'e-mail'] },
      { key: 'mobile_no', label: 'Phone', validate: 'phone', aliases: ['phone', 'mobile', 'telephone', 'contact number'] },
      { key: 'designation', label: 'Designation', aliases: ['title', 'job title', 'role'] },
      { key: 'stage', label: 'Stage', aliases: ['status', 'lead status'] },
      { key: 'description', label: 'Notes', aliases: ['notes', 'remark', 'remarks', 'comment', 'comments'] },
      // ALT-470 — UTM / lead attribution. Maps onto lead_master.utm_* (staged migration).
      { key: 'utm_source', label: 'UTM Source', aliases: ['utm source', 'utm_source', 'campaign source'] },
      { key: 'utm_medium', label: 'UTM Medium', aliases: ['utm medium', 'utm_medium', 'campaign medium'] },
      { key: 'utm_campaign', label: 'UTM Campaign', aliases: ['utm campaign', 'utm_campaign', 'campaign', 'campaign name'] },
      // ALT-499 — assignment at import. Server resolves user_id | email | full name
      // to lead_report.user_id; unresolved values import UNASSIGNED with a warning.
      { key: 'assigned_to', label: 'Assigned To', aliases: ['owner', 'assigned to', 'salesperson', 'agent', 'agent email', 'assignee', 'rep'] },
    ],
  },
];

export function getEntityDef(entityKey: string): EntityDef | undefined {
  return ENTITY_CATALOGS.find((e) => e.key === entityKey);
}

export interface ColumnMapping {
  sourceHeader: string;
  /** A target field key, or IGNORE_FIELD to skip the column. */
  targetField: string;
}

/** Normalise a header/field name for fuzzy comparison (case/space/punct-insensitive). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Auto-match source headers to target fields. A header matches a field when its
 * normalised form equals the field's normalised key, label, or any alias. Each
 * target field is claimed at most once (first matching header wins); unmatched
 * headers default to IGNORE_FIELD.
 */
export function autoMap(headers: string[], entity: EntityDef): ColumnMapping[] {
  // Build a normalised lookup: candidate string → field key.
  const lookup = new Map<string, string>();
  for (const f of entity.fields) {
    const candidates = [f.key, f.label, ...(f.aliases ?? [])];
    for (const c of candidates) {
      const n = norm(c);
      if (n && !lookup.has(n)) lookup.set(n, f.key);
    }
  }

  const claimed = new Set<string>();
  return headers.map((h) => {
    const fieldKey = lookup.get(norm(h));
    if (fieldKey && !claimed.has(fieldKey)) {
      claimed.add(fieldKey);
      return { sourceHeader: h, targetField: fieldKey };
    }
    return { sourceHeader: h, targetField: IGNORE_FIELD };
  });
}

/** Headers that ended up unmapped (target = IGNORE_FIELD) — surfaced in the UI. */
export function unmappedHeaders(mappings: ColumnMapping[]): string[] {
  return mappings.filter((m) => m.targetField === IGNORE_FIELD).map((m) => m.sourceHeader);
}
