import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <ComingSoon
      title="Family Calendar"
      summary="Birthdays from everyone's profile, plus family events and reminders in one shared month view. Built in the next milestone — birthdays already show on profiles today."
      requires={[
        "No external accounts needed — runs entirely on Supabase",
        "The events table + calendar UI from the next milestone",
      ]}
      dependsOn="Coming in Milestone 2 of the build plan."
    />
  );
}
