/** Shared UI constants — labels, emoji, and navigation. */

export const MOMENT_TYPES = {
  regular: { label: "Update", emoji: "💬" },
  birthday: { label: "Birthday", emoji: "🎂" },
  wedding: { label: "Wedding / Anniversary", emoji: "💍" },
  trip: { label: "Family Trip", emoji: "✈️" },
  throwback: { label: "Throwback", emoji: "📸" },
  achievement: { label: "Achievement", emoji: "🏆" },
  announcement: { label: "Announcement", emoji: "📣" },
} as const;

export type MomentType = keyof typeof MOMENT_TYPES;

export const REACTIONS = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
} as const;

export type ReactionType = keyof typeof REACTIONS;

export const RELATIONSHIPS: Record<string, string> = {
  cousin: "Cousin",
  sibling: "Sibling",
  uncle: "Uncle",
  aunt: "Aunt",
  parent: "Parent",
  grandparent: "Grandparent",
  other: "Other",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  member: "Member",
};

/** How long someone is considered "online" after their last heartbeat. */
export const PRESENCE_WINDOW_SECONDS = 150;
