"use client";

import { useEffect, useState } from "react";
import { Coins, Calendar, Target, AlertCircle } from "lucide-react";
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
import type { FamilyFund } from "@/lib/types";

interface FundFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundToEdit?: FamilyFund | null;
  onSaved: (fund: FamilyFund) => void;
}

export function FundFormDialog({
  open,
  onOpenChange,
  fundToEdit,
  onSaved,
}: FundFormDialogProps) {
  const { activeFamily, userId } = useFamily();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [targetAmount, setTargetAmount] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (fundToEdit) {
      setTitle(fundToEdit.title);
      setPurpose(fundToEdit.purpose || "");
      setTargetAmount(String(fundToEdit.target_amount || 0));
      setDeadline(fundToEdit.deadline || "");
      setIsClosed(fundToEdit.is_closed || false);
    } else {
      setTitle("");
      setPurpose("");
      setTargetAmount("0");
      setDeadline("");
      setIsClosed(false);
    }
    setErrorMsg(null);
  }, [fundToEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeFamily || !userId) return;

    if (!title.trim()) {
      setErrorMsg("Please enter a fund name.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const targetNum = parseFloat(targetAmount) || 0;

    try {
      if (fundToEdit) {
        const { data, error } = await supabase
          .from("family_funds")
          .update({
            title: title.trim(),
            purpose: purpose.trim() || null,
            target_amount: targetNum,
            deadline: deadline || null,
            is_closed: isClosed,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fundToEdit.id)
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase.from("financial_audit_logs").insert({
          family_id: activeFamily.id,
          actor_id: userId,
          action: "update_fund",
          target_type: "fund",
          target_id: fundToEdit.id,
          details: { title: title.trim(), target_amount: targetNum, is_closed: isClosed },
        });

        onSaved(data as FamilyFund);
      } else {
        const { data, error } = await supabase
          .from("family_funds")
          .insert({
            family_id: activeFamily.id,
            created_by: userId,
            title: title.trim(),
            purpose: purpose.trim() || null,
            target_amount: targetNum,
            deadline: deadline || null,
            is_closed: false,
          })
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase.from("financial_audit_logs").insert({
          family_id: activeFamily.id,
          actor_id: userId,
          action: "create_fund",
          target_type: "fund",
          target_id: data.id,
          details: { title: title.trim(), target_amount: targetNum },
        });

        onSaved(data as FamilyFund);
      }

      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Save fund error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save fund.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Coins className="h-5 w-5 text-primary" />
            {fundToEdit ? "Edit Family Fund" : "Start New Family Fund"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            A shared bookkeeping ledger for family events, medical aid, or monthly cousin savings.
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
              Fund Name *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Eid Reunion Fund 2026, Medical Assistance"
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Target className="h-3.5 w-3.5 text-muted-foreground" /> Target Goal (৳)
              </label>
              <Input
                type="number"
                min={0}
                step="any"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0"
                className="rounded-xl font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Target Date / Deadline
              </label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Purpose & Guidelines
            </label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Explain how funds will be collected (bKash/cash) and what it will be spent on..."
              rows={3}
              className="rounded-xl resize-none text-xs"
            />
          </div>

          {fundToEdit && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isClosed"
                checked={isClosed}
                onChange={(e) => setIsClosed(e.target.checked)}
                className="h-4 w-4 rounded-md border-border accent-primary"
              />
              <label htmlFor="isClosed" className="text-xs text-foreground font-medium cursor-pointer">
                Close / Archive this fund (no more new contributions)
              </label>
            </div>
          )}

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
              disabled={isSubmitting || !title.trim()}
              className="rounded-xl px-5"
            >
              {isSubmitting ? "Saving..." : fundToEdit ? "Update Fund" : "Create Fund"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

