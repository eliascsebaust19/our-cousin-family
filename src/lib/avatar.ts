import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Avatars live in a private bucket. `profiles.avatar_url` stores either:
 *   • an external https URL (e.g. from Google sign-in), or
 *   • a storage path like "avatars/{userId}/{file}.jpg"
 *
 * Storage paths are converted to short-lived signed URLs and cached in
 * memory until shortly before they expire.
 */
const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL_MS = 55 * 60 * 1000; // signed for 1h, refresh at ~55m

export async function resolveAvatarUrl(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const cached = cache.get(pathOrUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(pathOrUrl, 3600);

  if (error || !data?.signedUrl) return null;

  cache.set(pathOrUrl, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS });
  return data.signedUrl;
}

/** Same treatment for post media ("posts/{familyId}/{postId}/{file}"). */
const mediaCache = new Map<string, { url: string; expiresAt: number }>();

export async function resolveMediaUrl(
  supabase: SupabaseClient,
  path: string,
  bucket: "post-media" | "chat-attachments" = "post-media",
): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const key = `${bucket}:${path}`;
  const cached = mediaCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;

  mediaCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS });
  return data.signedUrl;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
