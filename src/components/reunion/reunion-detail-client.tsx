"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { ReunionDetailView } from "@/components/reunion/reunion-detail-view";
import type {
  ReunionPlan,
  ReunionParticipant,
  ReunionItineraryItem,
  ReunionTask,
  ReunionExpense,
} from "@/lib/types";

export function ReunionDetailClient({ id }: { id: string }) {
  const { activeFamily } = useFamily();
  const [plan, setPlan] = useState<ReunionPlan | null>(null);
  const [participants, setParticipants] = useState<
    (ReunionParticipant & { profile?: { full_name: string | null; avatar_url: string | null } })[]
  >([]);
  const [itinerary, setItinerary] = useState<ReunionItineraryItem[]>([]);
  const [tasks, setTasks] = useState<ReunionTask[]>([]);
  const [expenses, setExpenses] = useState<ReunionExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const [planRes, partRes, itinRes, taskRes, expRes] = await Promise.all([
        supabase.from("reunion_plans").select("*").eq("id", id).single(),
        supabase
          .from("reunion_participants")
          .select("*, profile:profiles(full_name, avatar_url)")
          .eq("reunion_id", id),
        supabase
          .from("reunion_itinerary")
          .select("*")
          .eq("reunion_id", id)
          .order("day_number", { ascending: true })
          .order("activity_time", { ascending: true }),
        supabase
          .from("reunion_tasks")
          .select("*")
          .eq("reunion_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("reunion_expenses")
          .select("*")
          .eq("reunion_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (planRes.error) throw planRes.error;

      setPlan(planRes.data as ReunionPlan);
      setParticipants((partRes.data as any) || []);
      setItinerary((itinRes.data as ReunionItineraryItem[]) || []);
      setTasks((taskRes.data as ReunionTask[]) || []);
      setExpenses((expRes.data as ReunionExpense[]) || []);
    } catch (err: unknown) {
      console.error("Failed to load reunion:", err);
      setErrorMsg(err instanceof Error ? err.message : "Trip not found or access denied.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading trip details...</p>
      </div>
    );
  }

  if (errorMsg || !plan) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h3 className="font-bold text-foreground">Unable to load trip</h3>
        <p className="text-xs text-muted-foreground">{errorMsg || "This trip does not exist."}</p>
        <Link
          href="/reunions"
          className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline pt-2"
        >
          <ChevronLeft className="h-4 w-4" /> Back to All Trips
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <ReunionDetailView
        initialPlan={plan}
        initialParticipants={participants}
        initialItinerary={itinerary}
        initialTasks={tasks}
        initialExpenses={expenses}
      />
    </div>
  );
}

