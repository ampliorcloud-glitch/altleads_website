/**
 * companyHierarchyFlag.ts — ALT-469 (parent company / account hierarchy).
 *
 * While COMPANY_HIERARCHY is false the CompanyHierarchyCard never mounts and the
 * `parent_company_id` column is never queried, so production is unchanged.
 *
 * Enable: apply `apply-company-hierarchy.cjs` (after sign-off) → flip this flag →
 * rebuild. The new column inherits company_master's existing RLS.
 */
export const COMPANY_HIERARCHY = false;
