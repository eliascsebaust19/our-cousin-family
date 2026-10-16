/**
 * Guards the `next` redirect parameter against open redirects.
 * Only same-origin absolute paths are allowed ("/..." but not "//..." or "/\...").
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback = "/home",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\") || raw.includes("\n") || raw.includes("\r")) {
    return fallback;
  }
  return raw;
}
