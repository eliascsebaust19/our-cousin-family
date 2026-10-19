/**
 * Calendar date helpers.
 *
 * Two kinds of event exist and they behave differently:
 *
 *  - **Timed events** are instants: every viewer sees them in their own
 *    local timezone (a 6 pm dinner is 6 pm for everyone in one family).
 *  - **All-day events** are *dates*, not instants: they are stored at
 *    00:00 UTC of the chosen day and always rendered with `timeZone: "UTC"`,
 *    so a birthday is the same day for everyone regardless of where they are.
 *
 * Everything here is deliberately free of dependencies so it can be unit
 * tested later without a DOM.
 */

/** "YYYY-MM-DD" in the viewer's local timezone. */
export function localDateKey(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** "YYYY-MM-DD" in UTC (all-day events). */
export function utcDateKey(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/** Which calendar cell an event belongs to. */
export function eventDateKey(event: { starts_at: string; all_day: boolean }): string {
  return event.all_day ? utcDateKey(event.starts_at) : localDateKey(event.starts_at);
}

export function todayKey(): string {
  return localDateKey(new Date());
}

/** "YYYY-MM-DD" → a Date at local midnight (never UTC midnight). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

// ----------------------------------------------------------------------------
// Form input conversions
// ----------------------------------------------------------------------------

/** ISO → value for `<input type="date">` (all-day events store UTC midnight). */
export function toInputDate(iso: string | Date): string {
  if (iso instanceof Date) return localDateKey(iso);
  return iso.slice(0, 10);
}

/** ISO → value for `<input type="datetime-local">`, in local time. */
export function toInputDateTime(iso: string | Date): string {
  const d = toDate(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** `<input type="date">` → ISO at UTC midnight. */
export function fromInputDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/**
 * `<input type="date">` → ISO at the *end* of that UTC day, used for all-day
 * end dates so "Oct 18 – Oct 20" actually covers all of October 20.
 */
export function fromInputDateEnd(value: string): string {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

/** `<input type="datetime-local">` → ISO in local time. */
export function fromInputDateTime(value: string): string {
  return new Date(value).toISOString();
}

// ----------------------------------------------------------------------------
// Month grid
// ----------------------------------------------------------------------------

export function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function addMonths(value: Date, delta: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * The grid for one month: a flat array of weeks, each week seven local date
 * keys, starting Sunday. Rows are 5 or 6 depending on the month, and every
 * cell (including the leading/trailing padding) is a real date so cell styling
 * can be uniform.
 */
export function monthMatrix(month: Date): string[][] {
  const year = month.getFullYear();
  const first = new Date(year, month.getMonth(), 1);
  const leading = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month.getMonth() + 1, 0).getDate();

  const cells: string[] = [];
  for (let i = 0; i < leading; i++) {
    cells.push(localDateKey(new Date(year, month.getMonth(), 1 - (leading - i))));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(localDateKey(new Date(year, month.getMonth(), day)));
  }
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push(localDateKey(new Date(year, month.getMonth(), cells.length - leading + 1)));
  }

  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// ----------------------------------------------------------------------------
// Display
// ----------------------------------------------------------------------------

export function monthLabel(month: Date): string {
  return month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** "Today", "Tomorrow", or "Sat, Oct 18". */
export function dayHeading(key: string): string {
  const date = fromDateKey(key);
  const today = fromDateKey(todayKey());
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const named = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (diff === 0) return `Today · ${named}`;
  if (diff === 1) return `Tomorrow · ${named}`;
  if (diff === -1) return `Yesterday · ${named}`;
  return named;
}

function clockTime(value: string | Date): string {
  return toDate(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Compact time for a list row: "All day" or "6:00 PM" (with an end time). */
export function formatEventTime(event: {
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
}): string {
  if (event.all_day) return "All day";
  if (!event.ends_at) return clockTime(event.starts_at);
  const start = toDate(event.starts_at);
  const end = toDate(event.ends_at);
  if (localDateKey(start) === localDateKey(end)) {
    return `${clockTime(start)} – ${clockTime(end)}`;
  }
  return `${clockTime(start)} – ${clockTime(end)}`;
}

/** Full line for a detail sheet: "Sat, Oct 18 · 6:00 – 8:00 PM". */
export function formatEventWhen(event: {
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
}): string {
  const start = toDate(event.starts_at);

  if (event.all_day) {
    const day = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const end = event.ends_at ? toDate(event.ends_at) : null;
    if (end && utcDateKey(end) !== utcDateKey(start)) {
      const endDay = end.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      return `${day} – ${endDay} · All day`;
    }
    return `${day} · All day`;
  }

  const day = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!event.ends_at) return `${day} · ${clockTime(start)}`;

  const end = toDate(event.ends_at);
  if (localDateKey(start) === localDateKey(end)) {
    return `${day} · ${clockTime(start)} – ${clockTime(end)}`;
  }
  const endDay = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} ${clockTime(start)} – ${endDay} ${clockTime(end)}`;
}
