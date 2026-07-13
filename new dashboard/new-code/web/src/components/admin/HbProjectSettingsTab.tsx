/**
 * HbProjectSettingsTab — per-project HungerBox settings tab in AdminPage.
 *
 * Currently exposes one setting:
 *   "Prequalified questions answered at: Company-wide / Site-wise"
 *
 * Only rendered when HUNGERBOX_FEATURES = true.
 * Visible to ADMIN users (AdminPage gate).
 *
 * Pattern mirrors ProjectAccessTab:
 *   1. Select a project from the dropdown.
 *   2. Fetch the current setting.
 *   3. Show a toggle (two-option radio/button pair).
 *   4. Save via upsertProjectHbSetting.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Info, ToggleLeft } from 'lucide-react';
import { HUNGERBOX_FEATURES } from '../../lib/hungerbox';
import {
  fetchProjectHbSetting,
  upsertProjectHbSetting,
  type PrequalGranularity,
} from '../../data/projectHbSettings';
import { fetchProjects, type AdminProject } from '../../data/admin';
import { Card, SectionCard } from './primitives';
import { GhostButton, PrimaryButton } from './Modal';

// -----------------------------------------------------------------------
// Granularity toggle — two-button segmented control
// -----------------------------------------------------------------------
function GranularityToggle({
  value,
  onChange,
  disabled,
}: {
  value: PrequalGranularity;
  onChange: (v: PrequalGranularity) => void;
  disabled: boolean;
}) {
  const options: { value: PrequalGranularity; label: string; desc: string }[] = [
    {
      value: 'site',
      label: 'Site-wise',
      desc: 'Each location/city site has its own set of answers (employee count, commercial model, notes). Default — use when the same company operates differently across cities.',
    },
    {
      value: 'company',
      label: 'Company-wide',
      desc: 'One shared set of answers applies to the whole company, regardless of site. Use when a single HQ decision covers all locations.',
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
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? '#1A7EE8' : '#111827', marginBottom: 2 }}>
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

// -----------------------------------------------------------------------
// Main tab
// -----------------------------------------------------------------------
export function HbProjectSettingsTab({ actorId }: { actorId: string }) {
  if (!HUNGERBOX_FEATURES) return null;

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projLoading, setProjLoading] = useState(true);
  const [projError, setProjError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const [granularity, setGranularity] = useState<PrequalGranularity>('site');
  const [draft, setDraft] = useState<PrequalGranularity>('site');
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

  /* Load setting when project changes */
  useEffect(() => {
    if (selectedProjectId == null) {
      setGranularity('site');
      setDraft('site');
      return;
    }
    setSettingsLoading(true);
    setSettingsError(null);
    setSaved(false);
    setSaveError(null);

    fetchProjectHbSetting(selectedProjectId).then(({ setting, error }) => {
      if (error) {
        setSettingsError(error);
        setSettingsLoading(false);
        return;
      }
      setGranularity(setting.prequalified_granularity);
      setDraft(setting.prequalified_granularity);
      setSettingsLoading(false);
    });
  }, [selectedProjectId]);

  const isDirty = draft !== granularity;

  const handleReset = () => {
    setDraft(granularity);
    setSaveError(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (selectedProjectId == null) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const err = await upsertProjectHbSetting(selectedProjectId, draft, actorId);
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    setGranularity(draft);
    setSaving(false);
    setSaved(true);
  };

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId);

  /* ── Render ── */
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
          <strong>Prequalified-question granularity:</strong>{' '}
          Controls whether HungerBox prequalified answers (employee count, commercial model, notes)
          are stored <strong>per site/location</strong> or as a single{' '}
          <strong>company-wide</strong> set. The choice applies to this project.{' '}
          Default is <em>Site-wise</em>.
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
          title={selectedProject?.project_name ?? `Project #${selectedProjectId}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ToggleLeft size={14} color="#6B7280" />
              <span style={{ fontSize: 12, color: '#6B7280' }}>HungerBox settings</span>
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
              {/* Section label */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Prequalified questions answered at
                </span>
              </div>

              <GranularityToggle
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
      )}
    </div>
  );
}
