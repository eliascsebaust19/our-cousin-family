"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Volume2, Mic } from "lucide-react";
import { useFamily } from "@/components/app/family-provider";
import { createClient } from "@/lib/supabase/client";
import { VoiceArchiveView } from "@/components/voice/voice-archive-view";
import type { VoiceMemory } from "@/lib/types";

export function VoiceMemoriesClient() {
  const { activeFamily } = useFamily();
  const [memories, setMemories] = useState<VoiceMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMemories = useCallback(async () => {
    if (!activeFamily) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("voice_memories")
        .select("*")
        .eq("family_id", activeFamily.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMemories((data as VoiceMemory[]) || []);
    } catch (err) {
      console.error("Failed to load voice memories:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFamily]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  if (!activeFamily) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center text-muted-foreground">
        Select or create a family to view voice memories.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 hover:text-foreground transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Family
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Voice Archive</span>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading voice memories...</p>
        </div>
      ) : (
        <VoiceArchiveView
          initialMemories={memories}
          familyId={activeFamily.id}
        />
      )}
    </div>
  );
}

