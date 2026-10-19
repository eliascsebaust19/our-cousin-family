import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const key = `test-${Date.now()}-1`;
    const res1 = rateLimit(key, { limit: 3, windowMs: 1000 });
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = rateLimit(key, { limit: 3, windowMs: 1000 });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = rateLimit(key, { limit: 3, windowMs: 1000 });
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("blocks requests that exceed the limit", () => {
    const key = `test-${Date.now()}-2`;
    rateLimit(key, { limit: 2, windowMs: 5000 });
    rateLimit(key, { limit: 2, windowMs: 5000 });

    const blocked = rateLimit(key, { limit: 2, windowMs: 5000 });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});

