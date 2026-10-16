"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CloudOff,
  FileText,
  HardDriveDownload,
  Loader2,
  Music,
  Search,
  Star,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_FIELDS, VAULT_SELECT, channels } from "@/lib/queries";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VaultItemDialog,
  type VaultMember,
} from "@/components/vault/vault-item-dialog";
import { readCaptureDate } from "@/lib/exif";
import { prepareImageForUpload } from "@/lib/image";
import {
  formatFileSize,
  getVaultConnectUrl,
  getVaultStatus,
  kindFromMime,
  uploadVaultItem,
  vaultErrorMessage,
} from "@/lib/vault";
import type { VaultItem, VaultKind, VaultStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: Array<{ value: VaultKind | "all"; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "document", label: "Documents" },
  { value: "audio", label: "Audio" },
];

const MAX_LISTED = 300;

function kindIconElement(kind: string, className: string) {
  if (kind === "video") return <Video className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

export function VaultView() {
  const { activeFamily, roleInActiveFamily } = useFamily();
  const familyId = activeFamily?.id ?? null;
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [members, setMembers] = useState<VaultMember[]>([]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<VaultKind | "all">("all");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number; name: string } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledDriveFlag = useRef<string | null>(null);

  const connected = status?.connected ?? false;

  // ---- data ----------------------------------------------------------------
  const loadStatus = useCallback(async () => {
    if (!familyId) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await getVaultStatus(familyId));
      setStatusError(null);
    } catch (error) {
      setStatus(null);
      setStatusError(vaultErrorMessage(error));
    }
  }, [familyId]);

  const loadItems = useCallback(async () => {
    if (!familyId) {
      setItems([]);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("vault_items")
      .select(VAULT_SELECT)
      .eq("family_id", familyId)
      .order("year", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(MAX_LISTED);

    if (error) {
      toast.error("Could not load the vault");
      setItems([]);
      return;
    }
    setItems((data ?? []) as unknown as VaultItem[]);
  }, [familyId]);

  const loadMembers = useCallback(async () => {
    if (!familyId) {
      setMembers([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("family_members")
      .select(
        `user_id, status, profile:profiles!family_members_user_id_fkey(${PROFILE_FIELDS})`,
      )
      .eq("family_id", familyId)
      .eq("status", "active");

    const rows = (data ?? []) as unknown as Array<{
      user_id: string;
      profile: { full_name: string | null; nickname: string | null } | null;
    }>;
    setMembers(
      rows.map((row) => ({
        user_id: row.user_id,
        name: row.profile?.full_name ?? row.profile?.nickname ?? "Family member",
      })),
    );
  }, [familyId]);

  useEffect(() => {
    void loadStatus();
    void loadItems();
    void loadMembers();
  }, [loadStatus, loadItems, loadMembers]);

  // Realtime: a new memory (or a metadata edit) refreshes the grid for everyone.
  useEffect(() => {
    if (!familyId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadItems(), 500);
    };

    const channel = supabase
      .channel(channels.vault(familyId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vault_items", filter: `family_id=eq.${familyId}` },
        reload,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vault_item_people" }, reload)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [familyId, loadItems]);

  // The OAuth callback returns to /vault?drive=connected|error&reason=...
  const driveFlag = searchParams.get("drive");
  useEffect(() => {
    if (!driveFlag) return;
    const stamp = `${driveFlag}:${searchParams.get("reason") ?? ""}`;
    if (handledDriveFlag.current === stamp) return;
    handledDriveFlag.current = stamp;

    if (driveFlag === "connected") {
      toast.success("Google Drive connected");
      void loadStatus();
      void loadItems();
      return;
    }
    const reason = searchParams.get("reason");
    toast.error(
      reason === "access_denied"
        ? "Drive connection cancelled."
        : `Drive connection failed (${reason ?? "unknown"}).`,
    );
  }, [driveFlag, searchParams, loadStatus, loadItems]);

  // ---- derived -------------------------------------------------------------
  const years = useMemo(() => {
    const found = new Set<number>();
    for (const item of items ?? []) if (item.year) found.add(item.year);
    return [...found].sort((a, b) => b - a);
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (yearFilter !== "all" && item.year !== yearFilter) return false;
      if (!term) return true;
      const haystack = [
        item.name,
        item.caption ?? "",
        item.event?.title ?? "",
        ...item.people.map((person) => person.profile?.full_name ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, search, kindFilter, yearFilter]);

  /** Year → items, with the un-dated ones collected under a final heading. */
  const grouped = useMemo(() => {
    const map = new Map<string, VaultItem[]>();
    for (const item of filtered) {
      const key = item.year ? String(item.year) : "Undated";
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "Undated") return 1;
      if (b === "Undated") return -1;
      return Number(b) - Number(a);
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const bytes = list.reduce((total, item) => total + (item.size_bytes ?? 0), 0);
    return {
      count: list.length,
      favourites: list.filter((item) => item.is_favorite).length,
      size: formatFileSize(bytes),
      pending: list.filter((item) => item.upload_state !== "ready").length,
    };
  }, [items]);

  // ---- actions -------------------------------------------------------------
  async function connectDrive() {
    if (!familyId) return;
    setConnecting(true);
    try {
      const url = await getVaultConnectUrl(familyId);
      window.location.assign(url);
    } catch (error) {
      toast.error(vaultErrorMessage(error));
      setConnecting(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!familyId || !files || files.length === 0) return;
    const list = Array.from(files);
    setUpload({ done: 0, total: list.length, name: list[0].name });

    let failures = 0;
    try {
      for (let index = 0; index < list.length; index += 1) {
        const file = list[index];
        setUpload({ done: index, total: list.length, name: file.name });
        try {
          // Read EXIF before resizing — re-encoding drops the capture date.
          const capturedAt = await readCaptureDate(file);
          const prepared = await prepareImageForUpload(file);
          await uploadVaultItem({
            familyId,
            file: prepared.file,
            name: prepared.file.name,
            kind: kindFromMime(prepared.file.type),
            capturedAt,
          });
        } catch (error) {
          failures += 1;
          toast.error(`${file.name}: ${vaultErrorMessage(error)}`);
        }
      }
      const succeeded = list.length - failures;
      if (succeeded > 0) {
        toast.success(
          succeeded === 1 ? "Memory added" : `${succeeded} memories added`,
        );
        await loadItems();
      }
    } finally {
      setUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ---- render --------------------------------------------------------------
  if (!activeFamily) {
    return (
      <div className="rounded-3xl border border-dashed p-6 text-center">
        <CloudOff className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Join or create a family first — the Vault belongs to a family.
        </p>
      </div>
    );
  }

  const canConnect = roleInActiveFamily === "owner" || roleInActiveFamily === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl">Memory Vault</h1>
          <p className="truncate text-sm text-muted-foreground">{activeFamily.name}</p>
        </div>
        {connected ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={upload !== null}
            className="h-11 shrink-0 rounded-full"
          >
            {upload ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Add
          </Button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,application/pdf"
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      {upload ? (
        <p className="rounded-2xl border bg-muted/50 px-3 py-2 text-xs">
          Uploading {Math.min(upload.done + 1, upload.total)} of {upload.total} ·{" "}
          <span className="truncate">{upload.name}</span>
        </p>
      ) : null}

      {/* Connection state — honest, actionable, never faked. */}
      {statusError ? (
        <SetupNotice
          tone="warn"
          title="The Vault server is not reachable"
          body={statusError}
          action={
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href="/settings">Open settings</Link>
            </Button>
          }
        />
      ) : status === null ? (
        <Skeleton className="h-24 w-full rounded-3xl" />
      ) : !status.configured ? (
        <SetupNotice
          tone="warn"
          title="Google Drive is not configured on the server yet"
          body="The Vault stores files in a Google Drive account you own. Until the Google credentials are set as Supabase secrets, there is nothing to browse — and this page will not pretend otherwise."
          action={
            <Button asChild variant="outline" className="h-11 rounded-full">
              <Link href="/settings">Open settings</Link>
            </Button>
          }
        />
      ) : !status.connected ? (
        <SetupNotice
          tone={status.revoked ? "warn" : "info"}
          title={status.revoked ? "Google Drive access expired" : "Connect Google Drive"}
          body={
            status.revoked
              ? "Google revoked the stored access. While the OAuth app is in Testing mode refresh tokens expire every 7 days — publish the app to make the connection permanent, or reconnect now."
              : "One Google account holds the family's files. Everyone else in the family reads them through membership-checked server endpoints, so no one needs their own Google account."
          }
          action={
            canConnect ? (
              <Button
                onClick={() => void connectDrive()}
                disabled={connecting}
                className="h-11 rounded-full"
              >
                {connecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <HardDriveDownload className="size-4" />
                )}
                {status.revoked ? "Reconnect Drive" : "Connect Google Drive"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ask a family owner or admin to connect Drive.
              </p>
            )
          }
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border bg-card px-4 py-3 text-xs">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span className="font-medium">
            {status.accountEmail ?? "Google Drive connected"}
          </span>
          <span className="text-muted-foreground">
            Folder “{status.folderName}” · {stats.count} memories · {stats.size}
            {stats.pending > 0 ? ` · ${stats.pending} unfinished` : ""}
          </span>
        </div>
      )}

      {/* Filters */}
      {items !== null && items.length > 0 ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, caption, event, or person"
              className="h-11 rounded-full pl-9"
              aria-label="Search the vault"
            />
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {KINDS.map((kind) => (
              <button
                key={kind.value}
                type="button"
                onClick={() => setKindFilter(kind.value)}
                aria-pressed={kindFilter === kind.value}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3 text-sm transition-colors",
                  kindFilter === kind.value
                    ? "border-foreground bg-muted font-medium"
                    : "text-muted-foreground hover:border-foreground/40",
                )}
              >
                {kind.label}
              </button>
            ))}
          </div>
          {years.length > 1 ? (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setYearFilter("all")}
                aria-pressed={yearFilter === "all"}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3 text-sm transition-colors",
                  yearFilter === "all"
                    ? "border-foreground bg-muted font-medium"
                    : "text-muted-foreground hover:border-foreground/40",
                )}
              >
                All years
              </button>
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setYearFilter(year)}
                  aria-pressed={yearFilter === year}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-3 text-sm tabular-nums transition-colors",
                    yearFilter === year
                      ? "border-foreground bg-muted font-medium"
                      : "text-muted-foreground hover:border-foreground/40",
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Grid */}
      {items === null ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-center">
          <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {connected
              ? "Nothing saved yet. Add the first photo and it lands in your family's Drive."
              : "Connect Google Drive to start building the archive."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No memories match that search.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([year, group]) => (
            <section key={year} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {year}
                <span className="ml-2 font-normal">({group.length})</span>
              </h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.map((item) => {
                  const showThumb =
                    item.kind === "photo" &&
                    item.upload_state === "ready" &&
                    Boolean(item.drive_file_id) &&
                    connected;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="group relative block aspect-square w-full overflow-hidden rounded-2xl border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={item.name}
                      >
                        {showThumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/drive/content?item=${encodeURIComponent(item.id)}`}
                            alt={item.name}
                            loading="lazy"
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <span className="grid size-full place-items-center gap-1 p-2 text-center">
                            {kindIconElement(item.kind, "size-6 text-muted-foreground")}
                            <span className="line-clamp-2 text-[11px] text-muted-foreground">
                              {item.upload_state === "ready" ? item.kind : "unfinished"}
                            </span>
                          </span>
                        )}
                        {item.is_favorite ? (
                          <Star className="absolute right-1.5 top-1.5 size-4 fill-current text-amber-400 drop-shadow" />
                        ) : null}
                        {item.kind === "video" ? (
                          <Video className="absolute bottom-1.5 left-1.5 size-4 text-white drop-shadow" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <VaultItemDialog
        item={selected}
        members={members}
        connected={connected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onChanged={() => {
          void loadItems();
          void loadStatus();
        }}
      />
    </div>
  );
}

function SetupNotice({
  tone,
  title,
  body,
  action,
}: {
  tone: "info" | "warn";
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-3xl border p-4",
        tone === "warn" ? "border-amber-500/40 bg-amber-500/5" : "bg-card",
      )}
    >
      <div className="flex items-start gap-2">
        <CloudOff
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "warn" ? "text-amber-600" : "text-muted-foreground",
          )}
        />
        <div className="space-y-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{body}</p>
        </div>
      </div>
      {action}
      <p className="text-[11px] text-muted-foreground">
        Setup guide: docs/SETUP-GOOGLE-DRIVE.md — the exact steps and the secrets
        involved are documented there.
      </p>
    </section>
  );
}
