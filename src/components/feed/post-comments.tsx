"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CornerDownRight, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { COMMENT_SELECT, channels } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { commentSchema } from "@/lib/validation";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommentItem } from "@/lib/types";

type Props = {
  postId: string;
  currentUserId: string;
  canModerate: boolean;
  onCountChange?: (count: number) => void;
};

export function PostComments({
  postId,
  currentUserId,
  canModerate,
  onCountChange,
}: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .select(COMMENT_SELECT)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Could not load comments");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as CommentItem[];
    setComments(rows);
    setLoading(false);
    onCountChange?.(rows.length);
  }, [postId, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channels.postComments(postId))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [postId, load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = commentSchema.safeParse({
      content: draft,
      parent_id: replyTo?.id ?? null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Write a comment");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: currentUserId,
      content: parsed.data.content,
      parent_id: parsed.data.parent_id ?? null,
    });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDraft("");
    setReplyTo(null);
    void load();
  }

  async function saveEdit(id: string) {
    const parsed = commentSchema.safeParse({ content: editDraft });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Comment cannot be empty");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("comments")
      .update({ content: parsed.data.content, edited_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    void load();
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="mt-3 border-t border-border pt-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No comments yet — be the first to say something kind.
        </p>
      ) : (
        <ul className="space-y-3">
          {roots.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                currentUserId={currentUserId}
                canModerate={canModerate}
                editingId={editingId}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                onEditStart={(c) => {
                  setEditingId(c.id);
                  setEditDraft(c.content);
                }}
                onEditCancel={() => setEditingId(null)}
                onEditSave={saveEdit}
                onDelete={remove}
                onReply={(c) => {
                  setReplyTo(c);
                  inputRef.current?.focus();
                }}
              />
              {repliesOf(comment.id).length > 0 ? (
                <ul className="ml-9 mt-2 space-y-2 border-l border-border pl-3">
                  {repliesOf(comment.id).map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        currentUserId={currentUserId}
                        canModerate={canModerate}
                        editingId={editingId}
                        editDraft={editDraft}
                        setEditDraft={setEditDraft}
                        onEditStart={(c) => {
                          setEditingId(c.id);
                          setEditDraft(c.content);
                        }}
                        onEditCancel={() => setEditingId(null)}
                        onEditSave={saveEdit}
                        onDelete={remove}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 space-y-2">
        {replyTo ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CornerDownRight className="h-3.5 w-3.5" aria-hidden />
            Replying to{" "}
            <strong className="font-medium text-foreground">
              {replyTo.author?.full_name ?? "member"}
            </strong>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-auto font-medium text-primary hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
            rows={1}
            maxLength={2000}
            className="min-h-11 resize-none rounded-2xl py-2.5"
            aria-label="Comment"
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={pending || draft.trim().length === 0}
            aria-label="Post comment"
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  canModerate,
  editingId,
  editDraft,
  setEditDraft,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDelete,
  onReply,
}: {
  comment: CommentItem;
  currentUserId: string;
  canModerate: boolean;
  editingId: string | null;
  editDraft: string;
  setEditDraft: (value: string) => void;
  onEditStart: (comment: CommentItem) => void;
  onEditCancel: () => void;
  onEditSave: (id: string) => void;
  onDelete: (id: string) => void;
  onReply?: (comment: CommentItem) => void;
}) {
  const isOwn = comment.author_id === currentUserId;
  const isEditing = editingId === comment.id;

  return (
    <div className="flex gap-2.5">
      <UserAvatar
        path={comment.author?.avatar_url ?? null}
        name={comment.author?.full_name ?? "Member"}
        size={32}
      />
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={2}
              maxLength={2000}
              className="resize-none rounded-2xl"
              aria-label="Edit comment"
            />
            <div className="flex gap-2">
              <Button size="sm" className="rounded-full" onClick={() => onEditSave(comment.id)}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={onEditCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-muted/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">
                  {comment.author?.nickname || comment.author?.full_name || "Member"}
                </span>
                <time
                  className="text-[11px] text-muted-foreground"
                  dateTime={comment.created_at}
                >
                  {timeAgo(comment.created_at)}
                </time>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
                {comment.content}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-3 pl-1 text-[11px] text-muted-foreground">
              {onReply ? (
                <button
                  type="button"
                  onClick={() => onReply(comment)}
                  className="font-medium hover:text-primary"
                >
                  Reply
                </button>
              ) : null}
              {isOwn ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEditStart(comment)}
                    className="inline-flex items-center gap-1 font-medium hover:text-primary"
                  >
                    <Pencil className="h-3 w-3" aria-hidden /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(comment.id)}
                    className="inline-flex items-center gap-1 font-medium hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden /> Delete
                  </button>
                </>
              ) : canModerate ? (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className="inline-flex items-center gap-1 font-medium hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" aria-hidden /> Remove
                </button>
              ) : null}
              {comment.edited_at ? <span>Edited</span> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
