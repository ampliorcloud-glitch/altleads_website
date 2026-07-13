/**
 * Task scheduling — IST (Asia/Kolkata) quick-schedule presets + bucketing.
 *
 * Every *human* due-time concept in the Task module is India time. We compute
 * presets ("Tomorrow 9am" = 9am IST) and day-bucketing (Overdue / Today /
 * Upcoming) against the Asia/Kolkata day boundary, then hand back absolute
 * `timestamptz` ISO strings (UTC instants). The DB stores UTC; only this display
 * layer reasons in IST — see TASK-MANAGER.md §6.5.
 *
 * IST has a fixed +05:30 offset (no DST), which keeps the math simple and exact:
 * we never depend on the viewer's browser timezone.
 */
import type { TaskStatus } from '../../data/tasks';

/** Fixed IST offset: +5h30m, in minutes. India observes no DST. */
const IST_OFFSET_MIN = 5 * 60 + 30;
const MS_PER_MIN = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

export type TaskBucket = 'Overdue' | 'Today' | 'Upcoming' | 'Completed';

/** Quick-schedule preset chips shown in the create modal. */
export type PresetKey = 'today5pm' | 'tomorrow9am' | 'in3days' | 'nextMonday' | 'custom';

export interface SchedulePreset {
  key: PresetKey;
  label: string;
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  { key: 'today5pm', label: 'Today 5pm' },
  { key: 'tomorrow9am', label: 'Tomorrow 9am' },
  { key: 'in3days', label: 'In 3 days' },
  { key: 'nextMonday', label: 'Next Monday' },
  { key: 'custom', label: 'Custom…' },
];

/* ------------------------------------------------------------------ */
/*  IST <-> UTC helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Wall-clock fields of an instant as seen in IST. Returned numbers are the
 * digits an Indian user would read on a clock/calendar.
 */
interface ISTParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  /** 0 = Sunday … 6 = Saturday (IST weekday). */
  weekday: number;
}

/** Decompose an absolute instant into IST wall-clock parts. */
export function toISTParts(instant: Date): ISTParts {
  // Shift the instant by the IST offset, then read UTC fields — those now equal
  // the IST wall-clock fields.
  const shifted = new Date(instant.getTime() + IST_OFFSET_MIN * MS_PER_MIN);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Build the absolute instant for a given IST wall-clock date+time. Inverse of
 * `toISTParts`: takes the digits a user picks in India and returns the UTC Date.
 */
export function istWallClockToInstant(
  year: number,
  month: number, // 1-12
  day: number, // 1-31
  hour: number,
  minute: number,
): Date {
  // Treat the wall-clock fields as if they were UTC, then subtract the offset to
  // get the true UTC instant.
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(asUtc - IST_OFFSET_MIN * MS_PER_MIN);
}

/** The IST midnight (00:00 IST) at the start of the IST day containing `instant`. */
function istStartOfDay(instant: Date): Date {
  const p = toISTParts(instant);
  return istWallClockToInstant(p.year, p.month, p.day, 0, 0);
}

/* ------------------------------------------------------------------ */
/*  Presets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolve a preset to an ISO `timestamptz` string, computed in IST relative to
 * `now`. Returns null for `custom` (the caller supplies a custom date+time).
 *
 * - today5pm     → 17:00 IST today
 * - tomorrow9am  → 09:00 IST tomorrow
 * - in3days      → 09:00 IST three days from today
 * - nextMonday   → 09:00 IST the next upcoming Monday (strictly after today)
 *
 * @param now defaults to the current instant; injectable for tests.
 */
export function presetToISO(key: PresetKey, now: Date = new Date()): string | null {
  if (key === 'custom') return null;

  const today = toISTParts(now);

  switch (key) {
    case 'today5pm':
      return istWallClockToInstant(today.year, today.month, today.day, 17, 0).toISOString();
    case 'tomorrow9am': {
      const base = istStartOfDay(now);
      const tomorrow = toISTParts(new Date(base.getTime() + MS_PER_DAY));
      return istWallClockToInstant(tomorrow.year, tomorrow.month, tomorrow.day, 9, 0).toISOString();
    }
    case 'in3days': {
      const base = istStartOfDay(now);
      const target = toISTParts(new Date(base.getTime() + 3 * MS_PER_DAY));
      return istWallClockToInstant(target.year, target.month, target.day, 9, 0).toISOString();
    }
    case 'nextMonday': {
      // Days until the next Monday (1). Always strictly in the future (1-7).
      const delta = ((1 - today.weekday + 7) % 7) || 7;
      const base = istStartOfDay(now);
      const target = toISTParts(new Date(base.getTime() + delta * MS_PER_DAY));
      return istWallClockToInstant(target.year, target.month, target.day, 9, 0).toISOString();
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  <input type="datetime-local"> <-> IST ISO                           */
/* ------------------------------------------------------------------ */

/**
 * Format an ISO instant as the `YYYY-MM-DDTHH:mm` value an
 * `<input type="datetime-local">` expects, with the time shown in IST so the
 * picker reads as India time regardless of browser timezone.
 */
export function isoToISTLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = toISTParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Parse a `<input type="datetime-local">` value (which has no timezone) as IST
 * wall-clock and return the absolute ISO instant.
 */
export function istLocalInputToISO(local: string): string | null {
  // Expected form: YYYY-MM-DDTHH:mm
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return istWallClockToInstant(
    Number(y),
    Number(mo),
    Number(d),
    Number(h),
    Number(mi),
  ).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Bucketing                                                           */
/* ------------------------------------------------------------------ */

/**
 * Bucket a task by status + due time, using the IST day boundary:
 * - Completed: status is DONE or SKIPPED (regardless of due time).
 * - Overdue:   OPEN and due_at < now.
 * - Today:     OPEN and due_at falls within today's IST calendar day.
 * - Upcoming:  OPEN and due_at is later than today's IST day.
 *
 * @param now defaults to the current instant; injectable for tests.
 */
export function bucketOf(
  status: TaskStatus,
  dueAtISO: string,
  now: Date = new Date(),
): TaskBucket {
  if (status === 'DONE' || status === 'SKIPPED') return 'Completed';

  const due = new Date(dueAtISO);
  if (due.getTime() < now.getTime()) return 'Overdue';

  const todayStart = istStartOfDay(now).getTime();
  const tomorrowStart = todayStart + MS_PER_DAY;
  if (due.getTime() < tomorrowStart) return 'Today';

  return 'Upcoming';
}

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** Render an ISO instant as a short IST date+time, e.g. "21 Jun, 5:00 PM". */
export function formatISTDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = toISTParts(new Date(iso));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? 'AM' : 'PM';
  const mm = String(p.minute).padStart(2, '0');
  return `${p.day} ${months[p.month - 1]}, ${h12}:${mm} ${ampm}`;
}

/**
 * Relative label vs now, e.g. "in 2h", "in 3d", "5m overdue", "due now".
 * Coarse by design — enough for a task row, not a precise countdown.
 */
export function relativeDueLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const diffMin = Math.round((new Date(iso).getTime() - now.getTime()) / MS_PER_MIN);
  const overdue = diffMin < 0;
  const mins = Math.abs(diffMin);

  let core: string;
  if (mins < 1) return 'due now';
  if (mins < 60) core = `${mins}m`;
  else if (mins < 60 * 24) core = `${Math.round(mins / 60)}h`;
  else core = `${Math.round(mins / (60 * 24))}d`;

  return overdue ? `${core} overdue` : `in ${core}`;
}

/* ------------------------------------------------------------------ */
/*  Snooze quick-options (+1h / Tonight / Tomorrow)                     */
/* ------------------------------------------------------------------ */

export type SnoozeKey = 'plus1h' | 'tonight' | 'tomorrow';

export interface SnoozeOption {
  key: SnoozeKey;
  label: string;
}

export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { key: 'plus1h', label: '+1 hour' },
  { key: 'tonight', label: 'Tonight (6pm)' },
  { key: 'tomorrow', label: 'Tomorrow 9am' },
];

/** Resolve a snooze quick-option to an ISO instant, computed in IST. */
export function snoozeToISO(key: SnoozeKey, now: Date = new Date()): string {
  switch (key) {
    case 'plus1h':
      return new Date(now.getTime() + 60 * MS_PER_MIN).toISOString();
    case 'tonight': {
      const today = toISTParts(now);
      return istWallClockToInstant(today.year, today.month, today.day, 18, 0).toISOString();
    }
    case 'tomorrow':
    default: {
      const base = istStartOfDay(now);
      const tomorrow = toISTParts(new Date(base.getTime() + MS_PER_DAY));
      return istWallClockToInstant(tomorrow.year, tomorrow.month, tomorrow.day, 9, 0).toISOString();
    }
  }
}
