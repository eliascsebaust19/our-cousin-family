import { describe, expect, it } from "vitest";
import {
  conversationRoom,
  familyRoom,
  parseRoomName,
  roomToSlug,
  slugToRoom,
} from "@/lib/call-rooms";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

describe("familyRoom / conversationRoom", () => {
  it("builds the documented room names", () => {
    expect(familyRoom(FAMILY_ID)).toBe(`family:${FAMILY_ID}`);
    expect(conversationRoom(CONVERSATION_ID)).toBe(`dm:${CONVERSATION_ID}`);
  });

  it("keeps the two kinds from ever colliding", () => {
    // Same id, different scope: a DM room and a family room of the same uuid are
    // distinct rooms, so a conversation token can never open a family call.
    expect(familyRoom(CONVERSATION_ID)).not.toBe(conversationRoom(CONVERSATION_ID));
  });
});

describe("parseRoomName", () => {
  it("round-trips both kinds", () => {
    expect(parseRoomName(familyRoom(FAMILY_ID))).toEqual({
      kind: "family",
      id: FAMILY_ID,
      room: `family:${FAMILY_ID}`,
    });
    expect(parseRoomName(conversationRoom(CONVERSATION_ID))).toEqual({
      kind: "dm",
      id: CONVERSATION_ID,
      room: `dm:${CONVERSATION_ID}`,
    });
  });

  it("accepts an uppercase uuid (uuid columns are case-insensitive)", () => {
    const parsed = parseRoomName(`family:${FAMILY_ID.toUpperCase()}`);
    expect(parsed?.kind).toBe("family");
    expect(parsed?.id).toBe(FAMILY_ID.toUpperCase());
  });

  // The server rejects these too, before any database query runs. Keeping the
  // two lists in step is the point of this block.
  it.each([
    ["", "empty"],
    ["family", "no separator"],
    ["family:", "no id"],
    [":11111111-1111-4111-8111-111111111111", "no prefix"],
    ["group:11111111-1111-4111-8111-111111111111", "unknown prefix"],
    ["Family:11111111-1111-4111-8111-111111111111", "prefix is case-sensitive"],
    ["family:not-a-uuid", "id is not a uuid"],
    ["family:11111111111141118111111111111111", "uuid without dashes"],
    ["family:11111111-1111-4111-8111-11111111111", "uuid one char short"],
    ["family:11111111-1111-4111-8111-1111111111111", "uuid one char long"],
    ["family:11111111-1111-4111-8111-11111111111z", "uuid with a bad char"],
    ["family:11111111-1111-4111-8111-111111111111:extra", "trailing segment"],
  ])("rejects %j (%s)", (room) => {
    expect(parseRoomName(room)).toBeNull();
  });

  it("rejects null / undefined", () => {
    expect(parseRoomName(null)).toBeNull();
    expect(parseRoomName(undefined)).toBeNull();
  });

  it("never returns a room that differs from its input", () => {
    // The room name goes into the LiveKit token verbatim. Rebuilding it is a
    // deliberate normalisation, so anything that survives parsing must already
    // be canonical.
    for (const room of [familyRoom(FAMILY_ID), conversationRoom(CONVERSATION_ID)]) {
      expect(parseRoomName(room)?.room).toBe(room);
    }
  });
});

describe("roomToSlug / slugToRoom", () => {
  it("round-trips through the URL form", () => {
    for (const room of [familyRoom(FAMILY_ID), conversationRoom(CONVERSATION_ID)]) {
      const slug = roomToSlug(room);
      expect(slug).not.toBeNull();
      expect(slugToRoom(slug)).toBe(room);
    }
  });

  it("uses a dash, not the colon, in the slug", () => {
    expect(roomToSlug(familyRoom(FAMILY_ID))).toBe(`family-${FAMILY_ID}`);
    expect(roomToSlug(conversationRoom(CONVERSATION_ID))).toBe(
      `dm-${CONVERSATION_ID}`,
    );
    // A colon in a path segment is legal but awkward; the slug avoids it.
    expect(roomToSlug(familyRoom(FAMILY_ID))).not.toContain(":");
  });

  it("splits on the prefix, not the last dash (uuids contain dashes)", () => {
    // The naive implementation — split on the final "-" — returns half a uuid.
    expect(slugToRoom(`family-${FAMILY_ID}`)).toBe(`family:${FAMILY_ID}`);
    expect(slugToRoom(`dm-${CONVERSATION_ID}`)).toBe(`dm:${CONVERSATION_ID}`);
  });

  it.each([
    ["", "empty"],
    ["family", "no id"],
    ["family-", "empty id"],
    [FAMILY_ID, "uuid with no prefix"],
    ["group-11111111-1111-4111-8111-111111111111", "unknown prefix"],
    ["dms-11111111-1111-4111-8111-111111111111", "prefix would match naively"],
    ["family-not-a-uuid", "id is not a uuid"],
    ["dm-11111111-1111-4111-8111-111111111111:1", "trailing segment"],
  ])("rejects the slug %j (%s)", (slug) => {
    expect(slugToRoom(slug)).toBeNull();
  });

  it("rejects null / undefined slugs", () => {
    expect(slugToRoom(null)).toBeNull();
    expect(slugToRoom(undefined)).toBeNull();
  });

  it("returns null for a room it cannot parse", () => {
    expect(roomToSlug("nonsense")).toBeNull();
    expect(roomToSlug("")).toBeNull();
  });
});
