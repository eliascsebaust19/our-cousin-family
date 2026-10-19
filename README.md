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
| Family calendar (events, RSVPs, realtime) | ✅ Code complete |
| Ludo — server-authoritative engine + UI (4/6/8 players + autoplay) | ✅ Code complete & verified by `npm run db:check` |
| Memory Vault (Google Drive) | ✅ Code complete (Edge Functions + RLS + UI) — needs Google credentials to run |
| Migrations + RLS policies | ✅ 8 migrations verified by `npm run db:check`, ready to apply to live Supabase |
| LiveKit audio/video calls | ✅ Code complete (token Edge Function + lobby + in-room UI) — needs LiveKit Cloud keys to run |
| Automated tests (Vitest + Playwright) | ✅ Complete (132 Vitest unit tests + Playwright smoke suite + GitHub Actions CI) |
| First deployment | ⏳ Ready for live deploy on your Supabase + Vercel accounts (see guides) |

**The app has never yet run against a live backend.** It will not start
meaningfully until you create a Supabase project and apply the migrations —
see [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md). No screen simulates an
integration that isn't configured: Vault and Calls both detect the missing
credentials and say exactly which value is absent instead of pretending.

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
- **Google Drive API** (Memory Vault) — server-side only, via Edge Functions
- **LiveKit** (audio/video calls) — client SDK in the browser, tokens minted
  only by an Edge Function that re-checks membership per room

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
- 📹 **Family calls** — LiveKit audio/video rooms derived from existing rows
  (one per family, one per conversation), with a lobby that shows who is
  already talking; tokens are minted server-side after a membership re-check

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
| `npm run db:check` | Run all migrations against in-process Postgres (PGlite) and assert RLS, grants, triggers and storage authorization |

### Checking the database without Supabase

`npm run db:check` boots **PGlite** (Postgres compiled to WebAssembly) with
minimal Supabase stubs, applies
[`supabase/migrations/`](supabase/migrations) in order, and then exercises the
security model for real: it switches to the `anon` and `authenticated` roles
with a JWT subject, and asserts that cross-family reads and writes are
refused, that mutating RPCs are not reachable by anonymous callers, that
notification triggers fire, and that storage paths are authorized by their
first segment.

It catches SQL syntax errors, migration-ordering mistakes and
`grant ... on function (argtypes)` signatures that don't match the
definitions — so the SQL can be validated without Docker or a cloud project.
The stubs are an approximation of Supabase's platform (see
[`scripts/pglite/supabase-stubs.sql`](scripts/pglite/supabase-stubs.sql));
they are **not** a substitute for testing against a real project before
launch.

## Project structure

```
supabase/migrations/        7 SQL migrations: schema, RLS/RPCs/triggers,
                            storage + realtime, extra RPCs, calendar, ludo,
                            vault
src/
  proxy.ts                  Next 16 middleware: session refresh + route guard
  app/
    page.tsx                Public landing page
    (auth)/                 login, signup, forgot/reset password
    auth/{callback,confirm} Supabase email-link / PKCE exchange routes
    join/, join/[code]      Public invitation preview + join (own layout)
    (app)/                  Authenticated shell: home, create, family/*,
                            chat/*, notifications, profile/*, settings,
                            calendar, ludo, vault, calls/*
    api/drive/content       cookie-auth proxy streaming Vault bytes
                            (media tags cannot send an auth header)
  components/               feature-grouped client components
  lib/                      supabase clients, validation (Zod), queries,
                            uploads, rate-limit, formatting, constants,
                            ludo geometry, EXIF, image downscaling, calls
  types/database.types.ts   hand-written Database types (regenerate with
                            `supabase gen types` once linked)
supabase/
  migrations/               schema + RLS + RPCs (see docs/SETUP-SUPABASE.md)
  functions/vault/          Memory Vault: status, connect, upload, delete
  functions/drive-oauth-callback/  Google OAuth redirect target
  functions/livekit-token/  the only minter of call join tokens
  functions/_shared/        request plumbing, token encryption, OAuth state
                            signing, Drive API, LiveKit token signing
scripts/
  check-migrations.mjs      `npm run db:check` — applies the migrations to
                            in-process Postgres and asserts RLS/grants
  pglite/supabase-stubs.sql minimal Supabase platform stubs used by the check
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
LiveKit keys, game RNG) live in **Supabase Edge Functions** — never
`NEXT_PUBLIC_*` variables. Calls go further: the Edge Function is the only
thing that can mint a LiveKit token, and it mints one only for the single room
whose membership it has just re-checked in Postgres.

See [docs/SECURITY.md](docs/SECURITY.md) for the full model.

## Deployment

Deploy to Vercel after Supabase is set up:
**[docs/SETUP-VERCEL.md](docs/SETUP-VERCEL.md)**.

## Known limitations

- Migrations are verified by `npm run db:check` against in-process Postgres
  (PGlite) with Supabase stubs, but **have not yet been applied to a real
  Supabase project** — expect to fix small environment differences on first
  apply.
- **Memory Vault**: the code is complete, but nothing works until you create a
  Google Cloud project, set four Supabase secrets and deploy the two Edge
  Functions ([docs/SETUP-GOOGLE-DRIVE.md](docs/SETUP-GOOGLE-DRIVE.md)). The
  `/vault` page detects each missing step and says so. Uploads are capped at
  40 MB per file (photos are downscaled in the browser first); video is stored
  and streamed but never transcoded, so playback depends on the codec the phone
  recorded. While the OAuth app is in **Testing** mode Google expires refresh
  tokens after 7 days, so the connection must be re-authorised weekly until the
  app is published.
- **Ludo**: the engine (dice, legality, turn timers, rankings, autoplay) runs entirely in
  Postgres security-definer functions, verified by `npm run db:check`; the UI
  drives it over RPC + Realtime.
- **Calls**: the code is complete and payments-free, but a call cannot start
  until you create a LiveKit Cloud project and deploy the token function
  ([docs/SETUP-LIVEKIT.md](docs/SETUP-LIVEKIT.md)). Rooms are derived from rows
  that already exist, so **calls add no tables**; there is no call log, no
  ringing/"incoming call" screen, and no missed-call record — the lobby shows
  who is in a room *right now*. Video is peer-to-peer through LiveKit's SFU:
  connection quality, bandwidth and TURN fallback are LiveKit's concern, and
  the free tier is metered in minutes.
- Chat voice notes rely on the browser's MediaRecorder (WebM/Opus on most
  browsers; Safari support varies).
- Email delivery (confirm signup, reset password) uses Supabase's default
  email rate limits; configure SMTP in Supabase for production volume.
- Push notifications (web push/mobile) are not implemented — notifications
  are in-app only.
- `src/types/database.types.ts` is hand-written; regenerate it with
  `supabase gen types typescript --linked` after linking the CLI.
- Automated tests: 132 Vitest unit tests (`npm run test`) and Playwright E2E
  smoke tests (`npm run test:e2e`) are configured alongside `npm run db:check`,
  `typecheck`, `lint` and `build`.

## Milestones

1. **M1 — done.** Core app: scaffold, schema + RLS, auth, families, feed, chat,
   notifications, docs.
2. **M2 — done.** ✅ Family calendar, ✅ Ludo (server-authoritative engine + UI
   for 4/6/8 players), ✅ Memory Vault (Drive Edge Functions, RLS, UI),
   ✅ LiveKit audio/video calls (token Edge Function, lobby, in-room UI).
3. **M3 — in progress / mostly complete.** ✅ Ludo autoplay RPC, ✅ Vitest unit
   test suite (132 tests), ✅ Playwright E2E smoke suite, ✅ GitHub Actions CI,
   ⏳ Live cloud accounts provisioning & first deploy.
