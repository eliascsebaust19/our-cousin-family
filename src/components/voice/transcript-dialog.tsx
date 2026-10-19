"use client";

import { useState } from "react";
import { FileText, Copy, Check, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import type { VoiceMemory } from "@/lib/types";

interface TranscriptDialogProps {
  memory: VoiceMemory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: VoiceMemory) => void;
}

export function TranscriptDialog({
  memory,
  open,
  onOpenChange,
  onUpdated,
}: TranscriptDialogProps) {
  const { userId } = useFamily();
  const supabase = createClient();
  const [text, setText] = useState(memory?.transcript || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync state if memory changes
  if (memory && memory.transcript !== undefined && !isEditing && text === "") {
    if (memory.transcript) setText(memory.transcript);
  }

  if (!memory) return null;

  async function handleSave() {
    if (!memory) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("voice_memories")
        .update({
          transcript: text.trim() || null,
          transcript_status: text.trim() ? "completed" : "none",
          transcript_updated_by: userId || null,
        })
        .eq("id", memory.id)
        .select()
        .single();

      if (error) throw error;
      onUpdated(data as VoiceMemory);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update transcript:", err);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopy() {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setIsEditing(false);
      }}
    >
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FileText className="h-5 w-5 text-primary" />
            Transcript & Story Notes
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">
            {memory.title} — by {memory.speaker_name || "Family Member"}
          </p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  memory.transcript_status === "completed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : memory.transcript_status === "pending"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {memory.transcript_status === "completed"
                  ? "Transcribed"
                  : memory.transcript_status === "pending"
                  ? "Pending Review"
                  : "No Written Transcript"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {text && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy Text
                    </>
                  )}
                </Button>
              )}

              {!isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setText(memory.transcript || "");
                    setIsEditing(true);
                  }}
                  className="h-8 text-xs rounded-xl"
                >
                  Edit / Add Notes
                </Button>
              )}
            </div>
          </div>

          {/* Transcript content */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste the spoken words, translation, or notes here..."
                rows={8}
                className="rounded-xl text-sm leading-relaxed"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText(memory.transcript || "");
                    setIsEditing(false);
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-1.5 rounded-xl"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : text ? (
            <div className="rounded-xl border border-border/70 bg-card p-4 text-sm leading-relaxed text-foreground/90 max-h-80 overflow-y-auto whitespace-pre-wrap">
              {text}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground text-xs">
              No written transcript has been added yet. Click &quot;Edit / Add Notes&quot; to write down the story or translation.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

