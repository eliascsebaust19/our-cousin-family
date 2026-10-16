"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Mic, Pencil, Quote, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveMediaUrl } from "@/lib/avatar";
import { messageTime } from "@/lib/format";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatMessage } from "@/lib/types";

function ChatImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    resolveMediaUrl(createClient(), path, "chat-attachments").then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <span className="flex h-40 w-40 items-center justify-center rounded-xl bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block overflow-hidden rounded-xl"
        aria-label="Open photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Chat attachment"
          className="max-h-60 w-auto max-w-full object-cover"
          loading="lazy"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Chat attachment"
            className="max-h-[80dvh] w-full rounded-2xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function VoicePlayer({
  path,
  durationMs,
}: {
  path: string;
  durationMs: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveMediaUrl(createClient(), path, "chat-attachments").then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <span className="flex h-10 w-48 items-center gap-2 rounded-full bg-muted px-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        <span className="h-1.5 flex-1 rounded-full bg-border" />
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Mic className="h-4 w-4 shrink-0" aria-hidden />
      <audio src={url} controls preload="none" className="h-9 max-w-[220px]" />
      {durationMs ? (
        <span className="shrink-0 text-[11px] opacity-70">
          {Math.max(1, Math.round(durationMs / 1000))}s
        </span>
      ) : null}
    </span>
  );
}

export function MessageBubble({
  message,
  isOwn,
  showSender,
  replyTo,
  onEdit,
  onDelete,
  onReply,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  replyTo: ChatMessage | null;
  onEdit: (message: ChatMessage, content: string) => Promise<boolean>;
  onDelete: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(message.content ?? "");
  }, [message.content, message.edited_at]);

  const senderName =
    message.sender?.nickname || message.sender?.full_name || "Family member";
  const deleted = message.deleted_at !== null;

  if (deleted) {
    return (
      <div
        className={`flex items-center gap-2 ${isOwn ? "justify-end" : ""}`}
      >
        {isOwn ? null : (
          <span className="w-8 shrink-0">
            {showSender ? (
              <UserAvatar
                path={message.sender?.avatar_url ?? null}
                name={senderName}
                size={32}
              />
            ) : null}
          </span>
        )}
        <p className="rounded-2xl border border-dashed border-border px-3 py-2 text-xs italic text-muted-foreground">
          {isOwn ? "You deleted this message" : "This message was deleted"}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-end gap-2 ${isOwn ? "justify-end" : ""}`}
    >
      {isOwn ? null : (
        <span className="w-8 shrink-0 self-start">
          {showSender ? (
            <UserAvatar
              path={message.sender?.avatar_url ?? null}
              name={senderName}
              size={32}
            />
          ) : null}
        </span>
      )}

      <div
        className={`max-w-[85%] min-w-0 ${isOwn ? "items-end" : "items-start"} flex flex-col`}
      >
        {!isOwn && showSender ? (
          <span className="mb-0.5 px-1 text-[11px] font-semibold text-muted-foreground">
            {senderName}
          </span>
        ) : null}

        <div
          className={`relative rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isOwn
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground"
          }`}
        >
          {replyTo ? (
            <span
              className={`mb-1.5 block border-l-2 pl-2 text-xs ${isOwn ? "border-primary-foreground/40 opacity-80" : "border-primary/50 text-muted-foreground"}`}
            >
              <Quote className="mr-1 inline h-3 w-3" aria-hidden />
              <strong className="font-semibold">
                {replyTo.sender?.full_name ?? "Member"}:{" "}
              </strong>
              {replyTo.content?.slice(0, 80) ?? "attachment"}
            </span>
          ) : null}

          {editing ? (
            <span className="block space-y-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={4000}
                className="rounded-xl bg-background/80 text-foreground"
                aria-label="Edit message"
              />
              <span className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={busy}
                  onClick={async () => {
                    if (draft.trim().length === 0) return;
                    setBusy(true);
                    const ok = await onEdit(message, draft.trim());
                    setBusy(false);
                    if (ok) setEditing(false);
                  }}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full"
                  onClick={() => {
                    setDraft(message.content ?? "");
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </span>
            </span>
          ) : (
            <>
              {message.message_attachments.map((attachment) =>
                attachment.media_type === "image" ? (
                  <span key={attachment.id} className="block">
                    <ChatImage path={attachment.storage_path} />
                  </span>
                ) : attachment.media_type === "voice" ? (
                  <span key={attachment.id} className="block">
                    <VoicePlayer
                      path={attachment.storage_path}
                      durationMs={attachment.duration_ms}
                    />
                  </span>
                ) : null,
              )}
              {message.content ? (
                <span className="block whitespace-pre-wrap break-words">
                  {message.content}
                </span>
              ) : null}
            </>
          )}
        </div>

        <span
          className={`mt-0.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground ${isOwn ? "justify-end" : ""}`}
        >
          <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
          {message.edited_at ? <span>edited</span> : null}
        </span>
      </div>

      {!editing ? (
        <span className="flex shrink-0 items-center self-end opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground"
            onClick={() => onReply(message)}
            aria-label="Reply"
          >
            <Quote className="h-3.5 w-3.5" aria-hidden />
          </Button>
          {isOwn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground"
                  aria-label="Message options"
                >
                  <span aria-hidden className="text-xs leading-none">
                    ⋯
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(message)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
