import { z } from "zod";

// ----------------------------------------------------------------------------
// Common
// ----------------------------------------------------------------------------
export const uuidSchema = z.string().uuid();

/** Invite codes: 8–12 chars from the unambiguous alphabet (SQL check too). */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{8,12}$/, "Enter a valid invitation code");

// ----------------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------------
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ----------------------------------------------------------------------------
// Profile
// ----------------------------------------------------------------------------
export const relationshipEnum = z.enum([
  "cousin",
  "sibling",
  "uncle",
  "aunt",
  "parent",
  "grandparent",
  "other",
]);

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(80),
  nickname: z.string().trim().max(40).optional().or(z.literal("")),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "3–24 letters, numbers or underscores")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(500).optional(),
  birthday: z.string().optional().nullable(),
  relationship: relationshipEnum.optional().nullable(),
  show_birthday: z.boolean(),
  show_online_status: z.boolean(),
});

// ----------------------------------------------------------------------------
// Family
// ----------------------------------------------------------------------------
export const createFamilySchema = z.object({
  name: z.string().trim().min(2, "Family name must be at least 2 characters").max(60),
  description: z.string().trim().max(1000).optional(),
  rules: z.string().trim().max(4000).optional(),
  privacy: z.enum(["invite_only", "private"]).default("invite_only"),
  require_approval: z.boolean().default(false),
  avatar_url: z.string().url().optional().or(z.literal("")),
  cover_url: z.string().url().optional().or(z.literal("")),
});

export const updateFamilySchema = createFamilySchema.partial();

export const createInviteSchema = z.object({
  role: z.enum(["admin", "moderator", "member"]).default("member"),
  /** ISO date-time; empty/undefined = never expires. */
  expires_at: z.string().optional().or(z.literal("")),
  max_uses: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const joinFamilySchema = z.object({
  code: inviteCodeSchema,
});

// ----------------------------------------------------------------------------
// Feed
// ----------------------------------------------------------------------------
export const momentTypeEnum = z.enum([
  "regular",
  "birthday",
  "wedding",
  "trip",
  "throwback",
  "achievement",
  "announcement",
]);

export const createPostSchema = z
  .object({
    content: z.string().trim().max(5000).optional(),
    moment_type: momentTypeEnum.default("regular"),
    visibility: z.enum(["family", "admins"]).default("family"),
    media_count: z.number().int().min(0).max(10).default(0),
  })
  .refine((d) => (d.content?.length ?? 0) > 0 || d.media_count > 0, {
    message: "Write something or add a photo",
  });

export const updatePostSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1, "Write a comment").max(2000),
  parent_id: uuidSchema.optional().nullable(),
});

export const reactionSchema = z.enum([
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
]);

// ----------------------------------------------------------------------------
// Chat
// ----------------------------------------------------------------------------
export const sendMessageSchema = z
  .object({
    content: z.string().trim().max(4000).optional(),
    message_type: z.enum(["text", "image", "voice", "system"]).default("text"),
    reply_to_id: uuidSchema.optional().nullable(),
    media_count: z.number().int().min(0).max(1).default(0),
  })
  .refine((d) => (d.content?.length ?? 0) > 0 || d.media_count > 0, {
    message: "Message cannot be empty",
  });

export const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export const createDirectChatSchema = z.object({
  other_user: uuidSchema,
});

export const createGroupChatSchema = z.object({
  title: z.string().trim().min(1, "Give the group a name").max(60),
  member_ids: z.array(uuidSchema).min(1, "Pick at least one member").max(50),
});

// ----------------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------------
export const markReadSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(200),
});

// ----------------------------------------------------------------------------
// Calendar
// ----------------------------------------------------------------------------
export const eventResponseEnum = z.enum(["going", "maybe", "declined"]);

/**
 * `starts_at` / `ends_at` arrive as ISO-8601 strings produced from the form's
 * <input type="date"> / <input type="datetime-local"> values (see
 * src/lib/datetime.ts), so they are just required ISO strings here. The
 * "end before start" rule is enforced in the database too.
 */
export const eventCategoryEnum = z.enum([
  "birthday",
  "wedding",
  "reunion",
  "eid",
  "anniversary",
  "gathering",
  "other",
]);

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Give the event a name").max(120),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    all_day: z.boolean(),
    starts_at: z.string().min(1, "Pick when it starts"),
    ends_at: z.string().optional().or(z.literal("")),
    category: eventCategoryEnum.default("gathering"),
    cover_url: z.string().url().optional().or(z.literal("")),
    is_recurring: z.boolean().default(false),
    recurrence_rule: z.string().optional().or(z.literal("")),
  })
  .refine((d) => !d.ends_at || d.ends_at >= d.starts_at, {
    message: "The event must end after it starts",
    path: ["ends_at"],
  });

export const updateEventSchema = createEventSchema;

export const rsvpSchema = z.object({
  response: eventResponseEnum,
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// Family Ludo
// ----------------------------------------------------------------------------
export const ludoBoardSeatsSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
]);

export const createLudoGameSchema = z.object({
  board_seats: ludoBoardSeatsSchema,
  /** Per-turn timer the engine enforces (server clamps it to 10–600 too). */
  turn_seconds: z.number().int().min(10).max(600),
});

export const ludoActionSchema = z.object({
  game_id: uuidSchema,
  expected_version: z.number().int().nonnegative(),
});

// ----------------------------------------------------------------------------
// Memory Vault
// ----------------------------------------------------------------------------

export const vaultKinds = ["photo", "video", "audio", "document", "other"] as const;

/**
 * Upload metadata sent to the `vault` Edge Function alongside the file. The
 * function still checks membership and Drive configuration server-side; this
 * only stops malformed requests from leaving the browser.
 */
export const vaultUploadSchema = z.object({
  family_id: uuidSchema,
  name: z.string().trim().min(1, "Give the memory a name").max(300),
  kind: z.enum(vaultKinds),
  caption: z.string().trim().max(2000).optional().or(z.literal("")),
  captured_at: z.string().datetime().optional().or(z.literal("")),
  event_id: uuidSchema.optional().or(z.literal("")),
});

/** Metadata-only edits the client may make (mirrors the column-level grants). */
export const vaultItemUpdateSchema = z.object({
  id: uuidSchema,
  caption: z.string().trim().max(2000).nullable().optional(),
  is_favorite: z.boolean().optional(),
});

export const vaultTagSchema = z.object({
  item_id: uuidSchema,
  profile_id: uuidSchema,
});

// ----------------------------------------------------------------------------
// Family calls
// ----------------------------------------------------------------------------

/**
 * Mirrors the room allow-list in the `livekit-token` function. This only stops
 * malformed requests leaving the browser — the function re-validates and then
 * checks membership in the database.
 */
export const callTokenRequestSchema = z.object({
  room: z.string().regex(/^(family|dm):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  canPublish: z.boolean().optional(),
});

// ----------------------------------------------------------------------------
// 1. Family Tree Schemas
// ----------------------------------------------------------------------------
export const treeGenderEnum = z.enum(["male", "female", "other"]);
export const treeRelTypeEnum = z.enum(["parent", "child", "spouse", "sibling"]);
export const treeRelStatusEnum = z.enum(["approved", "suggested", "rejected"]);

export const createTreeMemberSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  gender: treeGenderEnum.optional().nullable(),
  birth_date: z.string().optional().nullable(),
  death_date: z.string().optional().nullable(),
  is_deceased: z.boolean().default(false),
  bio: z.string().trim().max(1000).optional().nullable(),
  avatar_url: z.string().url().optional().nullable().or(z.literal("")),
  generation: z.number().int().default(0),
  profile_id: uuidSchema.optional().nullable(),
});

export const updateTreeMemberSchema = createTreeMemberSchema.partial();

export const createTreeRelationshipSchema = z
  .object({
    person_id: uuidSchema,
    related_person_id: uuidSchema,
    relationship_type: treeRelTypeEnum,
    status: treeRelStatusEnum.default("approved"),
  })
  .refine((d) => d.person_id !== d.related_person_id, {
    message: "Cannot relate a person to themselves",
    path: ["related_person_id"],
  });

// ----------------------------------------------------------------------------
// 2. Calendar Reminder Schemas
// ----------------------------------------------------------------------------
export const eventReminderTypeEnum = z.enum(["1_day_before", "1_hour_before", "on_day"]);

export const createEventReminderSchema = z.object({
  event_id: uuidSchema,
  reminder_type: eventReminderTypeEnum.default("1_day_before"),
});

// ----------------------------------------------------------------------------
// 3. Voice Memory Schemas
// ----------------------------------------------------------------------------
export const voiceLanguageEnum = z.enum(["bn", "en", "other"]);

export const createVoiceMemorySchema = z.object({
  title: z.string().trim().min(1, "Give the memory a title").max(150),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  speaker_name: z.string().trim().min(1, "Speaker name is required").max(80),
  speaker_id: uuidSchema.optional().nullable(),
  recorded_date: z.string().min(1, "Pick recorded date"),
  language: voiceLanguageEnum.default("bn"),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  audio_url: z.string().min(1, "Audio file is required"),
  duration_seconds: z.number().int().nonnegative().default(0),
  file_size_bytes: z.number().int().nonnegative().default(0),
  cover_url: z.string().url().optional().or(z.literal("")),
  transcript: z.string().trim().optional().or(z.literal("")),
  transcript_status: z.enum(["none", "pending", "completed", "failed"]).default("none"),
});

export const updateTranscriptSchema = z.object({
  id: uuidSchema,
  transcript: z.string().trim().max(10000),
  transcript_status: z.enum(["none", "pending", "completed", "failed"]).default("completed"),
});

// ----------------------------------------------------------------------------
// 4. Reunion / Travel Schemas
// ----------------------------------------------------------------------------
export const reunionStatusEnum = z.enum(["planning", "confirmed", "completed", "cancelled"]);
export const reunionParticipantStatusEnum = z.enum(["going", "interested", "declined"]);
export const reunionTaskCategoryEnum = z.enum(["transport", "food", "lodging", "supplies", "activities", "general"]);
export const reunionExpenseCategoryEnum = z.enum(["food", "transport", "lodging", "tickets", "activities", "other"]);

export const reunionBaseSchema = z.object({
  title: z.string().trim().min(1, "Enter a trip title").max(150),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  destination: z.string().trim().min(1, "Destination is required").max(200),
  cover_url: z.string().url().optional().or(z.literal("")),
  start_date: z.string().min(1, "Pick start date"),
  end_date: z.string().optional().or(z.literal("")),
  status: reunionStatusEnum.default("planning"),
  estimated_budget: z.number().nonnegative().default(0),
});

export const createReunionSchema = reunionBaseSchema.refine(
  (d) => !d.end_date || d.end_date >= d.start_date,
  {
    message: "Return date must be on or after start date",
    path: ["end_date"],
  },
);

export const updateReunionSchema = reunionBaseSchema.partial();

export const updateReunionParticipantSchema = z.object({
  reunion_id: uuidSchema,
  status: reunionParticipantStatusEnum.default("going"),
  adults_count: z.number().int().min(1, "At least 1 adult").max(50),
  kids_count: z.number().int().min(0).max(50).default(0),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const createReunionItinerarySchema = z.object({
  reunion_id: uuidSchema,
  day_number: z.number().int().min(1),
  activity_time: z.string().trim().max(30).optional().or(z.literal("")),
  title: z.string().trim().min(1, "Activity title is required").max(120),
  location: z.string().trim().max(150).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createReunionTaskSchema = z.object({
  reunion_id: uuidSchema,
  title: z.string().trim().min(1, "Task title is required").max(150),
  category: reunionTaskCategoryEnum.default("general"),
  assigned_to: uuidSchema.optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const createReunionExpenseSchema = z.object({
  reunion_id: uuidSchema,
  title: z.string().trim().min(1, "Title is required").max(120),
  category: reunionExpenseCategoryEnum.default("other"),
  estimated_amount: z.number().nonnegative().default(0),
  actual_amount: z.number().nonnegative().default(0),
  paid_by: uuidSchema.optional().nullable(),
  payer_name: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// 5. Family Fund & Shared Expenses (Record-keeping Only)
// ----------------------------------------------------------------------------
export const contributionStatusEnum = z.enum(["pledged", "received", "cancelled"]);
export const paymentMethodEnum = z.enum(["cash", "bkash", "nagad", "bank_transfer", "other"]);
export const fundExpenseCategoryEnum = z.enum(["food", "transport", "medical", "gifts", "events", "utilities", "other"]);
export const fundExpenseStatusEnum = z.enum(["pending_review", "approved", "rejected"]);

export const createFundSchema = z.object({
  title: z.string().trim().min(1, "Fund name is required").max(120),
  purpose: z.string().trim().max(2000).optional().or(z.literal("")),
  target_amount: z.number().nonnegative().default(0),
  deadline: z.string().optional().nullable(),
  is_private: z.boolean().default(false),
});

export const createFundContributionSchema = z.object({
  fund_id: uuidSchema,
  contributor_name: z.string().trim().min(1, "Contributor name is required").max(80),
  contributor_id: uuidSchema.optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  status: contributionStatusEnum.default("pledged"),
  payment_method: paymentMethodEnum.default("cash"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const createFundExpenseSchema = z.object({
  fund_id: uuidSchema.optional().nullable(),
  title: z.string().trim().min(1, "Title is required").max(120),
  category: fundExpenseCategoryEnum.default("other"),
  amount: z.number().positive("Amount must be greater than 0"),
  spent_at: z.string().min(1, "Date is required"),
  payer_name: z.string().trim().min(1, "Payer name is required").max(80),
  payer_id: uuidSchema.optional().nullable(),
  receipt_url: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  status: fundExpenseStatusEnum.default("approved"),
});

