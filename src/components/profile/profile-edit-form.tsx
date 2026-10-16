"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { profileUpdateSchema } from "@/lib/validation";
import { uploadAvatar } from "@/lib/uploads";
import { RELATIONSHIPS } from "@/lib/constants";
import { useFamily } from "@/components/app/family-provider";
import { UserAvatar } from "@/components/app/user-avatar";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProfileEditForm() {
  const router = useRouter();
  const { profile, userId } = useFamily();

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [birthday, setBirthday] = useState("");
  const [relationship, setRelationship] = useState<string>("");
  const [showBirthday, setShowBirthday] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFullName(profile.full_name ?? "");
    setNickname(profile.nickname ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setBirthday(profile.birthday ?? "");
    setRelationship(profile.relationship ?? "");
    setShowBirthday(profile.show_birthday);
    setShowOnline(profile.show_online_status);
    setAvatarPath(profile.avatar_url);
  }, [profile]);

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const path = await uploadAvatar(supabase, userId, file);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      setAvatarPath(path);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = profileUpdateSchema.safeParse({
      full_name: fullName,
      nickname,
      username,
      bio,
      birthday: birthday || null,
      relationship: relationship || null,
      show_birthday: showBirthday,
      show_online_status: showOnline,
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
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        nickname: parsed.data.nickname || null,
        username: parsed.data.username || null,
        bio: parsed.data.bio || null,
        birthday: parsed.data.birthday || null,
        relationship: parsed.data.relationship || null,
        show_birthday: parsed.data.show_birthday,
        show_online_status: parsed.data.show_online_status,
      })
      .eq("id", userId);
    setPending(false);

    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        setErrors({ username: "That username is already taken" });
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("Profile saved");
    router.push("/profile");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex items-center gap-4">
        <UserAvatar path={avatarPath} name={fullName} size={72} />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="avatar-input"
            onChange={(event) => void pickAvatar(event.target.files?.[0])}
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
                <Camera className="mr-1.5 h-4 w-4" aria-hidden />
                Change photo
              </>
            )}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">Max 5 MB.</p>
        </div>
      </div>

      <Field id="full-name" label="Full name" error={errors.full_name}>
        <Input
          id="full-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          maxLength={80}
          aria-invalid={!!errors.full_name}
        />
      </Field>

      <Field
        id="nickname"
        label="Nickname"
        hint={<span className="text-xs text-muted-foreground">Optional</span>}
        error={errors.nickname}
      >
        <Input
          id="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="What the family calls you"
          maxLength={40}
        />
      </Field>

      <Field id="username" label="Username" error={errors.username}>
        <Input
          id="username"
          value={username}
          onChange={(event) =>
            setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
          placeholder="lowercase_letters_and_numbers"
          maxLength={24}
          aria-invalid={!!errors.username}
        />
      </Field>

      <Field id="bio" label="About you" error={errors.bio}>
        <Textarea
          id="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          maxLength={500}
          className="resize-none rounded-2xl"
          placeholder="A sentence or two for your family…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="birthday" label="Birthday" error={errors.birthday}>
          <Input
            id="birthday"
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
          />
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor="relationship" className="text-sm">
            Relationship
          </Label>
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger id="relationship" className="h-10 rounded-xl">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RELATIONSHIPS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="show-birthday" className="text-sm font-medium">
              Show my birthday
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Family members will see the date (never the year).
            </p>
          </div>
          <Switch
            id="show-birthday"
            checked={showBirthday}
            onCheckedChange={setShowBirthday}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="show-online" className="text-sm font-medium">
              Show when I&apos;m online
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Only within your family — never public.
            </p>
          </div>
          <Switch
            id="show-online"
            checked={showOnline}
            onCheckedChange={setShowOnline}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-full"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            <Save className="mr-1.5 h-4 w-4" aria-hidden />
            Save profile
          </>
        )}
      </Button>
    </form>
  );
}
