"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  PlusSquare,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useFamily } from "@/components/app/family-provider";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  center?: boolean;
  badge?: "messages";
};

const NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/family", label: "Family", icon: Users },
  { href: "/create", label: "Create", icon: PlusSquare, center: true },
  { href: "/chat", label: "Chat", icon: MessageCircle, badge: "messages" },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const { unreadMessages } = useFamily();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 pb-safe">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const badgeCount =
            item.badge === "messages" ? unreadMessages : 0;

          if (item.center) {
            return (
              <li key={item.href} className="flex flex-1 justify-center">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className="-mt-5 flex h-14 w-14 touch-target items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95"
                >
                  <item.icon className="h-6 w-6" aria-hidden />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium transition ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <item.icon
                    className={`h-5 w-5 ${active ? "stroke-[2.4]" : ""}`}
                    aria-hidden
                  />
                  {badgeCount > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-warm px-1 text-[10px] font-bold leading-none text-white">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
