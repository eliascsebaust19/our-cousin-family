"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Coins,
  DollarSign,
  Plus,
  ShieldAlert,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FundFormDialog } from "@/components/fund/fund-form-dialog";
import type { FamilyFund } from "@/lib/types";

interface FundWithStats extends FamilyFund {
  total_contributions?: number;
  total_expenses?: number;
  balance?: number;
}

interface FundListViewProps {
  initialFunds: FundWithStats[];
  familyId: string;
}

export function FundListView({ initialFunds, familyId }: FundListViewProps) {
  const [funds, setFunds] = useState(initialFunds);
  const [filter, setFilter] = useState<"active" | "closed" | "all">("active");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredFunds = useMemo(() => {
    return funds.filter((f) => {
      if (filter === "active" && f.is_closed) return false;
      if (filter === "closed" && !f.is_closed) return false;
      return true;
    });
  }, [funds, filter]);

  // Aggregate treasury statistics
  const totalBalance = useMemo(() => {
    return funds.reduce((sum, f) => sum + (Number(f.balance) || 0), 0);
  }, [funds]);

  const totalCollected = useMemo(() => {
    return funds.reduce((sum, f) => sum + (Number(f.total_contributions) || 0), 0);
  }, [funds]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            Family Fund & Shared Expenses
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Transparent bookkeeping for Eid reunions, medical emergencies, gifts, and common expenses.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="gap-2 rounded-xl shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Start New Fund
        </Button>
      </div>

      {/* Bookkeeping Notice */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p>
          <strong className="text-foreground">Record-Keeping Only:</strong> This module is exclusively for tracking contributions and expenses. No payment processing is built-in; members transfer funds outside the app (bKash/cash/bank) and log them here for 100% honesty.
        </p>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground font-medium">Total Treasury Balance</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ৳{totalBalance.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Across all family funds</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground font-medium">Total Collected</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
            ৳{totalCollected.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Lifetime contributions</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
          <div className="text-xs text-muted-foreground font-medium">Active Funds</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-primary mt-1">
            {funds.filter((f) => !f.is_closed).length}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Open for collection</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex rounded-xl border border-border bg-muted/40 p-1 w-fit">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "active"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setFilter("active")}
        >
          Active Funds ({funds.filter((f) => !f.is_closed).length})
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "closed"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setFilter("closed")}
        >
          Closed / Archived ({funds.filter((f) => f.is_closed).length})
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            filter === "all"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setFilter("all")}
        >
          All Funds ({funds.length})
        </button>
      </div>

      {/* Fund Cards Grid */}
      {filteredFunds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Coins className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground text-base">
            {funds.length === 0
              ? "No family funds created yet"
              : "No funds match this filter"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {funds.length === 0
              ? "Start a fund for Eid gifts, family reunion food, or medical support."
              : "Switch filter tabs to view other funds."}
          </p>
          {funds.length === 0 && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-2 rounded-xl"
            >
              <Plus className="h-4 w-4" /> Start First Family Fund
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFunds.map((fund) => {
            const balance = fund.balance ?? 0;
            const collected = fund.total_contributions ?? 0;
            const progress = fund.target_amount > 0
              ? Math.min(100, Math.round((collected / fund.target_amount) * 100))
              : 0;

            return (
              <Link
                key={fund.id}
                href={`/fund/${fund.id}`}
                className="group flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/50 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        fund.is_closed
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {fund.is_closed ? "CLOSED" : "ACTIVE"}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      #{fund.id.slice(0, 5)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition line-clamp-1">
                      {fund.title}
                    </h3>
                    {fund.purpose && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                        {fund.purpose}
                      </p>
                    )}
                  </div>

                  {/* Target progress */}
                  {fund.target_amount > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Goal: ৳{fund.target_amount.toLocaleString()}</span>
                        <span className="font-mono font-bold text-foreground">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          style={{ width: `${progress}%` }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer details */}
                <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Available Balance</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ৳{balance.toLocaleString()}
                    </span>
                  </div>

                  {fund.deadline && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {fund.deadline}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <FundFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSaved={(created) => setFunds((prev) => [created, ...prev])}
      />
    </div>
  );
}

