/**
 * shared/auth.ts
 *
 * Auth helpers for both extensions (Option A1: explicit email/password login).
 * Wraps @supabase/supabase-js auth methods with chrome.storage session
 * persistence and loads the user's CRM profile (profiles.user_id + role)
 * so write-stamping and role-gating work the same as in AuthContext.tsx.
 *
 * HARD RULES:
 * - Never embed the service-role key.
 * - Never skip real auth (no "skip login" / dev backdoors).
 * - Strip every DEV_MODE / fake-admin path from the old extensions.
 */

import { getSupabaseClient } from './supabaseClient';
import type { UserProfile } from './types';

// chrome.storage key for persisting the selected project_id
const SELECTED_PROJECT_KEY = 'altleads_selected_project_id';

// ---------------------------------------------------------------------------
// Sign in / sign out
// ---------------------------------------------------------------------------

export interface SignInResult {
  ok: boolean;
  error?: string;
  profile?: UserProfile;
}

/**
 * Sign in with email + password (Option A1).
 * On success, loads the user's CRM profile and returns it.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // Map raw Supabase errors to friendly copy; keep technical detail in console
    console.error('[AltLeads] signIn error:', error?.message);
    const raw = error?.message ?? '';
    let friendly: string;
    if (raw.toLowerCase().includes('invalid login credentials') || raw.toLowerCase().includes('invalid email or password')) {
      friendly = 'Wrong email or password — please try again.';
    } else if (raw.toLowerCase().includes('network') || raw.toLowerCase().includes('fetch') || raw === '') {
      friendly = "Couldn't reach the server — check your connection and retry.";
    } else {
      friendly = "Couldn't reach the server — check your connection and retry.";
    }
    return { ok: false, error: friendly };
  }

  const profile = await loadProfile();
  if (!profile) {
    return { ok: false, error: 'Your account was found but your CRM profile is missing. Contact your admin.' };
  }

  return { ok: true, profile };
}

/**
 * Sign out and clear chrome.storage session data.
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
  // Clear the selected project on sign-out so the next user starts fresh.
  await chrome.storage.local.remove([SELECTED_PROJECT_KEY]);
}

// ---------------------------------------------------------------------------
// Session / profile
// ---------------------------------------------------------------------------

/**
 * Returns the current Supabase session, or null if not signed in.
 * The session is persisted in chrome.storage by the supabase client adapter.
 */
export async function getSession() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Load the authenticated user's CRM profile from public.profiles.
 * Returns null if there is no active session or no matching profile row.
 *
 * Profile shape (public.profiles):
 *   id        uuid  (= auth.uid())
 *   user_id   bigint (the numeric CRM user_id used as created_by/updated_by)
 *   role      text
 *   full_name text (if present)
 */
export async function loadProfile(): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, user_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    console.error('[AltLeads] loadProfile error:', error?.message);
    return null;
  }

  return {
    auth_uid: data.id as string,
    user_id: data.user_id as number,
    role: data.role as string,
    full_name: data.full_name as string | null,
  };
}

/**
 * Convenience: returns a valid profile if the session is active, null otherwise.
 * Side panel calls this on mount to decide whether to show login or content.
 */
export async function getSessionAndProfile(): Promise<UserProfile | null> {
  const session = await getSession();
  if (!session) return null;
  return loadProfile();
}

// ---------------------------------------------------------------------------
// Project selection persistence
// ---------------------------------------------------------------------------

/** Persist the selected project_id to chrome.storage. */
export async function setSelectedProject(projectId: number): Promise<void> {
  await chrome.storage.local.set({ [SELECTED_PROJECT_KEY]: projectId });
}

/** Retrieve the persisted selected project_id, or null if none. */
export async function getSelectedProject(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([SELECTED_PROJECT_KEY], (result) => {
      const val = result[SELECTED_PROJECT_KEY];
      resolve(typeof val === 'number' ? val : null);
    });
  });
}

// ---------------------------------------------------------------------------
// Role helpers (mirrors web AuthContext patterns)
// ---------------------------------------------------------------------------

export function isAdmin(role: string): boolean {
  return role === 'ADMIN';
}

export function isTeamLead(role: string): boolean {
  return role === 'TEAM_LEAD';
}

export function isAgent(role: string): boolean {
  return role === 'AGENT';
}

export function canCreateContacts(role: string): boolean {
  // Creation is ADMIN-default per launch-access-decisions (CLAUDE.md §4).
  return isAdmin(role);
}
