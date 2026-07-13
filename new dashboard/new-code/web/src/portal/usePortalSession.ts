/**
 * Client Portal — SESSION HOOK.
 *
 * Resolves whether the current Supabase Auth session is an ENABLED portal user by
 * reading the caller's own portal.client_portal_user row (the cpu_self_select RLS
 * policy in apply-portal-rls.cjs returns ONLY the caller's own enabled row). This is
 * the portal's identity bridge: a CRM-staff session has NO portal row → portalUser is
 * null → the guard bounces them to the portal login.
 *
 * Requires the portal schema applied + exposed (see data/portal.ts header); inert
 * (portalUser stays null) until then.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { portalDb } from './data/portal';

export type PortalRole = 'COMPANY_ADMIN' | 'SALES_HEAD' | 'SALES_PERSON';

export interface PortalUser {
  client_assoc_id: number;
  portal_role: PortalRole;
  enabled: boolean;
}

export interface PortalSession {
  loading: boolean;
  portalUser: PortalUser | null;
}

/** Fetch the caller's own client_portal_user row (RLS returns only their enabled row). */
async function fetchPortalUser(): Promise<PortalUser | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await portalDb
    .from('client_portal_user')
    .select('client_assoc_id, portal_role, enabled')
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { client_assoc_id: number; portal_role: PortalRole; enabled: boolean };
  if (!row.enabled) return null;
  return row;
}

/**
 * usePortalSession() — { loading, portalUser }.
 * Re-resolves on auth state changes (login / logout / token refresh).
 */
export function usePortalSession(): PortalSession {
  const [loading, setLoading] = useState(true);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      const u = await fetchPortalUser();
      if (!active) return;
      setPortalUser(u);
      setLoading(false);
    };

    void resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      // Deferred out of the callback — supabase-js holds its auth lock while
      // dispatching; queries started in here can deadlock (see AuthContext.tsx).
      setTimeout(() => { if (active) void resolve(); }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { loading, portalUser };
}
