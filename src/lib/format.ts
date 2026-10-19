import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  differenceInCalendarDays,
  parseISO,
  nextDay,
} from "date-fns";

function toDate(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = typeof iso === "string" ? parseISO(iso) : iso;
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** "3 minutes ago" / "2 days ago" — for feeds and notifications. */
export function timeAgo(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "just now";
  try {
    return formatDistanceToNowStrict(d, { addSuffix: true });
  } catch {
    return "just now";
  }
}

/** Chat-friendly time: "10:32 PM", "Yesterday 10:32 PM", "Mar 3, 10:32 PM". */
export function messageTime(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "";
  try {
    const time = format(d, "h:mm a");
    if (isToday(d)) return time;
    if (isYesterday(d)) return `Yesterday ${time}`;
    return `${format(d, "MMM d")}, ${time}`;
  } catch {
    return "";
  }
}

/** Full timestamp for tooltips/aria-labels. */
export function fullTimestamp(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "";
  try {
    return format(d, "EEEE, MMMM d, yyyy 'at' h:mm a");
  } catch {
    return "";
  }
}

/** Section headers for chat: Today / Yesterday / March 2026. */
export function dayLabel(iso: string | Date | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "";
  try {
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

/** "March 3" — birthdays without a year. */
export function formatBirthday(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("-").map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d || Number.isNaN(m) || Number.isNaN(d)) return "";
  try {
    const dt = new Date(2000, m - 1, d);
    return format(dt, "MMMM d");
  } catch {
    return "";
  }
}

/**
 * Where a birthday falls next, e.g. { daysUntil: 0, label: "Today" }.
 * Works across year boundaries.
 */
export function upcomingBirthday(
  birthday: string | null | undefined,
  now: Date = new Date(),
): { daysUntil: number; label: string; nextDate: Date } {
  if (!birthday || typeof birthday !== "string") {
    return { daysUntil: 0, label: "Today", nextDate: now };
  }
  const parts = birthday.split("-").map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d || Number.isNaN(m) || Number.isNaN(d)) {
    return { daysUntil: 0, label: "Today", nextDate: now };
  }
  let next = new Date(now.getFullYear(), m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < today) {
    next = new Date(now.getFullYear() + 1, m - 1, d);
  }
  const daysUntil = differenceInCalendarDays(next, today);
  const label =
    daysUntil === 0
      ? "Today"
      : daysUntil === 1
        ? "Tomorrow"
        : `In ${daysUntil} days`;
  return { daysUntil, label, nextDate: next };
}

/** Progress inside a day as a fraction — used by calendar "today" marker. */
export function isSameDay(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return false;
  try {
    return differenceInCalendarDays(da, db) === 0;
  } catch {
    return false;
  }
}

export { nextDay };
