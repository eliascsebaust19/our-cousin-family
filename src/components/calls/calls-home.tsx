"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff, Loader2, PhoneCall, Users, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  callsErrorMessage,
  getRoomParticipants,
  livekitUrl,
} from "@/lib/calls";
import { familyRoom, roomToSlug } from "@/lib/call-rooms";
import type { CallParticipant } from "@/lib/types";

type MemberRow = {
  user_id: string;
  profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

/** How often the lobby re-asks the server who is in the family room. */
const POLL_MS = 20_000;

export function CallsHome() {
  const { activeFamily, userId } = useFamily();
  const familyId = activeFamily?.id ?? null;

  const [serverError, setServerError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[] | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [checking, setChecking] = useState(false);

  const configured = livekitUrl() !== null;
  const room = familyId ? familyRoom(familyId) : null;
  const slug = room ? roomToSlug(room) : null;

  const refresh = useCallback(
    async (showSpinner: boolean) => {
      if (!room) {
        setParticipants([]);
        return;
      }
      if (showSpinner) setChecking(true);
      try {
        setParticipants(await getRoomParticipants(room));
        setServerError(null);
      } catch (error) {
        setParticipants([]);
        setServerError(callsErrorMessage(error));
      } finally {
        if (showSpinner) setChecking(false);
      }
    },
    [room],
  );

  useEffect(() => {
    if (!configured) return;
    void refresh(true);
    const timer = setInterval(() => void refresh(false), POLL_MS);
    // Coming back to the tab should not show a stale "nobody is here".
    const onFocus = () => void refresh(false);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [configured, refresh]);

  useEffect(() => {
    if (!familyId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("family_members")
        .select(
          `user_id, profile:profiles!family_members_user_id_fkey(id, full_name, avatar_url)`,
        )
        .eq("family_id", familyId)
        .eq("status", "active");
      if (cancelled) return;
      setMembers((data ?? []) as unknown as MemberRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  if (!activeFamily) {
    return (
      <div className="rounded-3xl border border-dashed p-6 text-center">
        <CloudOff className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Join or create a family first — calls belong to a family.
        </p>
      </div>
    );
  }

  if (!configured || serverError) {
    return (
      <div className="space-y-4">
        <div className="space-y-3 rounded-3xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <h1 className="text-sm font-medium">
                {!configured
                  ? "LiveKit is not configured yet"
                  : serverError?.includes("member")
                    ? "Family Access Notice"
                    : "Call Service Notice"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {!configured
                  ? "LiveKit configuration is missing."
                  : serverError}
              </p>
            </div>
          </div>
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh(true)}
              disabled={checking}
              className="h-8 rounded-full text-xs"
            >
              {checking ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Checking…
                </>
              ) : (
                "Retry connection"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const inCall = participants ?? [];
  const others = members.filter((member) => member.user_id !== userId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl">Family Calls</h1>
          <p className="truncate text-sm text-muted-foreground">
            {activeFamily.name} · {members.length}{" "}
            {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void refresh(true)}
          disabled={checking}
          aria-label="Refresh who is in the call"
          className="size-11 shrink-0 rounded-full p-0"
        >
          {checking ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Users className="size-5" />
          )}
        </Button>
      </div>

      {slug ? (
        <section className="space-y-3 rounded-3xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Video className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-sm font-semibold">Family room</h2>
              <p className="text-xs text-muted-foreground">
                One room for the whole family. Anyone can walk in or out — no
                ringing, no scheduling.
              </p>
            </div>
          </div>

          {participants === null ? (
            <Skeleton className="h-12 w-full rounded-2xl" />
          ) : inCall.length === 0 ? (
            <p className="rounded-2xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              Nobody is in the call right now.
            </p>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 px-3 py-2.5">
              <span className="flex -space-x-2">
                {inCall.slice(0, 4).map((participant) => (
                  <span
                    key={participant.identity}
                    className="grid size-8 place-items-center rounded-full bg-background text-[11px] font-semibold ring-2 ring-background"
                  >
                    {(participant.name ?? "F").charAt(0).toUpperCase()}
                  </span>
                ))}
              </span>
              <p className="min-w-0 flex-1 text-xs">
                <span className="font-medium">
                  {inCall.length === 1
                    ? `${inCall[0]?.name ?? "Someone"} is in the call`
                    : `${inCall.length} people are in the call`}
                </span>
              </p>
            </div>
          )}

          <Button asChild className="h-12 w-full rounded-full">
            <Link href={`/calls/${slug}`}>
              <PhoneCall className="size-4" />
              {inCall.length === 0 ? "Start the family call" : "Join the call"}
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="space-y-3 rounded-3xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Who can join</h2>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active members yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {others.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center gap-2 rounded-full border px-2 py-1"
              >
                <UserAvatar
                  path={member.profile?.avatar_url ?? null}
                  name={member.profile?.full_name ?? "Member"}
                  size={24}
                />
                <span className="text-xs">
                  {member.profile?.full_name ?? "Family member"}
                </span>
              </li>
            ))}
            {others.length === 0 ? (
              <li className="text-xs text-muted-foreground">
                You are the only active member.
              </li>
            ) : null}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          Direct and group calls are also available from the chat header — the
          room is derived from the conversation, so only its members can join.
        </p>
      </section>
    </div>
  );
}
