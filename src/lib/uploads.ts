import type { SupabaseClient } from "@supabase/supabase-js";

/** Client-side upload guards (server enforces bucket limits too). */

export const LIMITS = {
  avatar: { bytes: 5 * 1024 * 1024, kinds: ["image"] as const },
  post: { bytes: 100 * 1024 * 1024, kinds: ["image", "video"] as const },
  chatImage: { bytes: 25 * 1024 * 1024, kinds: ["image"] as const },
  voice: { bytes: 10 * 1024 * 1024, kinds: ["audio"] as const },
} as const;

export class UploadError extends Error {}

function assertFile(
  file: File,
  kind: (typeof LIMITS)[keyof typeof LIMITS],
): void {
  if (file.size > kind.bytes) {
    const mb = Math.round(kind.bytes / (1024 * 1024));
    throw new UploadError(`"${file.name}" is larger than ${mb} MB`);
  }
  const category: string = file.type.split("/")[0] ?? "";
  if (!(kind.kinds as readonly string[]).includes(category)) {
    throw new UploadError(`"${file.name}" has an unsupported file type`);
  }
}

function randomName(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function upload(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  kind: (typeof LIMITS)[keyof typeof LIMITS],
): Promise<string> {
  assertFile(file, kind);
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const fullPath = `${path}/${randomName()}.${ext!.toLowerCase().slice(0, 6)}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new UploadError(`Upload failed: ${error.message}`);
  }
  return fullPath;
}

/** avatars/{userId}/{name} — caller passes their own uid. */
export function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  return upload(supabase, "avatars", userId, file, LIMITS.avatar);
}

/** posts/{familyId}/{postId}/{name} */
export function uploadPostMedia(
  supabase: SupabaseClient,
  familyId: string,
  postId: string,
  file: File,
): Promise<string> {
  return upload(supabase, "post-media", `${familyId}/${postId}`, file, LIMITS.post);
}

/** {familyId}/family/{name} — family avatar/cover (post-media bucket). */
export function uploadFamilyImage(
  supabase: SupabaseClient,
  familyId: string,
  file: File,
): Promise<string> {
  return upload(supabase, "post-media", `${familyId}/family`, file, LIMITS.avatar);
}

/** chat/{conversationId}/{name} */
export function uploadChatAttachment(
  supabase: SupabaseClient,
  conversationId: string,
  file: File,
  voice = false,
): Promise<string> {
  return upload(
    supabase,
    "chat-attachments",
    conversationId,
    file,
    voice ? LIMITS.voice : LIMITS.chatImage,
  );
}

/**
 * Note: signed-URL resolution lives in `src/lib/avatar.ts`
 * (`resolveAvatarUrl` / `resolveMediaUrl`) because the bucket must be chosen
 * explicitly — paths in these buckets start with the owning id, not a prefix.
 */
