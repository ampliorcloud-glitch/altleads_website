/**
 * ProjectSelect — compact project selector backed by fetchProjects (companies.ts).
 *
 * Loads the project list on mount and, when no value is set yet, defaults to the
 * first project (notifying the parent via onChange). Styling mirrors the existing
 * display-only selector in CompanyDetailPage (small select + chevron).
 *
 * Props:
 *   value     selected project_id (number) or null
 *   onChange  called with project_id (number) or null
 *   disabled  optional
 */

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fetchProjects, type ProjectOption } from '../../data/companies';
import { useProjectScope } from '../../contexts/ProjectContext';

interface Props {
  value: number | null;
  onChange: (projectId: number | null) => void;
  disabled?: boolean;
}

export function ProjectSelect({ value, onChange, disabled = false }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  // The global top-bar project selection (ALT-273) — the default for any
  // per-project view so a record opens in the project the user picked.
  const { selectedProjectId } = useProjectScope();

  useEffect(() => {
    let cancelled = false;
    fetchProjects().then((rows) => {
      if (cancelled) return;
      setProjects(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // When nothing is chosen yet, default to the GLOBAL selection (top-bar), so a
  // record opens in the project the user picked — not always "the first project"
  // (the old bug: pick DEMO, open a company, still see AP-North). Falls back to
  // the first accessible project when the global scope is "All projects" (null).
  // Re-runs if the global selection resolves after mount (e.g. a hard refresh).
  useEffect(() => {
    if (value != null || projects.length === 0) return;
    const def =
      selectedProjectId != null && projects.some((p) => p.id === selectedProjectId)
        ? selectedProjectId
        : projects[0].id;
    onChange(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, projects, selectedProjectId]);

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value ?? ''}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        style={{
          fontSize: 12,
          padding: '5px 28px 5px 10px',
          border: '1px solid var(--border-input, #d4d4d8)',
          borderRadius: 'var(--radius-btn, 6px)',
          background: 'var(--color-surface, #fff)',
          color: 'var(--color-gray-700, #374151)',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          height: 30,
          appearance: 'none',
        }}
        title="Project"
      >
        <option value="">{loading ? 'Loading…' : 'Project'}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute text-stone-400 pointer-events-none"
        style={{ right: 9 }}
      />
    </div>
  );
}
