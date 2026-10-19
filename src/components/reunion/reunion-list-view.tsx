"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Compass,
  DollarSign,
  MapPin,
  Plane,
  Plus,
  Users,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReunionFormDialog } from "@/components/reunion/reunion-form-dialog";
import type { ReunionPlan } from "@/lib/types";

interface ReunionListViewProps {
  initialPlans: (ReunionPlan & {
    participants_count?: number;
    confirmed_headcount?: number;
  })[];
  familyId: string;
}

export function ReunionListView({
  initialPlans,
  familyId,
}: ReunionListViewProps) {
  const [plans, setPlans] = useState(initialPlans);
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (statusFilter === "active" && (p.status === "completed" || p.status === "cancelled")) {
        return false;
      }
      if (statusFilter === "completed" && p.status !== "completed") {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchDest = p.destination.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        return matchTitle || matchDest || matchDesc;
      }
      return true;
    });
  }, [plans, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" />
            Family Travel & Reunion Planner
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Coordinate family vacations, Eid reunions, picnics, and get-togethers in one shared place.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="gap-2 rounded-xl shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Plan New Trip
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex rounded-xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "active"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatusFilter("active")}
          >
            Active & Upcoming
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "completed"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatusFilter("completed")}
          >
            Past Memories
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "all"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setStatusFilter("all")}
          >
            All Plans
          </button>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search destination, title..."
            className="pl-8 text-xs rounded-xl h-9"
          />
        </div>
      </div>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plane className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground text-base">
            {plans.length === 0
              ? "No family trips or reunions planned yet"
              : "No trips found matching your filters"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {plans.length === 0
              ? "Plan your next Eid gathering, winter tour, or weekend picnic with shared schedules and headcounts."
              : "Try switching the filter tab or clearing your search keywords."}
          </p>
          {plans.length === 0 && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-2 rounded-xl"
            >
              <Plus className="h-4 w-4" /> Plan First Family Reunion
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((p) => {
            const isConfirmed = p.status === "confirmed";
            const isPlanning = p.status === "planning";
            const isCompleted = p.status === "completed";

            return (
              <Link
                key={p.id}
                href={`/reunions/${p.id}`}
                className="group flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50 hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Status & Tag */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isConfirmed
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : isPlanning
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : isCompleted
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status.toUpperCase()}
                    </span>

                    <span className="text-[11px] text-muted-foreground font-mono">
                      #{p.id.slice(0, 5)}
                    </span>
                  </div>

                  {/* Title & destination */}
                  <div>
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition line-clamp-1">
                      {p.title}
                    </h3>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      {p.destination}
                    </p>
                  </div>

                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>
                  )}
                </div>

                {/* Footer details */}
                <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {p.start_date}
                  </span>

                  {p.estimated_budget > 0 && (
                    <span className="flex items-center gap-1 font-mono text-foreground">
                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                      ৳{p.estimated_budget.toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <ReunionFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSaved={(created) => setPlans((prev) => [created, ...prev])}
      />
    </div>
  );
}

