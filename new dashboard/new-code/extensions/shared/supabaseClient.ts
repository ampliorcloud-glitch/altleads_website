/**
 * shared/supabaseClient.ts
 *
 * Single Supabase client singleton for use inside the side panel (and any
 * other extension pages that run in a normal browser context).
 *
 * The ANON key is PUBLIC — it is already shipped in the CRM web bundle.
 * The service-role key is NEVER used here or anywhere in the extensions.
 *
 * The client uses a custom chrome.storage adapter so that the Supabase session
 * (JWT + refresh token) persists across service-worker restarts.  The adapter
 * is defined in auth.ts and injected here so this file stays dependency-free
 * of chrome.* APIs (making it easier to unit-test).
 *
 * Usage inside the side panel:
 *   import { getSupabaseClient } from '../shared/supabaseClient';
 *   const supabase = getSupabaseClient();
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite replaces import.meta.env.VITE_* at build time from the extension's .env file.
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[AltLeads] Supabase env vars missing. ' +
    'Copy new-code/web/.env.local → new-code/extensions/contact-viewer/.env ' +
    '(and data-research/.env) and rebuild.'
  );
}

let _client: SupabaseClient | null = null;

/**
 * Returns the singleton Supabase client.
 * Call this from the side panel or any extension page context.
 *
 * The first call creates the client with chrome.storage session persistence.
 * Subsequent calls return the same instance.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist the session in chrome.storage.local so it survives
      // service-worker restarts and browser restarts.
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

// ---------------------------------------------------------------------------
// chrome.storage adapter for @supabase/supabase-js auth persistence
// ---------------------------------------------------------------------------
// Supabase's auth module expects a storage object that looks like localStorage.
// We implement get/set/remove over chrome.storage.local so the session survives
// service-worker restarts.  The adapter uses callbacks-to-promise wrappers
// because chrome.storage is async.

const STORAGE_KEY = 'altleads_sb_session';

const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] ?? null);
      });
    });
  },
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => resolve());
    });
  },
};

// Suppress the unused-variable warning — STORAGE_KEY documents the namespace.
void STORAGE_KEY;
