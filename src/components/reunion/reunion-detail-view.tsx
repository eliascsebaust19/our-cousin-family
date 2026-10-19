"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  Clock,
  DollarSign,
  Edit2,
  FileCheck2,
  ListTodo,
  MapPin,
  Pencil,
  PieChart,
  Plus,
  Trash2,
  UserCheck,
  Users,
  CheckCircle2,
  Circle,
  AlertCircle,
  Utensils,
  Car,
  Hotel,
  Ticket,
  Luggage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useFamily } from "@/components/app/family-provider";
import { initials } from "@/lib/avatar";
import { ReunionFormDialog } from "@/components/reunion/reunion-form-dialog";
import type {
  ReunionPlan,
  ReunionParticipant,
  ReunionItineraryItem,
  ReunionTask,
  ReunionExpense,
  ReunionParticipantStatus,
} from "@/lib/types";

interface ReunionDetailViewProps {
  initialPlan: ReunionPlan;
  initialParticipants: (ReunionParticipant & { profile?: { full_name: string | null; avatar_url: string | null } })[];
  initialItinerary: ReunionItineraryItem[];
  initialTasks: ReunionTask[];
  initialExpenses: ReunionExpense[];
}

export function ReunionDetailView({
  initialPlan,
  initialParticipants,
  initialItinerary,
  initialTasks,
  initialExpenses,
}: ReunionDetailViewProps) {
  const router = useRouter();
  const { userId, roleInActiveFamily } = useFamily();
  const supabase = createClient();

  const [plan, setPlan] = useState<ReunionPlan>(initialPlan);
  const [participants, setParticipants] = useState(initialParticipants);
  const [itinerary, setItinerary] = useState<ReunionItineraryItem[]>(initialItinerary);
  const [tasks, setTasks] = useState<ReunionTask[]>(initialTasks);
  const [expenses, setExpenses] = useState<ReunionExpense[]>(initialExpenses);

  const [activeTab, setActiveTab] = useState<"overview" | "itinerary" | "tasks" | "expenses">("overview");

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Form states for child dialogs
  const [actDay, setActDay] = useState(1);
  const [actTime, setActTime] = useState("");
  const [actTitle, setActTitle] = useState("");
  const [actLocation, setActLocation] = useState("");
  const [actDesc, setActDesc] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState<ReunionTask["category"]>("general");
  const [taskDueDate, setTaskDueDate] = useState("");

  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState<ReunionExpense["category"]>("other");
  const [expAmount, setExpAmount] = useState("");
  const [expPayer, setExpPayer] = useState("");
  const [expNotes, setExpNotes] = useState("");

  // Current user's RSVP
  const myRsvp = participants.find((p) => p.user_id === userId);
  const [myStatus, setMyStatus] = useState<ReunionParticipantStatus>(myRsvp?.status || "interested");
  const [myAdults, setMyAdults] = useState<number>(myRsvp?.adults_count ?? 1);
  const [myKids, setMyKids] = useState<number>(myRsvp?.kids_count ?? 0);
  const [myNotes, setMyNotes] = useState<string>(myRsvp?.notes || "");
  const [savingRsvp, setSavingRsvp] = useState(false);

  const canManage =
    userId === plan.created_by ||
    roleInActiveFamily === "owner" ||
    roleInActiveFamily === "admin";

  // Calculations
  const confirmedAttendees = useMemo(() => {
    return participants.filter((p) => p.status === "going");
  }, [participants]);

  const totalConfirmedHeadcount = useMemo(() => {
    return confirmedAttendees.reduce(
      (acc, p) => acc + (p.adults_count || 0) + (p.kids_count || 0),
      0,
    );
  }, [confirmedAttendees]);

  const totalAdults = useMemo(() => {
    return confirmedAttendees.reduce((acc, p) => acc + (p.adults_count || 0), 0);
  }, [confirmedAttendees]);

  const totalKids = useMemo(() => {
    return confirmedAttendees.reduce((acc, p) => acc + (p.kids_count || 0), 0);
  }, [confirmedAttendees]);

  const totalActualExpenses = useMemo(() => {
    return expenses.reduce((acc, e) => acc + (Number(e.actual_amount) || 0), 0);
  }, [expenses]);

  const perPersonCost = totalConfirmedHeadcount > 0
    ? Math.round(totalActualExpenses / totalConfirmedHeadcount)
    : 0;

  // Itinerary grouped by day
  const itineraryByDay = useMemo(() => {
    const map = new Map<number, ReunionItineraryItem[]>();
    itinerary.forEach((item) => {
      const list = map.get(item.day_number) || [];
      list.push(item);
      map.set(item.day_number, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [itinerary]);

  async function handleSaveRsvp() {
    if (!userId) return;
    setSavingRsvp(true);
    try {
      if (myRsvp) {
        const { data, error } = await supabase
          .from("reunion_participants")
          .update({
            status: myStatus,
            adults_count: myAdults,
            kids_count: myKids,
            notes: myNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", myRsvp.id)
          .select("*, profile:profiles(full_name, avatar_url)")
          .single();

        if (error) throw error;
        setParticipants((prev) =>
          prev.map((p) => (p.id === myRsvp.id ? (data as any) : p)),
        );
      } else {
        const { data, error } = await supabase
          .from("reunion_participants")
          .insert({
            reunion_id: plan.id,
            user_id: userId,
            status: myStatus,
            adults_count: myAdults,
            kids_count: myKids,
            notes: myNotes.trim() || null,
          })
          .select("*, profile:profiles(full_name, avatar_url)")
          .single();

        if (error) throw error;
        setParticipants((prev) => [...prev, data as any]);
      }
    } catch (err) {
      console.error("Failed to save RSVP:", err);
      alert("Failed to update your RSVP.");
    } finally {
      setSavingRsvp(false);
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actTitle.trim()) return;

    try {
      const { data, error } = await supabase
        .from("reunion_itinerary")
        .insert({
          reunion_id: plan.id,
          day_number: actDay,
          activity_time: actTime.trim() || null,
          title: actTitle.trim(),
          location: actLocation.trim() || null,
          description: actDesc.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      setItinerary((prev) => [...prev, data as ReunionItineraryItem]);
      setIsAddActivityOpen(false);
      setActTitle("");
      setActTime("");
      setActLocation("");
      setActDesc("");
    } catch (err) {
      console.error("Failed to add activity:", err);
    }
  }

  async function handleDeleteActivity(id: string) {
    if (!confirm("Remove this itinerary item?")) return;
    try {
      const { error } = await supabase.from("reunion_itinerary").delete().eq("id", id);
      if (error) throw error;
      setItinerary((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Delete activity error:", err);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      const { data, error } = await supabase
        .from("reunion_tasks")
        .insert({
          reunion_id: plan.id,
          title: taskTitle.trim(),
          category: taskCategory,
          due_date: taskDueDate || null,
          is_completed: false,
        })
        .select()
        .single();

      if (error) throw error;
      setTasks((prev) => [...prev, data as ReunionTask]);
      setIsAddTaskOpen(false);
      setTaskTitle("");
      setTaskDueDate("");
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  }

  async function handleToggleTask(task: ReunionTask) {
    const updatedStatus = !task.is_completed;
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                is_completed: updatedStatus,
                completed_by: updatedStatus ? userId : null,
                completed_at: updatedStatus ? new Date().toISOString() : null,
              }
            : t,
        ),
      );

      const { error } = await supabase
        .from("reunion_tasks")
        .update({
          is_completed: updatedStatus,
          completed_by: updatedStatus ? userId : null,
          completed_at: updatedStatus ? new Date().toISOString() : null,
        })
        .eq("id", task.id);

      if (error) throw error;
    } catch (err) {
      console.error("Toggle task error:", err);
    }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm("Delete this checklist task?")) return;
    try {
      const { error } = await supabase.from("reunion_tasks").delete().eq("id", id);
      if (error) throw error;
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Delete task error:", err);
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expTitle.trim()) return;
    const amount = parseFloat(expAmount) || 0;

    try {
      const { data, error } = await supabase
        .from("reunion_expenses")
        .insert({
          reunion_id: plan.id,
          title: expTitle.trim(),
          category: expCategory,
          estimated_amount: amount,
          actual_amount: amount,
          paid_by: userId,
          payer_name: expPayer.trim() || "Family Member",
          notes: expNotes.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      setExpenses((prev) => [...prev, data as ReunionExpense]);
      setIsAddExpenseOpen(false);
      setExpTitle("");
      setExpAmount("");
      setExpPayer("");
      setExpNotes("");
    } catch (err) {
      console.error("Add expense error:", err);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Delete this recorded expense?")) return;
    try {
      const { error } = await supabase.from("reunion_expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Delete expense error:", err);
    }
  }

  async function handleDeletePlan() {
    if (!confirm("Are you sure you want to delete this trip plan completely? This will remove all itinerary items, tasks, and headcounts.")) {
      return;
    }
    try {
      const { error } = await supabase.from("reunion_plans").delete().eq("id", plan.id);
      if (error) throw error;
      router.push("/reunions");
    } catch (err) {
      console.error("Delete plan error:", err);
      alert("Failed to delete trip plan.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/reunions"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ChevronLeft className="h-4 w-4" /> Back to All Trips & Reunions
        </Link>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              className="gap-1.5 text-xs rounded-xl h-8"
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit Trip
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDeletePlan}
              className="h-8 text-xs text-muted-foreground hover:text-destructive rounded-xl"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Header Card */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  plan.status === "confirmed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : plan.status === "planning"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : plan.status === "completed"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {plan.status.toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground">
                Trip ID: #{plan.id.slice(0, 6)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {plan.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="h-4 w-4 text-primary" /> {plan.destination}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                {plan.start_date}
                {plan.end_date ? ` to ${plan.end_date}` : ""}
              </span>
              {plan.estimated_budget > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Budget: ৳{plan.estimated_budget.toLocaleString()}
                </span>
              )}
            </div>

            {plan.description && (
              <p className="text-xs sm:text-sm text-muted-foreground pt-2 max-w-2xl leading-relaxed">
                {plan.description}
              </p>
            )}
          </div>

          {/* Quick Headcount Stats */}
          <div className="flex items-center gap-3 self-start md:self-auto rounded-2xl bg-muted/30 p-3 sm:p-4 border border-border/60">
            <div className="text-center px-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {totalConfirmedHeadcount}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Confirmed
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center px-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {totalAdults}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Adults
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center px-2">
              <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                {totalKids}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Kids
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-border text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="h-4 w-4" /> Overview & RSVP ({participants.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("itinerary")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "itinerary"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" /> Schedule & Itinerary ({itinerary.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition ${
            activeTab === "tasks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListTodo className="h-4 w-4" /> Packing & Tasks ({tasks.length})
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
          <PieChart className="h-4 w-4" /> Budget & Expenses (৳{totalActualExpenses.toLocaleString()})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & RSVP */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* User's RSVP Control Card */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Your RSVP & Party Headcount
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Let the family know if you and your household are joining this trip.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <div className="sm:col-span-4">
                <label className="text-xs font-semibold text-foreground">Your Status</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {(["going", "interested", "declined"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setMyStatus(st)}
                      className={`rounded-xl py-1.5 text-xs font-semibold capitalize transition border ${
                        myStatus === st
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {st === "going" ? "Going" : st === "interested" ? "Interested" : "Can't Go"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Adults</label>
                <Input
                  type="number"
                  min={0}
                  value={myAdults}
                  onChange={(e) => setMyAdults(parseInt(e.target.value) || 0)}
                  className="rounded-xl mt-1 text-xs"
                  disabled={myStatus === "declined"}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground">Children</label>
                <Input
                  type="number"
                  min={0}
                  value={myKids}
                  onChange={(e) => setMyKids(parseInt(e.target.value) || 0)}
                  className="rounded-xl mt-1 text-xs"
                  disabled={myStatus === "declined"}
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-xs font-semibold text-foreground">Travel Notes / Diet</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={myNotes}
                    onChange={(e) => setMyNotes(e.target.value)}
                    placeholder="e.g. Bringing car, need baby cot"
                    className="rounded-xl text-xs"
                  />
                  <Button
                    type="button"
                    onClick={handleSaveRsvp}
                    disabled={savingRsvp}
                    className="rounded-xl text-xs shrink-0"
                  >
                    {savingRsvp ? "Saving..." : "Save RSVP"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Attendees List */}
          <div className="space-y-3">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> RSVP Responses ({participants.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {participants.map((p) => {
                const name = p.profile?.full_name || "Family Member";
                const isGoing = p.status === "going";
                const isInterested = p.status === "interested";

                return (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {initials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            isGoing
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isInterested
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {p.adults_count} Adult{p.adults_count !== 1 ? "s" : ""}
                        {p.kids_count > 0 ? `, ${p.kids_count} Kid${p.kids_count !== 1 ? "s" : ""}` : ""}
                      </div>

                      {p.notes && (
                        <p className="text-[11px] italic text-muted-foreground/80 mt-1 line-clamp-2">
                          &ldquo;{p.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ITINERARY */}
      {activeTab === "itinerary" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-foreground">Schedule & Daily Itinerary</h3>
              <p className="text-xs text-muted-foreground">Keep everyone aligned on meeting times and plans.</p>
            </div>
            <Button
              onClick={() => setIsAddActivityOpen(true)}
              className="gap-1.5 rounded-xl text-xs h-9"
            >
              <Plus className="h-4 w-4" /> Add Activity
            </Button>
          </div>

          {itineraryByDay.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground text-xs">
              No daily schedule added yet. Click &quot;Add Activity&quot; to plan Day 1, Day 2, etc.
            </div>
          ) : (
            <div className="space-y-6">
              {itineraryByDay.map(([dayNum, items]) => (
                <div key={dayNum} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold font-mono">
                      {dayNum}
                    </span>
                    <h4 className="font-bold text-sm text-foreground">Day {dayNum}</h4>
                  </div>

                  <div className="ml-3 space-y-2 border-l-2 border-border pl-4">
                    {items.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {act.activity_time && (
                              <span className="font-mono text-xs font-semibold text-primary">
                                {act.activity_time}
                              </span>
                            )}
                            <h5 className="font-bold text-xs sm:text-sm text-foreground">
                              {act.title}
                            </h5>
                          </div>

                          {act.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 text-primary" /> {act.location}
                            </div>
                          )}

                          {act.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                              {act.description}
                            </p>
                          )}
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="text-muted-foreground/60 hover:text-destructive transition p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PACKING & TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-foreground">Checklist & Responsibilities</h3>
              <p className="text-xs text-muted-foreground">Packing lists, food planning, transportation, and tickets.</p>
            </div>
            <Button
              onClick={() => setIsAddTaskOpen(true)}
              className="gap-1.5 rounded-xl text-xs h-9"
            >
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground text-xs">
              No tasks or checklist items created yet. Add packing, cooking, or booking tasks.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 transition shadow-xs ${
                    task.is_completed
                      ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      className="mt-0.5 text-primary hover:text-primary/80 transition shrink-0"
                    >
                      {task.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs sm:text-sm font-semibold leading-snug ${
                          task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {task.category}
                        </span>
                        {task.due_date && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" /> Due {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-muted-foreground/50 hover:text-destructive transition p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BUDGET & EXPENSES */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-foreground">Budget & Shared Cost Calculator</h3>
              <p className="text-xs text-muted-foreground">
                Track shared travel expenses transparently and calculate cost-per-attendee.
              </p>
            </div>
            <Button
              onClick={() => setIsAddExpenseOpen(true)}
              className="gap-1.5 rounded-xl text-xs h-9"
            >
              <Plus className="h-4 w-4" /> Record Expense
            </Button>
          </div>

          {/* Cost Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-medium">Estimated Budget</div>
              <div className="text-2xl font-bold font-mono text-foreground mt-1">
                ৳{plan.estimated_budget.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-medium">Total Recorded Costs</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                ৳{totalActualExpenses.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground font-medium">Est. Cost Per Attendee</div>
              <div className="text-2xl font-bold font-mono text-primary mt-1">
                ৳{perPersonCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Based on {totalConfirmedHeadcount} confirmed people
              </div>
            </div>
          </div>

          {/* Expenses list */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-foreground">Recorded Expenses ({expenses.length})</h4>

            {expenses.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-muted-foreground text-xs">
                No trip expenses recorded yet. Click &quot;Record Expense&quot; to log vehicle rent, food, hotels, etc.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                {expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-foreground">
                          {exp.title}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {exp.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Paid by <span className="font-medium text-foreground">{exp.payer_name || "Family Member"}</span>
                        {exp.notes && ` • ${exp.notes}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                          ৳{Number(exp.actual_amount).toLocaleString()}
                        </span>
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
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
        </div>
      )}

      {/* Dialog: Edit Plan */}
      <ReunionFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        reunionToEdit={plan}
        onSaved={(updated) => setPlan(updated)}
      />

      {/* Dialog: Add Itinerary Activity */}
      <Dialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Add Schedule Item
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddActivity} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Day Number</label>
                <Input
                  type="number"
                  min={1}
                  value={actDay}
                  onChange={(e) => setActDay(parseInt(e.target.value) || 1)}
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Time (e.g. 09:00 AM)</label>
                <Input
                  value={actTime}
                  onChange={(e) => setActTime(e.target.value)}
                  placeholder="09:00 AM"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Activity Title *</label>
              <Input
                value={actTitle}
                onChange={(e) => setActTitle(e.target.value)}
                placeholder="e.g. Breakfast & Group Photo at Beach"
                className="rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Location / Venue</label>
              <Input
                value={actLocation}
                onChange={(e) => setActLocation(e.target.value)}
                placeholder="e.g. Hotel Rooftop / Sugondha Beach"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Description / Details</label>
              <Textarea
                value={actDesc}
                onChange={(e) => setActDesc(e.target.value)}
                placeholder="What to wear, meeting point, tickets..."
                rows={2}
                className="rounded-xl resize-none text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddActivityOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={!actTitle.trim()} className="rounded-xl">
                Save Activity
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Task */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" /> Add Checklist Task
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Task / Item Name *</label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Rent Microbus / Buy First Aid Box"
                className="rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as ReunionTask["category"])}
                  className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="transport">Transport</option>
                  <option value="food">Food & Snacks</option>
                  <option value="lodging">Lodging</option>
                  <option value="supplies">Supplies / Packing</option>
                  <option value="activities">Activities / Games</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Due Date (Optional)</label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddTaskOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={!taskTitle.trim()} className="rounded-xl">
                Add Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Record Expense */}
      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Record Trip Expense
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Expense Item *</label>
              <Input
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="e.g. Microbus CNG Gas, BBQ Dinner"
                className="rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Amount (৳) *</label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="0"
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ReunionExpense["category"])}
                  className="h-9 w-full rounded-xl border border-input bg-card px-3 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="food">Food</option>
                  <option value="transport">Transport</option>
                  <option value="lodging">Lodging</option>
                  <option value="tickets">Tickets / Passes</option>
                  <option value="activities">Activities</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Who Paid? (Payer Name)</label>
              <Input
                value={expPayer}
                onChange={(e) => setExpPayer(e.target.value)}
                placeholder="e.g. Asif, or Shared from Common Fund"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Notes / Receipt details</label>
              <Input
                value={expNotes}
                onChange={(e) => setExpNotes(e.target.value)}
                placeholder="e.g. Cash memo #412"
                className="rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsAddExpenseOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={!expTitle.trim() || !expAmount} className="rounded-xl">
                Save Expense
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

