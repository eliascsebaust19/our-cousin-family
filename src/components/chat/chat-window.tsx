"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageCircle, Users, Video } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { MESSAGE_SELECT, PROFILE_FIELDS, channels } from "@/lib/queries";
import { dayLabel } from "@/lib/format";
import { PRESENCE_WINDOW_SECONDS } from "@/lib/constants";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageComposer } from "@/components/chat/message-composer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage, ProfileLite } from "@/lib/types";

const PAGE_SIZE = 40;

type ConversationInfo = {
  id: string;
  family_id: string;
  type: string;
  title: string | null;
};

type MemberLite = { user_id: string; profile: ProfileLite | null };

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const { userId, profile, refreshBadges } = useFamily();
  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [notMember, setNotMember] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  const loadMessages = useCallback(
    async (opts: { older?: boolean; cursor?: string } = {}) => {
      const supabase = createClient();
      let query = supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (opts.older && opts.cursor) {
        query = query.lt("created_at", opts.cursor);
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Could not load messages");
        setLoading(false);
        return;
      }

      const rows = ((data ?? []) as unknown as ChatMessage[]).reverse();
      setHasEarlier(rows.length === PAGE_SIZE);
      setMessages((current) => {
        if (!opts.older) return rows;
        const seen = new Set(rows.map((m) => m.id));
        return [...rows, ...current.filter((m) => !seen.has(m.id))];
      });
      setLoading(false);
    },
    [conversationId],
  );

  const markRead = useCallback(async () => {
    const supabase = createClient();
    await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversationId,
    });
    refreshBadges();
  }, [conversationId, refreshBadges]);

  // Conversation + members + first page of messages.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const supabase = createClient();

    void (async () => {
      const { data: convRows } = await supabase
        .from("conversations")
        .select("id, family_id, type, title")
        .eq("id", conversationId)
        .limit(1);

      if (!active) return;
      const conv = (convRows ?? [])[0] as ConversationInfo | undefined;
      if (!conv) {
        setNotMember(true);
        setLoading(false);
        return;
      }
      setConversation(conv);

      const [{ data: memberRows }] = await Promise.all([
        supabase
          .from("conversation_members")
          .select(
            `user_id, profile:profiles!conversation_members_user_id_fkey(${PROFILE_FIELDS})`,
          )
          .eq("conversation_id", conversationId),
        loadMessages(),
      ]);

      if (!active) return;
      setMembers((memberRows ?? []) as unknown as MemberLite[]);
      void markRead();
    })();

    return () => {
      active = false;
    };
  }, [conversationId, loadMessages, markRead]);

  // Realtime + typing channel.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(channels.conversation(conversationId), {
      config: { broadcast: { self: false } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((current) =>
            current.some((m) => m.id === incoming.id)
              ? current
              : [...current, incoming],
          );
          if (incoming.sender_id !== userId) {
            void markRead();
            setTypingName(null);
          }
          scrollToBottom();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((current) =>
            current.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id;
          if (removedId) {
            setMessages((current) => current.filter((m) => m.id !== removedId));
          }
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const senderId = payload.payload?.userId as string | undefined;
        const name = (payload.payload?.name as string | undefined) ?? "Someone";
        if (!senderId || senderId === userId) return;
        setTypingName(name);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setTypingName(null), 3000);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, userId, markRead, scrollToBottom]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        name: profile.nickname || profile.full_name || "Someone",
      },
    });
  }, [userId, profile]);

  async function editMessage(message: ChatMessage, content: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", message.id);
    if (error) {
      toast.error("Could not edit the message");
      return false;
    }
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id
          ? { ...m, content, edited_at: new Date().toISOString() }
          : m,
      ),
    );
    return true;
  }

  async function deleteMessage(message: ChatMessage) {
    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", message.id);

    if (error) {
      toast.error("Could not delete the message");
      return;
    }
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id
          ? { ...m, deleted_at: new Date().toISOString() }
          : m,
      ),
    );
  }

  const otherMembers = useMemo(
    () => members.filter((m) => m.user_id !== userId),
    [members, userId],
  );

  const headerTitle = useMemo(() => {
    if (!conversation) return { title: "Chat", subtitle: null as string | null };
    if (conversation.type === "group") {
      return {
        title: conversation.title ?? "Group chat",
        subtitle: `${members.length} members`,
      };
    }
    const other = otherMembers[0];
    const name = other?.profile?.full_name ?? "Family member";
    const online = other?.profile
      ? other.profile.show_online_status &&
        other.profile.last_seen_at &&
        Date.now() - parseISO(other.profile.last_seen_at).getTime() <
          PRESENCE_WINDOW_SECONDS * 1000
      : false;
    return {
      title: name,
      subtitle: online ? "Online" : (other?.profile?.relationship ?? null),
    };
  }, [conversation, members, otherMembers]);

  if (notMember) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <MessageCircle
          className="mx-auto h-7 w-7 text-muted-foreground"
          aria-hidden
        />
        <h2 className="mt-2 font-display text-base font-semibold">
          Chat unavailable
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This conversation doesn&apos;t exist, or you&apos;re not a member of
          it.
        </p>
        <Button asChild className="mt-4 h-11 rounded-full">
          <Link href="/chat">Back to chats</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-12.5rem)] flex-col">
      {/* Conversation header (sticks under the app header) */}
      <div className="sticky top-14 z-20 -mx-3 mb-2 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <Link
          href="/chat"
          aria-label="Back to chats"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>

        {members.length > 0 ? (
          <span className="flex shrink-0 -space-x-2">
            {otherMembers.slice(0, 2).map((member) => (
              <span key={member.user_id} className="rounded-full ring-2 ring-background">
                <UserAvatar
                  path={member.profile?.avatar_url ?? null}
                  name={member.profile?.full_name ?? "Member"}
                  size={36}
                />
              </span>
            ))}
            {conversation?.type === "group" ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary ring-2 ring-background">
                +{members.length}
              </span>
            ) : null}
          </span>
        ) : (
          <Skeleton className="h-9 w-9 rounded-full" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {headerTitle.title}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {headerTitle.subtitle ?? " "}
          </span>
        </span>

        <Link
          href={`/calls/dm-${conversationId}`}
          aria-label="Start a call in this conversation"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Video className="h-5 w-5" aria-hidden />
        </Link>

        {conversation?.type === "group" ? (
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1.5 pb-2">
        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-1/2 rounded-2xl" />
            </div>
            <Skeleton className="h-10 w-3/5 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — say hello 👋
          </div>
        ) : (
          <>
            {hasEarlier ? (
              <div className="flex justify-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full text-xs"
                  disabled={loadingEarlier}
                  onClick={() => {
                    setLoadingEarlier(true);
                    void loadMessages({
                      older: true,
                      cursor: messages[0]?.created_at,
                    }).finally(() => setLoadingEarlier(false));
                  }}
                >
                  {loadingEarlier ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    "Load earlier messages"
                  )}
                </Button>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay =
                !previous ||
                dayLabel(previous.created_at) !== dayLabel(message.created_at);
              const sameSender =
                previous &&
                previous.sender_id === message.sender_id &&
                !newDay &&
                message.message_type !== "system";
              const isOwn = message.sender_id === userId;
              const replySource = message.reply_to_id
                ? (messages.find((m) => m.id === message.reply_to_id) ?? null)
                : null;

              return (
                <div key={message.id}>
                  {newDay ? (
                    <p className="py-3 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {dayLabel(message.created_at)}
                    </p>
                  ) : null}
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    showSender={conversation?.type === "group" ? !sameSender : !isOwn && !sameSender}
                    replyTo={replySource}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    onReply={setReplyTo}
                  />
                </div>
              );
            })}
          </>
        )}

        <div ref={bottomRef} aria-hidden className="h-1" />
      </div>

      {/* Typing indicator + composer (sticky above the bottom navigation) */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-3 mt-1 rounded-t-2xl border-t border-border bg-background/95 px-3 pt-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6">
        <p
          className={`h-4 px-1 text-[11px] text-muted-foreground transition-opacity ${typingName ? "opacity-100" : "opacity-0"}`}
          aria-live="polite"
        >
          {typingName ? `${typingName} is typing…` : " "}
        </p>
        <MessageComposer
          conversationId={conversationId}
          userId={userId}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSent={() => {
            void loadMessages();
            void markRead();
            window.setTimeout(() => scrollToBottom(), 60);
          }}
          onTyping={sendTyping}
        />
      </div>
    </div>
  );
}
