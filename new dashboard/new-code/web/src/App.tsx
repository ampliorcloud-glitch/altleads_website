import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { SalesShellProvider } from './contexts/SalesShellContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { CommandPalette } from './components/ui/CommandPalette';
import { KeyboardHelp } from './components/ui/KeyboardHelp';
// Auth/recovery pages stay EAGER — they render on first paint (the "/" landing is
// the login page) so code-splitting them would only add a chunk fetch to the cold start.
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

/* ────────────────────────── Lazily-loaded route pages ──────────────────────────
   Every routed PAGE below is split into its own chunk so the initial bundle only
   carries the providers, guards, shell, and the login screen. Chunks load on demand
   when their route is first visited (gated by the single <Suspense> in AppRoutes).
   Pages with a NAMED export are unwrapped to a default for React.lazy; AdminPage
   already ships a default export. */
const SalesLoginPage = lazy(() => import('./pages/sales/SalesLoginPage').then(m => ({ default: m.SalesLoginPage })));;
const SalesPlaceholderPage = lazy(() => import('./pages/sales/SalesPlaceholderPage').then(m => ({ default: m.SalesPlaceholderPage })));;
const SalesMeetingDetailPage = lazy(() => import('./pages/sales/SalesMeetingDetailPage').then(m => ({ default: m.SalesMeetingDetailPage })));;
const SalesWishlistPage = lazy(() => import('./pages/sales/SalesWishlistPage').then(m => ({ default: m.SalesWishlistPage })));;
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));;
const LeadsPage = lazy(() => import('./pages/LeadsPage').then(m => ({ default: m.LeadsPage })));;
const LeadsKanbanPage = lazy(() => import('./pages/LeadsKanbanPage').then(m => ({ default: m.LeadsKanbanPage })));;
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage').then(m => ({ default: m.LeadDetailPage })));;
const LeadFormPage = lazy(() => import('./pages/LeadFormPage').then(m => ({ default: m.LeadFormPage })));;
const MeetingsPage = lazy(() => import('./pages/MeetingsPage').then(m => ({ default: m.MeetingsPage })));;
const MeetingDetailPage = lazy(() => import('./pages/MeetingDetailPage').then(m => ({ default: m.MeetingDetailPage })));;
const MyTasksPage = lazy(() => import('./pages/MyTasksPage').then(m => ({ default: m.MyTasksPage })));;
const WishlistPage = lazy(() => import('./pages/WishlistPage').then(m => ({ default: m.WishlistPage })));;
const WishlistDetailPage = lazy(() => import('./pages/WishlistDetailPage').then(m => ({ default: m.WishlistDetailPage })));;
const LandingPage = lazy(() => import('./pages/LandingPage'));;
const AdminPage = lazy(() => import('./pages/AdminPage'));;
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));;
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));;
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));;
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));;
const RecycleBinPage = lazy(() => import('./pages/RecycleBinPage').then(m => ({ default: m.RecycleBinPage })));;
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })));;
const ContactDetailPage = lazy(() => import('./pages/ContactDetailPage').then(m => ({ default: m.ContactDetailPage })));;
const ContactFormPage = lazy(() => import('./pages/ContactFormPage').then(m => ({ default: m.ContactFormPage })));;
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));;
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage').then(m => ({ default: m.CompanyDetailPage })));;
const CompanyFormPage = lazy(() => import('./pages/CompanyFormPage').then(m => ({ default: m.CompanyFormPage })));;
const PortalRoutes = lazy(() => import('./portal/PortalRoutes').then(m => ({ default: m.PortalRoutes })));;

/**
 * PORTAL-ONLY mode (ALT — Client Portal v4). When the build sets VITE_PORTAL_ONLY,
 * this same app is served at the separate portal domain as the white-label client
 * portal: only the portal (/sales/*) surface is reachable, the internal CRM routes
 * are not mounted, and the root/login land on the portal login. Default (unset) =
 * the normal full CRM — so the live CRM build is completely unaffected.
 */
const PORTAL_ONLY =
  import.meta.env.VITE_PORTAL_ONLY === '1' || import.meta.env.VITE_PORTAL_ONLY === 'true';

/** Shared full-screen loading spinner used while auth/roles hydrate. */
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-page-bg)' }}>
      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Guards the internal CRM routes. Requires a session. Additionally, a PURE sales
 * user (has a sales role but no internal role) is bounced to the Sales Portal so
 * they never see internal pages. Internal users (incl. admins who may also hold a
 * sales role) keep full access.
 *
 * Note: we wait for `loading` to clear before evaluating roles — otherwise a sales
 * user could be momentarily mis-classified as internal (empty roles) and flash the
 * internal app, or vice-versa. `loading` only clears once the profile + roles resolve.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isSalesUser, isInternalUser } = useAuth();

  // While session/roles are being hydrated, show nothing (avoids flash redirect)
  if (loading) return <RouteLoader />;

  if (!session) return <Navigate to="/" replace />;

  // Pure sales user (sales role, no internal role) → send to the Sales Portal.
  if (isSalesUser && !isInternalUser) return <Navigate to="/sales" replace />;

  return <>{children}</>;
}

/**
 * Guards the Lead Report Approvals queue (/approvals). Builds on ProtectedRoute
 * (session + internal-only), then narrows access to approvers — Admin, Team Lead,
 * or QC (role 6), which mirrors the Team Lead's approvals access since QC has no
 * other screen today (AMBIG B1/A5). Non-approver internal users (e.g. plain
 * agents) are bounced to the dashboard.
 */
function ApproverRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, isApprover } = useAuth();

  // Narrow to approvers only once auth/roles have hydrated and a session exists.
  // ProtectedRoute owns the loading spinner + no-session / pure-sales redirects;
  // here we only bounce a logged-in internal non-approver (e.g. a plain agent).
  if (!loading && session && !isApprover) return <Navigate to="/dashboard" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/**
 * Guards admin-only routes (e.g. the Import Wizard at /import). Builds on
 * ProtectedRoute (session + internal-only), then narrows to ADMIN. Mirrors how
 * the Super Admin nav entry is gated (Sidebar adminOnly). A logged-in internal
 * non-admin is bounced to the dashboard. The page itself also re-checks isAdmin
 * (defence in depth).
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, isAdmin } = useAuth();

  if (!loading && session && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

/**
 * Guards the Sales Portal routes (/sales/*). Requires a session AND that the user
 * is either a sales user OR an internal user — i.e. sales staff use it day-to-day,
 * and internal staff (e.g. admins) may also view it. Not logged in → /sales/login.
 */
function SalesProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isSalesUser, isInternalUser } = useAuth();

  if (loading) return <RouteLoader />;

  if (!session) return <Navigate to="/sales/login" replace />;

  // Logged in but neither sales nor internal — no portal access.
  if (!isSalesUser && !isInternalUser) return <Navigate to="/sales/login" replace />;

  // Wrap in the sales-shell provider so AppShell/Sidebar render the sales nav
  // for the reused LeadsPage / LeadDetailPage without touching those pages.
  return <SalesShellProvider>{children}</SalesShellProvider>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  // PORTAL-ONLY mode: mount ONLY the portal (/sales/*) surface. The internal CRM
  // routes are intentionally not registered here, so on the portal domain a client
  // can never reach a CRM page even by typing the URL. Same guards (SalesProtectedRoute)
  // and same pages as the in-CRM sales shell — one codebase, white-labeled per domain.
  if (PORTAL_ONLY) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Self-service password recovery still works on the portal domain. */}
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {/* Portal login. Any non-portal login URL folds into it. */}
          <Route path="/sales/login" element={<SalesLoginPage />} />
          <Route path="/login" element={<Navigate to="/sales/login" replace />} />
          <Route
            path="/sales"
            element={
              <SalesProtectedRoute>
                <LeadsPage />
              </SalesProtectedRoute>
            }
          />
          <Route
            path="/sales/leads/:id"
            element={
              <SalesProtectedRoute>
                <LeadDetailPage />
              </SalesProtectedRoute>
            }
          />
          <Route
            path="/sales/meetings"
            element={
              <SalesProtectedRoute>
                <MeetingsPage />
              </SalesProtectedRoute>
            }
          />
          <Route
            path="/sales/meetings/:id"
            element={
              <SalesProtectedRoute>
                <SalesMeetingDetailPage />
              </SalesProtectedRoute>
            }
          />
          <Route
            path="/sales/wishlist"
            element={
              <SalesProtectedRoute>
                <SalesWishlistPage />
              </SalesProtectedRoute>
            }
          />
          <Route
            path="/sales/feedback"
            element={
              <SalesProtectedRoute>
                <SalesPlaceholderPage title="Feedback" />
              </SalesProtectedRoute>
            }
          />
          {/* Everything else on the portal domain → portal home (guards/redirects as needed). */}
          <Route path="*" element={<Navigate to="/sales" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    // Single Suspense boundary for ALL lazily-loaded route pages: while a route's
    // chunk is in flight, show the shared spinner instead of a blank screen.
    <Suspense fallback={<RouteLoader />}>
    <Routes>
      <Route
        path="/"
        element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      {/* Internal login is also reachable at /login (footer link target from /sales/login) */}
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      {/* Self-service password recovery (ALT-197). Forgot = request a link; Reset =
         the recovery landing page. Reset is NOT session-gated: users arrive there in
         a temporary Supabase recovery session and must be able to set a new password. */}
      <Route
        path="/forgot-password"
        element={session ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ───────────────────────── Sales Portal (/sales/*) ─────────────────────────
         Additive shell behind its own route tree. Sales users land here; internal
         users may also view it. Data is NOT yet sales-scoped (RLS scoping is a
         later ticket) — the reused LeadsPage/LeadDetailPage currently show all
         leads the session can read. Meetings/Feedback are "Coming soon" stubs. */}
      <Route path="/sales/login" element={<SalesLoginPage />} />
      <Route
        path="/sales"
        element={
          <SalesProtectedRoute>
            {/* Reuses the internal LeadsPage as the sales home (not yet sales-scoped). */}
            <LeadsPage />
          </SalesProtectedRoute>
        }
      />
      <Route
        path="/sales/leads/:id"
        element={
          <SalesProtectedRoute>
            <LeadDetailPage />
          </SalesProtectedRoute>
        }
      />
      {/* Sales Meetings list — reuses the internal MeetingsPage under the sales
         shell (it self-detects the shell and links rows to /sales/meetings/:id). */}
      <Route
        path="/sales/meetings"
        element={
          <SalesProtectedRoute>
            <MeetingsPage />
          </SalesProtectedRoute>
        }
      />
      {/* Sales Meeting record — the "mobile-ditto" screen (ALT-275). */}
      <Route
        path="/sales/meetings/:id"
        element={
          <SalesProtectedRoute>
            <SalesMeetingDetailPage />
          </SalesProtectedRoute>
        }
      />
      {/* Sales Wishlist — prospect capture (ALT-276). Sales/portal users add a
         wishlist entry (Company + Prospect + Location) via WishlistCreateModal. */}
      <Route
        path="/sales/wishlist"
        element={
          <SalesProtectedRoute>
            <SalesWishlistPage />
          </SalesProtectedRoute>
        }
      />
      <Route
        path="/sales/feedback"
        element={
          <SalesProtectedRoute>
            <SalesPlaceholderPage title="Feedback" />
          </SalesProtectedRoute>
        }
      />
      {/* Unknown /sales/* path → sales home (which guards/redirects as needed). */}
      <Route path="/sales/*" element={<Navigate to="/sales" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <ContactsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/new"
        element={
          <ProtectedRoute>
            <ContactFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/:id"
        element={
          <ProtectedRoute>
            <ContactDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <ProtectedRoute>
            <CompaniesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/new"
        element={
          <ProtectedRoute>
            <CompanyFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/:id"
        element={
          <ProtectedRoute>
            <CompanyDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute>
            <LeadsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/board"
        element={
          <ProtectedRoute>
            <LeadsKanbanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/new"
        element={
          <ProtectedRoute>
            <LeadFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id"
        element={
          <ProtectedRoute>
            <LeadDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id/edit"
        element={
          <ProtectedRoute>
            <LeadFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings"
        element={
          <ProtectedRoute>
            <MeetingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings/:id"
        element={
          <ProtectedRoute>
            <MeetingDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <MyTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wishlist"
        element={
          <ProtectedRoute>
            <WishlistPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wishlist/:id"
        element={
          <ProtectedRoute>
            <WishlistDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ApproverRoute>
            <ApprovalsPage />
          </ApproverRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      {/* Admin-only Import Wizard (ALT-399). Frontend-only: parses/maps/validates/
         previews a CSV/XLSX, but performs NO writes — the final Import action is
         disabled pending the server-side admin import endpoint. */}
      <Route
        path="/import"
        element={
          <AdminRoute>
            <ImportPage />
          </AdminRoute>
        }
      />
      {/* Admin-only Recycle Bin (ALT-400). Lists soft-deleted companies + contacts
         and allows an admin to restore them. Gated by AdminRoute + isAdmin in the
         page itself. NOTE: validate restore against RLS before prod use. */}
      <Route
        path="/recycle-bin"
        element={
          <AdminRoute>
            <RecycleBinPage />
          </AdminRoute>
        }
      />
      {/* ───────────────────────── Client Portal (/portal/*) ─────────────────────────
         White-label (Amplior) client-facing portal. Net-new, fully isolated module:
         it owns its OWN login + guard (PortalProtectedRoute via usePortalSession) and
         reads ONLY the portal.* snapshot views — never CRM live-data pages. Sits OUTSIDE
         the CRM/sales guards. Inert until the portal schema is applied + exposed (ALT-229). */}
      <Route path="/portal/*" element={<PortalRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

/**
 * Global keyboard-shortcuts overlay host. Owns the "?" (Shift+/) keydown that
 * opens the KeyboardHelp modal — but only when the user ISN'T typing in a field
 * (input/textarea/contenteditable/select), so "?" stays usable as text. Esc
 * closes (handled inside KeyboardHelp).
 */
function KeyboardHelpHost() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // "?" is Shift+/ on most layouts; accept either the resolved key or the combo.
      if (e.key !== '?' && !(e.key === '/' && e.shiftKey)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Don't hijack "?" while the user is typing into a field.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        t?.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      setOpen((o) => !o);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return <KeyboardHelp open={open} onClose={() => setOpen(false)} />;
}

function App() {
  return (
    <AuthProvider>
      {/* Global project scope (ALT-273 / owner #8): reads the signed-in user's
         accessible projects and exposes the selected scope app-wide. Inside
         AuthProvider (needs profile/isAdmin); above the router so every page +
         the TopBar switcher share one scope. Inert "All projects" outside it. */}
      <ProjectProvider>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              {/* Top-level boundary (ALT-196): an uncaught render error in any route
                 shows a calm fallback instead of white-screening the whole SPA. */}
              <ErrorBoundary>
                <AppRoutes />
                {/* Global Cmd-K search (ALT-188); self-gates to logged-in internal users. */}
                <CommandPalette />
                {/* Global keyboard-shortcuts overlay — press "?" to open. */}
                <KeyboardHelpHost />
              </ErrorBoundary>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
