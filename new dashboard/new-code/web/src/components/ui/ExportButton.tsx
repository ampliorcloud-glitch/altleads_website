/**
 * ExportButton — export rows to Excel (.xlsx via SheetJS) or CSV via a small menu.
 *
 * If `selectedIds` is provided and non-empty, only those rows are exported;
 * otherwise all `rows` are exported. The row id is read from `idKey` (default
 * 'id'). Columns control which fields export and their header labels; a column
 * may supply an `accessor` to derive its cell value, else row[key] is used.
 *
 * Props:
 *   rows          the full data set
 *   columns       { key, header, accessor? }[]  (ExportColumn / ColumnDef)
 *   filename      base filename (no extension)
 *   selectedIds?  Set of selected ids; when non-empty, limits the export
 *   idKey?        which row key holds the id (default 'id')
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ExportColumn } from './columns';
import type { SelectableId } from './useRowSelection';
import { useToast } from './Toast';

interface Props<Row extends Record<string, unknown>> {
  rows: Row[];
  columns: ExportColumn<Row>[];
  filename: string;
  selectedIds?: Set<SelectableId>;
  idKey?: string;
  /**
   * Header for the always-prepended Record-ID column (e.g. "Company ID").
   * The exported sheet leads with the stable record id so it can be edited
   * and later re-imported using that id as the match key — exactly how
   * HubSpot ("Record ID") and Zoho ("<Module> Id") make the export double as
   * the import template. Defaults to "Record ID".
   */
  idHeader?: string;
  disabled?: boolean;
  /**
   * Optional async hook called BEFORE building the export matrix. When
   * provided it must return the full (enriched) row set to export — this
   * supersedes the `rows` prop so callers can lazily load missing data
   * (e.g. per-project status for off-page rows) right before the download.
   * The button shows a brief loading state while awaiting. Returning `null`
   * aborts the export silently.
   */
  getRows?: () => Promise<Row[] | null>;
}

function cellValue<Row extends Record<string, unknown>>(row: Row, col: ExportColumn<Row>): unknown {
  const raw = col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key];
  if (raw == null) return '';
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object') return JSON.stringify(raw);
  return raw;
}

function pickRows<Row extends Record<string, unknown>>(
  rows: Row[],
  selectedIds: Set<SelectableId> | undefined,
  idKey: string,
): Row[] {
  if (!selectedIds || selectedIds.size === 0) return rows;
  return rows.filter((r) => selectedIds.has((r as Record<string, unknown>)[idKey] as SelectableId));
}

/**
 * Neutralise CSV / Excel formula injection. A cell whose text starts with a
 * formula trigger (= + - @, or a leading tab / carriage-return) can be executed
 * by Excel / Google Sheets when the file is opened — a real exfiltration / RCE
 * vector for data a CRM exports. We prefix such cells with a single quote so the
 * spreadsheet shows them as literal text. Applies to BOTH the CSV and XLSX paths
 * (numbers/booleans are never at risk, so only strings are touched).
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
function sanitizeCell(v: string | number | boolean): string | number | boolean {
  return typeof v === 'string' && FORMULA_LEAD.test(v) ? `'${v}` : v;
}

function toMatrix<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: ExportColumn<Row>[],
): (string | number | boolean)[][] {
  const header = columns.map((c) => c.header);
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = cellValue(row, c);
      const cell = (typeof v === 'number' || typeof v === 'boolean' ? v : String(v)) as
        | string
        | number
        | boolean;
      return sanitizeCell(cell);
    }),
  );
  return [header, ...body];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportButton<Row extends Record<string, unknown>>({
  rows,
  columns,
  filename,
  selectedIds,
  idKey = 'id',
  idHeader = 'Record ID',
  disabled = false,
  getRows,
}: Props<Row>) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Always lead the export with the stable record id so the sheet round-trips
  // (export → edit → re-import keyed on this id). Skip only if the caller's
  // own columns already surface that id key, so we never duplicate it.
  const exportColumns = React.useMemo<ExportColumn<Row>[]>(() => {
    if (columns.some((c) => c.key === idKey)) return columns;
    return [{ key: idKey, header: idHeader }, ...columns];
  }, [columns, idKey, idHeader]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function exportExcel() {
    setOpen(false);
    try {
      setExporting(true);
      const source = getRows ? (await getRows()) : rows;
      if (source === null) return; // caller aborted
      const data = pickRows(source, selectedIds, idKey);
      const matrix = toMatrix(data, exportColumns);
      const ws = XLSX.utils.aoa_to_sheet(matrix);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Export');
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success('Exported ' + data.length + ' rows');
    } catch {
      toast.error('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function exportCsv() {
    setOpen(false);
    try {
      setExporting(true);
      const source = getRows ? (await getRows()) : rows;
      if (source === null) return; // caller aborted
      const data = pickRows(source, selectedIds, idKey);
      const matrix = toMatrix(data, exportColumns);
      const csv = matrix
        .map((line) =>
          line
            .map((cell) => {
              const s = String(cell ?? '');
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(','),
        )
        .join('\r\n');
      downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
      toast.success('Exported ' + data.length + ' rows');
    } catch {
      toast.error('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  }

  const selectedCount = selectedIds?.size ?? 0;
  const isDisabled = disabled || exporting;
  const label = exporting ? 'Exporting…' : (selectedCount > 0 ? `Export (${selectedCount})` : 'Export');

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 12px',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    height: 32,
    opacity: exporting ? 0.7 : 1,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: '#18181b',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        style={btnStyle}
        disabled={isDisabled}
        onClick={() => !exporting && setOpen((o) => !o)}
      >
        <Download size={14} />
        {label}
        <ChevronDown size={13} style={{ color: '#9ca3af' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1000,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #d4d4d8',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            minWidth: 170,
            overflow: 'hidden',
          }}
        >
          <div
            style={itemStyle}
            onClick={exportExcel}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f9fafb')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <FileSpreadsheet size={14} style={{ color: '#16A34A' }} /> Excel (.xlsx)
          </div>
          <div
            style={{ ...itemStyle, borderTop: '1px solid #f3f4f6' }}
            onClick={exportCsv}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f9fafb')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            <FileText size={14} style={{ color: '#6b7280' }} /> CSV (.csv)
          </div>
        </div>
      )}
    </div>
  );
}
