"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createFamilySchema } from "@/lib/validation";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type CreateResult = { familyId: string; inviteCode: string };

export function CreateFamilyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [requireApproval, setRequireApproval] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = createFamilySchema.safeParse({
      name,
      description,
      rules,
      privacy: "invite_only",
      require_approval: requireApproval,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_family", {
      p_name: parsed.data.name,
      p_description: parsed.data.description ?? null,
      p_rules: parsed.data.rules ?? null,
      p_privacy: parsed.data.privacy,
      p_require_approval: parsed.data.require_approval,
    });
    setPending(false);

    if (error) {
      toast.error(
        error.message.includes("invalid_family_name")
          ? "That family name can't be used"
          : error.message,
      );
      return;
    }

    const payload = data as { family_id: string; invite_code: string } | null;
    if (!payload?.family_id) {
      toast.error("Could not create the family — please try again");
      return;
    }

    setResult({ familyId: payload.family_id, inviteCode: payload.invite_code });
    router.refresh();
  }

  async function copyInvite() {
    if (!result) return;
    const link = `${window.location.origin}/join/${result.inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — long-press to copy manually");
    }
  }

  async function shareInvite() {
    if (!result) return;
    const link = `${window.location.origin}/join/${result.inviteCode}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Join ${name} on Our Cousin Family`,
          text: "You're invited to our family space 💛",
          url: link,
        });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await copyInvite();
  }

  if (result) {
    return (
      <div className="space-y-5 text-center">
        <span aria-hidden className="text-3xl">
          🎉
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold">
            {name} is ready
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share this code with your relatives. You can always find it again
            under Family → Invitations.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Invitation code
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-primary">
            {result.inviteCode}
          </p>
        </div>

        <div className="grid gap-2">
          <Button className="h-12 rounded-full" onClick={() => void shareInvite()}>
            <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
            Share invite link
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-full"
            onClick={() => void copyInvite()}
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-4 w-4" aria-hidden />
                Link copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                Copy invite link
              </>
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          className="h-11 rounded-full"
          onClick={() => {
            router.push("/home");
            router.refresh();
          }}
        >
          <Users className="mr-1.5 h-4 w-4" aria-hidden />
          Go to my family
        </Button>

        <p className="text-xs text-muted-foreground">
          Tip: you can invite more relatives any time from{" "}
          <Link href="/family/invitations" className="font-medium text-primary">
            Family → Invitations
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="name" label="Family name" error={errors.name}>
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Rahman Family"
          maxLength={60}
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field
        id="description"
        label="Short description"
        hint={<span className="text-xs text-muted-foreground">Optional</span>}
        error={errors.description}
      >
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Who is this space for?"
          rows={3}
          maxLength={1000}
          className="resize-none rounded-2xl"
        />
      </Field>

      <Field
        id="rules"
        label="Family rules"
        hint={<span className="text-xs text-muted-foreground">Optional</span>}
        error={errors.rules}
      >
        <Textarea
          id="rules"
          value={rules}
          onChange={(event) => setRules(event.target.value)}
          placeholder="A few gentle guidelines for the family…"
          rows={4}
          maxLength={4000}
          className="resize-none rounded-2xl"
        />
      </Field>

      <div className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3">
        <div>
          <Label htmlFor="require-approval" className="text-sm font-medium">
            Approve new members
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recommended — admins confirm each relative before they can see
            family posts.
          </p>
        </div>
        <Switch
          id="require-approval"
          checked={requireApproval}
          onCheckedChange={setRequireApproval}
        />
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            Creating…
          </>
        ) : (
          "Create family"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Received an invite instead?{" "}
        <Link href="/join" className="font-medium text-primary">
          Join with a code
        </Link>
      </p>
    </form>
  );
}
