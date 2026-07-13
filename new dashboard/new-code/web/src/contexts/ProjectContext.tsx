/**
 * ProjectContext — the global "project scope" foundation (owner ask #8).
 *
 * One project selector lives next to the global search; the chosen project
 * pre-filters records across the app. `selectedProjectId === null` means
 * "All projects" (no project filter).
 *
 * Persistence model (localStorage, keyed PER USER so two people sharing a device
 * never inherit each other's scope — review ALT-273B M1/M5):
 *   - 'altleads:selected-project:<userId>'  → the live selection (sticky across reloads).
 *   - 'altleads:default-project:<userId>'   → the user's preferred default (set in Settings).
 *
 * Hydration: selection starts null and is loaded for the authenticated user only
 * AFTER auth resolves (so a shared device can't flash the prior user's scope before
 * we know who is logged in). On a successful project-list load, a stored id the user
 * can no longer access is dropped to "All"; on a FAILED load we keep the stored
 * selection rather than wiping it (a transient fetch error must not destroy the pref).
 *
 * This module is additive and read-only against the DB (it only reads the user's
 * accessible projects); it performs no writes.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchMyProjects } from '../data/admin';

const SELECTED_PREFIX = 'altleads:selected-project';
const DEFAULT_PREFIX = 'altleads:default-project';

/** Per-user localStorage key for the live selection. */
export function selectedProjectKey(userId: number | null): string {
  return userId == null ? SELECTED_PREFIX : `${SELECTED_PREFIX}:${userId}`;
}
/** Per-user localStorage key for the user's default scope (set in Settings). */
export function defaultProjectKey(userId: number | null): string {
  return userId == null ? DEFAULT_PREFIX : `${DEFAULT_PREFIX}:${userId}`;
}

export interface ScopedProject {
  project_id: number;
  project_name: string;
}

interface ProjectContextType {
  /** Projects the current user may scope to (excludes the "All projects" pseudo-option). */
  projects: ScopedProject[];
  /** Currently scoped project id; null = "All projects". */
  selectedProjectId: number | null;
  /** Set (and persist) the current scope. Pass null for "All projects". */
  setSelectedProjectId: (id: number | null) => void;
  /** True while the accessible-project list is still loading. */
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

/** Read a numeric project id from a localStorage key; null if absent/invalid/"all". */
function readStoredProjectId(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '' || raw === 'all' || raw === 'null') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Persist (or clear) a project id under a localStorage key. null → "all". */
function writeStoredProjectId(key: string, id: number | null): void {
  try {
    if (id == null) localStorage.setItem(key, 'all');
    else localStorage.setItem(key, String(id));
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * Canonical cross-surface bridge key (Chrome extension TODO-C). A SINGLE, stable
 * key the extension can read to know the active user + project WITHOUT needing the
 * per-user key name or React state. Updated on hydration and on every selection
 * change. Shape: { userId: number|null, projectId: number|null } (projectId null =
 * All projects). See docs/chrome-extension-rebuild/CRM-RESPONSE-TO-EXTENSION.md.
 */
export const ACTIVE_CONTEXT_KEY = 'altleads:active-context';
function writeActiveContext(userId: number | null, projectId: number | null): void {
  try {
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify({ userId, projectId }));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const userId = profile?.user_id ?? null;

  const [projects, setProjects] = useState<ScopedProject[]>([]);
  const [loading, setLoading] = useState(true);
  // Starts null; hydrated per-user once auth resolves (see effect). Never seeded
  // synchronously from localStorage — that would flash the prior user's scope on a
  // shared device before we know who is logged in.
  const [selectedProjectId, setSelectedProjectIdState] = useState<number | null>(null);

  // Load the user's accessible projects + hydrate their stored scope, once auth resolves.
  useEffect(() => {
    let cancelled = false;

    // Wait for auth to settle so isAdmin / user_id are accurate.
    if (authLoading) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    // Signed out: clear scope + list immediately (in-memory). Because the keys are
    // per-user, the next login reads only that user's own stored value.
    if (userId == null && !isAdmin) {
      setProjects([]);
      setSelectedProjectIdState(null);
      writeActiveContext(null, null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    // This user's stored scope: last live selection, else their configured default.
    const stored =
      readStoredProjectId(selectedProjectKey(userId)) ??
      readStoredProjectId(defaultProjectKey(userId));

    fetchMyProjects(userId, isAdmin)
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        // Apply the stored selection ONLY if the user can actually access it now;
        // otherwise fall back to "All". This branch runs only on a SUCCESSFUL load.
        if (stored != null && list.some((p) => p.project_id === stored)) {
          setSelectedProjectIdState(stored);
          writeActiveContext(userId, stored);
        } else {
          setSelectedProjectIdState(null);
          writeActiveContext(userId, null);
          if (stored != null) writeStoredProjectId(selectedProjectKey(userId), null);
        }
      })
      .catch(() => {
        // Fetch failed (network/RLS hiccup) — do NOT wipe the stored selection.
        // Keep the user's last choice; the switcher simply won't refresh options
        // this cycle. (review ALT-273B M4: error must not be treated as "no access".)
        if (cancelled) return;
        if (stored != null) setSelectedProjectIdState(stored);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin, authLoading]);

  // Selecting a project persists immediately, under the current user's key.
  const setSelectedProjectId = useCallback(
    (id: number | null) => {
      setSelectedProjectIdState(id);
      writeStoredProjectId(selectedProjectKey(userId), id);
      writeActiveContext(userId, id); // keep the cross-surface bridge in sync (extension)
    },
    [userId],
  );

  const value = useMemo<ProjectContextType>(
    () => ({ projects, selectedProjectId, setSelectedProjectId, loading }),
    [projects, selectedProjectId, setSelectedProjectId, loading],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * Access the global project scope. Safe to call outside a ProjectProvider — it
 * returns an inert "All projects" scope so non-CRM trees (e.g. the client portal,
 * login pages) don't crash if they read it indirectly.
 */
export function useProjectScope(): ProjectContextType {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    return {
      projects: [],
      selectedProjectId: null,
      setSelectedProjectId: () => {},
      loading: false,
    };
  }
  return ctx;
}
