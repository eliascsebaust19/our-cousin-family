"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createTreeMemberSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FamilyTreeMember, TreeGender } from "@/lib/types";

export function MemberDialog({
  open,
  familyId,
  member,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  familyId: string;
  member: FamilyTreeMember | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<TreeGender>("male");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [isDeceased, setIsDeceased] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (member) {
      setFullName(member.full_name);
      setGender(member.gender ?? "male");
      setBirthDate(member.birth_date ?? "");
      setDeathDate(member.death_date ?? "");
      setIsDeceased(member.is_deceased);
      setGeneration(member.generation ?? 0);
      setBio(member.bio ?? "");
      setAvatarUrl(member.avatar_url ?? "");
    } else {
      setFullName("");
      setGender("male");
      setBirthDate("");
      setDeathDate("");
      setIsDeceased(false);
      setGeneration(0);
      setBio("");
      setAvatarUrl("");
    }
  }, [open, member]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = createTreeMemberSchema.safeParse({
      full_name: fullName,
      gender,
      birth_date: birthDate || null,
      death_date: isDeceased ? (deathDate || null) : null,
      is_deceased: isDeceased,
      generation: Number(generation),
      bio: bio || null,
      avatar_url: avatarUrl || null,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check form fields");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setPending(false);
      toast.error("You must be logged in");
      return;
    }

    if (member) {
      // Update existing
      const { error } = await supabase
        .from("family_tree_members")
        .update({
          full_name: parsed.data.full_name,
          gender: parsed.data.gender,
          birth_date: parsed.data.birth_date,
          death_date: parsed.data.death_date,
          is_deceased: parsed.data.is_deceased,
          generation: parsed.data.generation,
          bio: parsed.data.bio,
          avatar_url: parsed.data.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id)
        .eq("family_id", familyId);

      setPending(false);
      if (error) {
        toast.error("Failed to update family member: " + error.message);
        return;
      }
      toast.success("Family member updated");
    } else {
      // Insert new
      const { error } = await supabase.from("family_tree_members").insert({
        family_id: familyId,
        created_by: user.id,
        full_name: parsed.data.full_name,
        gender: parsed.data.gender,
        birth_date: parsed.data.birth_date,
        death_date: parsed.data.death_date,
        is_deceased: parsed.data.is_deceased,
        generation: parsed.data.generation,
        bio: parsed.data.bio,
        avatar_url: parsed.data.avatar_url,
      });

      setPending(false);
      if (error) {
        toast.error("Failed to add family member: " + error.message);
        return;
      }
      toast.success("Family member added to tree");
    }

    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{member ? "Edit Family Member" : "Add Relative to Tree"}</DialogTitle>
          <DialogDescription>
            Record personal details, ancestors, and living relatives.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tree-name">Full Name *</Label>
            <Input
              id="tree-name"
              placeholder="e.g. Abul Kashem"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tree-gender">Gender</Label>
              <select
                id="tree-gender"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={gender}
                onChange={(e) => setGender(e.target.value as TreeGender)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="tree-gen">Generation</Label>
              <select
                id="tree-gen"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={generation}
                onChange={(e) => setGeneration(Number(e.target.value))}
              >
                <option value="-2">Grandparents (-2)</option>
                <option value="-1">Parents / Uncles (-1)</option>
                <option value="0">Our Generation / Cousins (0)</option>
                <option value="1">Children (+1)</option>
                <option value="2">Grandchildren (+2)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tree-birth">Date of Birth</Label>
              <Input
                id="tree-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="tree-deceased" className="block mb-2">Living Status</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                <input
                  type="checkbox"
                  id="tree-deceased"
                  checked={isDeceased}
                  onChange={(e) => setIsDeceased(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <span>Late (Deceased)</span>
              </label>
            </div>
          </div>

          {isDeceased && (
            <div>
              <Label htmlFor="tree-death">Date of Passing (Optional)</Label>
              <Input
                id="tree-death"
                type="date"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="tree-avatar">Photo URL (Optional)</Label>
            <Input
              id="tree-avatar"
              placeholder="https://... or leave empty"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="tree-bio">Biography / Memories</Label>
            <Textarea
              id="tree-bio"
              placeholder="Memorable stories, occupation, hometown..."
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {member ? "Save Changes" : "Add to Tree"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

