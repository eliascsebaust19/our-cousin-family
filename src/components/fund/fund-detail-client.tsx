"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { FundDetailView } from "@/components/fund/fund-detail-view";
import type {
  FamilyFund,
  FundContribution,
  FundExpense,
  FinancialAuditLog,
} from "@/lib/types";

export function FundDetailClient({ id }: { id: string }) {
  const { activeFamily } = useFamily();
  const [fund, setFund] = useState<FamilyFund | null>(null);
  const [contributions, setContributions] = useState<FundContribution[]>([]);
  const [expenses, setExpenses] = useState<FundExpense[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const [fundRes, contribRes, expRes, auditRes] = await Promise.all([
        supabase.from("family_funds").select("*").eq("id", id).single(),
        supabase
          .from("fund_contributions")
          .select("*")
          .eq("fund_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("fund_expenses")
          .select("*")
          .eq("fund_id", id)
          .order("spent_at", { ascending: false }),
        supabase
          .from("financial_audit_logs")
          .select("*")
          .eq("target_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (fundRes.error) throw fundRes.error;

      setFund(fundRes.data as FamilyFund);
      setContributions((contribRes.data as FundContribution[]) || []);
      setExpenses((expRes.data as FundExpense[]) || []);
      setAuditLogs((auditRes.data as FinancialAuditLog[]) || []);
    } catch (err: unknown) {
      console.error("Failed to load fund:", err);
      setErrorMsg(err instanceof Error ? err.message : "Fund not found or access denied.");
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
        <p className="text-xs text-muted-foreground">Loading fund details...</p>
      </div>
    );
  }

  if (errorMsg || !fund) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h3 className="font-bold text-foreground">Unable to load fund</h3>
        <p className="text-xs text-muted-foreground">{errorMsg || "This fund does not exist."}</p>
        <Link
          href="/fund"
          className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline pt-2"
        >
          <ChevronLeft className="h-4 w-4" /> Back to All Funds
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <FundDetailView
        initialFund={fund}
        initialContributions={contributions}
        initialExpenses={expenses}
        initialAuditLogs={auditLogs}
      />
    </div>
  );
}

