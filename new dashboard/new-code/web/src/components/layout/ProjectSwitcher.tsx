/**
 * ProjectSwitcher — the global project scope selector for the TopBar (owner #8).
 *
 * Sits next to the global Search affordance. Bound to useProjectScope:
 * shows "All projects" plus each accessible project; selecting one persists
 * immediately and pre-filters records app-wide (consumers read selectedProjectId).
 *
 * Compact, dependency-free dropdown styled to match the TopBar's other controls.
 * Hidden when the user has fewer than 2 accessible projects (single-project users
 * have nothing to switch between) — multi-project users get the benefit.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { useProjectScope } from '../../contexts/ProjectContext';

export function ProjectSwitcher() {
  const { projects, selectedProjectId, setSelectedProjectId, loading } = useProjectScope();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Hide for the common single-project user (nothing to switch between) — BUT keep
  // it visible whenever a project is actively scoped, so they always have a way back
  // to "All projects" even if they later lost access to other projects (review M3).
  if (loading) return null;
  if (projects.length < 2 && selectedProjectId == null) return null;

  const selected =
    selectedProjectId != null
      ? projects.find((p) => p.project_id === selectedProjectId) ?? null
      : null;
  const label = selected ? selected.project_name : 'All projects';

  function choose(id: number | null) {
    setSelectedProjectId(id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Project scope: ${label}`}
        title={`Project scope: ${label}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 32,
          padding: '0 8px',
          maxWidth: 200,
          borderRadius: 8,
          border: `1px solid ${open ? 'var(--color-brand)' : 'var(--border-color)'}`,
          background: 'var(--color-gray-50)',
          color: selected ? 'var(--color-gray-900)' : 'var(--color-gray-500)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: selected ? 600 : 400,
          transition: 'border-color 0.12s',
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-brand)';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
        }}
      >
        <Layers size={14} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--color-gray-400)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <ChevronDown size={13} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--color-gray-400)' }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            minWidth: 220,
            maxWidth: 280,
            marginTop: 4,
            background: 'var(--color-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          <ProjectOption
            label="All projects"
            selected={selectedProjectId == null}
            onClick={() => choose(null)}
          />
          <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
          {projects.map((p) => (
            <ProjectOption
              key={p.project_id}
              label={p.project_name}
              selected={p.project_id === selectedProjectId}
              onClick={() => choose(p.project_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        color: selected ? 'var(--color-brand)' : 'var(--color-gray-900)',
        background: selected ? 'var(--color-brand-light)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-100)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = selected
          ? 'var(--color-brand-light)'
          : 'transparent';
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {selected && <Check size={14} strokeWidth={2.25} style={{ flexShrink: 0 }} />}
    </div>
  );
}
