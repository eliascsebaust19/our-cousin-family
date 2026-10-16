"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  Music,
  Star,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteVaultItem,
  formatFileSize,
  vaultContentUrl,
  vaultErrorMessage,
} from "@/lib/vault";
import type { VaultItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One taggable relative, resolved from `family_members`. */
export type VaultMember = {
  user_id: string;
  name: string;
};

type VaultItemDialogProps = {
  item: VaultItem | null;
  members: VaultMember[];
  /** Whether the Drive account is connected — gates loading the bytes. */
  connected: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

function kindIconElement(kind: string, className: string) {
  if (kind === "video") return <Video className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

export function VaultItemDialog({
  item,
  members,
  connected,
  onOpenChange,
  onChanged,
}: VaultItemDialogProps) {
  const { userId, roleInActiveFamily } = useFamily();
  const [caption, setCaption] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setCaption(item?.caption ?? "");
  }, [item]);

  const taggedIds = useMemo(
    () => new Set((item?.people ?? []).map((person) => person.profile_id)),
    [item],
  );

  const canDelete = useMemo(() => {
    if (!item) return false;
    if (item.added_by === userId) return true;
    return roleInActiveFamily === "owner" || roleInActiveFamily === "admin";
  }, [item, userId, roleInActiveFamily]);

  if (!item) return null;

  const ready = item.upload_state === "ready" && Boolean(item.drive_file_id);
  const previewUrl = ready && connected ? vaultContentUrl(item.id) : null;
  const captured = item.captured_at ?? item.created_at;

  async function saveCaption() {
    if (!item) return;
    setSavingCaption(true);
    try {
      const supabase = createClient();
      // `caption` is one of only two columns clients may update; the rest is
      // server-written (see the column-level grants in the Vault migration).
      const { error } = await supabase
        .from("vault_items")
        .update({ caption: caption.trim() ? caption.trim() : null })
        .eq("id", item.id);
      if (error) throw error;
      toast.success("Caption saved");
      onChanged();
    } catch {
      toast.error("Could not save the caption");
    } finally {
      setSavingCaption(false);
    }
  }

  async function toggleFavorite() {
    if (!item) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("vault_items")
        .update({ is_favorite: !item.is_favorite })
        .eq("id", item.id);
      if (error) throw error;
      onChanged();
    } catch {
      toast.error("Could not update the favourite");
    }
  }

  async function toggleTag(profileId: string) {
    if (!item) return;
    setBusyTag(profileId);
    try {
      const supabase = createClient();
      const isTagged = taggedIds.has(profileId);
      const { error } = isTagged
        ? await supabase
            .from("vault_item_people")
            .delete()
            .eq("item_id", item.id)
            .eq("profile_id", profileId)
        : await supabase
            .from("vault_item_people")
            .insert({ item_id: item.id, profile_id: profileId });
      if (error) throw error;
      onChanged();
    } catch {
      toast.error("Could not update the tags");
    } finally {
      setBusyTag(null);
    }
  }

  async function remove() {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteVaultItem(item.id);
      toast.success("Memory deleted");
      onOpenChange(false);
      onChanged();
    } catch (error) {
      toast.error(vaultErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{item.name}</DialogTitle>
          <DialogDescription>
            {formatFileSize(item.size_bytes)} · {item.kind} ·{" "}
            {new Date(captured).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            {item.event?.title ? ` · ${item.event.title}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-2xl border bg-muted/40">
          {!ready ? (
            <div className="grid aspect-video place-items-center gap-2 p-6 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                This upload did not finish, so there are no bytes in Drive yet.
              </p>
            </div>
          ) : !previewUrl ? (
            <div className="grid aspect-video place-items-center gap-2 p-6 text-center">
              {kindIconElement(item.kind, "size-8 text-muted-foreground")}
              <p className="text-xs text-muted-foreground">
                Connect Google Drive to preview this file.
              </p>
            </div>
          ) : item.kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={item.name}
              className="max-h-[55dvh] w-full object-contain"
            />
          ) : item.kind === "video" ? (
            <video
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-[55dvh] w-full"
            />
          ) : item.kind === "audio" ? (
            <div className="p-6">
              <audio src={previewUrl} controls className="w-full" />
            </div>
          ) : (
            <div className="grid aspect-video place-items-center gap-3 p-6 text-center">
              {kindIconElement(item.kind, "size-8 text-muted-foreground")}
              <Button asChild variant="outline" className="h-11 rounded-full">
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <Download className="size-4" /> Open the document
                </a>
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="vault-caption"
            className="text-sm font-medium"
          >
            Caption
          </label>
          <Textarea
            id="vault-caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="What is happening in this memory?"
            rows={2}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={saveCaption}
              disabled={savingCaption || caption === (item.caption ?? "")}
              className="h-10 rounded-full"
            >
              {savingCaption ? <Loader2 className="size-4 animate-spin" /> : null}
              Save caption
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" /> Who is in this memory
          </p>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">No family members to tag.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const isTagged = taggedIds.has(member.user_id);
                return (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => void toggleTag(member.user_id)}
                    disabled={busyTag !== null}
                    aria-pressed={isTagged}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                      isTagged
                        ? "border-foreground bg-muted font-medium"
                        : "text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    {busyTag === member.user_id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    {member.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row flex-wrap justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant={item.is_favorite ? "default" : "outline"}
            onClick={toggleFavorite}
            className="h-11 rounded-full"
          >
            <Star className={cn("size-4", item.is_favorite && "fill-current")} />
            {item.is_favorite ? "Favourite" : "Mark favourite"}
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={deleting}
              className="h-11 rounded-full"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
