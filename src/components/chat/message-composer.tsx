"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { ImagePlus, Loader2, Mic, Send, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadChatAttachment } from "@/lib/uploads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage } from "@/lib/types";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export function MessageComposer({
  conversationId,
  userId,
  replyTo,
  onCancelReply,
  onSent,
  onTyping,
}: {
  conversationId: string;
  userId: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSent: () => void;
  onTyping: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [sending, setSending] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationRef = useRef(0);
  const discardRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Images must be smaller than 25 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only images can be attached here");
      return;
    }
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }

  function clearAttachment() {
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  async function send() {
    const content = draft.trim();
    if (!content && !attachment) return;
    if (sending) return;

    setSending(true);
    const supabase = createClient();

    try {
      let storagePath: string | null = null;
      let mimeType = "";

      if (attachment) {
        mimeType = attachment.file.type;
        storagePath = await uploadChatAttachment(
          supabase,
          conversationId,
          attachment.file,
        );
      }

      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: content.length > 0 ? content : null,
          message_type: attachment ? "image" : "text",
          reply_to_id: replyTo?.id ?? null,
        })
        .select("id")
        .single();

      if (error || !message) throw new Error(error?.message ?? "Send failed");

      if (storagePath) {
        const { error: attachmentError } = await supabase
          .from("message_attachments")
          .insert({
            message_id: message.id,
            storage_path: storagePath,
            media_type: "image",
            mime_type: mimeType,
            size_bytes: attachment?.file.size ?? 0,
          });
        if (attachmentError) throw new Error(attachmentError.message);
      }

      setDraft("");
      clearAttachment();
      onCancelReply();
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  async function sendVoice() {
    const blob = new Blob(chunksRef.current, {
      type: recorderRef.current?.mimeType || "audio/webm",
    });
    chunksRef.current = [];
    const durationMs = durationRef.current;
    durationRef.current = 0;
    setElapsed(0);

    if (blob.size === 0) return;

    const file = new File([blob], `voice-${Date.now()}.webm`, {
      type: blob.type || "audio/webm",
    });

    setSending(true);
    const supabase = createClient();
    try {
      const storagePath = await uploadChatAttachment(
        supabase,
        conversationId,
        file,
        true,
      );

      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: null,
          message_type: "voice",
        })
        .select("id")
        .single();

      if (error || !message) throw new Error(error?.message ?? "Send failed");

      const { error: attachmentError } = await supabase
        .from("message_attachments")
        .insert({
          message_id: message.id,
          storage_path: storagePath,
          media_type: "voice",
          mime_type: file.type,
          size_bytes: file.size,
          duration_ms: Math.max(1000, Math.round(durationMs)),
        });
      if (attachmentError) throw new Error(attachmentError.message);

      onSent();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send voice note",
      );
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (recording || sending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : undefined,
      });
      chunksRef.current = [];
      discardRef.current = false;
      durationRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!discardRef.current) void sendVoice();
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      timerRef.current = setInterval(() => {
        durationRef.current += 500;
        setElapsed(durationRef.current);
      }, 500);
    } catch {
      toast.error("Microphone access is needed to send voice messages");
    }
  }

  function stopRecording(discard: boolean) {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    discardRef.current = discard;
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current.stop();
    setRecording(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const rows = Math.min(6, Math.max(1, draft.split("\n").length));

  if (recording) {
    return (
      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <div className="flex items-center gap-3 px-2">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden />
            <span className="text-sm font-medium tabular-nums">
              {Math.floor(elapsed / 60000)}:
              {String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}
            </span>
          </span>
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Recording voice message…
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-muted-foreground"
            onClick={() => stopRecording(true)}
            aria-label="Cancel recording"
          >
            <Trash2 className="h-4.5 w-4.5" aria-hidden />
          </Button>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={() => stopRecording(false)}
            disabled={elapsed < 500}
            aria-label="Send voice message"
          >
            <Square className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
      {replyTo ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            Replying to{" "}
            <strong className="font-medium text-foreground">
              {replyTo.sender?.full_name ?? "member"}
            </strong>
            {replyTo.content ? `: ${replyTo.content.slice(0, 60)}` : ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full"
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ) : null}

      {attachment ? (
        <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-muted/60 p-2">
          <span className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {attachment.file.name}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={clearAttachment}
            aria-label="Remove attachment"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={pickImage}
          aria-label="Attach an image"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full text-muted-foreground"
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          aria-label="Attach photo"
        >
          <ImagePlus className="h-4.5 w-4.5" aria-hidden />
        </Button>

        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onTyping();
          }}
          onKeyDown={onKeyDown}
          placeholder="Message…"
          rows={rows}
          maxLength={4000}
          className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl py-2.5"
          aria-label="Message"
        />

        {draft.trim().length === 0 && !attachment ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full text-muted-foreground"
            onClick={() => void startRecording()}
            disabled={sending}
            aria-label="Record voice message"
          >
            <Mic className="h-4.5 w-4.5" aria-hidden />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            onClick={() => void send()}
            disabled={sending}
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4.5 w-4.5" aria-hidden />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
