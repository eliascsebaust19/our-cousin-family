"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Shield,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_FIELDS } from "@/lib/queries";
import { PRESENCE_WINDOW_SECONDS, ROLE_LABELS } from "@/lib/constants";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProfileLite } from "@/lib/types";

const MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);
const ADMIN_ROLES = new Set(["owner", "admin"]);
const ASSIGNABLE_ROLES = ["owner", "admin", "moderator", "member"] as const;

type MemberRow = {
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  profile: ProfileLite | null;
};

function isOnline(profile: ProfileLite | null): boolean {
  if (!profile?.show_online_status || !profile.last_seen_at) return false;
  const last = parseISO(profile.last_seen_at).getTime();
  return Date.now() - last < PRESENCE_WINDOW_SECONDS * 1000;
}

export function MembersPanel({ initialFilter = "active" }: { initialFilter?: string }) {
  const router = useRouter();
  const { activeFamily, roleInActiveFamily, userId } = useFamily();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [tab, setTab] = useState(initialFilter === "pending" ? "pending" : "active");

  const isModerator = MODERATOR_ROLES.has(roleInActiveFamily ?? "");
  const isAdmin = ADMIN_ROLES.has(roleInActiveFamily ?? "");

  const load = useCallback(async () => {
    if (!activeFamily) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("family_members")
      .select(
        `user_id, role, status, joined_at, profile:profiles!family_members_user_id_fkey(${PROFILE_FIELDS})`,
      )
      .eq("family_id", activeFamily.id)
      .order("joined_at", { ascending: true });

    if (error) {
      toast.error("Could not load members");
      setMembers([]);
      return;
    }
    setMembers((data ?? []) as unknown as MemberRow[]);
  }, [activeFamily]);

  useEffect(() => {
    setMembers(null);
    void load();
  }, [load]);

  const active = useMemo(
    () => (members ?? []).filter((m) => m.status === "active"),
    [members],
  );
  const pending = useMemo(
    () => (members ?? []).filter((m) => m.status === "pending"),
    [members],
  );

  async function approve(userIdToApprove: string) {
    if (!activeFamily) return;
    setBusyUserId(userIdToApprove);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_member_status", {
      p_family_id: activeFamily.id,
      p_user_id: userIdToApprove,
      p_status: "active",
    });
    setBusyUserId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member approved");
    void load();
  }

  async function remove(userIdToRemove: string, name: string) {
    if (!activeFamily) return;
    setBusyUserId(userIdToRemove);
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_member", {
      p_family_id: activeFamily.id,
      p_user_id: userIdToRemove,
    });
    setBusyUserId(null);
    if (error) {
      toast.error(
        error.message.includes("last_owner")
          ? "You can't remove the last owner."
          : error.message,
      );
      return;
    }
    toast.success(`${name} is no longer in ${activeFamily.name}`);
    void load();
  }

  async function changeRole(userIdToChange: string, role: string) {
    if (!activeFamily) return;
    setBusyUserId(userIdToChange);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_member_role", {
      p_family_id: activeFamily.id,
      p_user_id: userIdToChange,
      p_role: role,
    });
    setBusyUserId(null);
    if (error) {
      toast.error(
        error.message.includes("last_owner")
          ? "You can't change the last owner's role."
          : error.message,
      );
      return;
    }
    toast.success("Role updated");
    void load();
  }

  async function message(userIdToMessage: string) {
    if (!activeFamily) return;
    setBusyUserId(userIdToMessage);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_direct_conversation", {
      p_family_id: activeFamily.id,
      p_other_user: userIdToMessage,
    });
    setBusyUserId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const payload = data as { conversation_id?: string } | null;
    if (payload?.conversation_id) {
      router.push(`/chat/${payload.conversation_id}`);
    }
  }

  if (!activeFamily) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Join or create a family to see its members.
      </p>
    );
  }

  function renderMember(member: MemberRow, pendingMode: boolean) {
    const name = member.profile?.full_name ?? "Family member";
    const isSelf = member.user_id === userId;
    const canRemove =
      !isSelf && member.role !== "owner" && (isAdmin || (isModerator && pendingMode));
    const busy = busyUserId === member.user_id;

    return (
      <li
        key={member.user_id}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
      >
        <UserAvatar
          path={member.profile?.avatar_url ?? null}
          name={name}
          size={44}
          online={!pendingMode && isOnline(member.profile)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {name}
            {isSelf ? " (you)" : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {member.profile?.nickname || member.profile?.relationship
              ? [member.profile?.nickname, member.profile?.relationship]
                  .filter(Boolean)
                  .join(" · ")
              : ROLE_LABELS[member.role] ?? "Member"}
          </p>
          {member.joined_at && !pendingMode ? (
            <p className="text-[11px] text-muted-foreground">
              Joined {format(parseISO(member.joined_at), "MMM d, yyyy")}
            </p>
          ) : null}
        </div>

        {pendingMode ? (
          isModerator ? (
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                className="h-10 rounded-full"
                onClick={() => void approve(member.user_id)}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                <span className="sr-only sm:not-sr-only sm:ml-1.5">Approve</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => void remove(member.user_id, name)}
                disabled={busy}
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only sm:ml-1.5">Decline</span>
              </Button>
            </div>
          ) : null
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            {!isSelf ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-muted-foreground"
                onClick={() => void message(member.user_id)}
                disabled={busy}
                aria-label={`Message ${name}`}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}

            {(canRemove || isAdmin) && !isSelf ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full text-muted-foreground"
                    aria-label={`Options for ${name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAdmin ? (
                    <>
                      <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" aria-hidden />
                        Role
                      </DropdownMenuLabel>
                      {ASSIGNABLE_ROLES.filter((role) =>
                        roleInActiveFamily === "owner"
                          ? true
                          : role !== "owner" && role !== "admin",
                      ).map((role) => (
                        <DropdownMenuItem
                          key={role}
                          disabled={member.role === role || !isAdmin}
                          onClick={() => void changeRole(member.user_id, role)}
                        >
                          {ROLE_LABELS[role] ?? role}
                          {member.role === role ? " ✓" : ""}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  {canRemove ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => void remove(member.user_id, name)}
                    >
                      <UserMinus className="h-4 w-4" aria-hidden />
                      Remove from family
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">Members</h1>
        {isAdmin ? (
          <Button asChild size="sm" className="h-10 rounded-full">
            <Link href="/family/invitations">
              <UserPlus className="mr-1.5 h-4 w-4" aria-hidden />
              Invite
            </Link>
          </Button>
        ) : null}
      </div>

      {members === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Members ({active.length})</TabsTrigger>
            <TabsTrigger value="pending">
              Waiting ({pending.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-3">
            <ul className="space-y-2">
              {active.map((member) => renderMember(member, false))}
            </ul>
          </TabsContent>

          <TabsContent value="pending" className="mt-3">
            {pending.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No one is waiting for approval right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((member) => renderMember(member, true))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
