"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Dices,
  DoorOpen,
  Info,
  Loader2,
  ScrollText,
  Settings2,
  Ticket,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODERATOR_ROLES = new Set(["owner", "admin", "moderator"]);
const ADMIN_ROLES = new Set(["owner", "admin"]);

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function FamilyOverview() {
  const router = useRouter();
  const { activeFamily, roleInActiveFamily, userId, families } = useFamily();
  const [counts, setCounts] = useState<{ active: number; pending: number } | null>(
    null,
  );
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isModerator = MODERATOR_ROLES.has(roleInActiveFamily ?? "");
  const isAdmin = ADMIN_ROLES.has(roleInActiveFamily ?? "");

  const loadCounts = useCallback(async (familyId: string) => {
    const supabase = createClient();
    const [activeRes, pendingRes] = await Promise.all([
      supabase
        .from("family_members")
        .select("user_id", { count: "exact", head: true })
        .eq("family_id", familyId)
        .eq("status", "active"),
      supabase
        .from("family_members")
        .select("user_id", { count: "exact", head: true })
        .eq("family_id", familyId)
        .eq("status", "pending"),
    ]);
    setCounts({
      active: activeRes.count ?? 0,
      pending: pendingRes.count ?? 0,
    });
  }, []);

  useEffect(() => {
    if (!activeFamily) return;
    setCounts(null);
    void loadCounts(activeFamily.id);
  }, [activeFamily, loadCounts]);

  async function leave() {
    if (!activeFamily) return;
    setLeaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("remove_member", {
      p_family_id: activeFamily.id,
      p_user_id: userId,
    });
    setLeaving(false);
    if (error) {
      toast.error(
        error.message.includes("last_owner")
          ? "You're the last owner — promote another relative first."
          : error.message,
      );
      return;
    }
    setConfirmLeave(false);
    toast.success(`You left ${activeFamily.name}`);
    router.push("/home");
    router.refresh();
  }

  if (!activeFamily) {
    if (families.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <span aria-hidden className="text-3xl">
            👨‍👩‍👧‍👦
          </span>
          <h2 className="mt-2 font-display text-lg font-semibold">
            No family yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a family or join one with an invitation code.
          </p>
          <div className="mt-4 grid gap-2">
            <Button asChild className="h-11 rounded-full">
              <Link href="/create-family">Create a family</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href="/join">Join with a code</Link>
            </Button>
          </div>
        </div>
      );
    }
    return null;
  }

  const links: {
    href: string;
    label: string;
    icon: typeof Users;
    hint: string;
    show: boolean;
  }[] = [
    {
      href: "/family/members",
      label: "Members",
      icon: Users,
      hint:
        counts === null
          ? "Loading…"
          : `${counts.active} active${
              counts.pending > 0 ? ` · ${counts.pending} waiting` : ""
            }`,
      show: true,
    },
    {
      href: "/family/invitations",
      label: "Invitations",
      icon: Ticket,
      hint: "Invite relatives",
      show: isAdmin,
    },
    {
      href: "/family/settings",
      label: "Family settings",
      icon: Settings2,
      hint: "Name, rules & privacy",
      show: isAdmin,
    },
    {
      href: "/calendar",
      label: "Calendar",
      icon: CalendarDays,
      hint: "Birthdays & events",
      show: true,
    },
    {
      href: "/vault",
      label: "Memory Vault",
      icon: ScrollText,
      hint: "Photos & videos on Drive",
      show: true,
    },
    {
      href: "/ludo",
      label: "Family Ludo",
      icon: Dices,
      hint: "Play together",
      show: true,
    },
    {
      href: "/calls",
      label: "Calls",
      icon: Video,
      hint: "Audio & video",
      show: true,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-24 bg-gradient-to-r from-primary/25 via-brand-amber/25 to-brand-warm/20" />
        <div className="-mt-10 px-4 pb-4">
          <span
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-card bg-primary text-2xl font-bold text-primary-foreground"
          >
            {initials(activeFamily.name)}
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-semibold">
              {activeFamily.name}
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {ROLE_LABELS[roleInActiveFamily ?? "member"] ?? "Member"}
            </span>
          </div>
          {activeFamily.description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {activeFamily.description}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {counts === null
              ? "Loading members…"
              : `${counts.active} member${counts.active === 1 ? "" : "s"}`}
            {activeFamily.require_approval ? " · new members need approval" : ""}
          </p>
        </div>
      </section>

      {counts && counts.pending > 0 && isModerator ? (
        <Link
          href="/family/members?filter=pending"
          className="flex items-center gap-3 rounded-2xl border border-brand-amber/40 bg-brand-amber/10 p-3.5 transition hover:bg-brand-amber/15"
        >
          <Info className="h-4 w-4 shrink-0 text-brand-warm" aria-hidden />
          <span className="min-w-0 flex-1 text-sm">
            <strong className="font-semibold">{counts.pending}</strong>{" "}
            {counts.pending === 1 ? "person is" : "people are"} waiting for
            approval
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary">
            Review
          </span>
        </Link>
      ) : null}

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Family tools
        </h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {links
            .filter((link) => link.show)
            .map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex h-full min-h-[92px] flex-col justify-between rounded-2xl border border-border bg-card p-3.5 transition active:scale-[0.99] hover:border-primary/30"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <link.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {link.label}
                    </span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {link.hint}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {activeFamily.rules ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-1.5 font-display text-base font-semibold">
            <ScrollText className="h-4 w-4 text-primary" aria-hidden />
            Family rules
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {activeFamily.rules}
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold">Membership</h2>
        <Button
          variant="outline"
          className="mt-3 h-11 w-full rounded-full text-destructive hover:text-destructive"
          onClick={() => setConfirmLeave(true)}
        >
          <DoorOpen className="mr-1.5 h-4 w-4" aria-hidden />
          Leave {activeFamily.name}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          The last owner can&apos;t leave until another relative is promoted to
          owner.
        </p>
      </section>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Leave {activeFamily.name}?
            </DialogTitle>
            <DialogDescription>
              You&apos;ll lose access to this family&apos;s posts, photos, and
              chats. You can rejoin later with a new invitation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-full"
              onClick={() => setConfirmLeave(false)}
              disabled={leaving}
            >
              Stay
            </Button>
            <Button
              variant="destructive"
              className="h-11 rounded-full"
              onClick={() => void leave()}
              disabled={leaving}
            >
              {leaving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  Leaving…
                </>
              ) : (
                "Leave family"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {counts === null ? (
        <Skeleton className="h-2 w-full rounded-full" />
      ) : null}
    </div>
  );
}
