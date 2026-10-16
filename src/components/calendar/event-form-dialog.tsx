"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createEventSchema, updateEventSchema } from "@/lib/validation";
import {
  fromInputDate,
  fromInputDateEnd,
  fromInputDateTime,
  toInputDate,
  toInputDateTime,
} from "@/lib/datetime";
import { Field } from "@/components/field";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarEvent } from "@/lib/types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Empty defaults for a brand-new event on the given day. */
function nowTime(): string {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function EventFormDialog({
  open,
  event,
  familyId,
  userId,
  defaultDayKey,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null = create. */
  event: CalendarEvent | null;
  familyId: string;
  userId: string;
  /** Local "YYYY-MM-DD" the composer was opened from. */
  defaultDayKey: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(defaultDayKey);
  const [startTime, setStartTime] = useState(nowTime());
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  // Seed the form whenever it opens (new or existing event).
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTitle(event?.title ?? "");
    setAllDay(event?.all_day ?? false);
    setLocation(event?.location ?? "");
    setDescription(event?.description ?? "");

    if (event) {
      if (event.all_day) {
        setStartDate(toInputDate(event.starts_at));
        setStartTime("");
        setEndDate(event.ends_at ? toInputDate(event.ends_at) : "");
        setEndTime("");
      } else {
        const [d, t] = toInputDateTime(event.starts_at).split("T");
        setStartDate(d ?? defaultDayKey);
        setStartTime(t ?? nowTime());
        const [ed, et] = event.ends_at ? toInputDateTime(event.ends_at).split("T") : ["", ""];
        setEndDate(ed ?? "");
        setEndTime(et ?? "");
      }
      return;
    }

    setStartDate(defaultDayKey);
    setStartTime(nowTime());
    setEndDate("");
    setEndTime("");
  }, [open, event, defaultDayKey]);

  function toggleAllDay(next: boolean) {
    setAllDay(next);
    // datetime-local keeps the date when we drop the clock, and vice versa.
    if (!next && !startTime) setStartTime(nowTime());
    if (next) setEndTime("");
  }

  async function onSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();

    const endsAt = allDay
      ? endDate
        ? fromInputDateEnd(endDate)
        : ""
      : endDate
        ? fromInputDateTime(`${endDate}T${endTime || "23:59"}`)
        : "";

    const parsed = (event ? updateEventSchema : createEventSchema).safeParse({
      title,
      description,
      location,
      all_day: allDay,
      starts_at: allDay
        ? fromInputDate(startDate)
        : fromInputDateTime(`${startDate}T${startTime || "12:00"}`),
      ends_at: endsAt,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setPending(true);
    const supabase = createClient();
    const payload = {
      title: parsed.data.title,
      description: parsed.data.description ? parsed.data.description : null,
      location: parsed.data.location ? parsed.data.location : null,
      all_day: parsed.data.all_day,
      starts_at: parsed.data.starts_at,
      ends_at: parsed.data.ends_at ? parsed.data.ends_at : null,
    };

    const { error } = event
      ? await supabase.from("family_events").update(payload).eq("id", event.id)
      : await supabase.from("family_events").insert({
          ...payload,
          family_id: familyId,
          created_by: userId,
        });
    setPending(false);

    if (error) {
      const message = error.message.toLowerCase();
      toast.error(
        message.includes("check") || message.includes("constraint")
          ? "The end time must be after the start time"
          : "Could not save the event",
      );
      return;
    }

    toast.success(event ? "Event updated" : "Event added to the family calendar");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {event
              ? "Everyone in the family sees these changes straight away."
              : "Everyone in the family will be notified about it."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <Field id="event-title" label="What is happening?" error={errors.title}>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Eid lunch, movie night, cousin's birthday…"
              maxLength={120}
              autoComplete="off"
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
            <Label htmlFor="event-all-day" className="text-sm">
              All day
            </Label>
            <Switch id="event-all-day" checked={allDay} onCheckedChange={toggleAllDay} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="event-start-date"
              label={allDay ? "Start date" : "Starts"}
              error={errors.starts_at}
            >
              <div className="flex gap-2">
                <Input
                  id="event-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="min-w-0 flex-1"
                />
                {!allDay ? (
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-[7.5rem] shrink-0"
                    aria-label="Start time"
                  />
                ) : null}
              </div>
            </Field>

            <Field
              id="event-end-date"
              label={allDay ? "End date (optional)" : "Ends (optional)"}
              error={errors.ends_at}
            >
              <div className="flex gap-2">
                <Input
                  id="event-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="min-w-0 flex-1"
                  min={startDate || undefined}
                />
                {!allDay && endDate ? (
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-[7.5rem] shrink-0"
                    aria-label="End time"
                  />
                ) : null}
              </div>
            </Field>
          </div>

          <Field id="event-location" label="Where (optional)" error={errors.location}>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Grandma's house, the park…"
              maxLength={200}
              autoComplete="off"
            />
          </Field>

          <Field id="event-description" label="Details (optional)" error={errors.description}>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should everyone bring?"
              rows={3}
              maxLength={2000}
            />
          </Field>

          <DialogFooter className="gap-2 pt-1 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {event ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
