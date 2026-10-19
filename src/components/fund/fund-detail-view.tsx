"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  Coins,
  DollarSign,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Plus,
  Receipt,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  CheckCircle2,
  Clock,
  ExternalLink,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { resolveMediaUrl, initials } from "@/lib/avatar";
import { ContributionDialog } from "@/components/fund/contribution-dialog";
import { ExpenseDialog } from "@/components/fund/expense-dialog";
import { FundFormDialog } from "@/components/fund/fund-form-dialog";
import type {
  FamilyFund,
  FundContribution,
  FundExpense,
  FinancialAuditLog,
} from "@/lib/types";

interface FundDetailViewProps {
  initialFund: FamilyFund;
  initialContributions: FundContribution[];
  initialExpenses: FundExpense[];
  initialAuditLogs: FinancialAuditLog[];
}

export function FundDetailView({
  initialFund,
  initialContributions,
  initialExpenses,
  initialAuditLogs,
}: FundDetailViewProps) {
  const router = useRouter();
  const { userId, roleInActiveFamily, activeFamily } = useFamily();
  const supabase = createClient();

  const [fund, setFund] = useState<FamilyFund>(initialFund);
  const [contributions, setContributions] = useState<FundContribution[]>(initialContributions);
  const [expenses, setExpenses] = useState<FundExpense[]>(initialExpenses);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>(initialAuditLogs);

  const [activeTab, setActiveTab] = useState<"contributions" | "expenses" | "audit">("contributions");
  const [isContributionOpen, setIsContributionOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const canManage =
    userId === fund.created_by ||
    roleInActiveFamily === "owner" ||
    roleInActiveFamily === "admin" ||
    roleInActiveFamily === "moderator";

  // Financial calculations
  const totalReceived = useMemo(() => {
    return contributions
      .filter((c) => c.status === "received")
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [contributions]);

  const totalPledged = useMemo(() => {
    return contributions
      .filter((c) => c.status === "pledged")
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [contributions]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const netBalance = totalReceived - totalExpenses;

  const targetProgress = fund.target_amount > 0
    ? Math.min(100, Math.round((totalReceived / fund.target_amount) * 100))
    : 0;

  async function handleToggleContributionStatus(contrib: FundContribution) {
    if (!canManage) return;
    const newStatus = contrib.status === "received" ? "pledged" : "received";
    try {
      const { data, error } = await supabase
        .from("fund_contributions")
        .update({
          status: newStatus,
          received_at: newStatus === "received" ? new Date().toISOString() : null,
          confirmed_by: newStatus === "received" ? userId : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contrib.id)
        .select()
        .single();

      if (error) throw error;
      setContributions((prev) =>
        prev.map((c) => (c.id === contrib.id ? (data as FundContribution) : c)),
      );

      // Audit log
      if (activeFamily && userId) {
        await supabase.from("financial_audit_logs").insert({
          family_id: activeFamily.id,
          actor_id: userId,
          action: "update_contribution_status",
          target_type: "contribution",
          target_id: contrib.id,
          details: { old_status: contrib.status, new_status: newStatus },
        });
      }
    } catch (err) {
      console.error("Status toggle error:", err);
    }
  }

  async function handleDeleteContribution(id: string) {
    if (!confirm("Are you sure you want to delete this contribution record?")) return;
    try {
      const { error } = await supabase.from("fund_contributions").delete().eq("id", id);
      if (error) throw error;
      setContributions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Delete contribution error:", err);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const { error } = await supabase.from("fund_expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Delete expense error:", err);
    }
  }

  async function handleViewReceipt(receiptUrl: string) {
    const url = await resolveMediaUrl(supabase, receiptUrl, "post-media");
    if (url) {
      window.open(url, "_blank");
    } else {
      alert("Could not load receipt image.");
    }
  }

  function handleExportCSV() {
    const lines: string[] = [];

    // Metadata
    lines.push(`"FAMILY FUND FINANCIAL REPORT - ${fund.title.replace(/"/g, '""')}"`);
    lines.push(`"Generated On:","${new Date().toLocaleString()}"`);
    lines.push(`"Target Goal:","৳${fund.target_amount.toLocaleString()}"`);
    lines.push(`"Total Received:","৳${totalReceived.toLocaleString()}"`);
    lines.push(`"Total Expenses:","৳${totalExpenses.toLocaleString()}"`);
    lines.push(`"Current Net Balance:","৳${netBalance.toLocaleString()}"`);
    lines.push("");

    // Contributions section
    lines.push(`"--- CONTRIBUTIONS LEDGER ---"`);
    lines.push(`"Date","Contributor","Amount (BDT)","Payment Method","Status","Trx / Notes"`);
    contributions.forEach((c) => {
      const date = c.created_at ? new Date(c.created_at).toLocaleDateString() : "";
      lines.push(
        `"${date}","${(c.contributor_name || "").replace(/"/g, '""')}","${c.amount}","${c.payment_method}","${c.status}","${(c.notes || "").replace(/"/g, '""')}"`,
      );
    });
    lines.push("");

    // Expenses section
    lines.push(`"--- EXPENSES LEDGER ---"`);
    lines.push(`"Date","Item Title","Category","Amount (BDT)","Paid By","Notes / Memo"`);
    expenses.forEach((e) => {
      lines.push(
        `"${e.spent_at}","${(e.title || "").replace(/"/g, '""')}","${e.category}","${e.amount}","${(e.payer_name || "").replace(/"/g, '""')}","${(e.description || "").replace(/"/g, '""')}"`,
      );
    });

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Family_Fund_${fund.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/fund"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ChevronLeft className="h-4 w-4" /> Back to All Funds
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs rounded-xl h-8"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>

          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="gap-1.5 text-xs rounded-xl h-8"
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit Fund
            </Button>
          )}
        </div>
      </div>

      {/* Bookkeeping Notice Alert */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p>
          <strong className="text-foreground">Record-Keeping Only:</strong> This fund operates strictly as a bookkeeping ledger. No actual money transactions take place inside the app. Family members transfer funds directly (via bKash, Nagad, cash, or bank) and log entries here for complete financial transparency.
        </p>
      </div>

      {/* Top Header Card */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  fund.is_closed
                    ? "bg-muted text-muted-foreground"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {fund.is_closed ? "CLOSED / ARCHIVED" : "ACTIVE FUND"}
              </span>
              <span className="text-xs text-muted-foreground">
                Fund #{fund.id.slice(0, 6)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {fund.title}
            </h1>

            {fund.purpose && (
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                {fund.purpose}
              </p>
            )}

            {fund.deadline && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Target Date: {fund.deadline}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          {!fund.is_closed && (
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <Button
                onClick={() => setIsContributionOpen(true)}
                className="gap-1.5 rounded-xl shadow-xs text-xs h-9"
              >
                <Plus className="h-4 w-4" /> Add Contribution
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsExpenseOpen(true)}
                className="gap-1.5 rounded-xl shadow-xs text-xs h-9"
              >
                <Receipt className="h-4 w-4 text-primary" /> Record Expense
              </Button>
            </div>
          )}
        </div>

        {/* Target Goal Progress Bar */}
        {fund.target_amount > 0 && (
          <div className="mt-5 space-y-1.5 pt-4 border-t border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" /> Target Goal Progress
              </span>
              <span className="font-mono font-bold text-foreground">
                ৳{totalReceived.toLocaleString()} / ৳{fund.target_amount.toLocaleString()} ({targetProgress}%)
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                style={{ width: `${targetProgress}%` }}
                className="h-full rounded-full bg-primary transition-all duration-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Net Fund Balance */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Net Balance</span>
            <Coins className="h-4 w-4 text-primary" />
          </div>
          <div className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${
            netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          }`}>
            ৳{netBalance.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Cash in treasury hand
          </div>
        </div>

        {/* Total Received */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Received</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
            ৳{totalReceived.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {contributions.filter((c) => c.status === "received").length} payments collected
          </div>
        </div>

        {/* Pledged Pending */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Pledged (Pending)</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            ৳{totalPledged.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {contributions.filter((c) => c.status === "pledged").length} pledges to collect
          </div>
        </div>

        {/* Total Spent */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Spent</span>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-destructive mt-1">
            ৳{totalExpenses.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {expenses.length} purchases recorded
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-border text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("contributions")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "contributions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wallet className="h-4 w-4" /> Contributions ({contributions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "expenses"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="h-4 w-4" /> Expenses ({expenses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" /> Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: CONTRIBUTIONS */}
      {activeTab === "contributions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground">
              Member Contributions & Pledges ({contributions.length})
            </h3>
            {!fund.is_closed && (
              <Button
                size="sm"
                onClick={() => setIsContributionOpen(true)}
                className="gap-1.5 text-xs rounded-xl h-8"
              >
                <Plus className="h-3.5 w-3.5" /> Add Entry
              </Button>
            )}
          </div>

          {contributions.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground text-xs">
              No contributions recorded yet. Click &quot;Add Entry&quot; to log who has contributed.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
              {contributions.map((c) => {
                const isReceived = c.status === "received";
                const dateStr = c.created_at
                  ? new Date(c.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "";

                return (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 hover:bg-muted/20 transition gap-2 sm:gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {initials(c.contributor_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {c.contributor_name}
                          </span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                            {c.payment_method}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                              isReceived
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{dateStr}</span>
                          {c.notes && <span>• {c.notes}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                      <div className="font-mono text-sm sm:text-base font-bold text-foreground">
                        ৳{Number(c.amount).toLocaleString()}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleContributionStatus(c)}
                            className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted transition"
                            title="Toggle status"
                          >
                            {isReceived ? "Mark Pledged" : "Mark Received"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContribution(c.id)}
                            className="text-muted-foreground/50 hover:text-destructive transition p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXPENSES */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground">
              Purchases & Expenses Log ({expenses.length})
            </h3>
            {!fund.is_closed && (
              <Button
                size="sm"
                onClick={() => setIsExpenseOpen(true)}
                className="gap-1.5 text-xs rounded-xl h-8"
              >
                <Plus className="h-3.5 w-3.5" /> Record Expense
              </Button>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground text-xs">
              No expenses recorded yet. All fund money is intact.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 hover:bg-muted/20 transition gap-2 sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-foreground">
                        {e.title}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        {e.category}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                      <span>Date: {e.spent_at}</span>
                      <span>• Paid by <strong className="text-foreground">{e.payer_name}</strong></span>
                      {e.description && <span>• {e.description}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    {e.receipt_url && (
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(e.receipt_url!)}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <Receipt className="h-3.5 w-3.5" /> View Receipt
                      </button>
                    )}

                    <div className="font-mono text-sm sm:text-base font-bold text-destructive">
                      -৳{Number(e.amount).toLocaleString()}
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(e.id)}
                        className="text-muted-foreground/50 hover:text-destructive transition p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-foreground">
            Financial Transparency & Audit Log
          </h3>
          <p className="text-xs text-muted-foreground">
            Every modification, contribution, and expense is recorded for family trust.
          </p>

          {auditLogs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground text-xs">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
              {auditLogs.map((log) => {
                const dateStr = log.created_at
                  ? new Date(log.created_at).toLocaleString()
                  : "";

                return (
                  <div key={log.id} className="p-3 sm:p-4 text-xs space-y-1">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground font-mono">
                        {log.action.toUpperCase()}
                      </span>
                      <span>{dateStr}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Target: <span className="font-mono text-foreground">{log.target_type}</span> (#{log.target_id.slice(0, 6)})
                    </div>
                    {log.details && (
                      <div className="rounded-lg bg-muted/40 p-2 font-mono text-[11px] text-foreground/80 overflow-x-auto">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ContributionDialog
        open={isContributionOpen}
        onOpenChange={setIsContributionOpen}
        fundId={fund.id}
        familyId={fund.family_id}
        onSaved={(newContrib) => setContributions((prev) => [newContrib, ...prev])}
      />

      <ExpenseDialog
        open={isExpenseOpen}
        onOpenChange={setIsExpenseOpen}
        fundId={fund.id}
        familyId={fund.family_id}
        onSaved={(newExp) => setExpenses((prev) => [newExp, ...prev])}
      />

      <FundFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        fundToEdit={fund}
        onSaved={(updated) => setFund(updated)}
      />
    </div>
  );
}

