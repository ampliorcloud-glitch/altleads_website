/**
 * ImportWizard — the in-app Import Wizard (ALT-399 / DEC-14).
 *
 * Steps: (1) pick entity + upload file → (2) map columns → (3) preview +
 * validation summary (with an expandable skipped-row list, ALT-418) →
 * (4) finish — Import button enabled when VITE_USE_WRITE_GATEWAY=true.
 *
 * Write path (DEC-14):
 *   When VITE_USE_WRITE_GATEWAY is true, the "Import" button calls
 *   runImportChunked() (importApi.ts) which sends ≤500 rows/chunk to
 *   POST /api/write via the gateway.  The server upserts, records the batch,
 *   and returns per-row results.  The UI shows a progress bar + summary +
 *   per-batch undo buttons.  When the flag is OFF (default), the button shows
 *   a "coming soon" lock notice — no writes happen.
 *
 * Reuses the shared ModalShell + Toast.
 * Does NOT rewrite importParse / importMapping / importValidate.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, Download, ChevronDown, ChevronRight, Lock, RotateCcw, Loader2,
} from 'lucide-react';
import { ModalShell } from '../wishlist/AssignModal';
import { useToast } from '../ui/Toast';
import { parseImportFile, ImportParseError, type ParsedFile } from '../../lib/importParse';
import {
  ENTITY_CATALOGS, getEntityDef, autoMap, unmappedHeaders, IGNORE_FIELD,
  type ColumnMapping, type EntityDef,
} from '../../lib/importMapping';
import { validateRows, type ValidationResult, type MappedRow } from '../../lib/importValidate';
import { isWriteGatewayEnabled } from '../../lib/writeGateway';
import {
  runImportChunked, undoImportBatch,
  type ImportEntity, type ImportRunResult,
} from '../../data/importApi';
import {
  ENTITY_MATCH_KEYS, defaultMatchKey, getMatchKeyDef,
  classifyRows, type DedupResult, type DedupClassifiedRow,
} from '../../lib/importDedup';
import { fetchExistingKeys } from '../../data/importDedup';

type Step = 1 | 2 | 3 | 4;

const PREVIEW_ROWS = 5;

/* ── small CSV download helper (mirrors ExportButton's CSV path) ─────────── */
const FORMULA_LEAD = /^[=+\-@\t\r]/;
function sanitize(s: string): string {
  return FORMULA_LEAD.test(s) ? `'${s}` : s;
}
function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const matrix = [headers, ...rows];
  const csv = matrix
    .map((line) =>
      line
        .map((cell) => {
          const s = sanitize(String(cell ?? ''));
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── shared inline styles to match the app ──────────────────────────────── */
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
  padding: '7px 14px', height: 34, borderRadius: 6, border: 'none',
  background: 'var(--color-brand)', color: '#fff', cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
  padding: '7px 14px', height: 34, borderRadius: 6,
  border: '1px solid #d4d4d8', background: '#fff', color: '#374151', cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  fontSize: 13, height: 32, borderRadius: 6, border: '1px solid #d4d4d8',
  background: '#fff', color: '#18181b', padding: '0 8px',
};

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [entityKey, setEntityKey] = useState<string>(ENTITY_CATALOGS[0].key);
  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [matchKey, setMatchKey] = useState<string>(() => defaultMatchKey(ENTITY_CATALOGS[0].key));
  const [dedup, setDedup] = useState<DedupResult | null>(null);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupWarning, setDedupWarning] = useState<string | null>(null);
  const [newRowsOpen, setNewRowsOpen] = useState(false);
  const [updateRowsOpen, setUpdateRowsOpen] = useState(false);
  const [inFileDupRowsOpen, setInFileDupRowsOpen] = useState(false);

  // Write-engine state (DEC-14) — only active when gateway flag is ON
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<ImportRunResult | null>(null);
  const [undoingBatch, setUndoingBatch] = useState<number | null>(null); // batchId being undone
  const [undoneIds, setUndoneIds] = useState<Set<number>>(new Set());

  const gatewayEnabled = isWriteGatewayEnabled();

  const entity: EntityDef = getEntityDef(entityKey) ?? ENTITY_CATALOGS[0];

  /* ── parse a chosen file ─────────────────────────────────────────────── */
  async function handleFile(file: File) {
    setParsing(true);
    try {
      const result = await parseImportFile(file);
      setParsed(result);
      setFileName(file.name);
      setMappings(autoMap(result.headers, entity));
      if (result.truncated) {
        toast.warning(
          `Loaded the first ${result.rows.length.toLocaleString()} of ${result.totalRows.toLocaleString()} rows (preview cap).`,
        );
      } else {
        toast.success(`Loaded ${result.totalRows.toLocaleString()} rows.`);
      }
    } catch (e) {
      const msg = e instanceof ImportParseError ? e.message : 'We could not read that file.';
      toast.error(msg);
      setParsed(null);
      setFileName('');
    } finally {
      setParsing(false);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = ''; // allow re-selecting the same file
  }

  // Re-run auto-map if the entity changes after a file is already loaded.
  function onEntityChange(nextKey: string) {
    setEntityKey(nextKey);
    setMatchKey(defaultMatchKey(nextKey));
    setDedup(null);
    setDedupWarning(null);
    if (parsed) {
      const def = getEntityDef(nextKey) ?? ENTITY_CATALOGS[0];
      setMappings(autoMap(parsed.headers, def));
    }
  }

  function setMapping(sourceHeader: string, targetField: string) {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.sourceHeader === sourceHeader) return { ...m, targetField };
        // Keep target fields unique: if another column already held this field, free it.
        if (targetField !== IGNORE_FIELD && m.targetField === targetField) {
          return { ...m, targetField: IGNORE_FIELD };
        }
        return m;
      }),
    );
  }

  /* ── dedup computation (async, triggered on entering step 3) ───────── */
  async function computeDedup(validRows: MappedRow[]) {
    setDedup(null);
    setDedupWarning(null);
    setDedupLoading(true);
    try {
      const def = getMatchKeyDef(entityKey, matchKey);
      const fieldKey = def?.fieldKey ?? matchKey;

      // Extract raw key values from the valid rows (non-empty only for DB query).
      const rawValues = validRows
        .map((r) => (r[fieldKey] ?? '').trim())
        .filter(Boolean);

      const { existingNorms, ok, error } = await fetchExistingKeys(entityKey, matchKey, rawValues);
      if (!ok) {
        setDedupWarning(error ?? 'Could not check for existing records — dedup preview is estimate-only.');
      }

      const result = classifyRows(validRows, matchKey, entityKey, existingNorms);
      setDedup(result);
    } catch (e) {
      setDedupWarning(e instanceof Error ? e.message : 'Dedup check failed — continuing without match preview.');
      // Still classify in-file dups without DB data.
      const result = classifyRows(validRows, matchKey, entityKey, new Set());
      setDedup(result);
    } finally {
      setDedupLoading(false);
    }
  }

  /* ── validation (memoised) ───────────────────────────────────────────── */
  const validation: ValidationResult | null = useMemo(() => {
    if (!parsed) return null;
    return validateRows(parsed.rows, mappings, entity);
  }, [parsed, mappings, entity]);

  const unmapped = useMemo(() => unmappedHeaders(mappings), [mappings]);

  /* ── downloads ───────────────────────────────────────────────────────── */
  function downloadCleaned() {
    if (!validation) return;
    const keys = validation.mappedFieldKeys;
    const headers = keys.map((k) => entity.fields.find((f) => f.key === k)?.label ?? k);
    const rows = validation.validRows.map((r: MappedRow) => keys.map((k) => r[k] ?? ''));
    downloadCsv(`${entity.key}-cleaned.csv`, headers, rows);
    toast.success(`Downloaded ${rows.length.toLocaleString()} cleaned rows.`);
  }
  function downloadSkipped() {
    if (!validation) return;
    const keys = validation.mappedFieldKeys;
    const headers = ['Row', ...keys.map((k) => entity.fields.find((f) => f.key === k)?.label ?? k), 'Why skipped'];
    const rows = validation.skipped.map((s) => [
      String(s.rowIndex + 2), // +1 for 0-index, +1 for the header row in the source file
      ...keys.map((k) => s.values[k] ?? ''),
      s.errors.join('; '),
    ]);
    downloadCsv(`${entity.key}-skipped.csv`, headers, rows);
    toast.success(`Downloaded ${rows.length.toLocaleString()} skipped rows.`);
  }

  /* ── import commit (DEC-14) ──────────────────────────────────────────── */
  async function handleCommitImport() {
    if (!validation || validation.validRows.length === 0) return;
    setImporting(true);
    setImportProgress({ done: 0, total: validation.validRows.length });
    setImportResult(null);

    try {
      const result = await runImportChunked(
        entityKey as ImportEntity,
        validation.validRows as MappedRow[],
        fileName,
        (done, total) => setImportProgress({ done, total }),
      );
      setImportResult(result);
      if (result.bypassed) {
        toast.warning('Write gateway is disabled — no records were saved. Enable VITE_USE_WRITE_GATEWAY to import.');
      } else if (result.chunkErrors.length > 0) {
        toast.error(`Import finished with errors: ${result.chunkErrors.join('; ')}`);
      } else {
        toast.success(`Import done — ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unexpected error';
      toast.error(`Import failed: ${msg}`);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function handleUndoBatch(batchId: number) {
    setUndoingBatch(batchId);
    try {
      const res = await undoImportBatch(entityKey as ImportEntity, batchId);
      if (!res.ok) {
        toast.error(`Undo failed: ${res.error ?? 'unknown error'}`);
      } else {
        setUndoneIds((prev) => new Set([...prev, batchId]));
        toast.success(`Batch #${batchId} undone — ${res.undone} record(s) reverted.`);
      }
    } catch (e) {
      toast.error(`Undo error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUndoingBatch(null);
    }
  }

  /* ── per-step gating ─────────────────────────────────────────────────── */
  const canLeaveStep1 = parsed != null && !parsing;
  const canLeaveStep2 = (validation?.mappedFieldKeys.length ?? 0) > 0;

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <ModalShell
      title="Import data"
      icon={<Upload size={16} />}
      onClose={onClose}
      width={680}
    >
      <Stepper step={step} />

      {/* STEP 1 — entity + file */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
              What are you importing?
            </label>
            <select
              value={entityKey}
              onChange={(e) => onEntityChange(e.target.value)}
              style={{ ...selectStyle, width: 220 }}
            >
              {ENTITY_CATALOGS.map((e) => (
                <option key={e.key} value={e.key}>{e.label}</option>
              ))}
            </select>
            {/* Template download (Ankit 2026-07-03): exact headers for this entity so
                files auto-map cleanly. Headers = field labels (autoMap matches labels). */}
            <button
              type="button"
              onClick={() => {
                const def = getEntityDef(entityKey);
                if (!def) return;
                const headers = def.fields.map((f) => f.label);
                const hints = def.fields.map((f) =>
                  f.required ? 'REQUIRED' : f.validate ? `optional (${f.validate})` : 'optional',
                );
                downloadCsv(`${def.key}-import-template.csv`, headers, [hints]);
              }}
              style={{
                marginLeft: 10, padding: '7px 12px', fontSize: 12, fontWeight: 500,
                border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
                color: '#374151', cursor: 'pointer',
              }}
              title="CSV with the exact column headers this import expects (row 2 marks required fields — delete it before importing)"
            >
              ⬇ Download template
            </button>
          </div>

          <div>
            <label className="block mb-1 text-stone-600 font-medium" style={{ fontSize: 12 }}>
              Upload a CSV or Excel file
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              style={{
                border: '1.5px dashed #d4d4d8', borderRadius: 8, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', background: 'var(--color-page-bg)',
              }}
            >
              <FileSpreadsheet size={26} style={{ color: '#9ca3af', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                {parsing ? 'Reading file…' : 'Click to choose, or drag a file here'}
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                .csv, .xlsx — first sheet, first row is the header
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onFileInput}
                style={{ display: 'none' }}
              />
            </div>
            {parsed && (
              <p style={{ fontSize: 12, color: '#15803d', marginTop: 8 }}>
                <CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                {fileName} — {parsed.headers.length} columns, {parsed.totalRows.toLocaleString()} rows
                {parsed.truncated && ' (capped to preview)'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP 2 — mapping */}
      {step === 2 && parsed && (
        <div className="space-y-3">
          <p className="text-stone-500" style={{ fontSize: 12 }}>
            Match each column in your file to a {entity.label.toLowerCase().replace(/s$/, '')} field.
            Auto-matched where we could; choose <em>Don't import</em> to skip a column.
          </p>
          {unmapped.length > 0 && (
            <div style={{ fontSize: 12, color: '#b45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '7px 10px' }}>
              <AlertTriangle size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              {unmapped.length} unmapped column{unmapped.length > 1 ? 's' : ''} will be ignored: {unmapped.join(', ')}
            </div>
          )}
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Your column</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Maps to</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.sourceHeader}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#18181b', fontWeight: 500 }}>
                      {m.sourceHeader}
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                        e.g. {parsed.rows[0]?.[m.sourceHeader] || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
                      <select
                        value={m.targetField}
                        onChange={(e) => setMapping(m.sourceHeader, e.target.value)}
                        style={{ ...selectStyle, width: '100%' }}
                      >
                        <option value={IGNORE_FIELD}>— Don't import —</option>
                        {entity.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Match-key selector (ALT-490) */}
          {(ENTITY_MATCH_KEYS[entityKey]?.length ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                Match existing records by:
              </label>
              <select
                value={matchKey}
                onChange={(e) => {
                  setMatchKey(e.target.value);
                  setDedup(null);
                  setDedupWarning(null);
                }}
                style={{ ...selectStyle, width: 200 }}
              >
                {(ENTITY_MATCH_KEYS[entityKey] ?? []).map((def) => (
                  <option key={def.key} value={def.key}>
                    {def.label}{def.recommended ? ' (recommended)' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Used to detect new vs existing records in the preview
              </span>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — preview + validation summary */}
      {step === 3 && parsed && validation && (
        <div className="space-y-3">
          <div style={{ display: 'flex', gap: 10 }}>
            <SummaryPill color="#15803d" bg="#F0FDF4" border="#BBF7D0"
              label="ready to import" value={validation.validRows.length} />
            <SummaryPill color="#b45309" bg="#FFFBEB" border="#FDE68A"
              label="will be skipped" value={validation.skipped.length} />
          </div>

          {/* Dedup QC section (ALT-490) */}
          {dedupLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F8FAFC', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#6b7280' }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#6b7280' }} />
              Checking for existing records…
            </div>
          )}
          {!dedupLoading && dedup && (
            <div className="space-y-2">
              {/* Match-key label */}
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>
                Records are matched on: <strong style={{ color: '#374151' }}>
                  {getMatchKeyDef(entityKey, dedup.matchKey)?.label ?? dedup.matchKey}
                </strong>
              </p>

              {/* Soft warning if DB match query failed */}
              {dedupWarning && (
                <div style={{ fontSize: 12, color: '#b45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '7px 10px' }}>
                  <AlertTriangle size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                  {dedupWarning}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <DedupPill
                  color="#1d4ed8" bg="#EFF6FF" border="#BFDBFE"
                  label="new" value={dedup.newRows.length + dedup.emptyKeyRows.length}
                  open={newRowsOpen}
                  onToggle={() => setNewRowsOpen((o) => !o)}
                />
                <DedupPill
                  color="#7c3aed" bg="#F5F3FF" border="#DDD6FE"
                  label={`will update existing (matched by ${getMatchKeyDef(entityKey, dedup.matchKey)?.label ?? dedup.matchKey})`}
                  value={dedup.updateRows.length}
                  open={updateRowsOpen}
                  onToggle={() => setUpdateRowsOpen((o) => !o)}
                />
                <DedupPill
                  color="#b45309" bg="#FFFBEB" border="#FDE68A"
                  label="in-file duplicates"
                  value={dedup.inFileDupRows.length}
                  open={inFileDupRowsOpen}
                  onToggle={() => setInFileDupRowsOpen((o) => !o)}
                />
              </div>

              {/* Expandable new rows list */}
              {newRowsOpen && (dedup.newRows.length + dedup.emptyKeyRows.length) > 0 && (
                <DedupExpandedList
                  rows={[...dedup.newRows, ...dedup.emptyKeyRows]}
                  fieldKey={dedup.fieldKey}
                  matchKeyLabel={getMatchKeyDef(entityKey, dedup.matchKey)?.label ?? dedup.matchKey}
                  colorScheme={{ bg: '#EFF6FF', border: '#BFDBFE', text: '#1d4ed8' }}
                  emptyNote="(no key value — will be treated as new)"
                />
              )}

              {/* Expandable update rows list */}
              {updateRowsOpen && dedup.updateRows.length > 0 && (
                <DedupExpandedList
                  rows={dedup.updateRows}
                  fieldKey={dedup.fieldKey}
                  matchKeyLabel={getMatchKeyDef(entityKey, dedup.matchKey)?.label ?? dedup.matchKey}
                  colorScheme={{ bg: '#F5F3FF', border: '#DDD6FE', text: '#7c3aed' }}
                />
              )}

              {/* Expandable in-file dup rows list */}
              {inFileDupRowsOpen && dedup.inFileDupRows.length > 0 && (
                <DedupExpandedList
                  rows={dedup.inFileDupRows}
                  fieldKey={dedup.fieldKey}
                  matchKeyLabel={getMatchKeyDef(entityKey, dedup.matchKey)?.label ?? dedup.matchKey}
                  colorScheme={{ bg: '#FFFBEB', border: '#FDE68A', text: '#b45309' }}
                />
              )}
            </div>
          )}

          <div>
            <p className="text-stone-500" style={{ fontSize: 12, marginBottom: 4 }}>
              Preview — first {Math.min(PREVIEW_ROWS, validation.validRows.length)} mapped row(s)
            </p>
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {validation.mappedFieldKeys.map((k) => (
                      <th key={k} style={{ textAlign: 'left', padding: '6px 9px', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>
                        {entity.fields.find((f) => f.key === k)?.label ?? k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validation.validRows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <tr key={i}>
                      {validation.mappedFieldKeys.map((k) => (
                        <td key={k} style={{ padding: '5px 9px', color: '#27272a', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>
                          {r[k] || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {validation.validRows.length === 0 && (
                    <tr><td style={{ padding: '10px', color: '#9ca3af' }}>No valid rows with the current mapping.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expandable skipped-row list (ALT-418) */}
          {validation.skipped.length > 0 && (
            <div style={{ border: '1px solid #FDE68A', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setSkippedOpen((o) => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  padding: '8px 10px', background: '#FFFBEB', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: '#b45309',
                }}
              >
                {skippedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {validation.skipped.length} skipped row{validation.skipped.length > 1 ? 's' : ''} — see why
              </button>
              {skippedOpen && (
                <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fff' }}>
                  {validation.skipped.slice(0, 200).map((s) => (
                    <div key={s.rowIndex} style={{ padding: '6px 10px', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#52525b' }}>Row {s.rowIndex + 2}:</span>{' '}
                      <span style={{ color: '#b91c1c' }}>{s.errors.join('; ')}</span>
                    </div>
                  ))}
                  {validation.skipped.length > 200 && (
                    <div style={{ padding: '6px 10px', fontSize: 11, color: '#9ca3af' }}>
                      …and {validation.skipped.length - 200} more. Download the full skipped list on the next step.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — finish + commit */}
      {step === 4 && validation && (
        <div className="space-y-4">
          <div style={{ display: 'flex', gap: 10 }}>
            <SummaryPill color="#15803d" bg="#F0FDF4" border="#BBF7D0"
              label="ready to import" value={validation.validRows.length} />
            <SummaryPill color="#b45309" bg="#FFFBEB" border="#FDE68A"
              label="will be skipped" value={validation.skipped.length} />
          </div>

          {/* Gateway flag OFF → locked notice (ship dark) */}
          {!gatewayEnabled && !importResult && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} /> Writing is not enabled yet
              </p>
              <p style={{ fontSize: 12, color: '#1e40af', marginTop: 4, lineHeight: 1.5 }}>
                This wizard validates and previews your file. To enable real imports,
                set <code>VITE_USE_WRITE_GATEWAY=true</code> at build time and apply
                the <code>apply-import-batches</code> migration.
                For now you can download the cleaned, mapped data and the skipped rows below.
              </p>
            </div>
          )}

          {/* Progress bar while importing */}
          {importing && importProgress && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Loader2 size={14} style={{ color: '#15803d', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                  Importing… {importProgress.done.toLocaleString()} / {importProgress.total.toLocaleString()} rows
                </span>
              </div>
              <div style={{ height: 6, background: '#dcfce7', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%', borderRadius: 4, background: '#16a34a',
                    width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Results after import */}
          {importResult && !importResult.bypassed && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#f9fafb', padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 16 }}>
                <ResultCount label="Inserted" value={importResult.inserted} color="#15803d" />
                <ResultCount label="Updated"  value={importResult.updated}  color="#1d4ed8" />
                <ResultCount label="Skipped"  value={importResult.skipped}  color="#b45309" />
                <ResultCount label="Errors"   value={importResult.error}    color="#b91c1c" />
              </div>

              {importResult.chunkErrors.length > 0 && (
                <div style={{ padding: '8px 14px', fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderBottom: '1px solid #e5e7eb' }}>
                  <AlertTriangle size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                  {importResult.chunkErrors.join(' | ')}
                </div>
              )}

              {/* Undo buttons — one per batch chunk */}
              {importResult.batchIds.length > 0 && (
                <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>Undo:</span>
                  {importResult.batchIds.map((batchId) => (
                    <button
                      key={batchId}
                      onClick={() => void handleUndoBatch(batchId)}
                      disabled={undoingBatch === batchId || undoneIds.has(batchId)}
                      style={{
                        ...ghostBtn,
                        fontSize: 12, height: 28, padding: '4px 10px',
                        opacity: undoneIds.has(batchId) ? 0.5 : 1,
                        cursor: undoneIds.has(batchId) ? 'not-allowed' : 'pointer',
                        textDecoration: undoneIds.has(batchId) ? 'line-through' : 'none',
                      }}
                    >
                      {undoingBatch === batchId
                        ? <><Loader2 size={12} /> Undoing…</>
                        : <><RotateCcw size={12} /> {undoneIds.has(batchId) ? `Batch #${batchId} undone` : `Undo batch #${batchId}`}</>
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={ghostBtn} onClick={downloadCleaned} disabled={validation.validRows.length === 0}>
              <Download size={14} /> Download cleaned data ({validation.validRows.length})
            </button>
            <button style={ghostBtn} onClick={downloadSkipped} disabled={validation.skipped.length === 0}>
              <Download size={14} /> Download skipped rows ({validation.skipped.length})
            </button>
          </div>
        </div>
      )}

      {/* ── footer nav ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-stone-100">
        <div>
          {step > 1 && (
            <button style={ghostBtn} onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button style={ghostBtn} onClick={onClose}>Cancel</button>
          {step < 4 ? (
            <button
              style={{ ...primaryBtn, opacity: (step === 1 ? !canLeaveStep1 : step === 2 ? !canLeaveStep2 : false) ? 0.5 : 1, cursor: (step === 1 ? !canLeaveStep1 : step === 2 ? !canLeaveStep2 : false) ? 'not-allowed' : 'pointer' }}
              disabled={step === 1 ? !canLeaveStep1 : step === 2 ? !canLeaveStep2 : false}
              onClick={() => {
                const next = (step + 1) as Step;
                setStep(next);
                // Trigger dedup computation when entering the preview step.
                if (next === 3 && validation) {
                  void computeDedup(validation.validRows as MappedRow[]);
                }
              }}
            >
              Next <ArrowRight size={14} />
            </button>
          ) : gatewayEnabled ? (
            // Gateway ON — real import button
            <button
              style={{
                ...primaryBtn,
                opacity: (importing || (validation?.validRows.length ?? 0) === 0 || importResult != null) ? 0.5 : 1,
                cursor:  (importing || (validation?.validRows.length ?? 0) === 0 || importResult != null) ? 'not-allowed' : 'pointer',
              }}
              disabled={importing || (validation?.validRows.length ?? 0) === 0 || importResult != null}
              onClick={() => void handleCommitImport()}
              title={importResult != null ? 'Import already run — close and re-open to import again' : undefined}
            >
              {importing
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</>
                : <><Upload size={13} /> Import {(validation?.validRows.length ?? 0).toLocaleString()} records</>
              }
            </button>
          ) : (
            // Gateway OFF (default) — locked notice
            <button
              style={{ ...primaryBtn, opacity: 0.5, cursor: 'not-allowed' }}
              disabled
              title="Set VITE_USE_WRITE_GATEWAY=true to enable real imports."
            >
              <Lock size={13} /> Import (write gateway disabled)
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ── sub-components ──────────────────────────────────────────────────────── */

function Stepper({ step }: { step: Step }) {
  const labels = ['Upload', 'Map columns', 'Preview', 'Finish'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 20, height: 20, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'var(--color-brand)' : done ? '#BBF7D0' : '#e5e7eb',
                  color: active ? '#fff' : done ? '#15803d' : '#9ca3af',
                }}
              >
                {done ? '✓' : n}
              </span>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#18181b' : '#9ca3af' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SummaryPill({ label, value, color, bg, border }: { label: string; value: number; color: string; bg: string; border: string }) {
  return (
    <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color }}>{label}</div>
    </div>
  );
}

function ResultCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
    </div>
  );
}

/** Dedup stat pill with expand toggle (ALT-490). */
function DedupPill({
  label, value, color, bg, border, open, onToggle,
}: {
  label: string; value: number; color: string; bg: string; border: string;
  open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={value > 0 ? onToggle : undefined}
      disabled={value === 0}
      style={{
        flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 8,
        padding: '8px 10px', textAlign: 'left', cursor: value > 0 ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color }}>{value.toLocaleString()}</span>
        {value > 0 && (
          open ? <ChevronDown size={13} style={{ color }} /> : <ChevronRight size={13} style={{ color }} />
        )}
      </div>
      <div style={{ fontSize: 11, color, lineHeight: 1.3 }}>{label}</div>
    </button>
  );
}

const DEDUP_LIST_CAP = 200;

/** Expandable list of dedup-classified rows (ALT-490). */
function DedupExpandedList({
  rows, fieldKey, matchKeyLabel, colorScheme, emptyNote,
}: {
  rows: DedupClassifiedRow[];
  fieldKey: string;
  matchKeyLabel: string;
  colorScheme: { bg: string; border: string; text: string };
  emptyNote?: string;
}) {
  const shown = rows.slice(0, DEDUP_LIST_CAP);
  const overflow = rows.length - DEDUP_LIST_CAP;
  return (
    <div style={{ border: `1px solid ${colorScheme.border}`, borderRadius: 6, overflow: 'hidden', fontSize: 12 }}>
      <div style={{ background: colorScheme.bg, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: colorScheme.text, borderBottom: `1px solid ${colorScheme.border}` }}>
        {matchKeyLabel} value
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto', background: '#fff' }}>
        {shown.map((r) => (
          <div key={r.rowIndex} style={{ padding: '4px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>
            <span style={{ fontWeight: 600, color: '#52525b', marginRight: 6 }}>Row {r.rowIndex + 2}:</span>
            {r.keyValue
              ? <span style={{ color: colorScheme.text }}>{r.keyValue}</span>
              : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{emptyNote ?? '(empty)'}</span>
            }
          </div>
        ))}
        {overflow > 0 && (
          <div style={{ padding: '4px 10px', fontSize: 11, color: '#9ca3af' }}>
            …and {overflow.toLocaleString()} more
          </div>
        )}
      </div>
    </div>
  );
}
