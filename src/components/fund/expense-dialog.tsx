"use client";

import { useEffect, useState } from "react";
import { Receipt, Upload, AlertCircle, FileImage, X } from "lucide-react";
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
import { uploadFundReceipt } from "@/lib/uploads";
import { useFamily } from "@/components/app/family-provider";
import type { FundExpense, ExpenseCategory } from "@/lib/types";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundId: string;
  familyId: string;
  onSaved: (expense: FundExpense) => void;
}

export function ExpenseDialog({
  open,
  onOpenChange,
  fundId,
  familyId,
  onSaved,
}: ExpenseDialogProps) {
  const { userId, profile } = useFamily();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [spentAt, setSpentAt] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory("food");
      setAmount("");
      setPayerName(profile?.full_name || "");
      setSpentAt(new Date().toISOString().slice(0, 10));
      setDescription("");
      setReceiptFile(null);
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
      setReceiptPreview(null);
      setErrorMsg(null);
    }
  }, [open, profile]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a receipt image (JPG, PNG, WebP).");
      return;
    }

    setReceiptFile(file);
    const url = URL.createObjectURL(file);
    setReceiptPreview(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setErrorMsg("Please enter a valid expense amount.");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("Please enter what this expense was for.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        receiptPath = await uploadFundReceipt(supabase, familyId, receiptFile);
      }

      const payload = {
        fund_id: fundId,
        family_id: familyId,
        title: title.trim(),
        category,
        amount: amountNum,
        spent_at: spentAt || new Date().toISOString().slice(0, 10),
        payer_name: payerName.trim() || "Family Member",
        payer_id: userId,
        receipt_url: receiptPath,
        description: description.trim() || null,
        status: "approved" as const,
        approved_by: userId,
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("fund_expenses")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from("financial_audit_logs").insert({
        family_id: familyId,
        actor_id: userId,
        action: "record_expense",
        target_type: "expense",
        target_id: data.id,
        details: {
          fund_id: fundId,
          title: title.trim(),
          amount: amountNum,
          category,
          payer: payerName.trim(),
          has_receipt: !!receiptPath,
        },
      });

      onSaved(data as FundExpense);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Save expense error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Receipt className="h-5 w-5 text-primary" />
            Record Fund Expense
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Log purchases, catering, event venue, medicines, or supplies with receipt proof.
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
              What was purchased? *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 5kg Mutton & Rice, Hospital Medicine Bill"
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Amount Spent (৳) *
              </label>
              <Input
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 4500"
                className="rounded-xl font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="food">Food & Grocery</option>
                <option value="events">Events & Venue</option>
                <option value="transport">Transport / Fuel</option>
                <option value="medical">Medical / Health</option>
                <option value="gifts">Gifts & Welfare</option>
                <option value="utilities">Utilities & Supplies</option>
                <option value="other">Other Expense</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Paid By (Purchaser)
              </label>
              <Input
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="e.g. Uncle Kamal"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Expense Date
              </label>
              <Input
                type="date"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Memo / Shop Name
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Agora Superstore, Cash Memo #891"
              className="rounded-xl text-xs"
            />
          </div>

          {/* Receipt Image Upload */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Receipt / Bill Photo (Optional)
            </label>
            {receiptPreview ? (
              <div className="relative inline-block mt-1">
                <img
                  src={receiptPreview}
                  alt="Receipt Preview"
                  className="h-20 w-auto rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFile(null);
                    setReceiptPreview(null);
                  }}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 p-2.5 hover:bg-muted transition">
                <FileImage className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Attach cash memo or receipt photo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelected}
                  className="hidden"
                />
              </label>
            )}
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
              disabled={isSubmitting || !amount || !title.trim()}
              className="rounded-xl px-5"
            >
              {isSubmitting ? "Saving..." : "Record Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

