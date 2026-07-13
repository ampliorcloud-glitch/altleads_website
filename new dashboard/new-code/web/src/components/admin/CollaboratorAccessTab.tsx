/**
 * CollaboratorAccessTab — Admin panel to configure the global collaborator access level
 * per object type (lead, contact, company, meeting).
 *
 * Only rendered when COLLAB_ASSOC = true.
 * Visible to ADMIN users only (AdminPage gate).
 *
 * Pattern mirrors HbProjectSettingsTab:
 *   1. Select an object type.
 *   2. See / change the global access level (View / Edit).
 *   3. Save via upsertCollaboratorAccessSetting.
 *
 * Persistence: stored in the `collaborator_access_setting` table
 * (created by new-code/migration/apply-collaborator-access-setting.cjs).
 * Default = 'view' for all object types.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Info, Users } from 'lucide-react';
import { COLLAB_ASSOC, type CollaboratorAccessLevel, type RecordType } from '../../lib/collabAssoc';
import { supabase } from '../../lib/supabase';
import { SectionCard } from './primitives';
import { GhostButton, PrimaryButton } from './Modal';

/* ------------------------------------------------------------------ */
/*  Data layer (inline — simple enough to not warrant a new data file) */
/* ------------------------------------------------------------------ */

const SETTING_TABLE = 'collaborator_access_setting';

async function fetchCollaboratorAccessSetting(
  objectType: RecordType,
): Promise<{ level: CollaboratorAccessLevel; error: string | null }> {
  if (!COLLAB_ASSOC) return { level: 'view', error: null };

  const { data, error } = await supabase
    .from(SETTING_TABLE)
    .select('access_level')
    .eq('object_type', objectType)
    .maybeSingle();

  if (error) return { level: 'view', error: error.message };
  return { level: (data?.access_level as CollaboratorAccessLevel | undefined) ?? 'view', error: null };
}

async function upsertCollaboratorAccessSetting(
  objectType: RecordType,
  level: CollaboratorAccessLevel,
  actorId: string,
): Promise<string | null> {
  if (!COLLAB_ASSOC) return null;

  const { error } = await supabase
    .from(SETTING_TABLE)
    .upsert(
      {
        object_type: objectType,
        access_level: level,
        updated_by: actorId,
        updated_date: new Date().toISOString(),
      },
      { onConflict: 'object_type' },
    );

  return error?.message ?? null;
}

/* ------------------------------------------------------------------ */
/*  Access Level Toggle (two-button segmented control)                 */
/* ------------------------------------------------------------------ */

function AccessToggle({
  value,
  onChange,
  disabled,
}: {
  value: CollaboratorAccessLevel;
  onChange: (v: CollaboratorAccessLevel) => void;
  disabled: boolean;
}) {
  const options: { value: CollaboratorAccessLevel; label: string; desc: string }[] = [
    {
      value: 'view',
      label: 'View only',
      desc: 'Collaborators can view the record and its activity but cannot make any edits. Use when you need read access for cross-team visibility.',
    },
    {
      value: 'edit',
      label: 'View + Edit',
      desc: 'Collaborators can view and edit the record (update fields, log activity). Equivalent to the record owner\'s editing rights.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 16px',
              background: active ? '#EFF6FF' : '#F9FAFB',
              border: active ? '2px solid #1A7EE8' : '2px solid #E5E7EB',
              borderRadius: 8,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: disabled ? 0.6 : 1,
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            {/* Radio indicator */}
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: active ? '5px solid #1A7EE8' : '2px solid #D1D5DB',
                background: '#fff',
                flexShrink: 0,
                marginTop: 2,
                transition: 'border 0.15s',
              }}
            />
            <span>
              <span
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? '#1A7EE8' : '#111827',
                  marginBottom: 2,
                }}
              >
                {opt.label}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                {opt.desc}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main tab                                                            */
/* ------------------------------------------------------------------ */

const OBJECT_TYPES: { value: RecordType; label: string }[] = [
  { value: 'lead',    label: 'Lead' },
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
  { value: 'meeting', label: 'Meeting' },
];

export function CollaboratorAccessTab({ actorId }: { actorId: string }) {
  if (!COLLAB_ASSOC) return null;

  const [objectType, setObjectType] = useState<RecordType>('lead');

  const [level, setLevel] = useState<CollaboratorAccessLevel>('view');
  const [draft, setDraft] = useState<CollaboratorAccessLevel>('view');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /* Load setting when object type changes */
  useEffect(() => {
    setSettingsLoading(true);
    setSettingsError(null);
    setSaved(false);
    setSaveError(null);

    fetchCollaboratorAccessSetting(objectType).then(({ level: l, error }) => {
      if (error) {
        setSettingsError(error);
        setSettingsLoading(false);
        return;
      }
      setLevel(l);
      setDraft(l);
      setSettingsLoading(false);
    });
  }, [objectType]);

  const isDirty = draft !== level;

  const handleReset = () => {
    setDraft(level);
    setSaveError(null);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const err = await upsertCollaboratorAccessSetting(objectType, draft, actorId);
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    setLevel(draft);
    setSaving(false);
    setSaved(true);
  };

  const selectedLabel = OBJECT_TYPES.find((o) => o.value === objectType)?.label ?? objectType;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Explainer */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <Info size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          <strong>Collaborator access level:</strong>{' '}
          Controls what users who are added as collaborators on a record can do.{' '}
          Setting applies globally per object type.{' '}
          Default is <em>View only</em>.{' '}
          Row-level security enforcement requires the COLLAB_ASSOC flag to be live
          (pending DEC-03 sign-off).
        </div>
      </div>

      {/* Object type selector */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Object type
          </label>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <select
            value={objectType}
            onChange={(e) => setObjectType(e.target.value as RecordType)}
            style={{
              fontSize: 13,
              padding: '7px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              height: 36,
              width: '100%',
              maxWidth: 340,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {OBJECT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Settings panel */}
      <SectionCard
        title={`${selectedLabel} — Collaborator access`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} color="#6B7280" />
            <span style={{ fontSize: 12, color: '#6B7280' }}>Collaborator settings</span>
          </div>
        }
      >
        {settingsLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#9CA3AF',
              padding: '20px 0',
            }}
          >
            <Loader2 size={14} className="animate-spin" /> Loading settings…
          </div>
        ) : settingsError ? (
          <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{settingsError}</p>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                What can collaborators do on a {selectedLabel.toLowerCase()} record?
              </span>
            </div>

            <AccessToggle
              value={draft}
              onChange={(v) => { setDraft(v); setSaved(false); }}
              disabled={saving}
            />

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
                  <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>Setting saved.</p>
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
    </div>
  );
}
