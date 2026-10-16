import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Dices,
  MessageCircle,
  Newspaper,
  ShieldCheck,
  Users,
  Vault,
  Video,
} from "lucide-react";
import { LogoMark } from "@/components/logo";

const FEATURES = [
  {
    icon: Newspaper,
    title: "Family Feed",
    text: "Share photos, moments and announcements — react, comment and reminisce together.",
    tone: "bg-primary/10 text-primary",
  },
  {
    icon: Vault,
    title: "Memory Vault",
    text: "A private archive of family photos, videos and documents, organised in albums.",
    tone: "bg-brand-warm/15 text-brand-warm",
  },
  {
    icon: MessageCircle,
    title: "Real-time Chat",
    text: "Private and group chats with voice notes, read receipts and typing indicators.",
    tone: "bg-brand-navy/10 text-brand-navy dark:text-brand-navy",
  },
  {
    icon: Video,
    title: "Family Calls",
    text: "Crystal-clear audio and video calls, one-to-one or with the whole group.",
    tone: "bg-primary/10 text-primary",
  },
  {
    icon: Dices,
    title: "Multiplayer Ludo",
    text: "Play 4, 6 or 8 player Ludo online with fair, server-run turns and rematches.",
    tone: "bg-brand-amber/20 text-brand-warm",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Create your family",
    text: "Set up a private space and get a secure invitation code.",
  },
  {
    n: "2",
    title: "Invite your cousins",
    text: "Share the code or link — you can approve members before they join.",
  },
  {
    n: "3",
    title: "Share & play",
    text: "Post memories, chat, call and play Ludo — wherever everyone is.",
  },
];

const COLLAGE = [
  { label: "Throwback Sunday", emoji: "📸", from: "from-primary/25", to: "to-brand-amber/25", rotate: "-rotate-2" },
  { label: "Summer trip", emoji: "✈️", from: "from-brand-warm/25", to: "to-primary/20", rotate: "rotate-2" },
  { label: "Eid gathering", emoji: "🌙", from: "from-brand-navy/20", to: "to-primary/25", rotate: "-rotate-1" },
  { label: "Birthday bash", emoji: "🎂", from: "from-brand-amber/30", to: "to-brand-warm/20", rotate: "rotate-3" },
];

const btnPrimary =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98]";
const btnOutline =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-7 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent active:scale-[0.98]";

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Warm ambient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-primary/10 via-brand-amber/10 to-transparent"
      />

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight text-brand-navy dark:text-foreground">
            Our Cousin Family
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <Link
            href="/login"
            className="touch-target inline-flex items-center rounded-full px-4 text-sm font-semibold text-foreground/80 transition hover:text-primary"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        {/* ---------------- Hero ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-8 text-center sm:px-6 sm:pt-14">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
            Private & invite-only
          </span>

          <h1 className="mx-auto mt-5 max-w-2xl font-display text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-brand-navy sm:text-5xl dark:text-foreground">
            Every cousin, one warm corner of the internet
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Share everyday moments, keep family memories safe, talk face to
            face and play Ludo together — a private space made only for your
            family.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className={btnPrimary}>
              <Users className="h-4 w-4" aria-hidden />
              Create a Family
            </Link>
            <Link href="/join" className={btnOutline}>
              Join a Family
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center px-3 text-sm font-semibold text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>

          {/* Memory collage — styled placeholders, no fake photos */}
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:gap-4">
            {COLLAGE.map((c) => (
              <figure
                key={c.label}
                className={`rounded-2xl border border-border/70 bg-gradient-to-br ${c.from} ${c.to} p-4 text-left shadow-sm sm:p-5 ${c.rotate}`}
              >
                <span aria-hidden className="text-2xl sm:text-3xl">
                  {c.emoji}
                </span>
                <figcaption className="mt-6 text-xs font-semibold text-foreground/80 sm:text-sm">
                  {c.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-center font-display text-2xl font-semibold text-brand-navy dark:text-foreground">
            Everything your family needs
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
              >
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${f.tone}`}
                >
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.text}
                </p>
              </article>
            ))}
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-semibold">Stay in the loop</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Notifications for comments, reactions, invites, announcements
                and upcoming family events.
              </p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md sm:col-span-2 lg:col-span-3">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">Birthdays & family timeline</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    Never miss a birthday, anniversary or reunion — with a
                    shared calendar and a timeline of your family&apos;s
                    milestones.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
            <h2 className="text-center font-display text-2xl font-semibold text-brand-navy dark:text-foreground">
              Up and running in minutes
            </h2>
            <ol className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="text-center sm:text-left">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup" className={`${btnPrimary} w-full sm:w-auto`}>
                Start your family
              </Link>
              <Link href="/join" className={`${btnOutline} w-full sm:w-auto`}>
                I have an invite code
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------- Privacy strip ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center sm:flex-row sm:text-left">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-foreground/80">
              <strong className="font-semibold">Yours alone.</strong> Families
              are private by default, joined only with an invitation code, with
              optional member approval and role-based permissions. No strangers,
              no public profiles, no noise.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LogoMark />
            <span>Our Cousin Family</span>
          </div>
          <p className="text-xs text-muted-foreground">
            A private place for family memories, conversations and fun.
          </p>
        </div>
      </footer>
    </div>
  );
}
