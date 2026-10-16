/**
 * Call room names.
 *
 * Rooms are derived from rows that already exist, so calls need no extra tables
 * and no extra permissions — the room's identity *is* the family or conversation
 * whose membership is already enforced by RLS:
 *
 *   family:<family_id>        any active member of that family
 *   dm:<conversation_id>      any member of that conversation
 *
 * The prefix is part of the room identity, so the two can never collide.
 *
 * This module is intentionally dependency-free (no Supabase client, no React):
 * it is used by the browser, and by the `/calls/[room]` server route. The
 * matching server-side implementation lives in
 * `supabase/functions/_shared/livekit.ts`, which validates the same shapes
 * before it will sign anything.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoomKind = "family" | "dm";

export type ParsedRoom = { kind: RoomKind; id: string; room: string };

export function familyRoom(familyId: string): string {
  return `family:${familyId}`;
}

export function conversationRoom(conversationId: string): string {
  return `dm:${conversationId}`;
}

/** Parses `family:<uuid>` / `dm:<uuid>`. Returns null for anything else. */
export function parseRoomName(
  room: string | null | undefined,
): ParsedRoom | null {
  if (!room) return null;
  const separator = room.indexOf(":");
  if (separator < 0) return null;
  const kind = room.slice(0, separator);
  const id = room.slice(separator + 1);
  if (kind !== "family" && kind !== "dm") return null;
  if (!UUID_RE.test(id)) return null;
  return { kind, id, room: `${kind}:${id}` };
}

/**
 * A colon cannot travel comfortably in a URL segment — and a slug reads better
 * in a share sheet — so routes use `family-<uuid>` / `dm-<uuid>`. UUIDs contain
 * dashes too, so the prefix is matched explicitly rather than by splitting on
 * the last dash.
 */
export function roomToSlug(room: string): string | null {
  const parsed = parseRoomName(room);
  return parsed ? `${parsed.kind}-${parsed.id}` : null;
}

export function slugToRoom(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const kind: RoomKind | null = slug.startsWith("family-")
    ? "family"
    : slug.startsWith("dm-")
      ? "dm"
      : null;
  if (!kind) return null;
  return parseRoomName(`${kind}:${slug.slice(kind.length + 1)}`)?.room ?? null;
}
