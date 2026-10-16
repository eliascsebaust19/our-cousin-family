"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, Send, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MOMENT_TYPES, type MomentType } from "@/lib/constants";
import { createPostSchema } from "@/lib/validation";
import { uploadPostMedia } from "@/lib/uploads";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);
const MAX_FILES = 10;

type PickedFile = { file: File; previewUrl: string };

export function PostComposer() {
  const router = useRouter();
  const { activeFamily, profile, userId, roleInActiveFamily } = useFamily();

  const [content, setContent] = useState("");
  const [momentType, setMomentType] = useState<MomentType>("regular");
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canModerate = MODERATOR_ROLES.has(roleInActiveFamily ?? "");

  function pickFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;

    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} files`);
      return;
    }

    const accepted: PickedFile[] = [];
    for (const file of picked.slice(0, remaining)) {
      const category = file.type.split("/")[0];
      if (category !== "image" && category !== "video") {
        toast.error(`"${file.name}" is not a photo or video`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setFiles((current) => [...current, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function submit() {
    if (!activeFamily) {
      toast.error("Join or create a family first");
      return;
    }

    const parsed = createPostSchema.safeParse({
      content,
      moment_type: momentType,
      visibility: adminsOnly && canModerate ? "admins" : "family",
      media_count: files.length,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Nothing to post yet");
      return;
    }

    setPending(true);
    const supabase = createClient();

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({
        family_id: activeFamily.id,
        author_id: userId,
        content: parsed.data.content?.length ? parsed.data.content : null,
        moment_type: parsed.data.moment_type,
        visibility: parsed.data.visibility,
      })
      .select("id")
      .single();

    if (insertError || !post) {
      setPending(false);
      toast.error(insertError?.message ?? "Could not create the post");
      return;
    }

    const uploadedPaths: string[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const picked = files[index]!;
        const path = await uploadPostMedia(
          supabase,
          activeFamily.id,
          post.id,
          picked.file,
        );
        uploadedPaths.push(path);

        const { error: mediaError } = await supabase
          .from("post_media")
          .insert({
            post_id: post.id,
            storage_path: path,
            media_type: picked.file.type.startsWith("video") ? "video" : "image",
            mime_type: picked.file.type,
            position: index,
          });

        if (mediaError) throw new Error(mediaError.message);
      }
    } catch (error) {
      // Roll back: remove the post (media rows cascade) and uploaded files.
      await supabase.from("posts").delete().eq("id", post.id);
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("post-media").remove(uploadedPaths);
      }
      setPending(false);
      toast.error(
        error instanceof Error ? error.message : "Upload failed — try again",
      );
      return;
    }

    for (const picked of files) URL.revokeObjectURL(picked.previewUrl);
    setPending(false);
    toast.success("Shared with your family");
    router.push("/home");
    router.refresh();
  }

  if (!activeFamily) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Join or create a family before posting.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <UserAvatar
          path={profile.avatar_url}
          name={profile.full_name}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground">
            Posting to {activeFamily.name}
          </p>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={`Share something with ${activeFamily.name}…`}
        rows={5}
        maxLength={5000}
        className="resize-none rounded-2xl text-base leading-relaxed"
        aria-label="Post content"
      />

      {files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {files.map((picked, index) => (
            <li key={picked.previewUrl} className="relative">
              <span className="block aspect-square overflow-hidden rounded-xl bg-muted">
                {picked.file.type.startsWith("video") ? (
                  <video
                    src={picked.previewUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <Image
                    src={picked.previewUrl}
                    alt=""
                    width={200}
                    height={200}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label={`Remove attachment ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          What kind of moment is this?
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MOMENT_TYPES) as MomentType[]).map((key) => {
            const option = MOMENT_TYPES[key];
            const selected = momentType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMomentType(key)}
                aria-pressed={selected}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <span aria-hidden>{option.emoji}</span>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {canModerate ? (
        <div className="flex items-center justify-between rounded-2xl border border-border p-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy" aria-hidden />
            <div>
              <Label htmlFor="admins-only" className="text-sm font-medium">
                Admins only
              </Label>
              <p className="text-xs text-muted-foreground">
                Only owners, admins and moderators will see this post.
              </p>
            </div>
          </div>
          <Switch
            id="admins-only"
            checked={adminsOnly}
            onCheckedChange={setAdminsOnly}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={pickFiles}
          className="sr-only"
          id="post-media-input"
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />
          Add photos
          {files.length > 0 ? ` (${files.length})` : ""}
        </Button>

        <Button
          type="button"
          className="h-11 rounded-full px-6"
          onClick={() => void submit()}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              Sharing…
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-4 w-4" aria-hidden />
              Share
            </>
          )}
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden />
        Only members of {activeFamily.name} can see this.
      </p>
    </div>
  );
}
