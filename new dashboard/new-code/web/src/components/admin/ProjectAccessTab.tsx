/**
 * Project Access tab — per-project view_scope / edit_scope dials.
 *
 * Visible to ADMIN users (via AdminPage gate).
 * Reads from project_visibility_setting; writes via upsertAllProjectVisibility.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Info } from 'lucide-react';
import {
  fetchProjectVisibility,
  upsertAllProjectVisibility,
  type VisibilitySetting,
  type VisibilityScope,
  type ObjectType,
} from '../../data/accessSettings';
import { fetchProjects, type AdminProject } from '../../data/admin';
import { Card, SectionCard } from './primitives';
import { SelectInput, Field, GhostButton, PrimaryButton } from './Modal';

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const SCOPE_OPTIONS: { value: VisibilityScope; label: string }[] = [
  { value: 'owner',    label: 'Owner only' },
  { value: 'team',     label: 'Team (managers + owner)' },
  { value: 'everyone', label: 'Everyone in project' },
];

const SCOPE_HELP: Record<VisibilityScope, string> = {
  owner:    'Only the record owner, their project manager, and admins.',
  team:     'The record owner plus all project managers (Sales Head / Team Lead).',
  everyone: 'All users assigned to this project.',
};

/** Human-readable object type label */
const OBJ_LABEL: Record<ObjectType, string> = {
  lead:    'Leads',
  company: 'Companies',
  contact: 'Contacts',
};

/** Accent colour per object type */
const OBJ_COLOR: Record<ObjectType, string> = {
  lead:    '#1A7EE8',
  company: '#7C3AED',
  contact: '#059669',
};

const OBJECT_TYPES: ObjectType[] = ['lead', 'company', 'contact'];

/* ------------------------------------------------------------------ */
/*  Scope badge (read-only display)                                     */
/* ------------------------------------------------------------------ */
function ScopeBadge({ scope }: { scope: VisibilityScope }) {
  const cfg = {
    owner:    { bg: '#F3F4F6', color: '#374151', label: 'Owner only' },
    team:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Team' },
    everyone: { bg: '#ECFDF5', color: '#059669', label: 'Everyone' },
  }[scope];
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline scope selector row                                           */
/* ------------------------------------------------------------------ */
function ScopeRow({
  objectType,
  setting,
  onChange,
  disabled,
}: {
  objectType: ObjectType;
  setting: VisibilitySetting;
  onChange: (updated: VisibilitySetting) => void;
  disabled: boolean;
}) {
  const accent = OBJ_COLOR[objectType];
  const label = OBJ_LABEL[objectType];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 1fr',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      {/* Object type label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: accent,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{label}</span>
      </div>

      {/* View scope */}
      <div>
        <Field label="Who can view">
          <SelectInput
            value={setting.view_scope}
            onChange={(v) =>
              onChange({ ...setting, view_scope: v as VisibilityScope })
            }
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0', lineHeight: 1.4 }}>
          {SCOPE_HELP[setting.view_scope]}
        </p>
      </div>

      {/* Edit scope */}
      <div>
        <Field label="Who can edit">
          <SelectInput
            value={setting.edit_scope}
            onChange={(v) =>
              onChange({ ...setting, edit_scope: v as VisibilityScope })
            }
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0', lineHeight: 1.4 }}>
          {SCOPE_HELP[setting.edit_scope]}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main tab                                                            */
/* ------------------------------------------------------------------ */
export function ProjectAccessTab({ actorId }: { actorId: string }) {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projLoading, setProjLoading] = useState(true);
  const [projError, setProjError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [settings, setSettings] = useState<VisibilitySetting[]>([]);
  const [draft, setDraft] = useState<VisibilitySetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /* Load project list once */
  useEffect(() => {
    fetchProjects().then((res) => {
      setProjects(res.projects);
      setProjError(res.error);
      setProjLoading(false);
    });
  }, []);

  /* Load visibility settings when project changes */
  useEffect(() => {
    if (selectedProjectId == null) {
      setSettings([]);
      setDraft([]);
      return;
    }
    setSettingsLoading(true);
    setSettingsError(null);
    setSaved(false);
    setSaveError(null);

    fetchProjectVisibility(selectedProjectId).then((res) => {
      if (res.error) {
        setSettingsError(res.error);
        setSettingsLoading(false);
        return;
      }
      setSettings(res.settings);
      setDraft(res.settings.map((s) => ({ ...s })));
      setSettingsLoading(false);
    });
  }, [selectedProjectId]);

  const isDirty = draft.some((d, i) => {
    const s = settings[i];
    return !s || d.view_scope !== s.view_scope || d.edit_scope !== s.edit_scope;
  });

  const handleReset = () => {
    setDraft(settings.map((s) => ({ ...s })));
    setSaveError(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (selectedProjectId == null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const err = await upsertAllProjectVisibility(selectedProjectId, draft, actorId);
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    setSettings(draft.map((d) => ({ ...d })));
    setSaving(false);
    setSaved(true);
  };

  const updateDraftRow = (ot: ObjectType, updated: VisibilitySetting) => {
    setDraft((prev) =>
      prev.map((s) => (s.object_type === ot ? updated : s))
    );
    setSaved(false);
  };

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Explainer */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <Info size={16} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.6 }}>
          <strong>About access scopes:</strong>{' '}
          <span style={{ color: '#1E40AF' }}>
            "Owner only" means only the record's creator, their project manager, and admins can see / edit it.{' '}
            "Team" adds project managers (Sales Head, Team Lead) to the allowed set.{' '}
            "Everyone" means any user assigned to the project can see or edit the record.
          </span>
          <br />
          <span style={{ color: '#374151' }}>
            Companies and contacts use a single shared view across all projects, so their scope mainly
            affects future data-isolation features. Lead dials take effect immediately.
          </span>
        </div>
      </div>

      {/* Project selector */}
      <Card>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <label
            style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Select project
          </label>
        </div>
        <div style={{ padding: '14px 20px' }}>
          {projLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF' }}>
              <Loader2 size={14} className="animate-spin" /> Loading projects...
            </div>
          ) : projError ? (
            <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{projError}</p>
          ) : (
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === '' ? null : Number(e.target.value))
              }
              style={{
                fontSize: 13,
                padding: '7px 10px',
                border: '1px solid #D1D5DB',
                borderRadius: 6,
                background: '#fff',
                color: '#374151',
                height: 36,
                width: '100%',
                maxWidth: 420,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">— choose a project —</option>
              {projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.project_name}{p.clientName ? ` (${p.clientName})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* Settings panel */}
      {selectedProjectId != null && (
        <SectionCard
          title={
            projects.find((p) => p.project_id === selectedProjectId)?.project_name ??
            `Project #${selectedProjectId}`
          }
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Access dials</span>
            </div>
          }
        >
          {settingsLoading ? (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF', padding: '20px 0' }}
            >
              <Loader2 size={14} className="animate-spin" /> Loading settings...
            </div>
          ) : settingsError ? (
            <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{settingsError}</p>
          ) : (
            <div>
              {/* Column header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 1fr',
                  gap: 12,
                  padding: '0 0 8px',
                  borderBottom: '2px solid #1A7EE8',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Object
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1A7EE8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  View scope
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1A7EE8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Edit scope
                </span>
              </div>

              {/* Rows */}
              {OBJECT_TYPES.map((ot) => {
                const row = draft.find((s) => s.object_type === ot);
                if (!row) return null;
                return (
                  <ScopeRow
                    key={ot}
                    objectType={ot}
                    setting={row}
                    onChange={(updated) => updateDraftRow(ot, updated)}
                    disabled={saving}
                  />
                );
              })}

              {/* Lead-specific callout */}
              <div
                style={{
                  marginTop: 14,
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontSize: 12,
                  color: '#0369A1',
                  lineHeight: 1.6,
                }}
              >
                <strong>Lead dials are active now.</strong> Changing "Leads" view or edit scope
                updates RLS policy behaviour immediately for all project members.
                Company and contact scopes are stored for audit and future enforcement.
              </div>

              {/* Save / Reset bar */}
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ minHeight: 18 }}>
                  {saveError && (
                    <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{saveError}</p>
                  )}
                  {saved && !saveError && (
                    <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>Settings saved.</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <GhostButton onClick={handleReset} disabled={saving || !isDirty}>
                    Reset
                  </GhostButton>
                  <PrimaryButton onClick={handleSave} disabled={saving || !isDirty}>
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    Save changes
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Current settings summary table (all projects) */}
      {selectedProjectId == null && !projLoading && !projError && projects.length > 0 && (
        <Card>
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid #F3F4F6',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
            }}
          >
            Quick reference: current settings
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#FFFFFF' }}>
                  {['Project', 'Leads view', 'Leads edit', 'Companies view', 'Contacts view'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: i === 0 ? '10px 20px' : '10px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1A7EE8',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                        borderBottom: '2px solid #1A7EE8',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <ProjectSummaryRow
                    key={p.project_id}
                    project={p}
                    onSelect={() => setSelectedProjectId(p.project_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary row — fetches settings lazily per project                  */
/* ------------------------------------------------------------------ */
function ProjectSummaryRow({
  project,
  onSelect,
}: {
  project: AdminProject;
  onSelect: () => void;
}) {
  const [vis, setVis] = useState<VisibilitySetting[] | null>(null);

  useEffect(() => {
    fetchProjectVisibility(project.project_id).then((r) => {
      if (!r.error) setVis(r.settings);
    });
  }, [project.project_id]);

  const get = (ot: ObjectType, field: 'view_scope' | 'edit_scope'): VisibilityScope | null =>
    vis ? (vis.find((s) => s.object_type === ot)?.[field] ?? null) : null;

  return (
    <tr
      style={{ borderBottom: '1px solid #F3F4F6', height: 40 }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F9FAFB'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
    >
      <td style={{ padding: '0 20px', fontSize: 13, color: '#111827', verticalAlign: 'middle' }}>
        <button
          type="button"
          onClick={onSelect}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#1A7EE8',
            fontSize: 13,
            fontWeight: 500,
            padding: 0,
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecorationColor = '#1A7EE8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecorationColor = 'transparent'; }}
        >
          {project.project_name}
        </button>
      </td>
      {[get('lead', 'view_scope'), get('lead', 'edit_scope'), get('company', 'view_scope'), get('contact', 'view_scope')].map((scope, i) => (
        <td key={i} style={{ padding: '0 12px', verticalAlign: 'middle' }}>
          {scope == null ? (
            <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>
          ) : (
            <ScopeBadge scope={scope} />
          )}
        </td>
      ))}
    </tr>
  );
}
