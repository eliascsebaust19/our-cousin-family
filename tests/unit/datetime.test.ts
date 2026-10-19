import { describe, expect, it } from "vitest";
import {
  WEEKDAY_LABELS,
  addMonths,
  eventDateKey,
  formatEventTime,
  formatEventWhen,
  fromDateKey,
  fromInputDate,
  fromInputDateEnd,
  fromInputDateTime,
  isSameMonth,
  localDateKey,
  monthMatrix,
  startOfMonth,
  toDate,
  toInputDate,
  toInputDateTime,
  todayKey,
  utcDateKey,
} from "@/lib/datetime";

/**
 * The calendar distinguishes two kinds of event:
 *
 *  - timed events are instants, rendered in the viewer's local timezone;
 *  - all-day events are *dates*, stored at 00:00 UTC and always read as UTC, so
 *    a birthday is the same day everywhere.
 *
 * Two rules keep these tests honest on any machine:
 *
 *  1. Dates are built from local components (`new Date(2026, 9, 18)`), and day
 *     arithmetic goes through calendar fields rather than milliseconds — a
 *     millisecond difference is not a day across a DST boundary.
 *  2. Assertions never inspect a localised string produced by
 *     `toLocaleDateString(undefined, …)`. The default locale comes from the
 *     operating system, so only literal UI copy ("All day") and structure are
 *     asserted. The timezone/locale *logic* is proven through the date-key
 *     helpers instead, which is where it actually lives.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("date keys", () => {
  it("formats a local date as YYYY-MM-DD, zero padded", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("reads UTC for all-day events", () => {
    expect(utcDateKey("2026-10-18T00:00:00.000Z")).toBe("2026-10-18");
    // 23:59 UTC is still the same calendar day, wherever the viewer is.
    expect(utcDateKey("2026-10-18T23:59:59.999Z")).toBe("2026-10-18");
  });

  it("picks the right key per event kind", () => {
    const timed = { starts_at: "2026-10-18T23:30:00.000Z", all_day: false };
    const allDay = { starts_at: "2026-10-18T00:00:00.000Z", all_day: true };

    expect(eventDateKey(allDay)).toBe("2026-10-18");
    expect(eventDateKey(timed)).toBe(localDateKey(timed.starts_at));
    // The all-day path must be independent of the machine's timezone.
    expect(eventDateKey(allDay)).toBe(utcDateKey(allDay.starts_at));
  });

  it("gives every event key the same shape", () => {
    for (const all_day of [true, false]) {
      expect(
        eventDateKey({ starts_at: "2026-03-09T04:05:06.000Z", all_day }),
      ).toMatch(DATE_KEY_RE);
    }
  });

  it("accepts both an ISO string and a Date", () => {
    const date = new Date(2026, 4, 9);
    expect(localDateKey(date)).toBe(localDateKey(date.toISOString()));
  });

  it("todayKey matches a local date key", () => {
    expect(todayKey()).toBe(localDateKey(new Date()));
    expect(todayKey()).toMatch(DATE_KEY_RE);
  });

  it("round-trips a key through fromDateKey at local midnight", () => {
    for (const key of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      const date = fromDateKey(key);
      // Local midnight — never UTC midnight, which would shift the day for
      // anyone west of Greenwich.
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
      expect(localDateKey(date)).toBe(key);
    }
  });

  it("toDate passes Dates through and parses strings", () => {
    const date = new Date(2026, 1, 2);
    expect(toDate(date)).toBe(date);
    expect(toDate("2026-02-02T00:00:00.000Z").toISOString()).toBe(
      "2026-02-02T00:00:00.000Z",
    );
  });
});

describe("form input conversions", () => {
  it("cuts an ISO string down to the date input value", () => {
    expect(toInputDate("2026-10-18T00:00:00.000Z")).toBe("2026-10-18");
  });

  it("renders a datetime-local value from local components", () => {
    expect(toInputDateTime(new Date(2026, 9, 18, 18, 5))).toBe("2026-10-18T18:05");
    expect(toInputDateTime(new Date(2026, 0, 2, 0, 0))).toBe("2026-01-02T00:00");
  });

  it("pads single-digit months, days, hours and minutes", () => {
    expect(toInputDateTime(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04");
  });

  it("anchors a date input at UTC midnight", () => {
    const iso = fromInputDate("2026-10-18");
    expect(iso).toBe("2026-10-18T00:00:00.000Z");
    expect(utcDateKey(iso)).toBe("2026-10-18");
  });

  it("anchors a date end at the exact end of the UTC day", () => {
    const iso = fromInputDateEnd("2026-10-18");
    expect(iso).toBe("2026-10-18T23:59:59.999Z");
    // Still the 18th, so a single-day event covers the whole day.
    expect(utcDateKey(iso)).toBe("2026-10-18");
  });

  it("keeps a multi-day all-day range inclusive of the final day", () => {
    const start = fromInputDate("2026-10-18");
    const end = fromInputDateEnd("2026-10-20");
    expect(utcDateKey(start)).toBe("2026-10-18");
    expect(utcDateKey(end)).toBe("2026-10-20");
    // If the end were midnight, the 20th would render as an extra empty day.
    expect(new Date(end).getTime()).toBeGreaterThan(
      new Date(fromInputDate("2026-10-20")).getTime(),
    );
  });

  it("takes a datetime-local value as local time", () => {
    const iso = fromInputDateTime("2026-10-18T18:05");
    expect(new Date(iso).getTime()).toBe(new Date(2026, 9, 18, 18, 5).getTime());
    expect(toInputDateTime(iso)).toBe("2026-10-18T18:05");
  });
});

describe("month arithmetic", () => {
  it("snaps to the first of the month", () => {
    const start = startOfMonth(new Date(2026, 9, 18, 15, 30));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(1);
  });

  it("adds and subtracts months across year boundaries", () => {
    expect(addMonths(new Date(2026, 0, 1), -1).getFullYear()).toBe(2025);
    expect(addMonths(new Date(2026, 0, 1), -1).getMonth()).toBe(11);
    expect(addMonths(new Date(2026, 11, 1), 1).getFullYear()).toBe(2027);
    expect(addMonths(new Date(2026, 11, 1), 1).getMonth()).toBe(0);
  });

  it("never lands on a day the target month does not have", () => {
    // Jan 31 + 1 month must be 1 Feb, not 3 March.
    const next = addMonths(new Date(2026, 0, 31), 1);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(1);
  });

  it("compares months", () => {
    expect(isSameMonth(new Date(2026, 9, 1), new Date(2026, 9, 31))).toBe(true);
    expect(isSameMonth(new Date(2026, 9, 1), new Date(2026, 10, 1))).toBe(false);
    expect(isSameMonth(new Date(2026, 9, 1), new Date(2025, 9, 1))).toBe(false);
  });
});

describe("monthMatrix", () => {
  const SAMPLE_MONTHS = [
    new Date(2026, 0, 15),
    new Date(2026, 1, 15),
    new Date(2026, 9, 15),
    new Date(2027, 7, 15),
  ];

  it("starts every week on a Sunday with seven cells", () => {
    for (const month of SAMPLE_MONTHS) {
      const weeks = monthMatrix(month);
      expect(weeks.length).toBeGreaterThanOrEqual(5);
      expect(weeks.length).toBeLessThanOrEqual(6);
      for (const week of weeks) {
        expect(week).toHaveLength(7);
        expect(fromDateKey(week[0]!).getDay()).toBe(0); // Sunday
        expect(fromDateKey(week[6]!).getDay()).toBe(6); // Saturday
      }
    }
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });

  it("emits real, correctly shaped date keys in every cell", () => {
    for (const month of SAMPLE_MONTHS) {
      for (const key of monthMatrix(month).flat()) {
        expect(key).toMatch(DATE_KEY_RE);
        // A valid key round-trips: no month 13, no day 32.
        const [, m, d] = key.split("-").map(Number);
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(31);
        expect(localDateKey(fromDateKey(key))).toBe(key);
      }
    }
  });

  it("contains every day of the month exactly once", () => {
    const keys = monthMatrix(new Date(2026, 9, 15)).flat(); // October 2026
    const inMonth = keys.filter((key) => key.startsWith("2026-10-"));
    expect(inMonth).toHaveLength(31);
    expect(new Set(inMonth).size).toBe(31);
    expect(inMonth[0]).toBe("2026-10-01");
    expect(inMonth[30]).toBe("2026-10-31");
  });

  it("produces consecutive days across row boundaries", () => {
    // Compared through calendar fields, not milliseconds: a DST boundary inside
    // the grid would make a millisecond difference 23 or 25 hours, not 24.
    const keys = monthMatrix(new Date(2026, 9, 15)).flat();
    for (let index = 1; index < keys.length; index += 1) {
      const previous = fromDateKey(keys[index - 1]!);
      const dayAfter = new Date(
        previous.getFullYear(),
        previous.getMonth(),
        previous.getDate() + 1,
      );
      expect(localDateKey(dayAfter)).toBe(keys[index]);
    }
  });

  it("pads with the neighbouring months' dates", () => {
    // 1 Oct 2026 is a Thursday, so the grid starts on Sunday 27 September.
    // October 31 is a Saturday, so it fills the 5th week exactly.
    const oct = monthMatrix(new Date(2026, 9, 15));
    expect(oct[0]![0]).toBe("2026-09-27");
    expect(oct.flat().at(-1)).toBe("2026-10-31");

    // 1 Sep 2026 is a Tuesday, so the grid starts in August and pads into October.
    const sep = monthMatrix(new Date(2026, 8, 15));
    expect(sep[0]![0]).toMatch(/^2026-08-/);
    expect(sep.flat().at(-1)).toMatch(/^2026-10-/);
  });

  it("handles a month that starts on a Sunday without leading padding", () => {
    // 1 November 2026 is a Sunday.
    expect(monthMatrix(new Date(2026, 10, 15))[0]![0]).toBe("2026-11-01");
  });

  it("handles February in a common and a leap year", () => {
    const common = monthMatrix(new Date(2026, 1, 15)).flat();
    expect(common.filter((key) => key.startsWith("2026-02-"))).toHaveLength(28);

    const leap = monthMatrix(new Date(2028, 1, 15)).flat();
    expect(leap.filter((key) => key.startsWith("2028-02-"))).toHaveLength(29);
    // 29 Feb is real, not normalised away to 1 March.
    expect(leap).toContain("2028-02-29");
  });

  it("never repeats a date across any month of the year", () => {
    for (let month = 0; month < 12; month += 1) {
      const keys = monthMatrix(new Date(2026, month, 15)).flat();
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("event display", () => {
  const allDay = (starts_at: string, ends_at: string | null = null) => ({
    starts_at,
    ends_at,
    all_day: true,
  });
  const timed = (starts_at: string, ends_at: string | null = null) => ({
    starts_at,
    ends_at,
    all_day: false,
  });

  it("never shows a clock for an all-day event", () => {
    expect(formatEventTime(allDay("2026-10-18T00:00:00.000Z"))).toBe("All day");
    expect(formatEventWhen(allDay("2026-10-18T00:00:00.000Z"))).toContain(
      "All day",
    );
  });

  it("does show a time for a timed event", () => {
    const event = timed(new Date(2026, 9, 18, 18, 0).toISOString());
    const time = formatEventTime(event);
    expect(time).not.toBe("All day");
    expect(time.length).toBeGreaterThan(0);
    expect(formatEventWhen(event)).not.toContain("All day");
  });

  it("joins a start and end with an en dash", () => {
    const start = new Date(2026, 9, 18, 18, 0);
    const end = new Date(2026, 9, 18, 20, 0);
    expect(
      formatEventTime({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: false,
      }),
    ).toContain("–");
  });

  it("omits the end day when an all-day range starts and ends on one day", () => {
    const single = formatEventWhen(
      allDay("2026-10-18T00:00:00.000Z", "2026-10-18T23:59:59.999Z"),
    );
    const range = formatEventWhen(
      allDay("2026-10-18T00:00:00.000Z", "2026-10-20T23:59:59.999Z"),
    );
    expect(single).toContain("All day");
    expect(range).toContain("All day");
    // A multi-day range names an extra day, so it renders longer.
    expect(range.length).toBeGreaterThan(single.length);
    // The range case is the one that shows a dash.
    expect(range).toContain("–");
    expect(single).not.toContain("–");
  });

  it("appends a closing time for a timed event that ends on a later day", () => {
    const overnight = formatEventWhen(
      timed("2026-10-18T22:00:00.000Z", "2026-10-19T06:00:00.000Z"),
    );
    expect(overnight).not.toContain("All day");
    expect(overnight).toContain("–");
  });
});
