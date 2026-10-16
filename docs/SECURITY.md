# Security model

This document describes how **Our Cousin Family** protects family data, what
is enforced where, and — honestly — what is not yet covered.

The guiding rule: **the database is the security boundary.** The browser is
never trusted, the anon key is public by design, and any authorization
decision that matters is re-checked in Postgres.

---

## 1. Layers

| Layer | Enforces | Trust level |
| --- | --- | --- |
| `src/proxy.ts` (Next 16 proxy) | Refreshes the Supabase session cookie on every request; redirects signed-out users away from app routes and signed-in users away from auth pages | **Coarse only** — convenience, not security |
| Server components / route handlers | Reads the session, fetches the caller's profile + memberships, guards the `(app)` shell | Server-trusted, but still RLS-scoped |
| Browser Supabase client (anon key) | All reads/writes go through **Postgres RLS** | Untrusted client; RLS is authoritative |
| `security definer` RPCs | Cross-row operations (join a family, approve a member, start a conversation) that re-check the caller's role *inside* Postgres | Authoritative |
| Postgres triggers | Notification creation, `updated_at`, conversation activity, profile creation on signup | Authoritative, never client-driven |
| Storage policies | Who may read/write each object in each private bucket | Authoritative |
| Supabase Edge Functions | All third-party secrets: Google refresh tokens, Drive access, LiveKit API key/secret | Authoritative, server-only |

The proxy is a *routing* concern. If it were removed entirely, RLS would still
prevent any family from reading another family's data.

## 2. Row Level Security

RLS is **enabled on all 22 tables** and no table has a permissive `using
(true)` policy. The core policies live in
[`20261016020000_authz_rls.sql`](../supabase/migrations/20261016020000_authz_rls.sql);
the calendar, Ludo and Vault tables add their own in
`20261016050000_family_calendar.sql`, `20261016060000_ludo.sql` and
`20261016070000_vault.sql`.

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | Own row + profiles of people you share a family with | Own row only |
| `families` | Active members | Owner: delete; owner/admin: update |
| `family_members` | Members of the same family | Only via RPCs (`set_member_status`, `set_member_role`, `remove_member`) |
| `family_invitations` | Admins only | Created/revoked via RPCs (`create_invitation`, `revoke_invitation`) |
| `posts` / `post_media` / `comments` | Active members of the post's family | Author, or moderators/admins for moderation |
| `post_reactions` / `post_bookmarks` | Members (reactions) / own (bookmarks) | Own rows only |
| `conversations` / `conversation_members` | Conversation members | Membership changes via RPCs; members may update their own row |
| `messages` / `message_attachments` | Conversation members | Sender may edit; sender or family admin may delete |
| `notifications` | Own rows | Own rows (read/delete); inserts come from triggers |
| `family_events` / `event_rsvps` | Family members | Creator or family admin; RSVPs are own-row only |
| `ludo_games` / `ludo_seats` / `ludo_actions` | Family members (**select only**) | No client write path at all — every mutation goes through `ludo_*` security-definer RPCs, so the dice and the legality checks stay server-side |
| `vault_items` | Family members | `select` plus `update` on `is_favorite` and `caption` **only** (column-level grants); rows are created and deleted by the Vault Edge Function |
| `vault_item_people` | Family members | Members of the item's family may tag/untag |
| `vault_connections` | **Nobody** — RLS on, no policy, `revoke all` | The OAuth callback (service role) only |

**Helper functions** (`is_family_member`, `family_role`, `shares_family_with`,
`is_conversation_member`, `ludo_game_family_id`, `vault_item_family_id`, …) are
`stable`, `security definer`, and pinned with `set search_path` to avoid
search-path hijacking. They are the only functions granted to
`anon`/`authenticated` besides the RPC entry points.

**Function grants** are locked down explicitly. Postgres grants `EXECUTE` on
new functions to the `PUBLIC` pseudo-role, which every role inherits — so
revoking from `anon` alone is *not* enough to keep signed-out callers out of
the API. The migrations revoke `EXECUTE` from `PUBLIC` (and from `anon` /
`authenticated`) before re-granting only the intended entry points, and
trigger functions are deliberately left ungranted. `npm run db:check` asserts
this: anonymous callers can reach `preview_invitation` and nothing else.

**Membership requires `status = 'active'.`** Pending or rejected users hold a
row but fail every family check, so a pending invitee cannot read posts, media
or chat until an admin approves them.

## 3. Authentication

- **Email magic links / confirmation** via Supabase Auth. Links land on
  `/auth/confirm` (`token_hash` + `type`, validated against an allow-list) or
  `/auth/callback` (PKCE `code` exchange). Both routes are supported.
- **Google sign-in** (optional) uses Supabase's OAuth provider; the redirect
  allow-list lives in the Supabase dashboard, not in code.
- **Open-redirect protection:** every `next` parameter passes through
  `safeNextPath()` (`src/lib/safe-next.ts`), which only accepts same-origin
  relative paths.
- **Session handling** uses `@supabase/ssr` cookie storage; tokens are
  refreshed by `proxy.ts` and never placed in `localStorage`.
- **Rate limiting** (`src/lib/rate-limit.ts`) throttles the unauthenticated
  `/auth/confirm` (20/min/IP) and `/auth/callback` (30/min/IP) endpoints and
  returns a friendly message on `/login`.

## 4. Input validation

Every client-initiated write is validated with **Zod** before it reaches
Postgres (`src/lib/validation.ts`), covering profile updates, family
creation, invitations, posts, comments, messages and settings. Validation is
a UX and data-integrity gate — the same constraints are duplicated as
`check` constraints and `not null`s in the schema, so a malicious client that
skips Zod (or calls PostgREST directly) still cannot store invalid data.

RPC arguments are typed and validated again in PL/pgSQL (role checks, target
membership checks, invite expiry/max-uses). Codes are generated with
`gen_random_bytes`-backed helpers, not `Math.random()`.

## 5. Storage

Three **private** buckets — `avatars`, `post-media`, `chat-attachments` — with
policies keyed on the object path:

```
avatars:          {user_id}/{file}
post-media:       {family_id}/{post_id}/{file}      (family images: {family_id}/family/{file})
chat-attachments: {conversation_id}/{file}
```

Because the **first path segment is the authorization key**, policies verify
that the caller is a member of that family (or conversation) before granting
read, and that they own the leading id before granting write. Files are never
public: the client renders them through **short-lived signed URLs** resolved at
render time (`resolveAvatarUrl` / `resolveMediaUrl`), so a leaked URL expires.

## 6. Secrets

- The **anon key** is public by design — it is useless without RLS.
- The **service-role key is not used in the Next.js app at all.** It exists only
  inside the Vault Edge Functions, where the platform injects it, and is never
  sent to a client.
- Google client ID/secret, `GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY` and `SITE_URL`
  are **Supabase Edge Function secrets** (`supabase secrets set`), not Vercel
  environment variables. `.env.example` lists them for reference only.
- LiveKit's key/secret follow the same pattern: they are Supabase Edge Function
  secrets. Only `NEXT_PUBLIC_LIVEKIT_URL` — an address, not a credential —
  reaches the browser.
- `.env.example` contains placeholders only; `.env.local` is git-ignored.
- No secret is ever prefixed with `NEXT_PUBLIC_`.

### The Vault specifically

Third-party credentials are the highest-value target in this app, so the Vault
is built to keep them off every client:

| Control | What it prevents |
| --- | --- |
| `vault_connections` has RLS enabled and **no policy for any client role**, plus `revoke all` on the table | Even a family owner cannot read the stored refresh token through PostgREST — the column is unreachable by design |
| The refresh token is encrypted with **AES-256-GCM**; the key is derived from `GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY` through HKDF with a purpose label | A database leak alone does not yield a usable Drive token |
| The OAuth `state` parameter is **HMAC-SHA256 signed** and expires after 15 minutes | Forging a callback that points another family's Vault at the attacker's Drive account |
| The callback re-checks `family_members` after verifying the signature | A user who was an admin when the flow started but was removed mid-flow |
| `vault_items` grants clients `select` plus `update` on **two columns only** (`is_favorite`, `caption`) | Rewriting `drive_file_id`, `family_id`, `added_by` or `upload_state` from the browser |
| Uploads and deletes run in the Edge Function with explicit membership checks; delete is limited to the uploader or a family admin | A member of another family — or an unrelated member deleting someone else's memory |
| `/api/drive/content` reads the Supabase session cookie server-side and forwards it as a bearer token; responses are `cache-control: private` | A shared cache serving one family's photo to another user |
| The Drive scope is `drive.file` only | The app can never see the user's unrelated Drive files |

### Calls specifically

A call token is a bearer credential for a room, so the only question that
matters is *who can obtain one*. That decision lives in one Edge Function
(`supabase/functions/livekit-token/`) and nowhere else.

| Control | What it prevents |
| --- | --- |
| No migration: rooms are derived from `family_id` / `conversation_id`, so the room's identity **is** the row that already has RLS on it | A parallel table of "call permissions" that could drift from family membership |
| The function verifies the caller's Supabase JWT itself (`requireUser`), then re-checks `family_members` (family rooms) or `conversation_members` (DM rooms) in the database | A valid login being mistaken for permission to join any room; a removed member rejoining |
| The room name must match `family:<uuid>` / `dm:<uuid>` with a validated UUID before any database query runs | Crafted room names reaching a query or LiveKit |
| The signed token's `video` grant names **exactly one room** (`room`, `roomJoin`, `canPublish`) and is useless elsewhere | Pivoting a token from one family's room to another |
| Tokens expire in 1 hour and are signed with `LIVEKIT_API_SECRET`, which never leaves the server | A long-lived credential leaking out of the browser |
| The lobby's participant list is produced server-side (`?action=participants`) using a 60-second `roomAdmin` token minted in the function | The client deciding, or displaying, who is in a room it may not see |
| `canPublish` is granted by the server per request; the browser can never widen it | A viewer injecting audio/video into a room |
| `.env.example` lists `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` for reference only; both are set with `supabase secrets set` and are absent from the app's environment | Accidental bundling into the client |

The browser holds only a per-user, per-room, one-hour token. There is no
long-lived call credential and no call record to leak.

## 7. Realtime

Realtime `postgres_changes` subscriptions are subject to the same RLS
policies — a client only receives rows it is allowed to `select`. Chat
**typing indicators** use ephemeral broadcast channels scoped to the
conversation; presence is private per family. No table row is broadcast that
RLS would hide from the subscriber.

`ludo_games`, `ludo_seats`, `ludo_actions`, `family_events`, `event_rsvps` and
`vault_items` are added to the publication for the same reason: they are
select-only for clients, so broadcasting a change can only ever reveal a row
the subscriber could already read with a `select`.

Calls use no Postgres realtime at all. LiveKit is the presence source, and the
lobby reads it through the Edge Function, so there is no client-subscribable
channel that could leak who is in a room to a non-member.

## 8. Known gaps and limitations

Being explicit about what is **not** yet done:

1. **Rate limiting is per-instance.** `src/lib/rate-limit.ts` is an in-memory
   sliding window. On serverless it bounds bursts per instance but is not a
   global limit; a shared store (Upstash/Redis) is a drop-in replacement.
2. **`preview_invitation` has no database-level throttle.** It is callable by
   `anon` so logged-out visitors can see a family name before signing up.
   Invite codes are ≥8 characters from a 36-character alphabet (~2.8×10¹²
   combinations), which makes guessing impractical, and the preview reveals
   only the family name/cover — never content. Postgres-side attempt
   throttling is a planned hardening (tracked for M3).
3. **No 2FA / MFA.** Supabase supports TOTP; it is not enabled in the UI yet.
4. **No automated security tests in CI yet.** Vitest + Playwright coverage
   (unit + end-to-end against a live project) is planned for M3. The RLS and
   RPC authorization model *is* currently exercised by
   `npm run db:check`, which applies the migrations to in-process Postgres
   (PGlite) and then asserts, acting as the real `anon`/`authenticated` roles,
   that cross-family reads and writes are refused, that mutating RPCs are
   unreachable by anonymous callers, that notification triggers fire, and that
   storage paths are authorized by their first segment. What it is **not** is
   a test against Supabase's actual platform.
5. **Migrations are unapplied against real Supabase.** They pass
   `npm run db:check`, but the stubs in
   [`scripts/pglite/supabase-stubs.sql`](../scripts/pglite/supabase-stubs.sql)
   approximate Supabase's `auth`/`storage` schemas and default grants.
   Re-verify after applying them to a real project.
6. **Hand-written database types.** `src/types/database.types.ts` is manual
   and can drift from the schema. Regenerate with
   `supabase gen types typescript --linked` once the CLI is linked.
7. **No moderation/audit trail for deletions.** Deletes are hard deletes;
   there is no tombstone or admin audit log.
8. **Email is limited by Supabase's default rate limits** until custom SMTP
   is configured; this is a deliverability (not confidentiality) concern.
9. **The Vault, the Ludo engine and the calls function are untested against the
   real platform.** The Ludo rules are pure SQL exercised by `npm run db:check`;
   the Vault's and LiveKit's Edge Functions cannot be executed locally at all
   (no Deno runtime here), so they have been reviewed by hand but never run.
   They are the most likely place for a first-deploy bug. Deploy `vault`,
   `drive-oauth-callback` and `livekit-token` to a scratch project and walk each
   flow once before inviting family members.
10. **Vault uploads are not virus-scanned and not size-enforced per family.**
    The only limit is 40 MB per file, enforced in the Edge Function. A family
    member can fill the connected Drive account's quota.
11. **The Vault shares one Google account per family.** Anyone who can read
    `vault_connections` in the Supabase dashboard (i.e. the project owner) can
    decrypt the refresh token with the encryption key. This is a single-tenant
    design choice, not an oversight, but it is worth stating.
12. **Membership is checked only when a token is minted.** If a member is
    removed from a family mid-call they stay connected, and a token already in
    their browser stays valid for up to its 1-hour lifetime (LiveKit Cloud
    refreshes tokens automatically during a session, so it will not lapse).
    LiveKit revokes a token when `RemoveParticipant` is called, so the fix is to
    disconnect members from their family's room when `family_members` changes —
    a database webhook (or a scheduled sweep) calling the LiveKit server API.
    That wiring does not exist yet; until it does, remove-and-rotate is the only
    remedy. Note that a participant who was removed up to ~1 minute earlier can
    still rejoin, because revocation compares the token's `nbf` with a
    one-minute clock-skew buffer.
13. **Calls have no audit trail and no abuse controls.** There is no call log,
    no blocking, and no per-user call rate limit — any active member may start
    or join their family's room at any time. LiveKit's free tier is metered, so
    a member could in principle consume the family's minutes.

## 9. Reporting

This is a private family app. If you find a security issue, open an issue in
the repository (or contact the maintainer directly) rather than disclosing it
publicly. Include reproduction steps and the affected route/table.
