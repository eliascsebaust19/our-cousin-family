"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createTreeMemberSchema, createTreeRelationshipSchema } from "@/lib/validation";
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
import type { FamilyTreeMember, TreeGender, TreeRelType } from "@/lib/types";

export function AddRelativeDialog({
  open,
  familyId,
  currentPerson,
  allMembers,
  onOpenChange,
  onSaved,
  initialRelationType = "parent",
  initialGender = null,
  initialRoleLabel = "",
}: {
  open: boolean;
  familyId: string;
  currentPerson: FamilyTreeMember | null;
  allMembers: FamilyTreeMember[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialRelationType?: TreeRelType;
  initialGender?: TreeGender | null;
  initialRoleLabel?: string;
}) {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [targetPersonId, setTargetPersonId] = useState("");
  const [relationType, setRelationType] = useState<TreeRelType>(initialRelationType);
  const [pending, setPending] = useState(false);

  // New person form state
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<TreeGender>(initialGender ?? "male");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [newIsDeceased, setNewIsDeceased] = useState(false);
  const [newDeathDate, setNewDeathDate] = useState("");

  useEffect(() => {
    if (open) {
      setRelationType(initialRelationType);
      if (initialGender) setNewGender(initialGender);
      setTargetPersonId("");
      setNewName("");
      setNewBirthDate("");
      setNewIsDeceased(false);
      setNewDeathDate("");
      // If there are no eligible existing members, default to "new"
      const eligible = allMembers.filter((m) => m.id !== currentPerson?.id);
      if (eligible.length === 0) {
        setTab("new");
      }
    }
  }, [open, initialRelationType, initialGender, allMembers, currentPerson]);

  if (!currentPerson) return null;

  const eligiblePersons = allMembers.filter((m) => m.id !== currentPerson.id);

  async function handleConnectExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!targetPersonId) {
      toast.error("Please select a relative");
      return;
    }

    const parsed = createTreeRelationshipSchema.safeParse({
      person_id: currentPerson!.id,
      related_person_id: targetPersonId,
      relationship_type: relationType,
      status: "approved",
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid relationship");
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

    // If parent relationship, check cycle
    if (relationType === "parent") {
      const { data: noCycle, error: cycleErr } = await supabase.rpc(
        "check_tree_no_cycle",
        {
          p_parent_id: targetPersonId,
          p_child_id: currentPerson!.id,
        },
      );
      if (!cycleErr && noCycle === false) {
        setPending(false);
        toast.error("Cannot add circular parent-child relationship!");
        return;
      }
    }

    // Insert relationship
    const { error } = await supabase.from("family_tree_relationships").insert({
      family_id: familyId,
      person_id: currentPerson!.id,
      related_person_id: targetPersonId,
      relationship_type: relationType,
      status: "approved",
      created_by: user.id,
    });

    setPending(false);
    if (error) {
      if (error.message.includes("unique")) {
        toast.error("This relationship is already recorded");
      } else {
        toast.error("Could not add relationship: " + error.message);
      }
      return;
    }

    toast.success("Relationship connected successfully");
    onOpenChange(false);
    onSaved();
  }

  async function handleCreateAndConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Please enter a name");
      return;
    }

    let calculatedGen = currentPerson!.generation ?? 0;
    if (relationType === "parent") calculatedGen -= 1;
    else if (relationType === "child") calculatedGen += 1;

    const parsedMember = createTreeMemberSchema.safeParse({
      full_name: newName.trim(),
      gender: newGender,
      birth_date: newBirthDate || null,
      death_date: newIsDeceased ? newDeathDate || null : null,
      is_deceased: newIsDeceased,
      generation: calculatedGen,
      bio: null,
      avatar_url: null,
    });

    if (!parsedMember.success) {
      toast.error(parsedMember.error.issues[0]?.message ?? "Invalid member data");
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

    // 1. Insert new member
    const { data: newMember, error: memberErr } = await supabase
      .from("family_tree_members")
      .insert({
        family_id: familyId,
        created_by: user.id,
        full_name: parsedMember.data.full_name,
        gender: parsedMember.data.gender,
        birth_date: parsedMember.data.birth_date,
        death_date: parsedMember.data.death_date,
        is_deceased: parsedMember.data.is_deceased,
        generation: parsedMember.data.generation,
      })
      .select("id")
      .single();

    if (memberErr || !newMember) {
      setPending(false);
      toast.error("Failed to create relative: " + (memberErr?.message ?? "Unknown error"));
      return;
    }

    // 2. Insert relationship
    const { error: relErr } = await supabase.from("family_tree_relationships").insert({
      family_id: familyId,
      person_id: currentPerson!.id,
      related_person_id: newMember.id,
      relationship_type: relationType,
      status: "approved",
      created_by: user.id,
    });

    setPending(false);
    if (relErr) {
      toast.error("Relative created, but linking failed: " + relErr.message);
      onOpenChange(false);
      onSaved();
      return;
    }

    toast.success(`${parsedMember.data.full_name} added & linked!`);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Connect Relative to {currentPerson.full_name}</span>
          </DialogTitle>
          <DialogDescription>
            {initialRoleLabel
              ? `Adding: ${initialRoleLabel}`
              : `Specify how ${currentPerson.full_name} is related to another family member.`}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher: Connect existing vs Create new */}
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("existing")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition ${
              tab === "existing"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" /> Select Existing ({eligiblePersons.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition ${
              tab === "new"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" /> Create New Relative
          </button>
        </div>

        {tab === "existing" ? (
          <form onSubmit={handleConnectExisting} className="space-y-4 pt-1">
            <div>
              <Label htmlFor="rel-type" className="text-xs">Relationship Type</Label>
              <select
                id="rel-type"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value as TreeRelType)}
              >
                <option value="parent">Parent of {currentPerson.full_name} (Father / Mother)</option>
                <option value="child">Child of {currentPerson.full_name} (Son / Daughter)</option>
                <option value="spouse">Spouse of {currentPerson.full_name} (Husband / Wife)</option>
                <option value="sibling">Sibling of {currentPerson.full_name} (Brother / Sister)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="target-person" className="text-xs">Select Relative</Label>
              <select
                id="target-person"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={targetPersonId}
                onChange={(e) => setTargetPersonId(e.target.value)}
                required
              >
                <option value="">-- Choose a family member --</option>
                {eligiblePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} {p.gender ? `(${p.gender})` : ""} {p.is_deceased ? "• Late" : ""}
                  </option>
                ))}
              </select>
              {eligiblePersons.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  No other members exist yet. Switch to "Create New Relative" above!
                </p>
              )}
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
              <Button type="submit" disabled={pending || !targetPersonId}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleCreateAndConnect} className="space-y-3.5 pt-1">
            <div>
              <Label htmlFor="new-name" className="text-xs">Full Name *</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Mohammad Ali"
                required
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="new-rel-type" className="text-xs">Relationship to {currentPerson.full_name}</Label>
              <select
                id="new-rel-type"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs sm:text-sm"
                value={relationType}
                onChange={(e) => {
                  const val = e.target.value as TreeRelType;
                  setRelationType(val);
                  if (val === "parent" && initialGender) {
                    setNewGender(initialGender);
                  }
                }}
              >
                <option value="parent">Parent (Father / Mother)</option>
                <option value="child">Child (Son / Daughter)</option>
                <option value="spouse">Spouse (Husband / Wife)</option>
                <option value="sibling">Sibling (Brother / Sister)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-gender" className="text-xs">Gender</Label>
                <select
                  id="new-gender"
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs sm:text-sm"
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as TreeGender)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="new-dob" className="text-xs">Birth Date (Optional)</Label>
                <Input
                  id="new-dob"
                  type="date"
                  value={newBirthDate}
                  onChange={(e) => setNewBirthDate(e.target.value)}
                  className="mt-1 h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsDeceased}
                  onChange={(e) => setNewIsDeceased(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                Mark as Deceased (Late)
              </label>

              {newIsDeceased && (
                <div>
                  <Label htmlFor="new-dod" className="text-[11px] text-muted-foreground">
                    Death Date (Optional)
                  </Label>
                  <Input
                    id="new-dod"
                    type="date"
                    value={newDeathDate}
                    onChange={(e) => setNewDeathDate(e.target.value)}
                    className="mt-0.5 h-8 text-xs"
                  />
                </div>
              )}
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
              <Button type="submit" disabled={pending || !newName.trim()}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-1.5 h-4 w-4" /> Add & Connect
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
