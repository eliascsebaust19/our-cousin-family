import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  differenceInCalendarDays,
  parseISO,
  nextDay,
} from "date-fns";

function toDate(iso: string | Date): Date {
  return typeof iso === "string" ? parseISO(iso) : iso;
}

/** "3 minutes ago" / "2 days ago" — for feeds and notifications. */
export function timeAgo(iso: string | Date): string {
  return formatDistanceToNowStrict(toDate(iso), { addSuffix: true });
}

/** Chat-friendly time: "10:32 PM", "Yesterday 10:32 PM", "Mar 3, 10:32 PM". */
export function messageTime(iso: string | Date): string {
  const d = toDate(iso);
  const time = format(d, "h:mm a");
  if (isToday(d)) return time;
  if (isYesterday(d)) return `Yesterday ${time}`;
  return `${format(d, "MMM d")}, ${time}`;
}

/** Full timestamp for tooltips/aria-labels. */
export function fullTimestamp(iso: string | Date): string {
  return format(toDate(iso), "EEEE, MMMM d, yyyy 'at' h:mm a");
}

/** Section headers for chat: Today / Yesterday / March 2026. */
export function dayLabel(iso: string | Date): string {
  const d = toDate(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

/** "March 3" — birthdays without a year. */
export function formatBirthday(dateStr: string): string {
  // date comes back as YYYY-MM-DD
  const [, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(2000, m - 1, d);
  return format(dt, "MMMM d");
}

/**
 * Where a birthday falls next, e.g. { daysUntil: 0, label: "Today" }.
 * Works across year boundaries.
 */
export function upcomingBirthday(
  birthday: string,
  now: Date = new Date(),
): { daysUntil: number; label: string; nextDate: Date } {
  const [, m, d] = birthday.split("-").map(Number);
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
export function isSameDay(a: string | Date, b: string | Date): boolean {
  return differenceInCalendarDays(toDate(a), toDate(b)) === 0;
}

export { nextDay };
