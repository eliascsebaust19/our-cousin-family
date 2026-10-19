"use client";

import { useEffect, useState } from "react";
import { DollarSign, Wallet, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import type { FundContribution, PaymentMethod, ContributionStatus } from "@/lib/types";

interface ContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundId: string;
  familyId: string;
  onSaved: (contribution: FundContribution) => void;
}

export function ContributionDialog({
  open,
  onOpenChange,
  fundId,
  familyId,
  onSaved,
}: ContributionDialogProps) {
  const { userId, profile, roleInActiveFamily } = useFamily();
  const supabase = createClient();

  const [contributorName, setContributorName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bkash");
  const [status, setStatus] = useState<ContributionStatus>("received");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canConfirmDirectly =
    roleInActiveFamily === "owner" ||
    roleInActiveFamily === "admin" ||
    roleInActiveFamily === "moderator";

  useEffect(() => {
    if (open) {
      setContributorName(profile?.full_name || "");
      setAmount("");
      setPaymentMethod("bkash");
      setStatus(canConfirmDirectly ? "received" : "pledged");
      setNotes("");
      setErrorMsg(null);
    }
  }, [open, profile, canConfirmDirectly]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setErrorMsg("Please enter a valid contribution amount.");
      return;
    }

    if (!contributorName.trim()) {
      setErrorMsg("Please enter contributor name.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        fund_id: fundId,
        family_id: familyId,
        contributor_name: contributorName.trim(),
        contributor_id: userId,
        amount: amountNum,
        status: status,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        received_at: status === "received" ? new Date().toISOString() : null,
        confirmed_by: status === "received" ? userId : null,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("fund_contributions")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from("financial_audit_logs").insert({
        family_id: familyId,
        actor_id: userId,
        action: "record_contribution",
        target_type: "contribution",
        target_id: data.id,
        details: {
          fund_id: fundId,
          contributor: contributorName.trim(),
          amount: amountNum,
          method: paymentMethod,
          status,
        },
      });

      onSaved(data as FundContribution);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Save contribution error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to record contribution.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Wallet className="h-5 w-5 text-primary" />
            Record Member Contribution
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Strictly record-keeping: log who contributed via bKash, Cash, or Bank.
          </p>
        </DialogHeader>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Contributor Name *
            </label>
            <Input
              value={contributorName}
              onChange={(e) => setContributorName(e.target.value)}
              placeholder="e.g. Asif, Choto Chacha, or Shanto"
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Amount (৳) *
              </label>
              <Input
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Payment Channel
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="cash">Hand Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContributionStatus)}
              className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <option value="received">Received / Confirmed (Already paid)</option>
              <option value="pledged">Pledged (Promised, to pay soon)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Transaction Details / TrxID / Memo
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. TrxID 9XA1284 to Rashed, or Given at dinner"
              className="rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !amount || !contributorName.trim()}
              className="rounded-xl px-5"
            >
              {isSubmitting ? "Recording..." : "Record Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

