"use client";

import { useMemo, useState } from "react";
import {
  Bookmark,
  MessageCircle,
  MoreHorizontal,
  Pin,
  PinOff,
  Send,
  Share2,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MOMENT_TYPES, REACTIONS, type ReactionType } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { UserAvatar } from "@/components/app/user-avatar";
import { PostMediaGrid } from "@/components/feed/post-media";
import { PostComments } from "@/components/feed/post-comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FeedPost } from "@/lib/types";

type Props = {
  post: FeedPost;
  currentUserId: string;
  canModerate: boolean;
  bookmarked: boolean;
  onBookmarkChange: (postId: string, bookmarked: boolean) => void;
  onDeleted: (postId: string) => void;
  onPatched: (postId: string, patch: Partial<FeedPost>) => void;
};

export function PostCard({
  post,
  currentUserId,
  canModerate,
  bookmarked,
  onBookmarkChange,
  onDeleted,
  onPatched,
}: Props) {
  const isAuthor = post.author_id === currentUserId;
  const initialReaction =
    post.post_reactions.find((r) => r.user_id === currentUserId)?.reaction ?? null;

  const [myReaction, setMyReaction] = useState<string | null>(initialReaction);
  const [reactions, setReactions] = useState(post.post_reactions);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(
    Number(post.comments?.[0]?.count ?? 0),
  );
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.content ?? "");
  const [pinned, setPinned] = useState(post.is_pinned);
  const [busy, setBusy] = useState(false);

  const moment = MOMENT_TYPES[post.moment_type as keyof typeof MOMENT_TYPES];
  const authorName =
    post.author?.nickname || post.author?.full_name || "Family member";

  const sharedPost = Array.isArray(post.shared_post)
    ? post.shared_post[0] ?? null
    : post.shared_post ?? null;
  const hasSharedPost = Boolean(sharedPost && typeof sharedPost === "object" && sharedPost.id);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reactions) {
      counts.set(r.reaction, (counts.get(r.reaction) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { top, total: reactions.length };
  }, [reactions]);

  async function applyReaction(next: ReactionType | null) {
    const supabase = createClient();
    const previous = myReaction;
    const optimistic = reactions.filter((r) => r.user_id !== currentUserId);
    if (next) optimistic.push({ user_id: currentUserId, reaction: next });
    setReactions(optimistic);
    setMyReaction(next);

    let error = null;
    if (next === null) {
      ({ error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId));
    } else if (previous === null) {
      ({ error } = await supabase
        .from("post_reactions")
        .insert({ post_id: post.id, user_id: currentUserId, reaction: next }));
    } else {
      ({ error } = await supabase
        .from("post_reactions")
        .update({ reaction: next })
        .eq("post_id", post.id)
        .eq("user_id", currentUserId));
    }

    if (error) {
      setReactions(reactions);
      setMyReaction(previous);
      toast.error("Could not update your reaction");
    }
  }

  async function toggleBookmark() {
    const supabase = createClient();
    const next = !bookmarked;
    onBookmarkChange(post.id, next);
    const { error } = next
      ? await supabase
          .from("post_bookmarks")
          .insert({ post_id: post.id, user_id: currentUserId })
      : await supabase
          .from("post_bookmarks")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);

    if (error) {
      onBookmarkChange(post.id, !next);
      toast.error("Could not update your saved memories");
    } else if (next) {
      toast.success("Saved to your memories");
    }
  }

  async function share() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("posts").insert({
      family_id: post.family_id,
      author_id: currentUserId,
      shared_post_id: post.id,
      content: null,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not share this post");
      return;
    }
    toast.success("Shared with your family");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/home?post=${post.id}`,
      );
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function saveEdit() {
    const content = editDraft.trim();
    if (content.length === 0) {
      toast.error("Post cannot be empty");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("posts")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", post.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    onPatched(post.id, { content, edited_at: new Date().toISOString() });
    setEditing(false);
  }

  async function remove() {
    const supabase = createClient();
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDeleted(post.id);
    toast.success("Post deleted");
  }

  async function togglePin() {
    const supabase = createClient();
    const next = !pinned;
    setPinned(next);
    const { error } = await supabase
      .from("posts")
      .update({ is_pinned: next })
      .eq("id", post.id);
    if (error) {
      setPinned(!next);
      toast.error("Could not update pin");
      return;
    }
    onPatched(post.id, { is_pinned: next });
  }

  return (
    <article className="animate-fade-in-up rounded-2xl border border-border bg-card p-4 shadow-sm">
      <header className="flex items-start gap-3">
        <UserAvatar
          path={post.author?.avatar_url ?? null}
          name={authorName}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-sm font-semibold">{authorName}</span>
            {post.author?.relationship ? (
              <span className="text-[11px] text-muted-foreground">
                · {post.author.relationship}
              </span>
            ) : null}
            {moment && post.moment_type !== "regular" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-amber/20 px-2 py-0.5 text-[11px] font-medium">
                <span aria-hidden>{moment.emoji}</span>
                {moment.label}
              </span>
            ) : null}
            {post.visibility === "admins" ? (
              <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[11px] font-medium text-brand-navy dark:text-brand-navy">
                Admins only
              </span>
            ) : null}
            {pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Pin className="h-3 w-3" aria-hidden /> Pinned
              </span>
            ) : null}
          </div>
          <time
            dateTime={post.created_at}
            className="text-[11px] text-muted-foreground"
          >
            {timeAgo(post.created_at)}
            {post.edited_at ? " · edited" : ""}
          </time>
        </div>

        {isAuthor || canModerate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground"
                aria-label="Post options"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor ? (
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  Edit post
                </DropdownMenuItem>
              ) : null}
              {canModerate ? (
                <DropdownMenuItem onClick={togglePin}>
                  {pinned ? (
                    <>
                      <PinOff className="h-4 w-4" aria-hidden /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4" aria-hidden /> Pin to top
                    </>
                  )}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={copyLink}>
                <Share2 className="h-4 w-4" aria-hidden /> Copy link
              </DropdownMenuItem>
              {isAuthor || canModerate ? (
                <DropdownMenuItem
                  onClick={remove}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={4}
            maxLength={5000}
            className="resize-none rounded-2xl"
            aria-label="Edit post"
          />
          <div className="flex gap-2">
            <Button size="sm" className="rounded-full" onClick={saveEdit}>
              Save changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setEditing(false);
                setEditDraft(post.content ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : post.content ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {post.content}
        </p>
      ) : null}

      {hasSharedPost && sharedPost ? (
        <div className="mt-3 rounded-2xl border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <UserAvatar
              path={sharedPost.author?.avatar_url ?? null}
              name={sharedPost.author?.full_name ?? "Member"}
              size={28}
            />
            <span className="text-xs font-semibold">
              {sharedPost.author?.full_name ?? "Family member"}
            </span>
            <time
              className="text-[11px] text-muted-foreground"
              dateTime={sharedPost.created_at}
            >
              {timeAgo(sharedPost.created_at)}
            </time>
          </div>
          {sharedPost.content ? (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {sharedPost.content}
            </p>
          ) : null}
        </div>
      ) : null}

      <PostMediaGrid items={post.post_media} />

      {summary.total > 0 ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden>{summary.top.map(([r]) => REACTIONS[r as ReactionType]).join(" ")}</span>
          <span>{summary.total}</span>
        </div>
      ) : null}

      <footer className="mt-2 flex items-center justify-between border-t border-border pt-1">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className={`h-11 rounded-full ${myReaction ? "text-primary" : "text-muted-foreground"}`}
            onClick={() =>
              applyReaction(myReaction === "like" ? null : ("like" as ReactionType))
            }
            aria-pressed={myReaction !== null}
          >
            <span aria-hidden className="mr-1.5 text-base">
              {myReaction ? REACTIONS[myReaction as ReactionType] : "👍"}
            </span>
            {myReaction ? "Reacted" : "Like"}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-9 rounded-full text-muted-foreground"
                aria-label="Choose a reaction"
              >
                <SmilePlus className="h-4 w-4" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <div className="flex gap-1">
                {(Object.keys(REACTIONS) as ReactionType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyReaction(key)}
                    aria-label={key}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:bg-accent"
                  >
                    {REACTIONS[key]}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            className="h-11 rounded-full text-muted-foreground"
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
            {commentCount > 0 ? commentCount : "Comment"}
          </Button>
        </div>

        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full text-muted-foreground"
            onClick={share}
            disabled={busy}
            aria-label="Share with family"
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-11 w-11 rounded-full ${bookmarked ? "text-primary" : "text-muted-foreground"}`}
            onClick={toggleBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove from saved" : "Save memory"}
          >
            <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} aria-hidden />
          </Button>
        </div>
      </footer>

      {showComments ? (
        <PostComments
          postId={post.id}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onCountChange={setCommentCount}
        />
      ) : null}
    </article>
  );
}
