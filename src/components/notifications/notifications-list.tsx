"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_FIELDS } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileLite } from "@/lib/types";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor: ProfileLite | null;
};

export function NotificationsList() {
  const { userId, refreshBadges } = useFamily();
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(
        `id, type, title, body, link, read_at, created_at, actor:profiles!notifications_actor_id_fkey(${PROFILE_FIELDS})`,
      )
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      toast.error("Could not load notifications");
      setItems([]);
      return;
    }
    setItems((data ?? []) as unknown as NotificationRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  async function open(item: NotificationRow) {
    if (!item.read_at) {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", item.id);
      setItems((current) =>
        current?.map((row) =>
          row.id === item.id
            ? { ...row, read_at: new Date().toISOString() }
            : row,
        ) ?? null,
      );
      refreshBadges();
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    setMarkingAll(false);

    if (error) {
      toast.error("Could not mark notifications as read");
      return;
    }
    setItems((current) =>
      current?.map((row) =>
        row.read_at ? row : { ...row, read_at: new Date().toISOString() },
      ) ?? null,
    );
    refreshBadges();
    toast.success("All caught up");
  }

  const unread = (items ?? []).filter((item) => !item.read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">Notifications</h1>
        {unread > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-10 rounded-full"
            onClick={() => void markAllRead()}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCheck className="mr-1.5 h-4 w-4" aria-hidden />
            )}
            Mark all read
          </Button>
        ) : null}
      </div>

      {items === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Bell className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
          <h2 className="mt-2 font-display text-lg font-semibold">
            Nothing yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comments, reactions, invites, and family events will show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const content = (
              <>
                <UserAvatar
                  path={item.actor?.avatar_url ?? null}
                  name={item.actor?.full_name ?? "Family"}
                  size={40}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${item.read_at ? "" : "font-semibold"}`}
                  >
                    {item.title}
                  </span>
                  {item.body ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.body}
                    </span>
                  ) : null}
                  <time
                    className="mt-0.5 block text-[11px] text-muted-foreground"
                    dateTime={item.created_at}
                  >
                    {timeAgo(item.created_at)}
                  </time>
                </span>
                {!item.read_at ? (
                  <span
                    aria-label="Unread"
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-warm"
                  />
                ) : null}
              </>
            );

            return (
              <li key={item.id}>
                {item.link ? (
                  <Link
                    href={item.link}
                    onClick={() => void open(item)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition hover:border-primary/30 ${
                      item.read_at ? "border-border bg-card" : "border-primary/25 bg-primary/5"
                    }`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      item.read_at ? "border-border bg-card" : "border-primary/25 bg-primary/5"
                    }`}
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
