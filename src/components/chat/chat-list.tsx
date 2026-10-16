"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_FIELDS } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileLite } from "@/lib/types";

type Summary = {
  conversation_id: string;
  family_id: string;
  type: string;
  title: string | null;
  last_message_at: string | null;
  last_message_content: string | null;
  last_message_type: string | null;
  unread_count: number;
};

type MemberLite = { user_id: string; profile: ProfileLite | null };

export function ChatList() {
  const { activeFamily, userId } = useFamily();
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  const [members, setMembers] = useState<Map<string, MemberLite[]>>(
    new Map(),
  );
  const familyId = activeFamily?.id ?? null;

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_conversation_summaries");
    if (error) {
      toast.error("Could not load your chats");
      setSummaries([]);
      return;
    }
    const rows = ((data ?? []) as Summary[]).filter(
      (row) => row.family_id === familyId,
    );
    setSummaries(rows);

    if (rows.length > 0) {
      const { data: memberRows } = await supabase
        .from("conversation_members")
        .select(
          `conversation_id, user_id, profile:profiles!conversation_members_user_id_fkey(${PROFILE_FIELDS})`,
        )
        .in(
          "conversation_id",
          rows.map((row) => row.conversation_id),
        );

      type MemberRowWithConv = MemberLite & { conversation_id: string };
      const map = new Map<string, MemberLite[]>();
      for (const row of (memberRows ?? []) as unknown as MemberRowWithConv[]) {
        const list = map.get(row.conversation_id) ?? [];
        list.push({ user_id: row.user_id, profile: row.profile });
        map.set(row.conversation_id, list);
      }
      setMembers(map);
    } else {
      setMembers(new Map());
    }
  }, [familyId]);

  useEffect(() => {
    setSummaries(null);
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 800);
    };

    const channel = supabase
      .channel(`chat-list:${familyId ?? "none"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          ...(familyId ? { filter: `family_id=eq.${familyId}` } : {}),
        },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        debounced,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [familyId, load]);

  const titleFor = useCallback(
    (summary: Summary) => {
      const list = members.get(summary.conversation_id) ?? [];
      if (summary.type === "group") {
        return {
          title: summary.title ?? "Group chat",
          subtitle: `${list.length} members`,
          avatarPath: null as string | null,
          name: summary.title ?? "Group",
        };
      }
      const other = list.find((m) => m.user_id !== userId);
      const name = other?.profile?.full_name ?? "Family member";
      return {
        title: name,
        subtitle: other?.profile?.relationship ?? null,
        avatarPath: other?.profile?.avatar_url ?? null,
        name,
      };
    },
    [members, userId],
  );

  const previewText = useCallback((summary: Summary) => {
    if (summary.last_message_type === "image") return "📷 Photo";
    if (summary.last_message_type === "voice") return "🎤 Voice message";
    if (summary.last_message_type === "system") {
      return summary.last_message_content ?? "";
    }
    return summary.last_message_content ?? "Say hello 👋";
  }, []);

  if (!activeFamily) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Join or create a family to use family chat.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Chat</h1>
        <NewChatDialog onCreated={() => void load()}>
          <Button size="sm" className="h-10 rounded-full">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            New chat
          </Button>
        </NewChatDialog>
      </div>

      {summaries === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <span aria-hidden className="text-3xl">
            💬
          </span>
          <h2 className="mt-2 font-display text-lg font-semibold">
            No chats yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a one-to-one chat with a relative, or create a group for the
            whole family.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {summaries.map((summary) => {
            const { title, subtitle, avatarPath, name } = titleFor(summary);
            const unread = Number(summary.unread_count);
            return (
              <li key={summary.conversation_id}>
                <Link
                  href={`/chat/${summary.conversation_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/30 active:scale-[0.99]"
                >
                  <UserAvatar path={avatarPath} name={name} size={46} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {title}
                      </span>
                      {summary.last_message_at ? (
                        <time
                          className="shrink-0 text-[11px] text-muted-foreground"
                          dateTime={summary.last_message_at}
                        >
                          {timeAgo(summary.last_message_at)}
                        </time>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {previewText(summary)}
                      </span>
                      {unread > 0 ? (
                        <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-brand-warm px-1.5 text-[10px] font-bold text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : null}
                    </span>
                    {subtitle ? (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {subtitle}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        Chats are private to {activeFamily.name}.
      </p>
    </div>
  );
}
