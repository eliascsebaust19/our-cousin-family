/**
 * Shared PostgREST select strings.
 *
 * We hand-write these because the project's database types are maintained
 * manually; results are cast to the shapes declared in src/lib/types.ts.
 */

export const PROFILE_FIELDS =
  "id, full_name, nickname, username, avatar_url, bio, birthday, relationship, show_birthday, show_online_status, last_seen_at";

export const FEED_SELECT = `
  id, family_id, author_id, content, moment_type, visibility, is_pinned,
  shared_post_id, edited_at, created_at,
  author:profiles!posts_author_id_fkey(${PROFILE_FIELDS}),
  post_media(id, storage_path, media_type, mime_type, width, height, position),
  post_reactions(user_id, reaction),
  comments(count),
  shared_post:posts!shared_post_id(
    id, content, created_at,
    author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
  )
`;

export const COMMENT_SELECT = `
  id, post_id, parent_id, content, created_at, edited_at, author_id,
  author:profiles!comments_author_id_fkey(${PROFILE_FIELDS})
`;

export const MESSAGE_SELECT = `
  id, conversation_id, sender_id, reply_to_id, content, message_type,
  created_at, edited_at, deleted_at,
  sender:profiles!messages_sender_id_fkey(${PROFILE_FIELDS}),
  message_attachments(id, storage_path, media_type, mime_type, duration_ms)
`;

export const CONVERSATION_LIST_SELECT = `
  id, family_id, type, title, last_message_at,
  members:conversation_members(user_id, profile:profiles!conversation_members_user_id_fkey(${PROFILE_FIELDS}))
`;

export const CALENDAR_SELECT = `
  id, family_id, created_by, title, description, location, starts_at, ends_at,
  all_day, category, cover_url, is_recurring, recurrence_rule, created_at,
  author:profiles!family_events_created_by_fkey(${PROFILE_FIELDS}),
  rsvps:event_rsvps!event_rsvps_event_id_fkey(
    event_id, user_id, response, note,
    profile:profiles!event_rsvps_user_id_fkey(${PROFILE_FIELDS})
  )
`;

/** Realtime channel names (UUIDs keep them unguessable). */
export const channels = {
  feed: (familyId: string) => `feed:${familyId}`,
  postComments: (postId: string) => `post-comments:${postId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  typing: (conversationId: string) => `typing:${conversationId}`,
  presence: (conversationId: string) => `presence:${conversationId}`,
  calendar: (familyId: string) => `calendar:${familyId}`,
  ludoGame: (gameId: string) => `ludo-game:${gameId}`,
  ludoLobby: (familyId: string) => `ludo-lobby:${familyId}`,
  vault: (familyId: string) => `vault:${familyId}`,
};

/** Lobby rows: a game with its seats and the player sitting in each one. */
export const LUDO_GAME_SELECT = `
  id, family_id, created_by, board_seats, tokens_per_player, status, phase,
  turn_seat, dice, version, winner_seat, turn_seconds, created_at,
  seats:ludo_seats!ludo_seats_game_id_fkey(
    id, game_id, seat, user_id, color, autoplay, placement,
    profile:profiles!ludo_seats_user_id_fkey(id, full_name, nickname, avatar_url)
  )
`;

/**
 * Vault rows: the Drive metadata plus who added it, which event it belongs to,
 * and who is tagged in it. `profiles` is JOINed twice, so both are pinned to
 * explicit foreign keys.
 */
export const VAULT_SELECT = `
  id, family_id, added_by, drive_file_id, drive_folder_id, name, mime_type,
  size_bytes, kind, captured_at, year, event_id, caption, is_favorite,
  upload_state, created_at, updated_at,
  added_by_profile:profiles!vault_items_added_by_fkey(${PROFILE_FIELDS}),
  event:family_events!vault_items_event_id_fkey(id, title),
  people:vault_item_people!vault_item_people_item_id_fkey(
    profile_id,
    profile:profiles!vault_item_people_profile_id_fkey(${PROFILE_FIELDS})
  )
`;
