import { describe, expect, it } from "vitest";
import {
  formatBirthday,
  upcomingBirthday,
} from "@/lib/format";
import { initials as avatarInitials } from "@/lib/avatar";

describe("formatBirthday", () => {
  it("formats YYYY-MM-DD into month and day", () => {
    expect(formatBirthday("1995-04-12")).toBe("April 12");
    expect(formatBirthday("2000-01-01")).toBe("January 1");
    expect(formatBirthday("2010-12-25")).toBe("December 25");
  });
});

describe("upcomingBirthday", () => {
  it("identifies birthdays happening today", () => {
    const now = new Date(2026, 4, 15); // May 15, 2026
    const res = upcomingBirthday("1995-05-15", now);
    expect(res.daysUntil).toBe(0);
    expect(res.label).toBe("Today");
    expect(res.nextDate.getFullYear()).toBe(2026);
  });

  it("identifies birthdays happening tomorrow", () => {
    const now = new Date(2026, 4, 15); // May 15, 2026
    const res = upcomingBirthday("1995-05-16", now);
    expect(res.daysUntil).toBe(1);
    expect(res.label).toBe("Tomorrow");
  });

  it("identifies birthdays happening later in the same year", () => {
    const now = new Date(2026, 4, 15); // May 15, 2026
    const res = upcomingBirthday("1995-05-20", now);
    expect(res.daysUntil).toBe(5);
    expect(res.label).toBe("In 5 days");
  });

  it("wraps birthdays that already passed to next year", () => {
    const now = new Date(2026, 4, 15); // May 15, 2026
    const res = upcomingBirthday("1995-05-10", now);
    expect(res.nextDate.getFullYear()).toBe(2027);
    expect(res.daysUntil).toBeGreaterThan(300);
  });
});

describe("initials", () => {
  it("extracts initials from single and multi-word names", () => {
    expect(avatarInitials("Alice")).toBe("AL");
    expect(avatarInitials("Alice Smith")).toBe("AS");
    expect(avatarInitials("Alice Bob Charlie Smith")).toBe("AS");
    expect(avatarInitials("")).toBe("?");
    expect(avatarInitials(null)).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
    expect(avatarInitials("   ")).toBe("?");
  });
});

