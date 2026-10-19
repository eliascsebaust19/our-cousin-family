"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useFamily } from "@/components/app/family-provider";
import { createClient } from "@/lib/supabase/client";
import { FundListView } from "@/components/fund/fund-list-view";
import type { FamilyFund } from "@/lib/types";

export function FundListClient() {
  const { activeFamily } = useFamily();
  const [funds, setFunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFunds = useCallback(async () => {
    if (!activeFamily) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const [fundsRes, contribsRes, expensesRes] = await Promise.all([
        supabase
          .from("family_funds")
          .select("*")
          .eq("family_id", activeFamily.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("fund_contributions")
          .select("fund_id, amount, status")
          .eq("family_id", activeFamily.id),
        supabase
          .from("fund_expenses")
          .select("fund_id, amount, status")
          .eq("family_id", activeFamily.id),
      ]);

      if (fundsRes.error) throw fundsRes.error;

      const rawFunds = (fundsRes.data as FamilyFund[]) || [];
      const contribs = contribsRes.data || [];
      const expenses = expensesRes.data || [];

      // Calculate totals per fund
      const computedFunds = rawFunds.map((fund) => {
        const fundContribs = contribs.filter(
          (c) => c.fund_id === fund.id && c.status === "received",
        );
        const totalContrib = fundContribs.reduce(
          (sum, c) => sum + (Number(c.amount) || 0),
          0,
        );

        const fundExpenses = expenses.filter((e) => e.fund_id === fund.id);
        const totalExp = fundExpenses.reduce(
          (sum, e) => sum + (Number(e.amount) || 0),
          0,
        );

        return {
          ...fund,
          total_contributions: totalContrib,
          total_expenses: totalExp,
          balance: totalContrib - totalExp,
        };
      });

      setFunds(computedFunds);
    } catch (err) {
      console.error("Failed to load funds:", err);
    } finally {
      setLoading(false);
    }
  }, [activeFamily]);

  useEffect(() => {
    loadFunds();
  }, [loadFunds]);

  if (!activeFamily) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center text-muted-foreground">
        Select or create a family to view funds.
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
        <span className="text-foreground font-medium">Family Funds & Shared Expenses</span>
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading family funds...</p>
        </div>
      ) : (
        <FundListView
          initialFunds={funds}
          familyId={activeFamily.id}
        />
      )}
    </div>
  );
}

