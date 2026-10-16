"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CALENDAR_SELECT, channels } from "@/lib/queries";
import {
  addMonths,
  dayHeading,
  eventDateKey,
  formatEventTime,
  fromDateKey,
  isSameMonth,
  localDateKey,
  monthLabel,
  monthMatrix,
  startOfMonth,
  todayKey,
  WEEKDAY_LABELS,
} from "@/lib/datetime";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EventDetailsDialog } from "./event-details-dialog";
import { EventFormDialog } from "./event-form-dialog";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/types";

/** How many months either side of the visible one are fetched up front. */
const WINDOW_MONTHS = 3;

export function CalendarView() {
  const { userId, activeFamily, roleInActiveFamily } = useFamily();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedKey, setSelectedKey] = useState(() => todayKey());
  const [formOpen, setFormOpen] = useState<{ open: boolean; event: CalendarEvent | null }>({
    open: false,
    event: null,
  });
  const [detailsId, setDetailsId] = useState<string | null>(null);

  // ---- data ----------------------------------------------------------------
  const familyId = activeFamily?.id ?? null;

  const load = useCallback(async () => {
    if (!familyId) {
      setEvents([]);
      return;
    }
    const supabase = createClient();
    const from = startOfMonth(addMonths(visibleMonth, -WINDOW_MONTHS));
    const to = startOfMonth(addMonths(visibleMonth, WINDOW_MONTHS + 1));

    const { data, error } = await supabase
      .from("family_events")
      .select(CALENDAR_SELECT)
      .eq("family_id", familyId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at", { ascending: true })
      .limit(400);

    if (error) {
      toast.error("Could not load the family calendar");
      return;
    }
    setEvents((data ?? []) as unknown as CalendarEvent[]);
  }, [familyId, visibleMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: another family member's event, edit, or RSVP refreshes the list.
  useEffect(() => {
    if (!familyId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 600);
    };

    const channel = supabase
      .channel(channels.calendar(familyId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_events", filter: `family_id=eq.${familyId}` },
        reload,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, reload)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [familyId, load]);

  // Deep link from a notification: /calendar?event=<id> opens that event once.
  const deepLinkParam = searchParams.get("event");
  const openedDeepLink = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkParam || openedDeepLink.current === deepLinkParam || !events) return;
    if (events.some((event) => event.id === deepLinkParam)) {
      openedDeepLink.current = deepLinkParam;
      setDetailsId(deepLinkParam);
    }
  }, [deepLinkParam, events]);

  // ---- derived -------------------------------------------------------------
  const weeks = useMemo(() => monthMatrix(visibleMonth), [visibleMonth]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events ?? []) {
      const key = eventDateKey(event);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          Number(b.all_day) - Number(a.all_day) ||
          a.starts_at.localeCompare(b.starts_at),
      );
    }
    return map;
  }, [events]);

  const dayEvents = byDay.get(selectedKey) ?? [];

  const alsoUpcoming = useMemo(() => {
    const today = todayKey();
    return (events ?? [])
      .filter((event) => {
        const key = eventDateKey(event);
        return key > selectedKey && key >= today;
      })
      .slice(0, 6);
  }, [events, selectedKey]);

  const detailsEvent =
    detailsId && events ? events.find((event) => event.id === detailsId) ?? null : null;

  const detailsEventCanManage =
    detailsEvent !== null &&
    (detailsEvent.created_by === userId ||
      roleInActiveFamily === "owner" ||
      roleInActiveFamily === "admin");

  // ---- navigation ----------------------------------------------------------
  function goToMonth(delta: number) {
    const next = addMonths(visibleMonth, delta);
    setVisibleMonth(next);
    if (!isSameMonth(fromDateKey(selectedKey), next)) {
      setSelectedKey(localDateKey(next));
    }
  }

  function goToToday() {
    setVisibleMonth(startOfMonth(new Date()));
    setSelectedKey(todayKey());
  }

  function selectDay(key: string) {
    setSelectedKey(key);
    const day = fromDateKey(key);
    if (!isSameMonth(day, visibleMonth)) setVisibleMonth(startOfMonth(day));
  }

  // ---- guards --------------------------------------------------------------
  if (!activeFamily) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">Calendar</h1>
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
          <h2 className="mt-2 font-display text-lg font-semibold">
            No family selected
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Join or create a family to see the shared calendar.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/create-family">Create a family</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/join">Join with a code</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (events === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-semibold">Calendar</h1>
        <Button
          size="sm"
          className="h-10 rounded-full"
          onClick={() => setFormOpen({ open: true, event: null })}
        >
          <Plus aria-hidden />
          Add event
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => goToMonth(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2 className="min-w-0 truncate font-display text-base font-semibold">
            {monthLabel(visibleMonth)}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => goToMonth(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Month grid */}
      <div className="rounded-2xl border border-border bg-card p-2">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="py-1 text-center text-[11px] font-medium text-muted-foreground"
              aria-hidden
            >
              {label}
            </div>
          ))}

          {weeks.flat().map((key) => {
            const count = byDay.get(key)?.length ?? 0;
            const dayNumber = Number(key.slice(8));
            const isToday = key === todayKey();
            const isSelected = key === selectedKey;
            const outside = !isSameMonth(fromDateKey(key), visibleMonth);

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(key)}
                aria-current={isSelected ? "date" : undefined}
                aria-label={`${localDateKey(fromDateKey(key))}${count ? `, ${count} event${count === 1 ? "" : "s"}` : ""}`}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-start rounded-xl border py-1.5 text-sm transition",
                  outside ? "text-muted-foreground/50" : "text-foreground",
                  isToday && !isSelected ? "border-primary/50 font-semibold" : "border-transparent",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-accent focus-visible:bg-accent",
                )}
              >
                <span className="leading-none">{dayNumber}</span>
                <span className="mt-1 flex h-1.5 items-center gap-0.5">
                  {count > 0
                    ? Array.from({ length: Math.min(count, 3) }).map((_, dot) => (
                        <span
                          key={dot}
                          className={cn(
                            "size-1 rounded-full",
                            isSelected ? "bg-primary-foreground" : "bg-primary",
                          )}
                        />
                      ))
                    : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <section aria-labelledby="selected-day" className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="selected-day" className="font-display text-base font-semibold">
            {dayHeading(selectedKey)}
          </h2>
          {dayEvents.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center">
            <p className="text-sm text-muted-foreground">Nothing planned for this day.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setFormOpen({ open: true, event: null })}
            >
              <Plus aria-hidden />
              Add something
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {dayEvents.map((event) => {
              const mine = event.rsvps.find((rsvp) => rsvp.user_id === userId);
              const going = event.rsvps.filter((rsvp) => rsvp.response === "going").length;
              const eventDay = fromDateKey(eventDateKey(event));

              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setDetailsId(event.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/30"
                  >
                    <span
                      className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary"
                      aria-hidden
                    >
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        {eventDay.toLocaleDateString(undefined, { month: "short", timeZone: event.all_day ? "UTC" : undefined })}
                      </span>
                      <span className="text-sm font-bold leading-tight">
                        {eventDay.getUTCDate()}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{event.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {formatEventTime(event)}
                        {event.location ? ` · ${event.location}` : ""}
                      </span>
                    </span>
                    {mine ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          mine.response === "going"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {mine.response === "going" ? "You're going" : mine.response}
                      </span>
                    ) : going > 0 ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {going} going
                      </span>
                    ) : null}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {alsoUpcoming.length > 0 ? (
        <section aria-labelledby="also-upcoming" className="space-y-2">
          <h2 id="also-upcoming" className="font-display text-base font-semibold">
            Also upcoming
          </h2>
          <ul className="space-y-2">
            {alsoUpcoming.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setDetailsId(event.id)}
                  className="flex w-full items-between gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{event.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {dayHeading(eventDateKey(event))} · {formatEventTime(event)}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EventFormDialog
        open={formOpen.open}
        event={formOpen.event}
        familyId={activeFamily.id}
        userId={userId}
        defaultDayKey={selectedKey}
        onOpenChange={(open) => setFormOpen((current) => ({ ...current, open }))}
        onSaved={() => void load()}
      />

      {detailsEvent ? (
        <EventDetailsDialog
          event={detailsEvent}
          open={detailsId !== null}
          userId={userId}
          canManage={detailsEventCanManage}
          onOpenChange={(open) => {
            if (!open) setDetailsId(null);
          }}
          onEdit={() => {
            setFormOpen({ open: true, event: detailsEvent });
            setDetailsId(null);
          }}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}
