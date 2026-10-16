"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyLite, Membership, ProfileLite } from "@/lib/types";

type FamilyContextValue = {
  userId: string;
  profile: ProfileLite;
  /** Families the user is an active member of. */
  families: FamilyLite[];
  /** Families awaiting admin approval. */
  pendingFamilies: FamilyLite[];
  memberships: Membership[];
  activeFamily: FamilyLite | null;
  setActiveFamilyId: (id: string) => void;
  roleInActiveFamily: string | null;
  unreadNotifications: number;
  unreadMessages: number;
  refreshBadges: () => void;
};

const FamilyContext = createContext<FamilyContextValue | null>(null);

const ACTIVE_FAMILY_KEY = "ocf:activeFamilyId";

export function FamilyProvider({
  userId,
  profile,
  memberships,
  children,
}: {
  userId: string;
  profile: ProfileLite;
  memberships: Membership[];
  children: React.ReactNode;
}) {
  const families = useMemo(
    () => memberships.filter((m) => m.status === "active").map((m) => m.family),
    [memberships],
  );
  const pendingFamilies = useMemo(
    () => memberships.filter((m) => m.status === "pending").map((m) => m.family),
    [memberships],
  );

  const [activeFamilyId, setActiveFamilyIdState] = useState<string | null>(
    families[0]?.id ?? null,
  );

  // Restore the previously selected family.
  useEffect(() => {
    if (families.length === 0) {
      setActiveFamilyIdState(null);
      return;
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ACTIVE_FAMILY_KEY);
    } catch {
      stored = null;
    }
    setActiveFamilyIdState(
      stored && families.some((f) => f.id === stored) ? stored : families[0]!.id,
    );
  }, [families]);

  const setActiveFamilyId = useCallback((id: string) => {
    setActiveFamilyIdState(id);
    try {
      window.localStorage.setItem(ACTIVE_FAMILY_KEY, id);
    } catch {
      /* ignore private-mode failures */
    }
  }, []);

  const activeFamily = useMemo(
    () => families.find((f) => f.id === activeFamilyId) ?? families[0] ?? null,
    [families, activeFamilyId],
  );

  const roleInActiveFamily = useMemo(() => {
    if (!activeFamily) return null;
    return (
      memberships.find((m) => m.family.id === activeFamily.id)?.role ?? null
    );
  }, [activeFamily, memberships]);

  // ---- badges -------------------------------------------------------------
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const cancelled = useRef(false);

  const refreshBadges = useCallback(async () => {
    const supabase = createClient();
    const [notifRes, unreadRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      supabase.rpc("get_unread_counts"),
    ]);
    if (cancelled.current) return;
    setUnreadNotifications(notifRes.count ?? 0);
    const rows = (unreadRes.data ?? []) as { unread_count: number }[];
    setUnreadMessages(rows.reduce((sum, r) => sum + Number(r.unread_count), 0));
  }, []);

  useEffect(() => {
    cancelled.current = false;
    void refreshBadges();

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refreshBadges(), 1200);
    };

    const channel = supabase
      .channel(`shell:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        debounced,
      )
      .subscribe();

    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshBadges]);

  // ---- presence heartbeat -------------------------------------------------
  useEffect(() => {
    const supabase = createClient();
    const beat = () => {
      if (document.visibilityState === "visible") {
        void supabase.rpc("touch_last_seen");
      }
    };
    beat();
    const interval = setInterval(beat, 90_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  const value = useMemo<FamilyContextValue>(
    () => ({
      userId,
      profile,
      families,
      pendingFamilies,
      memberships,
      activeFamily,
      setActiveFamilyId,
      roleInActiveFamily,
      unreadNotifications,
      unreadMessages,
      refreshBadges,
    }),
    [
      userId,
      profile,
      families,
      pendingFamilies,
      memberships,
      activeFamily,
      setActiveFamilyId,
      roleInActiveFamily,
      unreadNotifications,
      unreadMessages,
      refreshBadges,
    ],
  );

  return (
    <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
  );
}

export function useFamily(): FamilyContextValue {
  const ctx = useContext(FamilyContext);
  if (!ctx) {
    throw new Error("useFamily must be used inside <FamilyProvider>");
  }
  return ctx;
}
