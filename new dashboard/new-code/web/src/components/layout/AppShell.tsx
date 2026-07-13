import React from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SalesSidebar } from './SalesSidebar';
import { TopBar } from './TopBar';
import { RouteErrorBoundary } from '../ui/ErrorBoundary';
import { useIsSalesShell } from '../../contexts/SalesShellContext';
import { pageTransition, pageTransitionConfig } from '../../lib/zenAnimations';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  // When rendered inside the Sales Portal route tree (/sales/*), swap the
  // internal nav for the minimal sales sidebar. Reused pages (LeadsPage,
  // LeadDetailPage) need no changes — the context provider in App.tsx flips this.
  const isSalesShell = useIsSalesShell();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: 'var(--color-page-bg)',
        transition: 'background var(--duration-normal) ease',
      }}
    >
      {isSalesShell ? (
        <SalesSidebar collapsed={sidebarCollapsed} />
      ) : (
        <Sidebar collapsed={sidebarCollapsed} />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
        {/* Per-route boundary: a render-time throw in the page CONTENT shows a
            calm fallback in the content area while the sidebar/topbar stay alive,
            so navigation survives one broken screen (mirrors PortalLayout). */}
        <main
          className="flex-1 overflow-auto"
          style={{
            padding: '24px',
            scrollBehavior: 'smooth',
          }}
        >
          <RouteErrorBoundary name="page">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageTransition}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransitionConfig}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
