"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatSeconds(sec: number): string {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VoicePlayer({
  src,
  title,
  durationSeconds,
}: {
  src: string;
  title: string;
  durationSeconds?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }

  function cycleSpeed() {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex]!;
    setPlaybackRate(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  }

  function toggleMute() {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center justify-between gap-3">
        {/* Play/Pause Button */}
        <Button
          type="button"
          size="icon-sm"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>

        {/* Progress & Title */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="truncate max-w-[180px] font-sans font-medium text-foreground text-xs">
              {title}
            </span>
            <span>
              {formatSeconds(currentTime)} / {formatSeconds(duration || durationSeconds || 0)}
            </span>
          </div>

          {/* Seek Range Input */}
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || durationSeconds || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              aria-label="Audio progress"
            />
          </div>
        </div>

        {/* Speed toggle */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-mono font-bold hover:bg-accent transition"
          title="Playback speed"
        >
          {playbackRate}x
        </button>

        {/* Mute button */}
        <button
          type="button"
          onClick={toggleMute}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

