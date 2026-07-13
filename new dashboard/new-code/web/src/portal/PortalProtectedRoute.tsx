/**
 * Client Portal — ROUTE GUARD.
 *
 * Renders children ONLY for an enabled portal user (a session with an enabled
 * portal.client_portal_user row). Anyone else — not logged in, or a CRM-staff
 * session with no portal row — is redirected to /portal/login. This is the portal's
 * OWN guard; it does NOT reuse the CRM's SalesProtectedRoute / role model.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePortalSession } from './usePortalSession';
import { useBrand } from './brand';

function PortalLoader() {
  const brand = useBrand();
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-page-bg)' }}
    >
      <div
        className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: brand.accent, borderTopColor: 'transparent' }}
      />
    </div>
  );
}

export function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, portalUser } = usePortalSession();

  // Wait for the session to resolve to avoid a flash redirect.
  if (loading) return <PortalLoader />;

  // No enabled portal user → bounce to the portal login.
  if (!portalUser) return <Navigate to="/portal/login" replace />;

  return <>{children}</>;
}
