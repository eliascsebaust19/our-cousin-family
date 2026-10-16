# Our Cousin Family

A private, mobile-first web app for extended families: a shared feed, family
chat, notifications, and — as later milestones land — a Google Drive–backed
Memory Vault, LiveKit audio/video calls, a server-authoritative multiplayer
Ludo, and a family calendar.

Built with Next.js (App Router) + TypeScript, Tailwind CSS + shadcn/ui, and
Supabase (Postgres, Auth, Realtime, Storage, Edge Functions).

---

## Honest project status (read this first)

This repository is under active construction against a **10-phase plan**.
Nothing is claimed to be "live" until it has been verified against real
credentials and a real backend.

| Area | State |
| --- | --- |
| Scaffold, design system, routing, auth UI, app shell | ✅ Code complete |
| Family create / join / members / invitations / settings | ✅ Code complete |
| Feed (posts, media, reactions, comments, bookmarks, pinning) | ✅ Code complete |
| Chat (direct + group, text, photos, voice notes, typing, edit/delete) | ✅ Code complete |
| Notifications, profile, settings, themes | ✅ Code complete |
| Migrations + RLS policies | ✅ Written, **not yet applied** (no Supabase project exists) |
| Memory Vault (Google Drive) | 🚧 Placeholder page — needs a Google Cloud project (Phase 5) |
| LiveKit calls | 🚧 Placeholder page — needs LiveKit Cloud keys (Phase 6) |
| Ludo (4/6/8 players) | 🚧 Placeholder page — engine ships in Phase 4 |
| Family calendar | 🚧 Placeholder page — ships in Phase 4 |
| Automated tests (Vitest + Playwright) | ⏳ Planned for Phase 9 |
| First deployment | ⏳ Blocked on your Supabase + Vercel accounts (see guides) |

**The app has never yet run against a live backend.** It will not start
meaningfully until you create a Supabase project and apply the migrations —
see [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md). The placeholder pages
are deliberate: this project never simulates an integration that isn't
configured.

---

## Tech stack

- **Next.js 16** (App Router, Turbopack, `proxy.ts` for auth routing) +
  TypeScript, React 19
- **Tailwind CSS v4** with CSS-first design tokens (warm cream light theme +
  dark theme, safe-area and touch-target utilities)
- **shadcn/ui** (23 components) + Lucide icons + Sonner toasts
- **Supabase**: Postgres with Row Level Security everywhere, Auth (email
  links + Google OAuth), Realtime (postgres_changes + broadcast + presence),
  private Storage buckets, Edge Functions (all secrets live server-side)
- **Motion** — used sparingly for list/dialog entrances
- Later phases: **Google Drive API** (Memory Vault), **LiveKit** (calls)

## Features

- 🏠 **Family feed** — posts with photos/videos, moment badges (birthday,
  trip, throwback…), six emoji reactions, threaded comments with replies,
  bookmarks, pin-to-top for moderators, share-to-family, admins-only posts
- 👨‍👩‍👧 **Families** — create a family, share invite codes/links (expiry,
  max-uses, roles), approval queue, roles (owner/admin/moderator/member),
  member management, family rules, family photo
- 💬 **Realtime chat** — direct and group chats, text, photos, voice notes,
  replies, edit/delete, typing indicators, unread badges, read receipts via
  per-conversation last-read
- 🔔 **Notifications** — comments, reactions, replies, invites, approvals;
  trigger-generated in Postgres, realtime-delivered, badge counts in the nav
- 🔐 **Security** — RLS on every table, server-side authorization via
  security-definer RPCs, Zod validation on every write path, rate limiting on
  sensitive endpoints, no client-side secrets
- 📱 **Mobile-first** — 320–430 px design, sticky bottom navigation with
  44 px touch targets, safe-area insets, light + dark themes

## Getting started

### Prerequisites

- Node.js 20.9+ (developed on Node 24)
- A free [Supabase](https://supabase.com) account (required to run the app)

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
your Supabase project's **Project Settings → API**. The other variables are
only needed for later phases.

### 3. Create the database

Follow **[docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md)** — it walks
through creating the project, applying the four migrations in
[`supabase/migrations/`](supabase/migrations), configuring auth email
templates, and enabling Google as a sign-in provider.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000, sign up, create a family, and invite a second
account to see realtime features (feed, chat, notifications) in action.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |

## Project structure

```
supabase/migrations/        4 SQL migrations: schema, RLS/RPCs/triggers,
                            storage + realtime, extra RPCs
src/
  proxy.ts                  Next 16 middleware: session refresh + route guard
  app/
    page.tsx                Public landing page
    (auth)/                 login, signup, forgot/reset password
    auth/{callback,confirm} Supabase email-link / PKCE exchange routes
    join/, join/[code]      Public invitation preview + join (own layout)
    (app)/                  Authenticated shell: home, create, family/*,
                            chat/*, notifications, profile/*, settings,
                            vault/ludo/calls/calendar (honest placeholders)
  components/               feature-grouped client components
  lib/                      supabase clients, validation (Zod), queries,
                            uploads, rate-limit, formatting, constants
  types/database.types.ts   hand-written Database types (regenerate with
                            `supabase gen types` once linked)
docs/                       setup guides + SECURITY.md
```

## Architecture in one paragraph

The browser reads and writes through the **RLS-scoped anon client** — every
table is protected by policies, so the database is the security boundary.
Server components and route handlers use the **server client** for auth
guards and SSR. Cross-row mutations (join a family by code, approve a member,
start a conversation…) go through **security-definer RPCs** that re-check
authorization in Postgres. Notifications are generated by **triggers**, not
by the client. Storage buckets are private; images render through short-lived
signed URLs resolved in the client. All secrets (Google refresh tokens,
LiveKit keys, game RNG) are destined for **Supabase Edge Functions** — never
`NEXT_PUBLIC_*` variables.

See [docs/SECURITY.md](docs/SECURITY.md) for the full model.

## Deployment

Deploy to Vercel after Supabase is set up:
**[docs/SETUP-VERCEL.md](docs/SETUP-VERCEL.md)**.

## Known limitations

- Migrations are written and reviewed but **have not been applied to a real
  database yet**; expect to fix small issues on first apply.
- Memory Vault, Ludo, Calls, and Calendar are placeholder pages that state
  exactly what they need — they do nothing fake.
- Chat voice notes rely on the browser's MediaRecorder (WebM/Opus on most
  browsers; Safari support varies).
- Email delivery (confirm signup, reset password) uses Supabase's default
  email rate limits; configure SMTP in Supabase for production volume.
- Push notifications (web push/mobile) are not implemented — notifications
  are in-app only.
- `src/types/database.types.ts` is hand-written; regenerate it with
  `supabase gen types typescript --linked` after linking the CLI.
- Automated tests are planned for Phase 9 of the build plan.

## Milestones

1. **M1 (current)** — core app: scaffold, schema + RLS, auth, families,
   feed, chat, notifications, docs, first deploy.
2. **M2** — Memory Vault (Google Drive), LiveKit calls, Ludo (rules doc
   first, then a server-authoritative engine), calendar.
3. **M3** — polish, Vitest + Playwright coverage, security audit, final
   deploy.
