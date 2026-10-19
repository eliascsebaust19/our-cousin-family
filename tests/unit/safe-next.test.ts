import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
  it("defaults to /home when input is null, undefined, or empty", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath(undefined)).toBe("/home");
    expect(safeNextPath("")).toBe("/home");
  });

  it("uses custom fallback if provided", () => {
    expect(safeNextPath(null, "/custom")).toBe("/custom");
    expect(safeNextPath("", "/settings")).toBe("/settings");
  });

  it("accepts valid relative internal paths", () => {
    expect(safeNextPath("/feed")).toBe("/feed");
    expect(safeNextPath("/chat/123-abc")).toBe("/chat/123-abc");
    expect(safeNextPath("/family/settings?tab=general")).toBe("/family/settings?tab=general");
  });

  it("rejects non-relative or absolute URL targets (open redirect vectors)", () => {
    expect(safeNextPath("https://evil.com")).toBe("/home");
    expect(safeNextPath("http://evil.com")).toBe("/home");
    expect(safeNextPath("javascript:alert(1)")).toBe("/home");
    expect(safeNextPath("data:text/html,evil")).toBe("/home");
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(safeNextPath("//evil.com")).toBe("/home");
    expect(safeNextPath("//google.com/path")).toBe("/home");
  });

  it("rejects backslash evasion attempts (/\\evil.com or \\evil.com)", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/home");
    expect(safeNextPath("\\evil.com")).toBe("/home");
    expect(safeNextPath("/path\\sub")).toBe("/home");
  });

  it("rejects newline injections", () => {
    expect(safeNextPath("/path\nSet-Cookie:bad=true")).toBe("/home");
    expect(safeNextPath("/path\r\nLocation:http://evil.com")).toBe("/home");
  });
});

