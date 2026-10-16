"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_FIELDS } from "@/lib/queries";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProfileLite } from "@/lib/types";

type MemberLite = { user_id: string; profile: ProfileLite | null };

export function NewChatDialog({
  onCreated,
  children,
}: {
  onCreated?: (conversationId: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const { activeFamily, userId } = useFamily();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [members, setMembers] = useState<MemberLite[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!activeFamily) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("family_members")
      .select(
        `user_id, profile:profiles!family_members_user_id_fkey(${PROFILE_FIELDS})`,
      )
      .eq("family_id", activeFamily.id)
      .eq("status", "active");

    if (error) {
      toast.error("Could not load family members");
      return;
    }
    setMembers(
      ((data ?? []) as unknown as MemberLite[]).filter(
        (row) => row.user_id !== userId,
      ),
    );
  }, [activeFamily, userId]);

  useEffect(() => {
    if (open) {
      setMembers(null);
      setSelected(new Set());
      setTitle("");
      void load();
    }
  }, [open, load]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (mode === "direct") return new Set([id]);
        next.add(id);
      }
      return next;
    });
  }

  async function start() {
    if (!activeFamily || selected.size === 0) return;
    setPending(true);
    const supabase = createClient();
    const ids = [...selected];

    if (mode === "direct") {
      const { data, error } = await supabase.rpc("create_direct_conversation", {
        p_family_id: activeFamily.id,
        p_other_user: ids[0],
      });
      setPending(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const payload = data as { conversation_id?: string } | null;
      if (payload?.conversation_id) {
        onCreated?.(payload.conversation_id);
        setOpen(false);
        router.push(`/chat/${payload.conversation_id}`);
      }
      return;
    }

    if (title.trim().length === 0) {
      toast.error("Give the group a name");
      setPending(false);
      return;
    }

    const { data, error } = await supabase.rpc("create_group_conversation", {
      p_family_id: activeFamily.id,
      p_title: title.trim(),
      p_member_ids: ids,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const payload = data as { conversation_id?: string } | null;
    if (payload?.conversation_id) {
      onCreated?.(payload.conversation_id);
      setOpen(false);
      router.push(`/chat/${payload.conversation_id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-4 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">New chat</DialogTitle>
          <DialogDescription>
            Message a relative, or start a group with a few of them.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
              One person
            </TabsTrigger>
            <TabsTrigger value="group">
              <Users className="mr-1.5 h-4 w-4" aria-hidden />
              Group
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "group" ? (
          <div className="space-y-1.5">
            <Label htmlFor="group-title" className="text-sm">
              Group name
            </Label>
            <Input
              id="group-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Cousins Group"
              maxLength={60}
            />
          </div>
        ) : null}

        <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
          {members === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading members…
            </p>
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No other active members yet. Invite relatives first.
            </p>
          ) : (
            members.map((member) => {
              const checked = selected.has(member.user_id);
              const name = member.profile?.full_name ?? "Family member";
              return (
                <button
                  key={member.user_id}
                  type="button"
                  onClick={() => toggle(member.user_id)}
                  aria-pressed={checked}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-accent"
                  }`}
                >
                  <UserAvatar
                    path={member.profile?.avatar_url ?? null}
                    name={name}
                    size={38}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {name}
                    </span>
                    {member.profile?.relationship ? (
                      <span className="block text-xs text-muted-foreground">
                        {member.profile.relationship}
                      </span>
                    ) : null}
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <Button
          className="h-12 w-full rounded-full"
          onClick={() => void start()}
          disabled={pending || selected.size === 0}
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              Starting…
            </>
          ) : mode === "direct" ? (
            "Start chat"
          ) : (
            `Create group (${selected.size})`
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
