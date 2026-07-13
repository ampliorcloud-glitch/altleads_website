/**
 * NOTIFICATIONS feature flag (ALT-489).
 *
 * When false (default / prod): the NotificationBell dropdown is hidden; the
 * TopBar bell navigates to the existing /notifications page as before; the
 * data helpers in data/notifications.ts return empty / no-op results.
 *
 * Set to true to enable the in-app Notification Center (bell dropdown + 60 s
 * polling + mark-read + collaborator/assignment triggers).
 *
 * Prerequisite: the in_app_notification table already exists in production
 * (columns verified 2026-06-29 from live schema).
 */
export const NOTIFICATIONS = false;
