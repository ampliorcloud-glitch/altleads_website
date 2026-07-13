import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Contact2,
  CalendarDays,
  CheckSquare,
  Star,
  Bell,
  ShieldCheck,
  Settings,
  LogOut,
  ClipboardCheck,
  Upload,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { fetchPendingCount } from '../../data/approvals';
import { fetchUnreadNotifCount } from '../../data/account';
import { ThemeToggle } from '../ui/ThemeToggle';

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
  approverOnly?: boolean;
};

// Grouped navigation structure
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'Data',
    items: [
      { to: '/leads', icon: Users, label: 'Leads' },
      { to: '/companies', icon: Building2, label: 'Companies' },
      { to: '/contacts', icon: Contact2, label: 'Contacts' },
      { to: '/meetings', icon: CalendarDays, label: 'Meetings' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { to: '/tasks', icon: CheckSquare, label: 'My Tasks' },
      { to: '/wishlist', icon: Star, label: 'Wishlist' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/approvals', icon: ClipboardCheck, label: 'Approvals', approverOnly: true },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/import', icon: Upload, label: 'Import', adminOnly: true },
      { to: '/recycle-bin', icon: Trash2, label: 'Recycle Bin', adminOnly: true },
      { to: '/admin', icon: ShieldCheck, label: 'Super Admin', adminOnly: true },
    ],
  },
];

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const { profile, signOut, isAdmin, isApprover } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Fetch pending approvals count for the Approvals badge (non-blocking, best-effort)
  useEffect(() => {
    if (!isApprover) return;
    let cancelled = false;
    fetchPendingCount().then((c) => { if (!cancelled) setPendingCount(c); });
    // Refresh every 60 s while the sidebar is mounted
    const id = setInterval(() => {
      fetchPendingCount().then((c) => { if (!cancelled) setPendingCount(c); });
    }, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isApprover]);

  // Fetch unread notification count for the Bell badge (non-blocking, best-effort)
  useEffect(() => {
    const userId = profile?.user_id ?? null;
    if (userId == null) return;
    let cancelled = false;
    fetchUnreadNotifCount(userId).then((c) => { if (!cancelled) setUnreadNotifCount(c); });
    const id = setInterval(() => {
      fetchUnreadNotifCount(userId).then((c) => { if (!cancelled) setUnreadNotifCount(c); });
    }, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [profile?.user_id]);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const displayName = profile?.full_name || 'Demo User';
  const displayRole = profile?.role ?? 'Agent';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();

  // Filter sections by role
  const filteredSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((navItem) => {
        if (navItem.adminOnly) return isAdmin;
        if (navItem.approverOnly) return isApprover;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      style={{
        width: collapsed ? 0 : 'var(--sidebar-width)',
        minHeight: '100vh',
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderRight: collapsed ? 'none' : '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--duration-normal) var(--ease-out), background var(--duration-fast) ease, border-color var(--duration-fast) ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo / Wordmark */}
      <div
        style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 72,
          flexShrink: 0,
        }}
      >
        <Logo size="md" />
      </div>

      {/* Sectioned Navigation */}
      <nav style={{ flex: 1, padding: '8px 12px', overflowY: 'auto' }}>
        {filteredSections.map((section) => (
          <div key={section.title}>
            <div className="sidebar-section-label">{section.title}</div>
            {section.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 12px',
                  height: 38,
                  borderRadius: 'var(--radius-btn)',
                  marginBottom: 2,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-brand-dark)' : 'var(--color-gray-500)',
                  background: isActive ? 'var(--color-brand-light)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) ease',
                  position: 'relative',
                  letterSpacing: '0.01em',
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
                          height: 18,
                          borderRadius: 2,
                          background: 'var(--color-brand)',
                        }}
                      />
                    )}
                    <Icon
                      size={16}
                      strokeWidth={isActive ? 2 : 1.5}
                      color={isActive ? 'var(--color-brand)' : 'currentColor'}
                    />
                    <span style={{ flex: 1 }}>{label}</span>
                    {/* Pending count badge on Approvals link */}
                    {to === '/approvals' && pendingCount > 0 && (
                      <span
                        style={{
                          minWidth: 18,
                          height: 18,
                          borderRadius: 9,
                          background: 'var(--color-danger)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                        }}
                      >
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                    {/* Unread count badge on Notifications link */}
                    {to === '/notifications' && unreadNotifCount > 0 && (
                      <span
                        style={{
                          minWidth: 18,
                          height: 18,
                          borderRadius: 9,
                          background: 'var(--color-danger)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                        }}
                      >
                        {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom section: user card + settings + logout */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
        {/* User Card */}
        <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl" style={{ background: 'var(--color-surface-alt)' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--color-brand-light)',
              border: '2px solid var(--color-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-dark)',
              fontWeight: 700,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-gray-900)', margin: 0 }}>{displayName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--color-gray-400)', margin: 0 }}>{displayRole}</p>
          </div>
        </div>

        {/* Settings */}
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 12px',
            height: 36,
            borderRadius: 'var(--radius-btn)',
            marginBottom: 2,
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--color-brand-dark)' : 'var(--color-gray-500)',
            background: isActive ? 'var(--color-brand-light)' : 'transparent',
            textDecoration: 'none',
            transition: 'background var(--duration-fast) var(--ease-out)',
          })}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {({ isActive }) => (
            <>
              <Settings size={15} strokeWidth={isActive ? 2 : 1.5} color={isActive ? 'var(--color-brand)' : 'currentColor'} />
              <span>Settings</span>
            </>
          )}
        </NavLink>

        {/* Theme Toggle */}
        <div style={{ padding: '4px 10px 6px' }}>
          <ThemeToggle />
        </div>

        {/* Log Out */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 12px',
            height: 36,
            borderRadius: 'var(--radius-btn)',
            width: '100%',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-gray-500)',
            fontSize: 13,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) ease',
            textAlign: 'left',
            letterSpacing: '0.01em',
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
          <LogOut size={15} strokeWidth={1.5} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
