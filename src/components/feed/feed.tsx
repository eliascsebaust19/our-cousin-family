"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, PlusCircle, RefreshCw, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FEED_SELECT, channels } from "@/lib/queries";
import { useFamily } from "@/components/app/family-provider";
import { PostCard } from "@/components/feed/post-card";
import { QuickFeaturesBar } from "@/components/feed/quick-features-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedPost } from "@/lib/types";

const PAGE_SIZE = 8;
const MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);

function PostSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <Skeleton className="mt-3 h-40 w-full rounded-2xl" />
    </div>
  );
}

export function Feed() {
  const { activeFamily, userId, roleInActiveFamily } = useFamily();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const familyId = activeFamily?.id ?? null;
  const canModerate = MODERATOR_ROLES.has(roleInActiveFamily ?? "");

  const loadBookmarks = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("post_bookmarks")
      .select("post_id")
      .eq("user_id", userId);
    setBookmarks(new Set((data ?? []).map((row) => row.post_id)));
  }, [userId]);

  const loadPage = useCallback(
    async (offset: number) => {
      if (!familyId) return;
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("posts")
        .select(FEED_SELECT)
        .eq("family_id", familyId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (queryError) {
        setError("We couldn't load your family feed. Pull to try again.");
        return;
      }

      const rawRows = (data ?? []) as unknown as FeedPost[];
      const rows: FeedPost[] = rawRows.map((post) => {
        const sp = Array.isArray(post.shared_post)
          ? post.shared_post[0] ?? null
          : post.shared_post ?? null;
        return {
          ...post,
          shared_post: sp && sp.id ? sp : null,
        };
      });
      setError(null);
      setHasMore(rows.length === PAGE_SIZE);
      setPosts((current) => {
        if (offset === 0) return rows;
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...rows.filter((p) => !seen.has(p.id))];
      });
    },
    [familyId],
  );

  // Initial load / family switch.
  useEffect(() => {
    if (!familyId) {
      setPosts([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    let active = true;
    setLoading(true);
    setPosts([]);
    void (async () => {
      await Promise.all([loadPage(0), loadBookmarks()]);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [familyId, loadPage, loadBookmarks]);

  // Live updates for new posts.
  useEffect(() => {
    if (!familyId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(channels.feed(familyId))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `family_id=eq.${familyId}`,
        },
        () => void loadPage(0),
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "posts",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id;
          if (removedId) {
            setPosts((current) => current.filter((p) => p.id !== removedId));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId, loadPage]);

  // Infinite scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !familyId) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loading || loadingMore || !hasMore) return;
        setLoadingMore(true);
        void loadPage(posts.length).finally(() => setLoadingMore(false));
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [familyId, loading, loadingMore, hasMore, posts.length, loadPage]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPage(0), loadBookmarks()]);
    setRefreshing(false);
  }, [loadPage, loadBookmarks]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((current) => current.filter((post) => post.id !== postId));
  }, []);

  const setBookmark = useCallback((postId: string, value: boolean) => {
    setBookmarks((current) => {
      const next = new Set(current);
      if (value) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }, []);

  if (!familyId) {
    return <NoFamilyState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">
          {activeFamily?.name ?? "Family"}{" "}
          <span className="text-muted-foreground">feed</span>
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground"
          onClick={() => void refresh()}
          aria-label="Refresh feed"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
        </Button>
      </div>

      <QuickFeaturesBar />

      {loading ? (
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button className="mt-3 rounded-full" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <span aria-hidden className="text-3xl">
            🌱
          </span>
          <h2 className="mt-2 font-display text-lg font-semibold">
            Nothing here yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share the first update, photo, or memory with your family.
          </p>
          <Button asChild className="mt-4 h-11 rounded-full">
            <Link href="/create">
              <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden />
              Create a post
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              canModerate={canModerate}
              bookmarked={bookmarks.has(post.id)}
              onBookmarkChange={setBookmark}
              onDeleted={removePost}
              onPatched={patchPost}
            />
          ))}

          <div ref={sentinelRef} aria-hidden className="h-1" />

          {loadingMore ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </div>
          ) : null}

          {!hasMore && posts.length > 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function NoFamilyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
      <span aria-hidden className="text-3xl">
        👨‍👩‍👧‍👦
      </span>
      <h2 className="mt-2 font-display text-lg font-semibold">
        You&apos;re not in a family yet
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a new family space, or join one with the invitation code a family
        member sent you.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild className="h-11 rounded-full">
          <Link href="/create-family">
            <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden />
            Create a family
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full">
          <Link href="/join">
            <Users className="mr-1.5 h-4 w-4" aria-hidden />
            Join with a code
          </Link>
        </Button>
      </div>
    </div>
  );
}
