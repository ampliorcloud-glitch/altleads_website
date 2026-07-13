/**
 * Client Portal — SHELL / LAYOUT.
 *
 * A branded header + a simple top nav (Home / Meetings) + a sign-out control.
 * Wraps page content in the shared ErrorBoundary so one broken portal screen can't
 * white-screen the SPA. Deliberately does NOT import the CRM Sidebar / AppShell —
 * the portal is its own brand seam and must not pull in CRM chrome or data.
 */
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { supabase } from '../lib/supabase';
import { useBrand } from './brand';

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/portal', label: 'Home' },
  { to: '/portal/meetings', label: 'Meetings' },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const brand = useBrand();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-page-bg)', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          height: 56,
          padding: '0 20px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: brand.accent }}>
          {brand.logoText}
        </span>

        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              // Home must match exactly so it isn't "active" on every /portal/* route.
              end={item.to === '/portal'}
              style={({ isActive }) => ({
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                color: isActive ? brand.accent : '#4b5563',
                background: isActive ? 'rgba(196,149,106,0.08)' : 'transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleSignOut}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: 'transparent',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 13,
            fontWeight: 500,
            color: '#4b5563',
            cursor: 'pointer',
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </header>

      <main style={{ flex: 1, padding: '24px 20px', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <ErrorBoundary routeName="Portal">{children}</ErrorBoundary>
      </main>
    </div>
  );
}
