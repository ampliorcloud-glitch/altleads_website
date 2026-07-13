/**
 * Client Portal — ROUTE TREE (mounted by App.tsx at /portal/*).
 *
 * Owns the nested <Routes> for the whole portal:
 *   /portal/login            → PortalLoginPage (public)
 *   /portal                  → PortalHomePage          (guarded + shell)
 *   /portal/meetings         → PortalMeetingsPage      (guarded + shell)
 *   /portal/meetings/:id     → PortalMeetingDetailPage (guarded + shell)
 *
 * Every non-login route is wrapped in PortalProtectedRoute (enabled portal user only)
 * and PortalLayout (branded shell). The portal NEVER reuses CRM routes/pages/data.
 *
 * NOTE: the three page components are authored in parallel at the exact contract paths
 * under ./pages/ — they resolve at build time.
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PortalProtectedRoute } from './PortalProtectedRoute';
import { PortalLayout } from './PortalLayout';
import { PortalLoginPage } from './pages/PortalLoginPage';
import { PortalHomePage } from './pages/PortalHomePage';
import { PortalMeetingsPage } from './pages/PortalMeetingsPage';
import { PortalMeetingDetailPage } from './pages/PortalMeetingDetailPage';

/** Wrap a page in the guard + branded shell. */
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <PortalProtectedRoute>
      <PortalLayout>{children}</PortalLayout>
    </PortalProtectedRoute>
  );
}

export function PortalRoutes() {
  return (
    <Routes>
      <Route path="login" element={<PortalLoginPage />} />

      <Route
        index
        element={
          <Protected>
            <PortalHomePage />
          </Protected>
        }
      />
      <Route
        path="meetings"
        element={
          <Protected>
            <PortalMeetingsPage />
          </Protected>
        }
      />
      <Route
        path="meetings/:id"
        element={
          <Protected>
            <PortalMeetingDetailPage />
          </Protected>
        }
      />

      {/* Unknown /portal/* path → portal home (guard redirects if not signed in). */}
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}
