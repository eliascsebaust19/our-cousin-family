"use client";

import Link from "next/link";
import {
  CalendarDays,
  Coins,
  Compass,
  Download,
  Network,
  Volume2,
} from "lucide-react";
import { usePwaInstall } from "@/components/pwa/pwa-install-prompt";

const QUICK_ACTIONS = [
  {
    href: "/tree",
    label: "Family Tree",
    icon: Network,
    badge: "Lineage",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    badge: "Events",
  },
  {
    href: "/voice-memories",
    label: "Voice Stories",
    icon: Volume2,
    badge: "Audio",
  },
  {
    href: "/reunions",
    label: "Reunions",
    icon: Compass,
    badge: "Trips",
  },
  {
    href: "/fund",
    label: "Family Fund",
    icon: Coins,
    badge: "Ledger",
  },
];

export function QuickFeaturesBar() {
  const { isInstalled, promptInstall } = usePwaInstall();

  return (
    <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 py-1 sm:mx-0 sm:px-0">
      {!isInstalled && (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="group flex shrink-0 items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2 shadow-xs transition hover:bg-primary/20 active:scale-98"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground transition group-hover:scale-105">
            <Download className="h-4 w-4" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-primary leading-tight">
              Install App
            </span>
            <span className="block text-[10px] text-muted-foreground leading-tight">
              Add to phone
            </span>
          </div>
        </button>
      )}
      {QUICK_ACTIONS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex shrink-0 items-center gap-2 rounded-2xl border border-border/80 bg-card px-3 py-2 shadow-xs transition hover:border-primary/50 hover:bg-muted/40 active:scale-98"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
            <item.icon className="h-4 w-4" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-foreground leading-tight group-hover:text-primary transition">
              {item.label}
            </span>
            <span className="block text-[10px] text-muted-foreground leading-tight">
              {item.badge}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

