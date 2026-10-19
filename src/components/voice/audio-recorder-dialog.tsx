"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Upload,
  AlertCircle,
  FileAudio,
  X,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { uploadVoiceMemory } from "@/lib/uploads";
import { useFamily } from "@/components/app/family-provider";
import type { VoiceMemory } from "@/lib/types";

interface AudioRecorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId: string;
  onSaved: (memory: VoiceMemory) => void;
}

export function AudioRecorderDialog({
  open,
  onOpenChange,
  familyId,
  onSaved,
}: AudioRecorderDialogProps) {
  const { userId, profile } = useFamily();
  const supabase = createClient();

  const [mode, setMode] = useState<"record" | "upload">("record");
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "paused" | "recorded"
  >("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [speakerName, setSpeakerName] = useState("");
  const [promptQuestion, setPromptQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [transcriptText, setTranscriptText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on dialog close or unmount
  useEffect(() => {
    if (!open) {
      cleanupStream();
      resetForm();
    }
  }, [open]);

  function cleanupStream() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function resetForm() {
    setRecordingState("idle");
    setRecordingDuration(0);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setErrorMsg(null);
    setTitle("");
    setSpeakerName("");
    setPromptQuestion("");
    setDescription("");
    setTags([]);
    setTranscriptText("");
  }

  async function startRecording() {
    setErrorMsg(null);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Audio recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        setRecordingState("recorded");
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start(250); // Slice every 250ms
      setRecordingState("recording");
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not access microphone.";
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        setErrorMsg(
          "Microphone permission was denied. Please allow microphone access in your browser settings to record voice memories.",
        );
      } else {
        setErrorMsg(msg);
      }
      setRecordingState("idle");
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setErrorMsg("Please upload a valid audio file (MP3, WAV, WebM, M4A, etc.)");
      return;
    }

    setAudioBlob(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Audio element to check duration
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      if (tempAudio.duration && isFinite(tempAudio.duration)) {
        setRecordingDuration(Math.round(tempAudio.duration));
      }
    };

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function addTag() {
    const trimmed = tagInput.trim().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function removeTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSave() {
    if (!title.trim()) {
      setErrorMsg("Please provide a title for this voice memory.");
      return;
    }

    if (!audioBlob) {
      setErrorMsg("Please record or select an audio file first.");
      return;
    }

    if (!userId) {
      setErrorMsg("You must be logged in to save voice memories.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const ext = audioBlob.type.includes("mp4")
        ? "m4a"
        : audioBlob.type.includes("mpeg")
        ? "mp3"
        : audioBlob.type.includes("wav")
        ? "wav"
        : "webm";

      const file = new File([audioBlob], `voice_${Date.now()}.${ext}`, {
        type: audioBlob.type || "audio/webm",
      });

      const storagePath = await uploadVoiceMemory(supabase, familyId, file);

      const fullDescription = promptQuestion.trim()
        ? `[Prompt: ${promptQuestion.trim()}]${description.trim() ? `\n\n${description.trim()}` : ""}`
        : description.trim() || null;

      const payload = {
        family_id: familyId,
        created_by: userId,
        speaker_name: speakerName.trim() || profile?.full_name || "Family Member",
        title: title.trim(),
        description: fullDescription,
        audio_url: storagePath,
        duration_seconds: recordingDuration,
        file_size_bytes: file.size,
        tags: tags,
        transcript: transcriptText.trim() || null,
        transcript_status: transcriptText.trim() ? "completed" : "none",
      };

      const { data, error } = await supabase
        .from("voice_memories")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      onSaved(data as VoiceMemory);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Save error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save voice memory.");
    } finally {
      setIsSaving(false);
    }
  }

  function formatTime(totalSec: number) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Mic className="h-5 w-5 text-primary" />
            Archive a Family Voice Memory
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preserve elder stories, childhood laughs, recipes, and family history in their own voice.
          </p>
        </DialogHeader>

        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Mode Selector */}
        <div className="flex rounded-xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-xs sm:text-sm font-semibold transition ${
              mode === "record"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("record")}
          >
            Live Record Microphone
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-xs sm:text-sm font-semibold transition ${
              mode === "upload"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode("upload")}
          >
            Upload Audio File
          </button>
        </div>

        {/* Audio Recording / Upload Section */}
        {mode === "record" ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center">
            {recordingState === "idle" && (
              <div className="space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
                  <Mic className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Ready to record</h4>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    Click Start when you are ready to record. Speak clearly into the microphone.
                  </p>
                </div>
                <Button type="button" onClick={startRecording} className="gap-2 rounded-xl">
                  <Mic className="h-4 w-4" /> Start Recording
                </Button>
              </div>
            )}

            {(recordingState === "recording" || recordingState === "paused") && (
              <div className="space-y-4 w-full">
                {/* Live pulsing waveform indication */}
                <div className="flex items-center justify-center gap-1.5 py-4">
                  {[40, 70, 100, 60, 90, 45, 80, 50, 95, 30].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: recordingState === "recording" ? `${h}%` : "20%" }}
                      className={`w-1.5 max-h-12 rounded-full transition-all duration-300 ${
                        recordingState === "recording"
                          ? "bg-primary animate-pulse"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>

                <div className="text-3xl font-mono font-bold text-foreground">
                  {formatTime(recordingDuration)}
                </div>

                <div className="flex items-center justify-center gap-2">
                  {recordingState === "recording" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={pauseRecording}
                      className="gap-1.5 rounded-xl"
                    >
                      <Pause className="h-4 w-4" /> Pause
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resumeRecording}
                      className="gap-1.5 rounded-xl"
                    >
                      <Play className="h-4 w-4" /> Resume
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopRecording}
                    className="gap-1.5 rounded-xl"
                  >
                    <Square className="h-4 w-4" /> Stop & Finish
                  </Button>
                </div>
              </div>
            )}

            {recordingState === "recorded" && audioUrl && (
              <div className="space-y-3 w-full">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Recording captured ({formatTime(recordingDuration)})
                </p>
                <audio src={audioUrl} controls className="w-full h-11 rounded-xl" />
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRecordingState("idle");
                      setAudioBlob(null);
                      setAudioUrl(null);
                      setRecordingDuration(0);
                    }}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Re-record
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center">
            {audioUrl ? (
              <div className="space-y-3 w-full">
                <div className="flex items-center justify-center gap-2 text-foreground text-sm font-semibold">
                  <FileAudio className="h-5 w-5 text-primary" /> Audio file selected
                </div>
                <audio src={audioUrl} controls className="w-full h-11 rounded-xl" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAudioBlob(null);
                    setAudioUrl(null);
                  }}
                  className="text-xs text-muted-foreground"
                >
                  Choose another file
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 py-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="h-7 w-7" />
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Click or drag audio file to upload
                </div>
                <div className="text-xs text-muted-foreground">
                  Supports MP3, WAV, M4A, WebM, OGG up to 50 MB
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {/* Metadata Inputs */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Story / Recording Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dadu's Stories from Old Dhaka, 1968"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Speaker / Storyteller
              </label>
              <Input
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
                placeholder="e.g. Grandma, Uncle Tariq"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Prompt / Context Question
              </label>
              <Input
                value={promptQuestion}
                onChange={(e) => setPromptQuestion(e.target.value)}
                placeholder="e.g. How did you two first meet?"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Story Description or Background
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context about when or why this was recorded..."
              rows={2}
              className="rounded-xl resize-none text-xs"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-destructive transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag (e.g. Heritage, Recipes, 1971)"
                className="rounded-xl text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                className="rounded-xl shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Transcript / Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Transcript / Written Translation (Optional)
            </label>
            <Textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Type what was said, a translation, or a written summary so it can be searched easily..."
              rows={3}
              className="rounded-xl resize-none text-xs"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !audioBlob || !title.trim()}
            className="rounded-xl px-5"
          >
            {isSaving ? "Saving..." : "Save to Archive"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
