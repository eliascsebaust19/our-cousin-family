"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  Share2,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { createInviteSchema } from "@/lib/validation";
import { ROLE_LABELS } from "@/lib/constants";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ADMIN_ROLES = new Set(["owner", "admin"]);

type Invitation = {
  id: string;
  code: string;
  role: string;
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
};

const EXPIRY_OPTIONS = [
  { value: "0", label: "Never expires" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

export function InvitationsPanel() {
  const { activeFamily, roleInActiveFamily } = useFamily();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [role, setRole] = useState("member");
  const [expiryDays, setExpiryDays] = useState("7");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = ADMIN_ROLES.has(roleInActiveFamily ?? "");

  const load = useCallback(async () => {
    if (!activeFamily) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("family_invitations")
      .select(
        "id, code, role, expires_at, revoked_at, max_uses, used_count, created_at",
      )
      .eq("family_id", activeFamily.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Could not load invitations");
      setInvitations([]);
      return;
    }
    setInvitations((data ?? []) as Invitation[]);
  }, [activeFamily]);

  useEffect(() => {
    setInvitations(null);
    void load();
  }, [load]);

  async function create() {
    if (!activeFamily) return;
    const days = Number(expiryDays);
    const parsed = createInviteSchema.safeParse({
      role,
      expires_at: days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : "",
      max_uses: maxUses === "" ? null : Number(maxUses),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the invitation options");
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_invitation", {
      p_family_id: activeFamily.id,
      p_role: parsed.data.role,
      p_expires_at: parsed.data.expires_at ? parsed.data.expires_at : null,
      p_max_uses:
        parsed.data.max_uses === "" || parsed.data.max_uses === undefined
          ? null
          : Number(parsed.data.max_uses),
    });
    setCreating(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation created");
    setMaxUses("");
    void load();
  }

  async function revoke(id: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("revoke_invitation", {
      p_invitation_id: id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation revoked");
    void load();
  }

  async function copy(code: string, id: string) {
    const link = `${window.location.origin}/join/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      toast.success("Invite link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Could not copy — long-press to copy manually");
    }
  }

  async function share(code: string) {
    const link = `${window.location.origin}/join/${code}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Join ${activeFamily?.name ?? "our family"}`,
          text: "You're invited to our family space 💛",
          url: link,
        });
        return;
      } catch {
        /* cancelled */
      }
    }
    toast.message(link);
  }

  if (!activeFamily || !isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Only family owners and admins can manage invitations.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a code for a relative, then share the link or the code itself.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Plus className="h-4 w-4 text-primary" aria-hidden />
          New invitation
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-xs">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-expiry" className="text-xs">
              Expires
            </Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger id="invite-expiry" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-uses" className="text-xs">
              Max uses (optional)
            </Label>
            <Input
              id="invite-uses"
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              placeholder="Unlimited"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <Button
          className="h-11 w-full rounded-full"
          onClick={() => void create()}
          disabled={creating}
        >
          {creating ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            <>
              <Ticket className="mr-1.5 h-4 w-4" aria-hidden />
              Generate invitation code
            </>
          )}
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Existing invitations
        </h2>

        {invitations === null ? (
          <>
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </>
        ) : invitations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No invitations yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((invitation) => {
              const revoked = invitation.revoked_at !== null;
              const expired =
                invitation.expires_at !== null &&
                parseISO(invitation.expires_at).getTime() < Date.now();
              const exhausted =
                invitation.max_uses !== null &&
                invitation.used_count >= invitation.max_uses;
              const dead = revoked || expired || exhausted;

              return (
                <li
                  key={invitation.id}
                  className={`rounded-2xl border p-3.5 ${
                    dead
                      ? "border-border bg-muted/40"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-bold tracking-[0.18em]">
                        {invitation.code}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ROLE_LABELS[invitation.role] ?? invitation.role} ·{" "}
                        {invitation.used_count}
                        {invitation.max_uses ? `/${invitation.max_uses}` : ""}{" "}
                        used
                        {invitation.expires_at
                          ? ` · ${
                              expired ? "expired" : "until"
                            } ${format(parseISO(invitation.expires_at), "MMM d, yyyy")}`
                          : " · never expires"}
                      </p>
                      {dead ? (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          <Link2 className="h-3 w-3" aria-hidden />
                          {revoked ? "Revoked" : expired ? "Expired" : "Used up"}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-full"
                      onClick={() => void copy(invitation.code, invitation.id)}
                      disabled={dead}
                    >
                      {copiedId === invitation.id ? (
                        <>
                          <Check className="mr-1.5 h-4 w-4" aria-hidden />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                          Copy link
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10 rounded-full"
                      onClick={() => void share(invitation.code)}
                      disabled={dead}
                    >
                      <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
                      Share
                    </Button>
                    {!revoked ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 rounded-full text-destructive hover:text-destructive"
                        onClick={() => void revoke(invitation.id)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
