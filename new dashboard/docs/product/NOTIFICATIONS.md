# In-App Notification Center (ALT-489)

> Status: **built dark behind `NOTIFICATIONS` flag** (`new-code/web/src/lib/notificationsFlag.ts`). Prod unchanged until flipped. This doc is the spec + current state.

## Why
Internal-launch UX gap: agents/TLs had no in-app signal when a lead was assigned to them, a collaborator was added, or an approval moved. Email-only notification is too slow for live outreach work. ERPNext/EspoCRM/Vtiger all have an in-app bell + feed; this is table-stakes.

## What it is
A bell icon in the top bar with an unread badge + a dropdown feed of recent notifications. Clicking a notification marks it read and (optionally) navigates to the linked record.

- **Bell + badge:** `new-code/web/src/components/notifications/NotificationBell.tsx`, mounted in `TopBar.tsx` (ternary against the existing nav button; only renders when `NOTIFICATIONS` is true).
- **Data layer:** `new-code/web/src/data/notifications.ts` — thin wrappers over the `in_app_notification` helpers in `data/account.ts`.

## Data model — `in_app_notification` (existing table, no migration needed)
The table already exists in prod; ALT-489 only reads/writes it. Columns used:

| Column            | Type        | Role |
|-------------------|-------------|------|
| `notification_id` | bigint PK   | identity |
| `user_id`         | bigint      | **recipient** (app user_id) |
| `status`          | varchar     | used as the human-readable **title / label** |
| `notif_descr`     | varchar     | body / message text |
| `route`           | varchar     | client-side path to navigate on click (e.g. `/leads/123`) |
| `is_seen`         | bool        | read/unread |
| `lead_id` / `report_id` / `meeting_id` | bigint | optional record links |
| audit cols        | —           | created_by / created_date / … |

> Note the slightly counter-intuitive mapping: `status` holds the **title**, `notif_descr` holds the **body**. The data layer names (`type` → `status`, `descr` → `notif_descr`) hide this so callers read naturally.

## Public data API (`data/notifications.ts`)
- `listNotifications(userId, limit)` — recent feed for the bell dropdown.
- `unreadCount(userId)` — badge number.
- `markRead(notificationId)` / `markAllRead(userId)`.
- `createNotification({ recipientUserId, type, descr, route, lead_id?, report_id?, meeting_id? })` — insert one row.

## Triggers wired so far
- **Lead assignment** (already wired pre-ALT-489): `data/assignment.ts` fires `notifyInApp` / `fireOwnerNotify` on reassign.
- **Collaborator added** (ALT-441/442): `data/collaborators.ts` calls `createNotification` for the new collaborator.

## Security note (must harden before flag-on at scale)
Creating notifications for **other** users via the browser uses the user's own Supabase session — fine for the current low-risk triggers, but the durable design is to route cross-user notification writes through **notify-service** (service-role), same as the write-gateway. There's a `TODO(notify-service)` marker at the `createNotification` callsite. Not a launch blocker for the current triggers (assignment/collaborator), but do this before broad automation-driven notifications.

## To enable
1. (No migration — table exists.)
2. Flip `NOTIFICATIONS = true` in `new-code/web/src/lib/notificationsFlag.ts`.
3. Rebuild + redeploy. Validate the bell shows for a user with assigned leads; confirm unread badge clears on read.
4. (Before scale) move cross-user `createNotification` writes behind notify-service.

## Related
- Realtime push (Supabase Realtime subscription so the badge updates without refresh) is a **future enhancement** — v1 polls on mount / nav. Candidate follow-up ticket.
- Browser/native push notifications are out of scope for v1 (in-app only).
