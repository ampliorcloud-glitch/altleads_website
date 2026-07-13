import React, { useEffect, useState } from 'react';
import { Bell, Menu } from 'lucide-react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUnreadNotifCount } from '../../data/account';
import { NOTIFICATIONS } from '../../lib/notificationsFlag';
import { NotificationBell } from '../notifications/NotificationBell';
import { ProjectSwitcher } from './ProjectSwitcher';
import { GlobalSearchBar } from '../ui/GlobalSearchBar';
import { ThemeToggle } from '../ui/ThemeToggle';

interface TopBarProps {
  title: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

type Crumb = { label: string };

/**
 * Derive a page-aware breadcrumb trail from the current route.
 * Returns 1–2 segments, e.g. ["Leads"] or ["Leads", "Lead Detail"].
 * Layout/visual only — does not affect navigation or data.
 */
function useBreadcrumb(title: string): Crumb[] {
  const { pathname } = useLocation();
  const params = useParams();

  // Section label keyed by the first path segment.
  const SECTION_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    leads: 'Leads',
    meetings: 'Meetings',
    wishlist: 'Wish List',
    notifications: 'Notifications',
    approvals: 'Approvals',
    admin: 'Super Admin',
    settings: 'Settings',
  };

  const segments = pathname.split('/').filter(Boolean);
  const section = segments[0] ?? '';
  const sectionLabel = SECTION_LABELS[section] ?? title;

  // Single-level sections: just the section name.
  if (segments.length <= 1) {
    return [{ label: sectionLabel }];
  }

  // Determine the leaf label for nested routes.
  const tail = segments[segments.length - 1];
  let leaf: string;

  if (section === 'leads') {
    if (tail === 'new') leaf = 'New Lead';
    else if (tail === 'edit') leaf = 'Edit Lead';
    else if (params.id) leaf = 'Lead Detail';
    else leaf = title;
  } else if (section === 'meetings') {
    leaf = params.id ? 'Meeting Detail' : title;
  } else if (section === 'wishlist') {
    leaf = params.id ? 'Wish List Detail' : title;
  } else {
    leaf = title;
  }

  return [{ label: sectionLabel }, { label: leaf }];
}

export function TopBar({ title, sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  const { userEmail, profile, isInternalUser } = useAuth();
  const crumbs = useBreadcrumb(title);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Unread in-app notification count for the bell badge. Refetched on every route
  // change so it updates after the user visits /notifications and marks them read.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchUnreadNotifCount(profile?.user_id ?? null).then((n) => {
      if (!cancelled) setUnread(n);
    });
    return () => { cancelled = true; };
  }, [profile?.user_id, pathname]);

  const displayEmail = userEmail || profile?.email || '';
  const displayName = profile?.full_name || displayEmail.split('@')[0] || '';
  const displayRole = profile?.role ?? 'Agent';

  const initials = displayName
    ? displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : (displayEmail.substring(0, 2).toUpperCase() || 'AC');

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        transition: 'background var(--duration-fast) ease, border-color var(--duration-fast) ease',
      }}
    >
      {/* Left: toggle button + page-aware breadcrumb (route-derived) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 'var(--radius-btn)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-gray-500)',
            transition: 'background var(--duration-fast) ease, color var(--duration-fast) ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-900)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-500)';
          }}
          title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
        >
          <Menu size={18} />
        </button>
        <nav
          aria-label="Breadcrumb"
          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      color: 'var(--color-gray-300)',
                      fontSize: 14,
                      lineHeight: 1,
                      opacity: 0.5,
                    }}
                  >
                    /
                  </span>
                )}
                <span
                  aria-current={isLast ? 'page' : undefined}
                  style={{
                    fontSize: 14,
                    fontWeight: isLast ? 600 : 400,
                    color: isLast ? 'var(--color-gray-900)' : 'var(--color-gray-400)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {crumb.label}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: project scope + search + theme + bell + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Global project scope selector (ALT-273 / owner #8). Self-hides for users
           with <2 accessible projects. Internal users only — sits left of search. */}
        {isInternalUser && <ProjectSwitcher />}

        {/* Always-visible global search bar (ALT-213). Shows grouped results inline
           as you type, reusing the same shared index as the Cmd-K palette (which
           still works via its own ⌘K/Ctrl-K listener). Internal users only. */}
        {isInternalUser && <GlobalSearchBar />}

        {/* Theme toggle for light/dark mode switching */}
        <ThemeToggle />

        {/* Bell notification icon.
            NOTIFICATIONS=true  → NotificationBell dropdown (ALT-489, in-app center).
            NOTIFICATIONS=false → plain nav to /notifications page (prod default). */}
        {NOTIFICATIONS ? (
          <NotificationBell />
        ) : (
          <button
            onClick={() => navigate('/notifications')}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-btn)',
              border: '1px solid var(--border-color)',
              background: 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-gray-500)',
              transition: 'background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) ease',
            }}
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
            title={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)'; }}
          >
            <Bell size={15} strokeWidth={1.5} />
            {unread > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', top: -3, right: -3,
                  minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: 999, background: 'var(--color-danger)',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--color-surface)', lineHeight: 1,
                }}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        )}

        {/* User section: avatar + name + role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Circular avatar — warm terracotta accent */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--color-brand-light)',
              border: '2px solid var(--color-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand-dark)',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
              userSelect: 'none',
            }}
            title={displayName}
          >
            {initials}
          </div>

          {/* Name + role stack */}
          <div style={{ lineHeight: 1.2 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-gray-900)',
                letterSpacing: '-0.01em',
              }}
            >
              {displayName || displayEmail}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: 'var(--color-gray-400)',
                fontWeight: 400,
              }}
            >
              {displayRole}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
