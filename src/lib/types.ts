import type { Database } from "@/types/database.types";

/** Convenience aliases over the generated-style row types. */
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type FamilyRow = Database["public"]["Tables"]["families"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["family_members"]["Row"];

export type ProfileLite = Pick<
  ProfileRow,
  | "id"
  | "full_name"
  | "nickname"
  | "username"
  | "avatar_url"
  | "bio"
  | "birthday"
  | "relationship"
  | "show_birthday"
  | "show_online_status"
  | "last_seen_at"
>;

export type FamilyLite = Pick<
  FamilyRow,
  | "id"
  | "name"
  | "description"
  | "rules"
  | "avatar_url"
  | "cover_url"
  | "privacy"
  | "require_approval"
  | "created_by"
>;

export type Membership = {
  role: string;
  status: string;
  family: FamilyLite;
};

/** Feed shapes (hand-typed to match the PostgREST embeds we request). */
export type PostMediaItem = {
  id: string;
  storage_path: string;
  media_type: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  position: number;
};

export type FeedPost = {
  id: string;
  family_id: string;
  author_id: string;
  content: string | null;
  moment_type: string;
  visibility: string;
  is_pinned: boolean;
  shared_post_id: string | null;
  edited_at: string | null;
  created_at: string;
  author: ProfileLite | null;
  post_media: PostMediaItem[];
  post_reactions: { user_id: string; reaction: string }[];
  comments: { count: number }[];
  shared_post?: {
    id: string;
    content: string | null;
    created_at: string;
    author: Pick<ProfileLite, "id" | "full_name" | "avatar_url"> | null;
  } | null;
};

export type CommentItem = {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  author: ProfileLite | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_id: string | null;
  content: string | null;
  message_type: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender: ProfileLite | null;
  message_attachments: {
    id: string;
    storage_path: string;
    media_type: string;
    mime_type: string;
    duration_ms: number | null;
  }[];
};

export type ConversationListItem = {
  id: string;
  family_id: string;
  type: string;
  title: string | null;
  last_message_at: string | null;
  members: {
    user_id: string;
    profile: ProfileLite | null;
  }[];
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor: ProfileLite | null;
};
