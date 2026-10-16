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
| Supabase Edge Functions *(Phase 5/6)* | All third-party secrets: Google refresh tokens, LiveKit key/secret, game RNG | Authoritative, server-only |

The proxy is a *routing* concern. If it were removed entirely, RLS would still
prevent any family from reading another family's data.

## 2. Row Level Security

RLS is **enabled on all 14 tables** and no table has a permissive `using
(true)` policy. Policies live in
[`20261016020000_authz_rls.sql`](../supabase/migrations/20261016020000_authz_rls.sql).

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

**Helper functions** (`is_family_member`, `family_role`, `shares_family_with`,
`is_conversation_member`, …) are `stable`, `security definer`, and pinned with
`set search_path` to avoid search-path hijacking. They are the only functions
granted to `anon`/`authenticated` besides the RPC entry points.

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
- The **service-role key is not used in M1** and is absent from the client.
- Google client secret, LiveKit API secret and the refresh-token encryption
  key are server-only and are destined for **Supabase Edge Function secrets**.
- `.env.example` contains placeholders only; `.env.local` is git-ignored.
- No secret is ever prefixed with `NEXT_PUBLIC_`.

## 7. Realtime

Realtime `postgres_changes` subscriptions are subject to the same RLS
policies — a client only receives rows it is allowed to `select`. Chat
**typing indicators** use ephemeral broadcast channels scoped to the
conversation; presence is private per family. No table row is broadcast that
RLS would hide from the subscriber.

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
4. **No automated security tests yet.** Vitest + Playwright coverage,
   including RLS assertions (cross-family access must fail), is planned for
   M3. Until then RLS has been reviewed by hand, not proven by tests.
5. **Migrations are unapplied.** The policies above are written and reviewed
   but have not run against a live database; verify them on first setup.
6. **Hand-written database types.** `src/types/database.types.ts` is manual
   and can drift from the schema. Regenerate with
   `supabase gen types typescript --linked` once the CLI is linked.
7. **No moderation/audit trail for deletions.** Deletes are hard deletes;
   there is no tombstone or admin audit log.
8. **Email is limited by Supabase's default rate limits** until custom SMTP
   is configured; this is a deliverability (not confidentiality) concern.
9. **Drive and LiveKit features store refresh tokens / mint tokens in Phase
   5–6.** Until those functions exist and are reviewed, the Vault and Calls
   placeholders intentionally do nothing.

## 9. Reporting

This is a private family app. If you find a security issue, open an issue in
the repository (or contact the maintainer directly) rather than disclosing it
publicly. Include reproduction steps and the affected route/table.
