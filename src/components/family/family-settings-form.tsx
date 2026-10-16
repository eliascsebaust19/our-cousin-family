"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { resolveMediaUrl } from "@/lib/avatar";
import { updateFamilySchema } from "@/lib/validation";
import { uploadFamilyImage } from "@/lib/uploads";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const ADMIN_ROLES = new Set(["owner", "admin"]);

export function FamilySettingsForm() {
  const { activeFamily, roleInActiveFamily, profile } = useFamily();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = ADMIN_ROLES.has(roleInActiveFamily ?? "");

  useEffect(() => {
    if (!activeFamily) return;
    setName(activeFamily.name);
    setDescription(activeFamily.description ?? "");
    setRules(activeFamily.rules ?? "");
    setRequireApproval(activeFamily.require_approval);
    setAvatarPath(activeFamily.avatar_url);
  }, [activeFamily]);

  useEffect(() => {
    let active = true;
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    resolveMediaUrl(createClient(), avatarPath, "post-media").then((url) => {
      if (active) setAvatarUrl(url);
    });
    return () => {
      active = false;
    };
  }, [avatarPath]);

  async function onPickAvatar(file: File | undefined) {
    if (!file || !activeFamily) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const path = await uploadFamilyImage(supabase, activeFamily.id, file);
      const { error } = await supabase
        .from("families")
        .update({ avatar_url: path })
        .eq("id", activeFamily.id);
      if (error) throw new Error(error.message);
      setAvatarPath(path);
      toast.success("Family photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFamily) return;

    const parsed = updateFamilySchema.safeParse({
      name,
      description,
      rules,
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
    const { error } = await supabase
      .from("families")
      .update({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        rules: parsed.data.rules ?? null,
        require_approval: parsed.data.require_approval,
      })
      .eq("id", activeFamily.id);
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Family settings saved");
  }

  if (!activeFamily) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Join or create a family first.
      </p>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Only family owners and admins can change these settings.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            activeFamily.name.slice(0, 2).toUpperCase()
          )}
        </span>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="family-avatar"
            onChange={(event) => void onPickAvatar(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-1.5 h-4 w-4" aria-hidden />
                Change family photo
              </>
            )}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Visible to family members only. Max 5 MB.
          </p>
        </div>
      </div>

      <Field id="family-name" label="Family name" error={errors.name}>
        <Input
          id="family-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field id="family-description" label="Description" error={errors.description}>
        <Textarea
          id="family-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={1000}
          className="resize-none rounded-2xl"
          placeholder="Who is this family space for?"
        />
      </Field>

      <Field id="family-rules" label="Family rules" error={errors.rules}>
        <Textarea
          id="family-rules"
          value={rules}
          onChange={(event) => setRules(event.target.value)}
          rows={5}
          maxLength={4000}
          className="resize-none rounded-2xl"
          placeholder="Gentle guidelines for everyone…"
        />
      </Field>

      <div className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3">
        <div>
          <Label htmlFor="family-approval" className="text-sm font-medium">
            Approve new members
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When on, admins confirm each relative before they can see family
            content.
          </p>
        </div>
        <Switch
          id="family-approval"
          checked={requireApproval}
          onCheckedChange={setRequireApproval}
        />
      </div>

      <Button type="submit" className="h-12 w-full rounded-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            <Save className="mr-1.5 h-4 w-4" aria-hidden />
            Save changes
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Signed in as {profile.full_name}
      </p>

      {!avatarUrl && avatarPath ? (
        <Skeleton className="hidden" />
      ) : null}
    </form>
  );
}
