import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Users, CalendarDays, MessageSquare, Star, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

/**
 * Minimal sidebar for the Sales Portal (/sales/*). Mirrors the visual style of
 * the internal Sidebar but exposes only the sales-relevant entries. Meetings and
 * Feedback are placeholder ("Coming soon") routes for now — the shell ticket only
 * scaffolds navigation; their real pages land in later tickets.
 */
type SalesNavItem = { to: string; icon: typeof Users; label: string; end?: boolean };

const navItems: SalesNavItem[] = [
  { to: '/sales', icon: Users, label: 'Leads', end: true },
  { to: '/sales/meetings', icon: CalendarDays, label: 'Meetings' },
  { to: '/sales/wishlist', icon: Star, label: 'Wishlist' },
  { to: '/sales/feedback', icon: MessageSquare, label: 'Feedback' },
];

export function SalesSidebar({ collapsed }: { collapsed?: boolean }) {
  const { signOut, isInternalUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/sales/login', { replace: true });
  };

  return (
    <aside
      style={{
        width: collapsed ? 0 : 'var(--sidebar-width)',
        minHeight: '100vh',
        flexShrink: 0,
        background: 'var(--color-surface)',
        boxShadow: collapsed ? 'none' : 'var(--shadow-sm)',
        borderRight: collapsed ? 'none' : '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--duration-normal) var(--ease-out), background var(--duration-fast) ease, border-color var(--duration-fast) ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo / Wordmark + portal label */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 72,
          flexShrink: 0,
        }}
      >
        <Logo size="md" />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--color-brand)',
            background: 'var(--color-brand-light)',
            borderRadius: 'var(--radius-badge)',
            padding: '2px 6px',
            textTransform: 'uppercase',
          }}
        >
          Sales
        </span>
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, padding: '12px 14px 8px' }}>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 12px',
              height: 40,
              borderRadius: 'var(--radius-btn)',
              marginBottom: 4,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-brand)' : 'var(--color-gray-500)',
              background: isActive ? 'var(--color-brand-light)' : 'transparent',
              textDecoration: 'none',
              transition: 'background var(--duration-fast), color var(--duration-fast)',
              position: 'relative',
            })}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'var(--color-surface-hover)';
                el.style.color = 'var(--color-gray-700)';
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'transparent';
                el.style.color = 'var(--color-gray-500)';
              }
            }}
          >
            {({ isActive }) => (
              <>
                {/* Active accent bar */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 20,
                      borderRadius: 2,
                      background: 'var(--color-brand)',
                    }}
                  />
                )}
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'var(--color-brand)' : 'var(--color-surface-alt)',
                    flexShrink: 0,
                    transition: 'background var(--duration-fast)',
                  }}
                >
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.75} color={isActive ? '#fff' : 'currentColor'} />
                </span>
                <span style={{ flex: 1 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: back-to-CRM (internal/admin users only) + theme toggle + logout */}
      <div style={{ padding: '12px 14px 20px', borderTop: '1px solid var(--border-color)' }}>
        {isInternalUser && (
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0 12px',
              height: 40,
              borderRadius: 'var(--radius-btn)',
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-gray-500)',
              fontSize: 14,
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'background var(--duration-fast), color var(--duration-fast)',
              textAlign: 'left',
              marginBottom: 4,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-700)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-500)';
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface-alt)',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.75} />
            </span>
            Back to CRM
          </button>
        )}
        <div style={{ padding: '4px 10px 8px' }}>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 12px',
            height: 40,
            borderRadius: 'var(--radius-btn)',
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-gray-500)',
            fontSize: 14,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'background var(--duration-fast), color var(--duration-fast)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-700)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-500)';
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-surface-alt)',
              flexShrink: 0,
            }}
          >
            <LogOut size={16} strokeWidth={1.75} />
          </span>
          Log Out
        </button>
      </div>
    </aside>
  );
}
