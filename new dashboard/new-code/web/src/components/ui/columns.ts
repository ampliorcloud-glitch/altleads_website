/**
 * Shared column shape used across list pages, the ColumnCustomizer and the
 * ExportButton so every page describes its columns the same way.
 *
 * - key          stable identifier, also the row accessor key.
 * - header       human label shown in the header / customizer / export.
 * - defaultVisible  whether the column is shown when no saved view exists
 *                   (defaults to true when omitted).
 *
 * `accessor` is optional and only used by ExportButton to derive a cell value
 * for a row; pages that pass plain objects can omit it (the exporter falls back
 * to row[key]).
 */

export interface ColumnDef<Row = Record<string, unknown>> {
  key: string;
  header: string;
  defaultVisible?: boolean;
  /** Optional value extractor for export; defaults to row[key]. */
  accessor?: (row: Row) => unknown;
}

/** Minimal column shape the ExportButton needs. */
export interface ExportColumn<Row = Record<string, unknown>> {
  key: string;
  header: string;
  accessor?: (row: Row) => unknown;
}
