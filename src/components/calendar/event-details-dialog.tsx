"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarClock, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatEventWhen } from "@/lib/datetime";
import { rsvpSchema } from "@/lib/validation";
import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CalendarEvent, EventResponse } from "@/lib/types";

const RESPONSES: { value: EventResponse; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "declined", label: "Can't make it" },
];

function counts(event: CalendarEvent) {
  const going = event.rsvps.filter((r) => r.response === "going");
  const maybe = event.rsvps.filter((r) => r.response === "maybe");
  const declined = event.rsvps.filter((r) => r.response === "declined");
  return { going, maybe, declined };
}

export function EventDetailsDialog({
  event,
  open,
  userId,
  canManage,
  onOpenChange,
  onEdit,
  onChanged,
}: {
  event: CalendarEvent;
  open: boolean;
  userId: string;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const mine = event.rsvps.find((r) => r.user_id === userId) ?? null;
  const [response, setResponse] = useState<EventResponse | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminder, setReminder] = useState<string>("none");
  const [reminderPending, setReminderPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResponse(mine?.response ?? null);
    setNote(mine?.note ?? "");
    setConfirmDelete(false);

    // Fetch user's reminder for this event
    const supabase = createClient();
    supabase
      .from("event_reminders")
      .select("reminder_type")
      .eq("event_id", event.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setReminder(data?.reminder_type ?? "none");
      });
  }, [open, mine?.response, mine?.note, event.id, userId]);

  async function handleReminderChange(type: string) {
    setReminderPending(true);
    const supabase = createClient();
    if (type === "none") {
      await supabase
        .from("event_reminders")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", userId);
      setReminder("none");
      toast.success("Reminder turned off");
    } else {
      const { error } = await supabase.from("event_reminders").upsert(
        {
          event_id: event.id,
          user_id: userId,
          reminder_type: type,
        },
        { onConflict: "event_id,user_id,reminder_type" },
      );
      if (!error) {
        setReminder(type);
        toast.success("Reminder set!");
      }
    }
    setReminderPending(false);
  }

  const { going, maybe, declined } = counts(event);

  async function saveResponse(next: EventResponse, nextNote: string) {
    const parsed = rsvpSchema.safeParse({ response: next, note: nextNote });
    if (!parsed.success) {
      toast.error("That response could not be saved");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("event_rsvps").upsert(
      {
        event_id: event.id,
        user_id: userId,
        response: parsed.data.response,
        note: parsed.data.note ? parsed.data.note : null,
      },
      { onConflict: "event_id,user_id" },
    );
    setPending(false);

    if (error) {
      toast.error("Could not save your response");
      return;
    }
    if (next !== response) {
      toast.success(next === "going" ? "You're going!" : "Response saved");
    }
    onChanged();
  }

  async function remove() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("family_events")
      .delete()
      .eq("id", event.id);
    setPending(false);

    if (error) {
      toast.error("Could not delete the event");
      return;
    }
    toast.success("Event deleted");
    onOpenChange(false);
    onChanged();
  }

  const notes = mine?.note ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>{event.title}</DialogTitle>
            {event.category && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                {event.category}
              </span>
            )}
            {event.is_recurring && (
              <span className="rounded-full bg-brand-warm/10 px-2 py-0.5 text-[10px] font-semibold text-brand-warm">
                Repeats Yearly
              </span>
            )}
          </div>
          <DialogDescription>
            Organised by {event.author?.full_name ?? "a relative"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{formatEventWhen(event)}</span>
            </p>
            {event.location ? (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{event.location}</span>
              </p>
            ) : null}
            {event.description ? (
              <p className="whitespace-pre-wrap break-words rounded-xl border border-border bg-card p-3 text-foreground/90">
                {event.description}
              </p>
            ) : null}
          </div>

          {/* Reminder Section */}
          <section className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Bell className="h-3.5 w-3.5 text-primary" />
                <span>In-App Reminder</span>
              </div>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={reminder}
                disabled={reminderPending}
                onChange={(e) => void handleReminderChange(e.target.value)}
              >
                <option value="none">No reminder</option>
                <option value="1_day_before">1 day before</option>
                <option value="1_hour_before">1 hour before</option>
                <option value="on_day">On the day</option>
              </select>
            </div>
          </section>

          <section aria-labelledby="event-going" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 id="event-going" className="text-sm font-semibold">
                Who&apos;s coming
              </h3>
              <p className="text-xs text-muted-foreground">
                {going.length} going · {maybe.length} maybe · {declined.length} not
              </p>
            </div>
            {going.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                Nobody has answered yet — be the first.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-x-3 gap-y-2">
                {going.slice(0, 8).map((rsvp) => (
                  <li
                    key={rsvp.user_id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-3 pl-1"
                  >
                    <UserAvatar
                      path={rsvp.profile?.avatar_url ?? null}
                      name={rsvp.profile?.full_name ?? "Relative"}
                      size={24}
                    />
                    <span className="text-xs">
                      {rsvp.user_id === userId ? "You" : rsvp.profile?.full_name ?? "Relative"}
                    </span>
                  </li>
                ))}
                {going.length > 8 ? (
                  <li className="self-center text-xs text-muted-foreground">
                    +{going.length - 8} more
                  </li>
                ) : null}
              </ul>
            )}
          </section>

          <section aria-labelledby="event-answer" className="space-y-2">
            <h3 id="event-answer" className="text-sm font-semibold">
              Your answer
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {RESPONSES.map((option) => {
                const selected = response === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    className="h-10 px-2"
                    aria-pressed={selected}
                    disabled={pending}
                    onClick={() => void saveResponse(option.value, note)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bringing the kids…"
                maxLength={200}
                aria-label="Note on your RSVP"
                disabled={!response}
                className="h-10 flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10"
                disabled={!response || pending || note === notes}
                onClick={() => void saveResponse(response ?? "going", note)}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Save note
              </Button>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {canManage ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onEdit} disabled={pending}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "outline"}
                onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
                disabled={pending}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                {confirmDelete ? "Really delete?" : "Delete"}
              </Button>
            </div>
          ) : (
            <span />
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
