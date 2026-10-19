"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useFamily } from "@/components/app/family-provider";
import { createClient } from "@/lib/supabase/client";
import { ReunionListView } from "@/components/reunion/reunion-list-view";
import type { ReunionPlan } from "@/lib/types";

export function ReunionListClient() {
  const { activeFamily } = useFamily();
  const [plans, setPlans] = useState<ReunionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    if (!activeFamily) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("reunion_plans")
        .select("*")
        .eq("family_id", activeFamily.id)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setPlans((data as ReunionPlan[]) || []);
    } catch (err) {
      console.error("Failed to load reunions:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFamily]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  if (!activeFamily) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center text-muted-foreground">
        Select or create a family to view trips and reunions.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 hover:text-foreground transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Family
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Reunion & Travel Planner</span>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading family trips...</p>
        </div>
      ) : (
        <ReunionListView
          initialPlans={plans}
          familyId={activeFamily.id}
        />
      )}
    </div>
  );
}

