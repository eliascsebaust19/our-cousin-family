"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Crown,
  Eye,
  GitBranch,
  Info,
  Link as LinkIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  User,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberDialog } from "./member-dialog";
import { AddRelativeDialog } from "./add-relative-dialog";
import type {
  FamilyTreeMember,
  FamilyTreeRelationship,
  TreeGender,
  TreeRelType,
} from "@/lib/types";

const GENERATION_LABELS: Record<number, string> = {
  "-2": "Grandparents & Elders",
  "-1": "Parents & Uncles / Aunts",
  "0": "Our Generation / Cousins",
  "1": "Children",
  "2": "Grandchildren",
};

// ============================================================================
// Binary Tree Types & Helpers
// ============================================================================

export type BinaryTreeNode = {
  key: string;
  member: FamilyTreeMember | null;
  role: "root" | "left" | "right";
  label: string;
  depth: number;
  parentMember: FamilyTreeMember | null;
  expectedRelation?: "father" | "mother" | "child" | "parent";
  left?: BinaryTreeNode | null;
  right?: BinaryTreeNode | null;
};

/**
 * Builds a classic Pedigree / Ancestry Binary Tree:
 * Root: Selected person
 * Left Subtree: Father & paternal ancestors
 * Right Subtree: Mother & maternal ancestors
 */
function buildAncestryBinaryTree(
  rootId: string,
  members: FamilyTreeMember[],
  relationships: FamilyTreeRelationship[],
  maxDepth = 3,
): BinaryTreeNode | null {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const rootMember = memberMap.get(rootId);
  if (!rootMember) return null;

  function getParents(id: string): {
    father?: FamilyTreeMember;
    mother?: FamilyTreeMember;
  } {
    const parentList: FamilyTreeMember[] = [];
    for (const r of relationships) {
      if (r.person_id === id && r.relationship_type === "parent") {
        const p = memberMap.get(r.related_person_id);
        if (p && !parentList.some((x) => x.id === p.id)) parentList.push(p);
      } else if (r.related_person_id === id && r.relationship_type === "child") {
        const p = memberMap.get(r.person_id);
        if (p && !parentList.some((x) => x.id === p.id)) parentList.push(p);
      }
    }

    let father = parentList.find((p) => p.gender === "male");
    let mother = parentList.find((p) => p.gender === "female");

    if (!father && parentList.length > 0) {
      father = parentList[0];
    }
    if (!mother && parentList.length > 1 && parentList[1].id !== father?.id) {
      mother = parentList[1];
    }

    return { father, mother };
  }

  function buildNode(
    member: FamilyTreeMember | null,
    depth: number,
    role: "root" | "left" | "right",
    label: string,
    parentMember: FamilyTreeMember | null,
    expectedRelation?: "father" | "mother",
    visited: Set<string> = new Set(),
  ): BinaryTreeNode {
    const key = member
      ? `${member.id}-${depth}-${role}`
      : `empty-${parentMember?.id}-${role}-${depth}`;

    if (!member) {
      return {
        key,
        member: null,
        role,
        label,
        depth,
        parentMember,
        expectedRelation,
        left: null,
        right: null,
      };
    }

    if (visited.has(member.id) || depth >= maxDepth) {
      return {
        key,
        member,
        role,
        label,
        depth,
        parentMember,
        left: null,
        right: null,
      };
    }

    const nextVisited = new Set(visited);
    nextVisited.add(member.id);

    const { father, mother } = getParents(member.id);

    // Dynamic labels based on depth and subtree branch
    const leftLabel =
      depth === 0
        ? "Father (Left Subtree)"
        : role === "left"
        ? "Paternal Grandfather"
        : "Maternal Grandfather";
    const rightLabel =
      depth === 0
        ? "Mother (Right Subtree)"
        : role === "left"
        ? "Paternal Grandmother"
        : "Maternal Grandmother";

    let leftNode: BinaryTreeNode | null = null;
    let rightNode: BinaryTreeNode | null = null;

    if (father) {
      leftNode = buildNode(
        father,
        depth + 1,
        "left",
        leftLabel,
        member,
        undefined,
        nextVisited,
      );
    } else if (depth < maxDepth) {
      leftNode = buildNode(
        null,
        depth + 1,
        "left",
        leftLabel,
        member,
        "father",
        nextVisited,
      );
    }

    if (mother) {
      rightNode = buildNode(
        mother,
        depth + 1,
        "right",
        rightLabel,
        member,
        undefined,
        nextVisited,
      );
    } else if (depth < maxDepth) {
      rightNode = buildNode(
        null,
        depth + 1,
        "right",
        rightLabel,
        member,
        "mother",
        nextVisited,
      );
    }

    return {
      key,
      member,
      role,
      label,
      depth,
      parentMember,
      left: leftNode,
      right: rightNode,
    };
  }

  return buildNode(rootMember, 0, "root", "Root Member", null);
}

/**
 * Builds a Descendants Binary Tree:
 * Root: Selected ancestor
 * Left Subtree: Branch 1 / Eldest child & lineage
 * Right Subtree: Branch 2 / Younger child & lineage
 */
function buildDescendantBinaryTree(
  rootId: string,
  members: FamilyTreeMember[],
  relationships: FamilyTreeRelationship[],
  maxDepth = 3,
): BinaryTreeNode | null {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const rootMember = memberMap.get(rootId);
  if (!rootMember) return null;

  function getChildren(id: string): FamilyTreeMember[] {
    const list: FamilyTreeMember[] = [];
    for (const r of relationships) {
      if (r.person_id === id && r.relationship_type === "child") {
        const c = memberMap.get(r.related_person_id);
        if (c && !list.some((x) => x.id === c.id)) list.push(c);
      } else if (r.related_person_id === id && r.relationship_type === "parent") {
        const c = memberMap.get(r.person_id);
        if (c && !list.some((x) => x.id === c.id)) list.push(c);
      }
    }
    return list;
  }

  function buildNode(
    member: FamilyTreeMember | null,
    depth: number,
    role: "root" | "left" | "right",
    label: string,
    parentMember: FamilyTreeMember | null,
    visited: Set<string> = new Set(),
  ): BinaryTreeNode {
    const key = member
      ? `desc-${member.id}-${depth}-${role}`
      : `empty-desc-${parentMember?.id}-${role}-${depth}`;

    if (!member) {
      return {
        key,
        member: null,
        role,
        label,
        depth,
        parentMember,
        expectedRelation: "child",
        left: null,
        right: null,
      };
    }

    if (visited.has(member.id) || depth >= maxDepth) {
      return {
        key,
        member,
        role,
        label,
        depth,
        parentMember,
        left: null,
        right: null,
      };
    }

    const nextVisited = new Set(visited);
    nextVisited.add(member.id);

    const children = getChildren(member.id);
    const child1 = children[0] || null;
    const child2 = children[1] || null;

    let leftNode: BinaryTreeNode | null = null;
    let rightNode: BinaryTreeNode | null = null;

    if (child1) {
      leftNode = buildNode(
        child1,
        depth + 1,
        "left",
        depth === 0 ? "Left Subtree (Branch 1)" : "Left Branch",
        member,
        nextVisited,
      );
    } else if (depth < 2) {
      leftNode = buildNode(
        null,
        depth + 1,
        "left",
        "Add Child (Left)",
        member,
        nextVisited,
      );
    }

    if (child2) {
      rightNode = buildNode(
        child2,
        depth + 1,
        "right",
        depth === 0 ? "Right Subtree (Branch 2)" : "Right Branch",
        member,
        nextVisited,
      );
    } else if (child1 && depth < 2) {
      rightNode = buildNode(
        null,
        depth + 1,
        "right",
        "Add Child (Right)",
        member,
        nextVisited,
      );
    }

    return {
      key,
      member,
      role,
      label,
      depth,
      parentMember,
      left: leftNode,
      right: rightNode,
    };
  }

  return buildNode(rootMember, 0, "root", "Root Ancestor", null);
}

// ============================================================================
// Recursive Binary Tree Node Component
// ============================================================================

function BinaryTreeNodeRenderer({
  node,
  selectedMember,
  rootMemberId,
  isAncestryMode,
  onSelectMember,
  onSetRoot,
  onOpenEdit,
  onOpenConnect,
  onDelete,
  onAddEmptySlot,
  canManage,
}: {
  node: BinaryTreeNode;
  selectedMember: FamilyTreeMember | null;
  rootMemberId: string;
  isAncestryMode: boolean;
  onSelectMember: (m: FamilyTreeMember) => void;
  onSetRoot: (m: FamilyTreeMember) => void;
  onOpenEdit: (m: FamilyTreeMember) => void;
  onOpenConnect: (m: FamilyTreeMember) => void;
  onDelete: (id: string) => void;
  onAddEmptySlot: (
    parent: FamilyTreeMember,
    relation: "father" | "mother" | "child" | "parent",
    label: string,
  ) => void;
  canManage: boolean;
}) {
  const isRoot = node.role === "root";
  const m = node.member;
  const isSelected = m && selectedMember?.id === m.id;
  const hasChildren = Boolean(node.left || node.right);

  // 1. Render Empty Branch Placeholder
  if (!m) {
    return (
      <button
        type="button"
        onClick={() => {
          if (node.parentMember) {
            onAddEmptySlot(
              node.parentMember,
              node.expectedRelation || "parent",
              node.label,
            );
          }
        }}
        className="group flex flex-col items-center justify-center w-36 sm:w-44 min-h-[110px] rounded-2xl border-2 border-dashed border-border/80 hover:border-primary bg-muted/20 hover:bg-primary/5 p-3 text-center transition shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition text-muted-foreground">
          <Plus className="h-4 w-4" />
        </div>
        <span className="mt-2 text-xs font-semibold text-muted-foreground group-hover:text-primary transition line-clamp-2">
          + {node.label}
        </span>
        <span className="text-[10px] text-muted-foreground/70">Click to add</span>
      </button>
    );
  }

  // 2. Render Existing Family Member Node Card
  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div
        onClick={() => onSelectMember(m)}
        className={`group relative flex w-44 sm:w-48 flex-col items-center rounded-2xl border p-3 text-center transition cursor-pointer shadow-xs hover:shadow-md ${
          isRoot
            ? "border-primary/80 bg-card ring-2 ring-primary/40 shadow-sm"
            : isSelected
            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
            : m.is_deceased
            ? "border-border/60 bg-muted/40 opacity-90 hover:opacity-100"
            : "border-border bg-card hover:border-primary/50"
        }`}
      >
        {/* Subtree / Role Badge */}
        {isRoot ? (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
            <Crown className="h-3 w-3" /> ROOT NODE
          </span>
        ) : node.role === "left" ? (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-300 uppercase tracking-wider">
            Left Subtree
          </span>
        ) : (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider">
            Right Subtree
          </span>
        )}

        {/* Avatar */}
        {m.avatar_url ? (
          <img
            src={m.avatar_url}
            alt={m.full_name}
            className="h-12 w-12 rounded-full object-cover border-2 border-primary/30 shadow-xs"
          />
        ) : (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold shadow-xs ${
              isRoot
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : m.gender === "female"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
            }`}
          >
            {m.full_name.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Member Name */}
        <span className="mt-2 block w-full truncate text-xs font-bold text-foreground">
          {m.full_name}
        </span>

        {/* Node Label / Relation context */}
        <span className="text-[10px] font-medium text-primary line-clamp-1">
          {node.label}
        </span>

        {/* Lifespan info */}
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {m.is_deceased
            ? `Late (${m.death_date ? m.death_date.slice(0, 4) : "Passed"})`
            : m.birth_date
            ? `Born ${m.birth_date.slice(0, 4)}`
            : "Living"}
        </span>

        {/* Quick Node Actions Bar */}
        <div className="mt-2.5 flex items-center justify-center gap-1 border-t border-border/50 pt-2 w-full">
          {!isRoot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetRoot(m);
              }}
              title="Set as Root of Tree"
              className="inline-flex h-6 items-center gap-1 px-1.5 rounded bg-muted/80 hover:bg-primary hover:text-primary-foreground text-[10px] font-semibold text-muted-foreground transition"
            >
              <Target className="h-3 w-3" />
              <span>Root</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenConnect(m);
            }}
            title="Connect Relative"
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <LinkIcon className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEdit(m);
            }}
            title="Edit Details"
            className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <Pencil className="h-3 w-3" />
          </button>

          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(m.id);
              }}
              title="Delete Member"
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Binary Tree Branching Structure: Left Subtree & Right Subtree */}
      {hasChildren && (
        <div className="w-full flex flex-col items-center">
          {/* Vertical trunk line coming down from parent node */}
          <div className="w-0.5 h-6 bg-primary/40" />

          {/* Subtree Header Badges directly below Root node */}
          {isRoot && (
            <div className="flex w-full items-center justify-between max-w-lg px-4 py-1 mb-1 text-[11px] font-bold">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2.5 py-0.5 rounded-full shadow-2xs">
                <span>⬅️</span>
                <span>LEFT SUBTREE ({isAncestryMode ? "Father's Lineage" : "Branch 1"})</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/25 px-2.5 py-0.5 rounded-full shadow-2xs">
                <span>RIGHT SUBTREE ({isAncestryMode ? "Mother's Lineage" : "Branch 2"})</span>
                <span>➡️</span>
              </span>
            </div>
          )}

          {/* Branch Fork: Horizontal bridge and vertical drops */}
          <div className="relative flex justify-center w-full">
            {/* Horizontal branch bar spanning from center of left column (25%) to center of right column (75%) */}
            <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary/40" />

            {/* Left Subtree Column */}
            <div className="flex-1 flex flex-col items-center px-1 sm:px-3">
              <div className="w-0.5 h-5 bg-primary/40" />
              {node.left && (
                <BinaryTreeNodeRenderer
                  node={node.left}
                  selectedMember={selectedMember}
                  rootMemberId={rootMemberId}
                  isAncestryMode={isAncestryMode}
                  onSelectMember={onSelectMember}
                  onSetRoot={onSetRoot}
                  onOpenEdit={onOpenEdit}
                  onOpenConnect={onOpenConnect}
                  onDelete={onDelete}
                  onAddEmptySlot={onAddEmptySlot}
                  canManage={canManage}
                />
              )}
            </div>

            {/* Right Subtree Column */}
            <div className="flex-1 flex flex-col items-center px-1 sm:px-3">
              <div className="w-0.5 h-5 bg-primary/40" />
              {node.right && (
                <BinaryTreeNodeRenderer
                  node={node.right}
                  selectedMember={selectedMember}
                  rootMemberId={rootMemberId}
                  isAncestryMode={isAncestryMode}
                  onSelectMember={onSelectMember}
                  onSetRoot={onSetRoot}
                  onOpenEdit={onOpenEdit}
                  onOpenConnect={onOpenConnect}
                  onDelete={onDelete}
                  onAddEmptySlot={onAddEmptySlot}
                  canManage={canManage}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Family Tree View
// ============================================================================

export function FamilyTreeView() {
  const { activeFamily, roleInActiveFamily, userId } = useFamily();
  const [members, setMembers] = useState<FamilyTreeMember[]>([]);
  const [relationships, setRelationships] = useState<FamilyTreeRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"ancestry" | "descendant" | "list">("ancestry");
  const [rootMemberId, setRootMemberId] = useState<string>("");

  // Dialog states
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyTreeMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyTreeMember | null>(null);
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [connectTargetPerson, setConnectTargetPerson] = useState<FamilyTreeMember | null>(null);
  const [prefilledRelType, setPrefilledRelType] = useState<TreeRelType>("parent");
  const [prefilledGender, setPrefilledGender] = useState<TreeGender | null>(null);
  const [prefilledRoleLabel, setPrefilledRoleLabel] = useState<string>("");

  const canManage =
    roleInActiveFamily === "owner" ||
    roleInActiveFamily === "admin" ||
    roleInActiveFamily === "moderator";

  const loadTree = useCallback(async () => {
    if (!activeFamily) return;
    setLoading(true);
    const supabase = createClient();

    const [membersRes, relRes] = await Promise.all([
      supabase
        .from("family_tree_members")
        .select("*")
        .eq("family_id", activeFamily.id)
        .order("generation", { ascending: true })
        .order("full_name", { ascending: true }),
      supabase
        .from("family_tree_relationships")
        .select("*")
        .eq("family_id", activeFamily.id)
        .eq("status", "approved"),
    ]);

    if (membersRes.data) {
      const fetched = membersRes.data as FamilyTreeMember[];
      setMembers(fetched);

      // Auto-pick root if none selected yet
      if (fetched.length > 0) {
        setRootMemberId((current) => {
          if (current && fetched.some((m) => m.id === current)) return current;
          // Prefer member matching logged-in user profile, else first member
          const userMatch = userId ? fetched.find((m) => m.profile_id === userId) : null;
          return userMatch ? userMatch.id : fetched[0].id;
        });
      }
    }

    if (relRes.data) {
      setRelationships(relRes.data as FamilyTreeRelationship[]);
    }
    setLoading(false);
  }, [activeFamily, userId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  // Group members by generation for "list" mode
  const generationGroups = useMemo(() => {
    const map = new Map<number, FamilyTreeMember[]>();
    for (const m of members) {
      const gen = m.generation ?? 0;
      if (!map.has(gen)) map.set(gen, []);
      map.get(gen)!.push(m);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.bio && m.bio.toLowerCase().includes(q)),
    );
  }, [members, search]);

  // Active root member
  const currentRootMember = useMemo(() => {
    return members.find((m) => m.id === rootMemberId) || members[0] || null;
  }, [members, rootMemberId]);

  // Build Binary Tree Data
  const binaryTreeData = useMemo(() => {
    if (!currentRootMember) return null;
    if (viewMode === "descendant") {
      return buildDescendantBinaryTree(currentRootMember.id, members, relationships, 3);
    }
    return buildAncestryBinaryTree(currentRootMember.id, members, relationships, 3);
  }, [currentRootMember, members, relationships, viewMode]);

  // Helper to find related people for the selected member
  const relatedInfo = useMemo(() => {
    if (!selectedMember) return null;
    const sid = selectedMember.id;
    const parents: FamilyTreeMember[] = [];
    const children: FamilyTreeMember[] = [];
    const spouses: FamilyTreeMember[] = [];
    const siblings: FamilyTreeMember[] = [];

    const memberMap = new Map(members.map((m) => [m.id, m]));

    for (const r of relationships) {
      if (r.person_id === sid) {
        const target = memberMap.get(r.related_person_id);
        if (target) {
          if (r.relationship_type === "parent") parents.push(target);
          else if (r.relationship_type === "child") children.push(target);
          else if (r.relationship_type === "spouse") spouses.push(target);
          else if (r.relationship_type === "sibling") siblings.push(target);
        }
      } else if (r.related_person_id === sid) {
        const source = memberMap.get(r.person_id);
        if (source) {
          if (r.relationship_type === "parent") children.push(source);
          else if (r.relationship_type === "child") parents.push(source);
          else if (r.relationship_type === "spouse") spouses.push(source);
          else if (r.relationship_type === "sibling") siblings.push(source);
        }
      }
    }

    return { parents, children, spouses, siblings };
  }, [selectedMember, relationships, members]);

  // Empty slot click handler
  function handleAddEmptySlot(
    parent: FamilyTreeMember,
    relation: "father" | "mother" | "child" | "parent",
    label: string,
  ) {
    setConnectTargetPerson(parent);
    setPrefilledRelType(relation === "child" ? "child" : "parent");
    setPrefilledGender(
      relation === "father" ? "male" : relation === "mother" ? "female" : null,
    );
    setPrefilledRoleLabel(label);
    setAddRelOpen(true);
  }

  // Open generic connect dialog
  function handleOpenConnect(member: FamilyTreeMember) {
    setConnectTargetPerson(member);
    setPrefilledRelType("parent");
    setPrefilledGender(null);
    setPrefilledRoleLabel("");
    setAddRelOpen(true);
  }

  async function handleDeleteMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this person from the family tree?"))
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("family_tree_members")
      .delete()
      .eq("id", memberId)
      .eq("family_id", activeFamily!.id);

    if (error) {
      toast.error("Failed to delete member: " + error.message);
      return;
    }
    toast.success("Member removed from tree");
    if (selectedMember?.id === memberId) setSelectedMember(null);
    if (rootMemberId === memberId) {
      const remaining = members.filter((m) => m.id !== memberId);
      setRootMemberId(remaining[0]?.id || "");
    }
    void loadTree();
  }

  if (!activeFamily) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-2 font-display text-lg font-semibold">No Family Selected</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select or join a family first to view the family tree.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/family"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent transition"
              aria-label="Back to family overview"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span>Family Tree</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Binary Tree View
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 ml-10">
            Binary Tree structure with Root, Left Subtree & Right Subtree for {activeFamily.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl border border-border bg-background p-0.5 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("ancestry")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition ${
                viewMode === "ancestry"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>Ancestry (Binary)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("descendant")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition ${
                viewMode === "descendant"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Descendants</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Generations List
            </button>
          </div>

          <Button
            size="sm"
            className="rounded-full shadow-sm"
            onClick={() => {
              setEditingMember(null);
              setMemberDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Relative
          </Button>
        </div>
      </div>

      {/* Binary Tree Control Toolbar: Root Selector, Search, Zoom */}
      {members.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-card/60 p-2.5 sm:px-4 backdrop-blur-sm">
          {/* Root Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span>Root Member:</span>
            </div>
            <select
              value={rootMemberId}
              onChange={(e) => setRootMemberId(e.target.value)}
              className="h-8 max-w-[200px] sm:max-w-xs rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} {m.is_deceased ? "(Late)" : ""}
                </option>
              ))}
            </select>

            {userId && members.some((m) => m.profile_id === userId) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg"
                onClick={() => {
                  const match = members.find((m) => m.profile_id === userId);
                  if (match) setRootMemberId(match.id);
                }}
              >
                <Target className="mr-1 h-3 w-3 text-primary" /> Center Me
              </Button>
            )}
          </div>

          {/* Search & Zoom */}
          <div className="flex items-center gap-2">
            <div className="relative w-36 sm:w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Find relative..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>

            {viewMode !== "list" && (
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                  className="p-1 hover:text-primary transition"
                  title="Zoom Out"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1 font-semibold min-w-[40px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
                  className="p-1 hover:text-primary transition"
                  title="Zoom In"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1 hover:text-primary transition border-l border-border ml-0.5 pl-1.5"
                  title="Reset Zoom"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <span className="text-4xl" aria-hidden>
            🌳
          </span>
          <h2 className="mt-3 font-display text-lg font-semibold">Start Your Family Tree</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Build a Computer Science Binary Tree: Root node branches into Left Subtree (Father's side)
            and Right Subtree (Mother's side).
          </p>
          <Button
            className="mt-4 rounded-full"
            onClick={() => {
              setEditingMember(null);
              setMemberDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add First Relative
          </Button>
        </div>
      ) : viewMode !== "list" ? (
        /* ========================================================================= */
        /* Visual Interactive Binary Tree Canvas */
        /* ========================================================================= */
        <div className="relative rounded-2xl border border-border bg-card/40 p-3 sm:p-4 overflow-hidden shadow-xs">
          {/* Legend / Info bar */}
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground px-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>
                {viewMode === "ancestry"
                  ? "Ancestry Binary Tree: Root ➔ Left (Father) & Right (Mother)"
                  : "Descendants Binary Tree: Root ➔ Left & Right Branches"}
              </span>
            </span>
            <span className="text-[11px] hidden sm:inline-block">
              Tip: Click "Root" on any member to re-center the binary tree!
            </span>
          </div>

          <div className="overflow-auto min-h-[500px] max-h-[75vh] cursor-grab active:cursor-grabbing p-4 sm:p-8 flex justify-center bg-radial from-card/80 to-muted/20">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease-out",
              }}
              className="pb-16 flex flex-col items-center min-w-[650px]"
            >
              {binaryTreeData ? (
                <BinaryTreeNodeRenderer
                  node={binaryTreeData}
                  selectedMember={selectedMember}
                  rootMemberId={rootMemberId}
                  isAncestryMode={viewMode === "ancestry"}
                  onSelectMember={setSelectedMember}
                  onSetRoot={(m) => {
                    setRootMemberId(m.id);
                    toast.success(`Root updated to ${m.full_name}`);
                  }}
                  onOpenEdit={(m) => {
                    setEditingMember(m);
                    setMemberDialogOpen(true);
                  }}
                  onOpenConnect={handleOpenConnect}
                  onDelete={handleDeleteMember}
                  onAddEmptySlot={handleAddEmptySlot}
                  canManage={canManage}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Select a root member to view tree</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* Generations List View (Alternative Flat View) */
        /* ========================================================================= */
        <div className="space-y-4">
          {generationGroups.map(([gen, group]) => {
            const groupMembers = group.filter((m) =>
              filteredMembers.some((fm) => fm.id === m.id),
            );
            if (groupMembers.length === 0) return null;

            return (
              <section key={gen} className="rounded-2xl border border-border bg-card p-4">
                <h3 className="font-display text-sm font-semibold text-primary mb-3">
                  {GENERATION_LABELS[gen] ?? `Generation ${gen}`} ({groupMembers.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {groupMembers.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition hover:bg-accent/50 ${
                        selectedMember?.id === m.id
                          ? "border-primary bg-primary/5"
                          : "border-border/60 bg-background"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          m.gender === "female"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        }`}
                      >
                        {m.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{m.full_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.is_deceased
                            ? `Late (${m.death_date ? m.death_date.slice(0, 4) : "Passed"})`
                            : m.birth_date
                            ? `Born ${m.birth_date}`
                            : "Living"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRootMemberId(m.id);
                          setViewMode("ancestry");
                          toast.success(`Centered tree on ${m.full_name}`);
                        }}
                        title="View in Binary Tree"
                        className="p-1 text-muted-foreground hover:text-primary transition"
                      >
                        <GitBranch className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Selected Member Detail Drawer / Card */}
      {selectedMember && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold shadow-xs ${
                  selectedMember.gender === "female"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                }`}
              >
                {selectedMember.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="font-display text-base font-bold flex items-center gap-2">
                  {selectedMember.full_name}
                  {selectedMember.is_deceased && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-normal text-muted-foreground">
                      Late
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedMember.birth_date && `Born: ${selectedMember.birth_date}`}
                  {selectedMember.death_date && ` · Passed: ${selectedMember.death_date}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs"
                onClick={() => {
                  setRootMemberId(selectedMember.id);
                  setViewMode("ancestry");
                  toast.success(`Binary Tree centered on ${selectedMember.full_name}`);
                }}
              >
                <Crown className="mr-1 h-3.5 w-3.5 text-amber-500" /> Make Root
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs"
                onClick={() => handleOpenConnect(selectedMember)}
              >
                <LinkIcon className="mr-1 h-3.5 w-3.5" /> Connect Relative
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-full"
                onClick={() => {
                  setEditingMember(selectedMember);
                  setMemberDialogOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive"
                  onClick={() => handleDeleteMember(selectedMember.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {selectedMember.bio && (
            <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-xl">
              {selectedMember.bio}
            </p>
          )}

          {/* Relationships Breakdown */}
          {relatedInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60">
              <div className="bg-background rounded-xl p-2.5 border border-border/50">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                  Parents ({relatedInfo.parents.length})
                </span>
                {relatedInfo.parents.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">None listed</span>
                ) : (
                  <ul className="text-xs space-y-0.5">
                    {relatedInfo.parents.map((p) => (
                      <li
                        key={p.id}
                        className="truncate cursor-pointer text-primary hover:underline"
                        onClick={() => setSelectedMember(p)}
                      >
                        {p.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-background rounded-xl p-2.5 border border-border/50">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                  Spouse ({relatedInfo.spouses.length})
                </span>
                {relatedInfo.spouses.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">None listed</span>
                ) : (
                  <ul className="text-xs space-y-0.5">
                    {relatedInfo.spouses.map((s) => (
                      <li
                        key={s.id}
                        className="truncate cursor-pointer text-primary hover:underline"
                        onClick={() => setSelectedMember(s)}
                      >
                        {s.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-background rounded-xl p-2.5 border border-border/50">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                  Siblings ({relatedInfo.siblings.length})
                </span>
                {relatedInfo.siblings.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">None listed</span>
                ) : (
                  <ul className="text-xs space-y-0.5">
                    {relatedInfo.siblings.map((sb) => (
                      <li
                        key={sb.id}
                        className="truncate cursor-pointer text-primary hover:underline"
                        onClick={() => setSelectedMember(sb)}
                      >
                        {sb.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-background rounded-xl p-2.5 border border-border/50">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-1">
                  Children ({relatedInfo.children.length})
                </span>
                {relatedInfo.children.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">None listed</span>
                ) : (
                  <ul className="text-xs space-y-0.5">
                    {relatedInfo.children.map((c) => (
                      <li
                        key={c.id}
                        className="truncate cursor-pointer text-primary hover:underline"
                        onClick={() => setSelectedMember(c)}
                      >
                        {c.full_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Member Form Modal */}
      <MemberDialog
        open={memberDialogOpen}
        familyId={activeFamily.id}
        member={editingMember}
        onOpenChange={setMemberDialogOpen}
        onSaved={loadTree}
      />

      {/* Connect Relative Modal */}
      <AddRelativeDialog
        open={addRelOpen}
        familyId={activeFamily.id}
        currentPerson={connectTargetPerson}
        allMembers={members}
        initialRelationType={prefilledRelType}
        initialGender={prefilledGender}
        initialRoleLabel={prefilledRoleLabel}
        onOpenChange={setAddRelOpen}
        onSaved={loadTree}
      />
    </div>
  );
}
