"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Mic,
  Search,
  Filter,
  FileText,
  Trash2,
  Calendar,
  Sparkles,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoicePlayer } from "@/components/voice/voice-player";
import { AudioRecorderDialog } from "@/components/voice/audio-recorder-dialog";
import { TranscriptDialog } from "@/components/voice/transcript-dialog";
import { createClient } from "@/lib/supabase/client";
import { resolveMediaUrl, initials } from "@/lib/avatar";
import { useFamily } from "@/components/app/family-provider";
import type { VoiceMemory } from "@/lib/types";

interface VoiceArchiveViewProps {
  initialMemories: VoiceMemory[];
  familyId: string;
}

export function VoiceArchiveView({
  initialMemories,
  familyId,
}: VoiceArchiveViewProps) {
  const { userId, roleInActiveFamily } = useFamily();
  const supabase = createClient();

  const [memories, setMemories] = useState<VoiceMemory[]>(initialMemories);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [transcriptMemory, setTranscriptMemory] = useState<VoiceMemory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Resolve signed URLs for audio playback
  useEffect(() => {
    let isMounted = true;
    async function loadUrls() {
      const updates: Record<string, string> = {};
      for (const m of memories) {
        if (!resolvedUrls[m.id] && m.audio_url) {
          const url = await resolveMediaUrl(supabase, m.audio_url, "post-media");
          if (url) updates[m.id] = url;
        }
      }
      if (isMounted && Object.keys(updates).length > 0) {
        setResolvedUrls((prev) => ({ ...prev, ...updates }));
      }
    }
    loadUrls();
    return () => {
      isMounted = false;
    };
  }, [memories]);

  // Unique speakers
  const allSpeakers = useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => {
      if (m.speaker_name?.trim()) set.add(m.speaker_name.trim());
    });
    return Array.from(set).sort();
  }, [memories]);

  // Unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => {
      m.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [memories]);

  // Filtered memories
  const filteredMemories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return memories.filter((m) => {
      if (selectedSpeaker !== "all" && m.speaker_name !== selectedSpeaker) {
        return false;
      }
      if (selectedTag !== "all" && (!m.tags || !m.tags.includes(selectedTag))) {
        return false;
      }
      if (!q) return true;

      const titleMatch = m.title.toLowerCase().includes(q);
      const descMatch = m.description?.toLowerCase().includes(q);
      const speakerMatch = m.speaker_name?.toLowerCase().includes(q);
      const transcriptMatch = m.transcript?.toLowerCase().includes(q);
      const tagMatch = m.tags?.some((t) => t.toLowerCase().includes(q));

      return (
        titleMatch ||
        descMatch ||
        speakerMatch ||
        transcriptMatch ||
        tagMatch
      );
    });
  }, [memories, searchQuery, selectedSpeaker, selectedTag]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this voice memory? This cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    try {
      const memoryToDelete = memories.find((m) => m.id === id);
      if (memoryToDelete?.audio_url) {
        await supabase.storage.from("post-media").remove([memoryToDelete.audio_url]);
      }

      const { error } = await supabase.from("voice_memories").delete().eq("id", id);
      if (error) throw error;

      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete memory:", err);
      alert("Failed to delete voice memory.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleMemorySaved(saved: VoiceMemory) {
    setMemories((prev) => [saved, ...prev]);
    // Immediately pre-resolve url
    resolveMediaUrl(supabase, saved.audio_url, "post-media").then((url) => {
      if (url) {
        setResolvedUrls((prev) => ({ ...prev, [saved.id]: url }));
      }
    });
  }

  function handleMemoryUpdated(updated: VoiceMemory) {
    setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (transcriptMemory?.id === updated.id) {
      setTranscriptMemory(updated);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Volume2 className="h-6 w-6 text-primary" />
            Voice Memories & Story Archive
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Preserve elders&apos; voices, childhood laughs, bedtime stories, and family memories forever.
          </p>
        </div>

        <Button
          onClick={() => setIsRecordDialogOpen(true)}
          className="gap-2 rounded-xl shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Mic className="h-4 w-4" /> Record New Story
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search Input */}
        <div className="relative sm:col-span-6 md:col-span-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stories, speakers, transcripts, tags..."
            className="pl-9 rounded-xl"
          />
        </div>

        {/* Speaker Filter */}
        <div className="sm:col-span-3 md:col-span-3">
          <select
            value={selectedSpeaker}
            onChange={(e) => setSelectedSpeaker(e.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Speakers ({allSpeakers.length})</option>
            {allSpeakers.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div className="sm:col-span-3 md:col-span-3">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Tags ({allTags.length})</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Memory Cards Grid */}
      {filteredMemories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mic className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground text-base">
            {memories.length === 0
              ? "No voice memories archived yet"
              : "No voice memories match your filters"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {memories.length === 0
              ? "Start recording grandma's recipes, grandpa's stories, or your cousins' funniest moments."
              : "Try clearing your search keyword or selecting 'All Speakers' or 'All Tags'."}
          </p>
          {memories.length === 0 && (
            <Button
              onClick={() => setIsRecordDialogOpen(true)}
              className="mt-4 gap-2 rounded-xl"
            >
              <Mic className="h-4 w-4" /> Record First Voice Story
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((m) => {
            const audioSrc = resolvedUrls[m.id];
            const dateStr = m.created_at
              ? new Date(m.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "";

            const canDelete =
              userId === m.created_by ||
              roleInActiveFamily === "owner" ||
              roleInActiveFamily === "admin";

            // Extract prompt prefix if present
            let promptText: string | null = null;
            let displayDesc = m.description;
            if (m.description?.startsWith("[Prompt: ")) {
              const closeIdx = m.description.indexOf("]");
              if (closeIdx !== -1) {
                promptText = m.description.substring(9, closeIdx);
                displayDesc = m.description.substring(closeIdx + 1).trim() || null;
              }
            }

            return (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs transition hover:border-primary/40 space-y-4"
              >
                <div>
                  {/* Top row: Speaker & Date */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                        {initials(m.speaker_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                          <span>{m.speaker_name || "Family Member"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete action (if owner or admin) */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="text-muted-foreground/60 hover:text-destructive transition p-1"
                        title="Delete memory"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Title & prompt */}
                  <div className="mt-3 space-y-1">
                    <h3 className="font-bold text-base text-foreground leading-snug">
                      {m.title}
                    </h3>
                    {promptText && (
                      <p className="text-xs italic text-primary/90 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        &ldquo;{promptText}&rdquo;
                      </p>
                    )}
                    {displayDesc && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {displayDesc}
                      </p>
                    )}
                  </div>
                </div>

                {/* Audio Player */}
                <div className="pt-1">
                  {audioSrc ? (
                    <VoicePlayer
                      src={audioSrc}
                      title={m.title}
                      durationSeconds={m.duration_seconds ?? undefined}
                    />
                  ) : (
                    <div className="rounded-2xl border border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground animate-pulse">
                      Loading audio player...
                    </div>
                  )}
                </div>

                {/* Tags & Transcript Link */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.tags && m.tags.length > 0 ? (
                      m.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">
                        No tags
                      </span>
                    )}
                    {m.tags && m.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{m.tags.length - 3} more
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTranscriptMemory(m)}
                    className="h-7 gap-1 text-xs text-primary hover:text-primary rounded-lg px-2"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {m.transcript ? "View Transcript" : "Add Transcript"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Dialog */}
      <AudioRecorderDialog
        open={isRecordDialogOpen}
        onOpenChange={setIsRecordDialogOpen}
        familyId={familyId}
        onSaved={handleMemorySaved}
      />

      {/* Transcript Dialog */}
      <TranscriptDialog
        memory={transcriptMemory}
        open={!!transcriptMemory}
        onOpenChange={(open) => {
          if (!open) setTranscriptMemory(null);
        }}
        onUpdated={handleMemoryUpdated}
      />
    </div>
  );
}

