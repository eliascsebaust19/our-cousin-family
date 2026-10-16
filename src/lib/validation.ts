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
export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Give the event a name").max(120),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    all_day: z.boolean(),
    starts_at: z.string().min(1, "Pick when it starts"),
    ends_at: z.string().optional().or(z.literal("")),
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
