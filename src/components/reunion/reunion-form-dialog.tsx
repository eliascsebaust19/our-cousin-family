"use client";

import { useEffect, useState } from "react";
import { Plane, Calendar, MapPin, DollarSign, AlertCircle } from "lucide-react";
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
import type { ReunionPlan, ReunionStatus } from "@/lib/types";

interface ReunionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reunionToEdit?: ReunionPlan | null;
  onSaved: (plan: ReunionPlan) => void;
}

export function ReunionFormDialog({
  open,
  onOpenChange,
  reunionToEdit,
  onSaved,
}: ReunionFormDialogProps) {
  const { activeFamily, userId } = useFamily();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState<string>("0");
  const [status, setStatus] = useState<ReunionStatus>("planning");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (reunionToEdit) {
      setTitle(reunionToEdit.title);
      setDestination(reunionToEdit.destination);
      setStartDate(reunionToEdit.start_date || "");
      setEndDate(reunionToEdit.end_date || "");
      setEstimatedBudget(String(reunionToEdit.estimated_budget || 0));
      setStatus(reunionToEdit.status || "planning");
      setDescription(reunionToEdit.description || "");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setTitle("");
      setDestination("");
      setStartDate(today);
      setEndDate("");
      setEstimatedBudget("0");
      setStatus("planning");
      setDescription("");
    }
    setErrorMsg(null);
  }, [reunionToEdit, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeFamily || !userId) return;

    if (!title.trim()) {
      setErrorMsg("Please enter a trip or reunion title.");
      return;
    }
    if (!destination.trim()) {
      setErrorMsg("Please specify the destination or venue.");
      return;
    }
    if (!startDate) {
      setErrorMsg("Please select a start date.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const budgetNum = parseFloat(estimatedBudget) || 0;

    try {
      if (reunionToEdit) {
        const { data, error } = await supabase
          .from("reunion_plans")
          .update({
            title: title.trim(),
            destination: destination.trim(),
            start_date: startDate,
            end_date: endDate || null,
            estimated_budget: budgetNum,
            status,
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reunionToEdit.id)
          .select()
          .single();

        if (error) throw error;
        onSaved(data as ReunionPlan);
      } else {
        const { data, error } = await supabase
          .from("reunion_plans")
          .insert({
            family_id: activeFamily.id,
            created_by: userId,
            title: title.trim(),
            destination: destination.trim(),
            start_date: startDate,
            end_date: endDate || null,
            estimated_budget: budgetNum,
            status,
            description: description.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Auto-add creator as confirmed participant
        await supabase.from("reunion_participants").insert({
          reunion_id: data.id,
          user_id: userId,
          status: "going",
          adults_count: 1,
          kids_count: 0,
        });

        onSaved(data as ReunionPlan);
      }

      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Save reunion error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save reunion plan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Plane className="h-5 w-5 text-primary" />
            {reunionToEdit ? "Edit Reunion / Trip" : "Plan New Family Trip or Reunion"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Coordinate dates, budget, itinerary, packing, and headcounts with the family.
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
              Event / Trip Name *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cox's Bazar Winter Tour 2026"
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Destination / Venue *
            </label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Inani Beach, Cox's Bazar or Dadu's Village Home"
              className="rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Start Date *
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> End Date (Optional)
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl"
                min={startDate}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Estimated Budget
              </label>
              <Input
                type="number"
                min={0}
                step="any"
                value={estimatedBudget}
                onChange={(e) => setEstimatedBudget(e.target.value)}
                placeholder="0"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReunionStatus)}
                className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="planning">Planning (Discussing)</option>
                <option value="confirmed">Confirmed (Dates Fixed)</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Description & Highlights (Optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this reunion special? Hotel or travel guidelines..."
              rows={3}
              className="rounded-xl resize-none text-xs"
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
              disabled={isSubmitting || !title.trim() || !destination.trim() || !startDate}
              className="rounded-xl px-5"
            >
              {isSubmitting ? "Saving..." : reunionToEdit ? "Update Plan" : "Create Trip Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

