"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Video as VideoIcon,
  VideoOff,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_FIELDS } from "@/lib/queries";
import {
  CallsError,
  callsErrorMessage,
  livekitUrl,
  requestCallToken,
} from "@/lib/calls";
import { parseRoomName } from "@/lib/call-rooms";
import { cn } from "@/lib/utils";

type Tile = {
  key: string;
  name: string;
  isLocal: boolean;
  videoTrack: Track | null;
  cameraOn: boolean;
  micOn: boolean;
  speaking: boolean;
};

type Phase = "connecting" | "live" | "error" | "unconfigured";

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * The in-call experience.
 *
 * LiveKit owns the media plane; this component owns the *session*: it asks the
 * `livekit-token` Edge Function for a single-room token, connects, and renders
 * whatever the room reports. It never decides who may join — the server already
 * decided, and the token is useless outside the one room it names.
 */
export function CallRoom({ room: roomSlug }: { room: string }) {
  const router = useRouter();
  const { activeFamily, userId } = useFamily();
  const parsed = useMemo(() => parseRoomName(roomSlug), [roomSlug]);

  const [phase, setPhase] = useState<Phase>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [roomSubtitle, setRoomSubtitle] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const connectedAtRef = useRef<number | null>(null);

  // ---- room label ----------------------------------------------------------
  useEffect(() => {
    if (!parsed) return;
    if (parsed.kind === "family") {
      setRoomTitle(activeFamily?.name ?? "Family call");
      setRoomSubtitle("Everyone in the family can join");
      return;
    }

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("conversations")
        .select(
          `id, type, title, members:conversation_members(user_id, profile:profiles!conversation_members_user_id_fkey(${PROFILE_FIELDS}))`,
        )
        .eq("id", parsed.id)
        .maybeSingle();
      if (cancelled) return;

      const row = data as unknown as {
        type: string;
        title: string | null;
        members: Array<{ user_id: string; profile: { full_name: string | null } | null }>;
      } | null;
      if (!row) {
        setRoomTitle("Call");
        return;
      }
      if (row.type === "group") {
        setRoomTitle(row.title ?? "Group call");
      } else {
        const other = row.members.find((member) => member.user_id !== userId);
        setRoomTitle(other?.profile?.full_name ?? "Direct call");
      }
      setRoomSubtitle("Direct call");
    })();

    return () => {
      cancelled = true;
    };
  }, [parsed, activeFamily, userId]);

  // ---- session -------------------------------------------------------------
  const syncTiles = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next: Tile[] = [];

    const local = room.localParticipant;
    if (local) {
      const cameraPub = local.getTrackPublication(Track.Source.Camera);
      const micPub = local.getTrackPublication(Track.Source.Microphone);
      next.push({
        key: local.identity,
        name: "You",
        isLocal: true,
        videoTrack: cameraPub?.videoTrack ?? null,
        cameraOn: Boolean(cameraPub && !cameraPub.isMuted),
        micOn: Boolean(micPub && !micPub.isMuted),
        speaking: local.isSpeaking,
      });
    }

    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      const cameraPub = participant.getTrackPublication(Track.Source.Camera);
      const micPub = participant.getTrackPublication(Track.Source.Microphone);
      next.push({
        key: participant.identity,
        name: participant.name?.trim() ? participant.name : "Family member",
        isLocal: false,
        videoTrack: cameraPub?.videoTrack ?? null,
        cameraOn: Boolean(cameraPub && !cameraPub.isMuted),
        micOn: Boolean(micPub && !micPub.isMuted),
        speaking: participant.isSpeaking,
      });
    });

    setTiles(next);
  }, []);

  useEffect(() => {
    if (!parsed) {
      setPhase("error");
      setErrorMessage("That call link is not valid.");
      return;
    }
    if (!livekitUrl()) {
      setPhase("unconfigured");
      setErrorMessage(
        "NEXT_PUBLIC_LIVEKIT_URL is not set, so the browser has no LiveKit address to connect to.",
      );
      return;
    }

    let disposed = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attachRemoteAudio = (track: RemoteTrack) => {
      const element = track.attach();
      element.style.display = "none";
      audioContainerRef.current?.appendChild(element);
    };

    room
      .on(RoomEvent.Connected, () => {
        if (disposed) return;
        connectedAtRef.current = Date.now();
        setPhase("live");
        setAudioBlocked(!room.canPlaybackAudio);
        syncTiles();
      })
      .on(RoomEvent.Disconnected, () => {
        if (disposed) return;
        syncTiles();
        setPhase((current) => (current === "live" ? "error" : current));
        setErrorMessage("The call ended.");
      })
      .on(RoomEvent.ParticipantConnected, syncTiles)
      .on(RoomEvent.ParticipantDisconnected, syncTiles)
      .on(RoomEvent.LocalTrackPublished, syncTiles)
      .on(RoomEvent.LocalTrackUnpublished, syncTiles)
      .on(RoomEvent.TrackMuted, syncTiles)
      .on(RoomEvent.TrackUnmuted, syncTiles)
      .on(RoomEvent.ActiveSpeakersChanged, syncTiles)
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        // Remote audio has no visible element of its own; it needs to exist in
        // the DOM to play at all, so it is parked in a hidden container.
        if (track.kind === Track.Kind.Audio) attachRemoteAudio(track);
        syncTiles();
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) track.detach();
        syncTiles();
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioBlocked(!room.canPlaybackAudio);
      });

    void (async () => {
      try {
        const token = await requestCallToken(parsed.room, true);
        if (disposed) return;
        await room.connect(token.url, token.token);
        if (disposed) return;
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        syncTiles();
      } catch (error) {
        if (disposed) return;
        setPhase("error");
        setErrorMessage(
          error instanceof CallsError
            ? callsErrorMessage(error)
            : "Could not connect to the call. Check that your browser is allowed to use the camera and microphone.",
        );
      }
    })();

    return () => {
      disposed = true;
      connectedAtRef.current = null;
      void room.disconnect();
      roomRef.current = null;
    };
  }, [parsed, syncTiles]);

  // Attach/detach video tracks whenever the participant list changes.
  useEffect(() => {
    for (const tile of tiles) {
      const element = videoRefs.current.get(tile.key);
      if (element && tile.videoTrack) tile.videoTrack.attach(element);
    }
  }, [tiles]);

  useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => {
      if (connectedAtRef.current) {
        setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ---- controls ------------------------------------------------------------
  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    setBusy(true);
    try {
      const next = !micEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
      syncTiles();
    } catch {
      toast.error("Could not change the microphone");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    setBusy(true);
    try {
      const next = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      syncTiles();
    } catch {
      toast.error("Could not change the camera");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await roomRef.current?.disconnect();
    } catch {
      // Leaving must never be blocked by a failing teardown.
    } finally {
      router.push("/calls");
    }
  }

  async function enableAudio() {
    try {
      await roomRef.current?.startAudio();
      setAudioBlocked(false);
    } catch {
      toast.error("Your browser blocked audio playback");
    }
  }

  // ---- render --------------------------------------------------------------
  const remoteCount = tiles.filter((tile) => !tile.isLocal).length;

  if (phase === "unconfigured" || phase === "error") {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-3xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <h1 className="text-sm font-medium">
                {phase === "unconfigured" ? "LiveKit is not configured" : "Call unavailable"}
              </h1>
              <p className="text-xs text-muted-foreground">{errorMessage}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-full">
            <Link href="/calls">Back to calls</Link>
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Setup guide: docs/SETUP-LIVEKIT.md
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70dvh] flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl">{roomTitle ?? "Call"}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {phase === "connecting" ? "Connecting…" : formatElapsed(elapsed)}
            {" · "}
            <Users className="inline size-3" /> {tiles.length}{" "}
            {tiles.length === 1 ? "person" : "people"}
            {roomSubtitle ? ` · ${roomSubtitle}` : ""}
          </p>
        </div>
      </div>

      {audioBlocked ? (
        <button
          type="button"
          onClick={() => void enableAudio()}
          className="flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-medium"
        >
          <Volume2 className="size-4" />
          Tap to enable sound
        </button>
      ) : null}

      {phase === "connecting" ? (
        <div className="grid flex-1 place-items-center gap-3 rounded-3xl border bg-muted/40 p-6 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Asking the server for a room token…
          </p>
        </div>
      ) : (
        <ul className="grid flex-1 auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
          {tiles.map((tile) => (
            <li
              key={tile.key}
              className={cn(
                "relative min-h-[38vw] overflow-hidden rounded-3xl border bg-muted/50 sm:min-h-0",
                tile.speaking && "ring-2 ring-emerald-500",
              )}
            >
              <video
                ref={(element) => {
                  if (element) videoRefs.current.set(tile.key, element);
                  else videoRefs.current.delete(tile.key);
                }}
                autoPlay
                playsInline
                muted={tile.isLocal}
                className={cn(
                  "size-full object-cover",
                  !tile.cameraOn && "opacity-0",
                )}
              />
              {!tile.cameraOn ? (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-16 place-items-center rounded-full bg-background/80 text-lg font-semibold">
                    {tile.name.charAt(0).toUpperCase()}
                  </span>
                </span>
              ) : null}
              <span className="absolute inset-x-2 bottom-2 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                {tile.micOn ? (
                  <Mic className="size-3" />
                ) : (
                  <MicOff className="size-3 text-amber-300" />
                )}
                <span className="truncate">{tile.name}</span>
              </span>
            </li>
          ))}
          {tiles.length === 0 ? (
            <li className="grid place-items-center rounded-3xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              You are the only one here. Others will appear as they join.
            </li>
          ) : null}
        </ul>
      )}

      {remoteCount === 0 && phase === "live" ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Nobody else has joined yet — the room stays open until you leave.
        </p>
      ) : null}

      {/* Hidden sink for remote audio tracks. */}
      <div ref={audioContainerRef} className="hidden" aria-hidden />

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant={micEnabled ? "outline" : "destructive"}
          onClick={() => void toggleMic()}
          disabled={busy || phase !== "live"}
          aria-pressed={!micEnabled}
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
          className="size-14 rounded-full p-0"
        >
          {micEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void leave()}
          disabled={busy}
          className="h-14 rounded-full px-6"
        >
          <PhoneOff className="size-5" />
          Leave
        </Button>
        <Button
          type="button"
          variant={cameraEnabled ? "outline" : "destructive"}
          onClick={() => void toggleCamera()}
          disabled={busy || phase !== "live"}
          aria-pressed={!cameraEnabled}
          aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          className="size-14 rounded-full p-0"
        >
          {cameraEnabled ? (
            <VideoIcon className="size-5" />
          ) : (
            <VideoOff className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
