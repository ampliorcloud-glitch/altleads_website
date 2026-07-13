/**
 * NotificationBell.tsx — Bell icon + unread-count badge + dropdown (ALT-489).
 *
 * Rendered in TopBar ONLY when NOTIFICATIONS === true.
 * Replaces the plain nav-to-/notifications button with an inline dropdown that
 * shows the 20 most recent notifications, supports mark-all-read, and navigates
 * to the record on click.
 *
 * Polling: unread count is refreshed on mount and every ~60 s. Full list is
 * fetched when the dropdown opens.
 *
 * TODO: web-push via Service Worker once the flag graduates to stable.
 * TODO: task-due / @mention / overdue notifications via scheduled job + event-spine.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  type AppNotification,
} from '../../data/notifications';
import { formatRelativeTime } from '../../data/account';

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const { profile } = useAuth();
  const userId = profile?.user_id ?? null;
  const actor = userId != null ? String(userId) : 'system';
  const navigate = useNavigate();

  const [badgeCount, setBadgeCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── badge polling ────────────────────────────────────────────────── */

  const refreshBadge = useCallback(async () => {
    const n = await unreadCount(userId);
    setBadgeCount(n);
  }, [userId]);

  useEffect(() => {
    void refreshBadge();
    const timer = setInterval(() => { void refreshBadge(); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshBadge]);

  /* ── dropdown open / close ────────────────────────────────────────── */

  const openDropdown = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    const { notifications: items } = await listNotifications(userId, 20);
    setNotifications(items);
    setLoading(false);
  }, [userId]);

  const closeDropdown = useCallback(() => setOpen(false), []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, closeDropdown]);

  /* ── actions ────────────────────────────────────────────────────────── */

  const handleMarkAllRead = useCallback(async () => {
    if (userId == null) return;
    await markAllRead(userId, actor);
    setNotifications((prev) => prev.map((n) => ({ ...n, isSeen: true })));
    setBadgeCount(0);
  }, [userId, actor]);

  const handleOpen = useCallback(
    async (n: AppNotification) => {
      // Mark as read (fire-and-forget).
      if (!n.isSeen) {
        void markRead(n.notificationId, actor, userId).then(() => {
          setNotifications((prev) =>
            prev.map((x) => (x.notificationId === n.notificationId ? { ...x, isSeen: true } : x)),
          );
          setBadgeCount((c) => Math.max(0, c - 1));
        });
      }
      if (n.route) {
        closeDropdown();
        navigate(n.route);
      }
    },
    [actor, userId, navigate, closeDropdown],
  );

  /* ── render ─────────────────────────────────────────────────────────── */

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={open ? closeDropdown : openDropdown}
        style={{
          position: 'relative',
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '1px solid var(--border-color)',
          background: open ? 'var(--color-gray-100)' : 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-gray-500)',
          transition: 'background 0.12s',
        }}
        aria-label={badgeCount > 0 ? `Notifications (${badgeCount} unread)` : 'Notifications'}
        title={badgeCount > 0 ? `${badgeCount} unread notification${badgeCount === 1 ? '' : 's'}` : 'Notifications'}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-100)'; }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface)';
        }}
      >
        <Bell size={15} strokeWidth={1.75} />
        {badgeCount > 0 && (
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
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            maxHeight: 480,
            borderRadius: 10,
            border: '1px solid var(--border-color)',
            background: 'var(--color-surface)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-900)' }}>
              Notifications
              {badgeCount > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: 'var(--color-danger)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {badgeCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, color: 'var(--color-brand)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 6px', borderRadius: 4,
                  }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={closeDropdown}
                title="Close"
                style={{
                  display: 'flex', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-gray-400)', padding: 4, borderRadius: 4,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-gray-400)' }} />
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 8, padding: '40px 16px', color: 'var(--color-gray-400)',
                }}
              >
                <Bell size={28} strokeWidth={1.25} />
                <span style={{ fontSize: 13 }}>No notifications yet</span>
              </div>
            ) : (
              notifications.map((n) => {
                const title =
                  (n.status?.trim()) ||
                  (n.leadNumber ? `Lead ${n.leadNumber}` : 'Notification');
                const message = (n.description ?? '').trim();
                const timeStr = formatRelativeTime(n.createdDate);
                const clickable = !!n.route;

                return (
                  <div
                    key={n.notificationId}
                    onClick={clickable ? () => { void handleOpen(n); } : undefined}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void handleOpen(n);
                            }
                          }
                        : undefined
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      background: n.isSeen ? 'transparent' : 'rgba(99,102,241,0.04)',
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (clickable) (e.currentTarget as HTMLElement).style.background = 'var(--color-gray-50, #f9fafb)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = n.isSeen ? 'transparent' : 'rgba(99,102,241,0.04)';
                    }}
                  >
                    {/* Unread dot */}
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                        background: n.isSeen ? 'transparent' : 'var(--color-brand)',
                        border: n.isSeen ? '1.5px solid var(--border-color)' : 'none',
                      }}
                    />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: 13, fontWeight: n.isSeen ? 500 : 600,
                            color: 'var(--color-gray-900)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        >
                          {title}
                        </span>
                        {n.leadNumber && (
                          <span
                            style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 5px',
                              borderRadius: 4, background: 'var(--color-brand-light)',
                              color: 'var(--color-brand)', flexShrink: 0,
                            }}
                          >
                            {n.leadNumber}
                          </span>
                        )}
                      </div>
                      {message && (
                        <p
                          style={{
                            margin: '0 0 4px', fontSize: 12, color: 'var(--color-gray-500)',
                            lineHeight: 1.45,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {message}
                        </p>
                      )}
                      {timeStr && (
                        <span style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>{timeStr}</span>
                      )}
                    </div>

                    {/* Mark-read check (only for unread) */}
                    {!n.isSeen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void markRead(n.notificationId, actor, userId).then(() => {
                            setNotifications((prev) =>
                              prev.map((x) =>
                                x.notificationId === n.notificationId ? { ...x, isSeen: true } : x,
                              ),
                            );
                            setBadgeCount((c) => Math.max(0, c - 1));
                          });
                        }}
                        title="Mark as read"
                        style={{
                          flexShrink: 0, display: 'flex', alignItems: 'center',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-gray-400)', padding: 4, borderRadius: 4,
                          marginTop: 2,
                        }}
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: link to full notifications page */}
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              padding: '8px 16px',
              flexShrink: 0,
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => { closeDropdown(); navigate('/notifications'); }}
              style={{
                fontSize: 12, color: 'var(--color-brand)', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 500,
              }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
