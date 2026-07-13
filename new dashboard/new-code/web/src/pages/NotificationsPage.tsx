import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchNotifications,
  markNotificationSeen,
  markAllNotificationsSeen,
  formatRelativeTime,
  formatDate,
  type AppNotification,
} from '../data/account';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';

type Tab = 'all' | 'unread';

function NotificationRow({
  n,
  onMarkSeen,
  onOpen,
}: {
  n: AppNotification;
  onMarkSeen: (id: number) => void;
  onOpen: (n: AppNotification) => void;
}) {
  const clickable = !!n.route;
  // `status` is the human-readable label (e.g. 'Approved', 'Rejected',
  // 'New Meeting', 'Approval Requested'); read/unread lives in `is_seen`.
  const title =
    (n.status && n.status.trim()) ||
    (n.leadNumber ? `Lead ${n.leadNumber}` : 'Notification');

  // The lead number is already shown as a separate chip beside the title, so the
  // message is just the descriptive text.
  const message = (n.description ?? '').trim();

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 border-b border-stone-100 last:border-0 transition-colors hover:bg-stone-50"
      style={{ background: n.isSeen ? '#fff' : '#fafaff', cursor: clickable ? 'pointer' : 'default' }}
      onClick={clickable ? () => onOpen(n) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(n);
              }
            }
          : undefined
      }
    >
      {/* Unread dot */}
      <div className="flex items-center justify-center" style={{ width: 8, marginTop: 6 }}>
        {!n.isSeen && (
          <span
            className="rounded-full"
            style={{ width: 7, height: 7, background: '#1A7EE8', display: 'block' }}
          />
        )}
      </div>

      {/* Icon */}
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: 32,
          height: 32,
          background: n.isSeen ? '#f4f4f5' : '#E8F2FD',
        }}
      >
        <Bell
          size={15}
          strokeWidth={1.75}
          className={n.isSeen ? 'text-stone-400' : 'text-blue-600'}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={n.isSeen ? 'text-stone-700' : 'text-stone-900'}
            style={{ fontSize: 13, fontWeight: n.isSeen ? 500 : 600 }}
          >
            {title}
          </p>
          {n.leadNumber && (
            <span
              className="text-stone-500 font-medium rounded"
              style={{ fontSize: 11, padding: '1px 6px', background: '#f4f4f5' }}
            >
              {n.leadNumber}
            </span>
          )}
        </div>
        {message && (
          <p className="text-stone-500 truncate" style={{ fontSize: 12, marginTop: 2 }}>
            {message}
          </p>
        )}
        <p className="text-stone-400" style={{ fontSize: 11, marginTop: 3 }} title={formatDate(n.createdDate)}>
          {formatRelativeTime(n.createdDate)}
        </p>
      </div>

      {/* Mark as read */}
      {!n.isSeen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkSeen(n.notificationId);
          }}
          className="flex items-center gap-1 text-stone-400 hover:text-blue-600 transition-colors shrink-0"
          style={{ fontSize: 11 }}
          title="Mark as read"
        >
          <Check size={13} strokeWidth={2} />
          Mark read
        </button>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const userId = profile?.user_id ?? null;
  // Audit identifier (updated_by) must be the current user's user_id, never a name.
  const actor = profile?.user_id != null ? String(profile.user_id) : 'system';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchNotifications(userId).then((res) => {
      if (cancelled) return;
      setNotifications(res.notifications);
      setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isSeen).length,
    [notifications],
  );

  const visible = useMemo(
    () => (tab === 'unread' ? notifications.filter((n) => !n.isSeen) : notifications),
    [tab, notifications],
  );

  const handleMarkSeen = async (id: number) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === id ? { ...n, isSeen: true } : n)),
    );
    const { error: err } = await markNotificationSeen(id, actor, userId);
    if (err) {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id ? { ...n, isSeen: false } : n)),
      );
      setError(err);
    }
  };

  const handleOpen = (n: AppNotification) => {
    if (!n.route) return;
    // Mark seen on open (optimistic) and navigate to the linked page.
    if (!n.isSeen) handleMarkSeen(n.notificationId);
    navigate(n.route);
  };

  const handleMarkAll = async () => {
    if (userId == null || unreadCount === 0) return;
    setMarking(true);
    const snapshot = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, isSeen: true })));
    const { error: err } = await markAllNotificationsSeen(userId, actor);
    if (err) {
      setNotifications(snapshot);
      setError(err);
    }
    setMarking(false);
  };

  return (
    <AppShell title="Notifications">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Header row: tabs + mark all */}
        <div className="flex items-center justify-between">
          <div
            className="inline-flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5"
          >
            {(['all', 'unread'] as Tab[]).map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="rounded-md font-medium transition-colors"
                  style={{
                    fontSize: 12,
                    padding: '4px 12px',
                    background: active ? '#1A7EE8' : 'transparent',
                    color: active ? '#fff' : '#52525b',
                  }}
                >
                  {t === 'all' ? 'All' : 'Unread'}
                  {t === 'unread' && unreadCount > 0 && (
                    <span
                      className="ml-1.5 rounded-full"
                      style={{
                        fontSize: 11,
                        padding: '0 6px',
                        background: active ? 'rgba(255,255,255,0.22)' : '#E8F2FD',
                        color: active ? '#fff' : '#1A7EE8',
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleMarkAll}
            disabled={unreadCount === 0 || marking || loading}
            className="flex items-center gap-1.5 border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 12, padding: '5px 12px', height: 30 }}
          >
            {marking ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CheckCheck size={14} strokeWidth={1.75} />
            )}
            Mark all as read
          </button>
        </div>

        {error && (
          <div
            className="px-4 py-2.5 rounded-lg border"
            style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c', fontSize: 12 }}
          >
            {error}
          </div>
        )}

        {/* List */}
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          {loading ? (
            <div
              className="flex items-center justify-center gap-2 text-stone-400"
              style={{ fontSize: 13, padding: '48px 16px' }}
            >
              <Loader2 size={16} className="animate-spin" />
              Loading notifications...
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3" style={{ padding: '56px 16px' }}>
              <div
                className="rounded-full bg-stone-100 flex items-center justify-center"
                style={{ width: 48, height: 48 }}
              >
                <Bell size={20} strokeWidth={1.5} className="text-stone-400" />
              </div>
              <div>
                <p className="font-semibold text-stone-700" style={{ fontSize: 14 }}>
                  {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-stone-400" style={{ fontSize: 12, marginTop: 2 }}>
                  {tab === 'unread'
                    ? 'You are all caught up.'
                    : 'Updates about your leads and meetings will appear here.'}
                </p>
              </div>
            </div>
          ) : (
            visible.map((n) => (
              <NotificationRow key={n.notificationId} n={n} onMarkSeen={handleMarkSeen} onOpen={handleOpen} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default NotificationsPage;
