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
  shared_post?:
    | {
        id: string;
        content: string | null;
        created_at: string;
        author: Pick<ProfileLite, "id" | "full_name" | "avatar_url"> | null;
      }
    | Array<{
        id: string;
        content: string | null;
        created_at: string;
        author: Pick<ProfileLite, "id" | "full_name" | "avatar_url"> | null;
      }>
    | null;
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

export type EventResponse = "going" | "maybe" | "declined";

export type EventRsvp = {
  event_id: string;
  user_id: string;
  response: EventResponse;
  note: string | null;
  profile: ProfileLite | null;
};

export type CalendarCategory =
  | "birthday"
  | "wedding"
  | "reunion"
  | "eid"
  | "anniversary"
  | "gathering"
  | "other";

export type CalendarEvent = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  category?: CalendarCategory;
  cover_url?: string | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  created_at: string;
  author: ProfileLite | null;
  rsvps: EventRsvp[];
};

// ---------------------------------------------------------------------------
// Family Ludo — the shapes returned by `public.ludo_*` RPCs
// ---------------------------------------------------------------------------

export type LudoTokenState = {
  seat: number;
  /** -1 yard · 0..ring-1 outer ring · ring..ring+4 column · ring+5 home */
  progress: number[];
};

export type LudoLastMove = {
  seat: number;
  token: number;
  from: number;
  to: number;
  captured: number;
};

export type LudoState = {
  safeSquares?: number[];
  tokens?: LudoTokenState[];
  finishedOrder?: number[];
  lastMove?: LudoLastMove | null;
};

export type LudoSnapshot = {
  id: string;
  familyId: string;
  status: "waiting" | "playing" | "finished" | "abandoned";
  phase: "awaiting_roll" | "awaiting_move";
  turnSeat: number | null;
  dice: number | null;
  version: number;
  winnerSeat: number | null;
  turnDeadline: string | null;
  consecutiveSixes: number;
  boardSeats: number;
  legalMoves: number[];
  state: LudoState;
};

/** One row of the lobby list: a game plus its seats and their players. */
export type LudoGameListItem = {
  id: string;
  family_id: string;
  created_by: string;
  board_seats: number;
  tokens_per_player: number;
  status: string;
  phase: string;
  turn_seat: number | null;
  dice: number | null;
  version: number;
  winner_seat: number | null;
  turn_seconds: number;
  created_at: string;
  seats: {
    id: string;
    game_id: string;
    seat: number;
    user_id: string;
    color: string;
    autoplay: boolean;
    placement: number | null;
    profile: ProfileLite | null;
  }[];
};

/** Error messages raised by the engine that the UI reacts to specially. */
export const LUDO_TURN_EXPIRED = "turn_expired";
export const LUDO_STALE_STATE = "stale_state";

// ---------------------------------------------------------------------------
// Memory Vault — Google Drive backed archive
// ---------------------------------------------------------------------------

export type VaultKind = "photo" | "video" | "audio" | "document" | "other";

/** One tagged relative: "who is in the picture". */
export type VaultPerson = {
  profile_id: string;
  profile: ProfileLite | null;
};

/** A row of `public.vault_items` with its embedded relations. */
export type VaultItem = {
  id: string;
  family_id: string;
  added_by: string;
  drive_file_id: string | null;
  drive_folder_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  kind: string;
  captured_at: string | null;
  year: number | null;
  event_id: string | null;
  caption: string | null;
  is_favorite: boolean;
  upload_state: string;
  created_at: string;
  updated_at: string;
  added_by_profile: ProfileLite | null;
  event: { id: string; title: string } | null;
  people: VaultPerson[];
};

/**
 * What the Edge Function reports about the Drive link. `configured` is false
 * when the Google secrets have not been set yet, and `connected` is false when
 * no family admin has authorized the Drive account — the UI uses this to show
 * the real setup steps instead of pretending the Vault works.
 */
export type VaultStatus = {
  configured: boolean;
  connected: boolean;
  canConnect: boolean;
  accountEmail: string | null;
  accountName: string | null;
  /** Set when Google reported the stored refresh token is no longer valid. */
  revoked: boolean;
  /** Human-readable reason when `configured` is false. */
  reason: string | null;
  folderName: string | null;
};

// ---------------------------------------------------------------------------
// Family calls — LiveKit rooms derived from existing rows
// ---------------------------------------------------------------------------

/** Someone LiveKit reports as connected to a room. */
export type CallParticipant = {
  identity: string;
  name: string | null;
  joinedAt: string | null;
};

/** What the `livekit-token` function returns when a caller joins. */
export type CallToken = {
  url: string;
  room: string;
  identity: string;
  token: string;
};

// ---------------------------------------------------------------------------
// 1. Family Tree
// ---------------------------------------------------------------------------

export type TreeGender = "male" | "female" | "other";
export type TreeRelType = "parent" | "child" | "spouse" | "sibling";
export type TreeRelStatus = "approved" | "suggested" | "rejected";

export type FamilyTreeMember = {
  id: string;
  family_id: string;
  profile_id: string | null;
  full_name: string;
  gender: TreeGender | null;
  birth_date: string | null;
  death_date: string | null;
  is_deceased: boolean;
  bio: string | null;
  avatar_url: string | null;
  generation: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  profile?: ProfileLite | null;
};

export type FamilyTreeRelationship = {
  id: string;
  family_id: string;
  person_id: string;
  related_person_id: string;
  relationship_type: TreeRelType;
  status: TreeRelStatus;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  person?: FamilyTreeMember;
  related_person?: FamilyTreeMember;
};

// ---------------------------------------------------------------------------
// 2. Calendar Reminders
// ---------------------------------------------------------------------------

export type EventReminderType = "1_day_before" | "1_hour_before" | "on_day";

export type EventReminder = {
  id: string;
  event_id: string;
  user_id: string;
  reminder_type: EventReminderType;
  is_sent: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// 3. Voice Memory & Story Archive
// ---------------------------------------------------------------------------

export type VoiceMemory = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  speaker_name: string;
  speaker_id: string | null;
  recorded_date: string;
  language: string;
  tags: string[];
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  cover_url: string | null;
  transcript: string | null;
  transcript_status: "none" | "pending" | "completed" | "failed";
  transcript_updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator?: ProfileLite | null;
  speaker?: ProfileLite | null;
};

// ---------------------------------------------------------------------------
// 4. Family Travel & Reunion Planner
// ---------------------------------------------------------------------------

export type ReunionStatus = "planning" | "confirmed" | "completed" | "cancelled";
export type ReunionParticipantStatus = "going" | "interested" | "declined";

export type ReunionPlan = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  destination: string;
  cover_url: string | null;
  start_date: string;
  end_date: string | null;
  status: ReunionStatus;
  estimated_budget: number;
  created_at: string;
  updated_at: string;
  creator?: ProfileLite | null;
  participants?: ReunionParticipant[];
  itinerary?: ReunionItineraryItem[];
  tasks?: ReunionTask[];
  expenses?: ReunionExpense[];
};

export type ReunionParticipant = {
  id: string;
  reunion_id: string;
  user_id: string;
  status: ReunionParticipantStatus;
  adults_count: number;
  kids_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: ProfileLite | null;
};

export type ReunionItineraryItem = {
  id: string;
  reunion_id: string;
  day_number: number;
  activity_time: string | null;
  title: string;
  location: string | null;
  description: string | null;
  created_at: string;
};

export type ReunionTask = {
  id: string;
  reunion_id: string;
  title: string;
  category: "transport" | "food" | "lodging" | "supplies" | "activities" | "general";
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  assignee?: ProfileLite | null;
};

export type ReunionExpense = {
  id: string;
  reunion_id: string;
  title: string;
  category: "food" | "transport" | "lodging" | "tickets" | "activities" | "other";
  estimated_amount: number;
  actual_amount: number;
  paid_by: string | null;
  payer_name: string | null;
  notes: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// 5. Family Fund & Shared Expenses (Record-keeping Only)
// ---------------------------------------------------------------------------

export type ContributionStatus = "pledged" | "received" | "cancelled";
export type PaymentMethod = "cash" | "bkash" | "nagad" | "bank_transfer" | "other";
export type ExpenseStatus = "pending_review" | "approved" | "rejected";
export type ExpenseCategory =
  | "food"
  | "transport"
  | "medical"
  | "gifts"
  | "events"
  | "utilities"
  | "other";

export type FamilyFund = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  purpose: string | null;
  target_amount: number;
  deadline: string | null;
  is_closed: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  creator?: ProfileLite | null;
  contributions?: FundContribution[];
  expenses?: FundExpense[];
};

export type FundContribution = {
  id: string;
  fund_id: string;
  family_id: string;
  contributor_name: string;
  contributor_id: string | null;
  amount: number;
  status: ContributionStatus;
  payment_method: PaymentMethod;
  notes: string | null;
  received_at: string | null;
  confirmed_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  contributor?: ProfileLite | null;
};

export type FundExpense = {
  id: string;
  family_id: string;
  fund_id: string | null;
  title: string;
  category: ExpenseCategory;
  amount: number;
  spent_at: string;
  payer_name: string;
  payer_id: string | null;
  receipt_url: string | null;
  description: string | null;
  status: ExpenseStatus;
  approved_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  payer?: ProfileLite | null;
  fund?: { id: string; title: string } | null;
};

export type FinancialAuditLog = {
  id: string;
  family_id: string;
  actor_id: string;
  action: string;
  target_type: "fund" | "contribution" | "expense";
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
  actor?: ProfileLite | null;
};

