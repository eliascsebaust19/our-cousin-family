# Setup guide — Supabase (required)

The app cannot run without this. Expect ~15 minutes. Everything is on the
**free tier**.

## 1. Create the project

1. Go to <https://supabase.com> and sign in (free).
2. **New project**:
   - **Organization**: personal/free.
   - **Project name**: e.g. `our-cousin-family`.
   - **Database password**: generate a strong one and save it somewhere safe
     (you rarely need it again, but it's unrecoverable).
   - **Region**: pick the region closest to your family (e.g. Frankfurt,
     Washington, Singapore). Region can't be changed later.
3. Wait ~2 minutes for provisioning.

## 2. Apply the database migrations

All schema, RLS policies, RPCs, triggers, storage buckets, and realtime
config live in [`supabase/migrations/`](../supabase/migrations). Apply them
**in this exact order**.

### Option A — SQL Editor (simplest, no tooling)

1. In the Supabase dashboard open **SQL Editor**.
2. For **each** file below: open it, paste the **entire** contents, press
   **Run**, and confirm the message shows no errors (e.g.
   `Success. No rows returned`):

   1. `20261016010000_core_schema.sql` — 14 tables, indexes, triggers
   2. `20261016020000_authz_rls.sql` — helper functions, security-definer
      RPCs, **every RLS policy**, notification triggers
   3. `20261016030000_storage_realtime.sql` — private storage buckets,
      storage policies, realtime publication
   4. `20261016040000_rpc_extras.sql` — `get_unread_counts()`,
      `get_conversation_summaries()`, `bump_conversation_activity()` trigger
   5. `20261016050000_family_calendar.sql` — events + RSVPs (RLS, realtime)
   6. `20261016060000_ludo.sql` — the whole Ludo engine: tables, server-side
      RNG, rules, turn timers, `ludo_*` RPCs (see **docs/ludo-rules.md**)
   7. `20261016070000_vault.sql` — Memory Vault index tables, RLS, and the
      column-level grants clients need to favourite or caption a memory

   > Run them one at a time in order — later files reference functions
   > created by earlier ones.

### Option B — Supabase CLI

```bash
supabase login
supabase init          # creates config.toml; keep the existing supabase/migrations
supabase link --project-ref <project-ref>   # ref = the string in your project URL
supabase db push       # applies all pending migrations in filename order
```

You can verify afterwards in **Database → Tables** that 14 tables exist, and
in **Database → Policies** that nearly every table has policies attached.

> **Optional: check the migrations before you touch Supabase.**
> `npm run db:check` applies all four files to in-process Postgres (PGlite)
> and asserts the resulting RLS policies, function grants, triggers and
> storage authorization. It needs no Docker and no project, and it is the
> same check CI runs.

## 3. URL configuration (auth redirects)

**Project Settings → Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` during development
- **Additional redirect URLs** — add all that apply:

  ```
  http://localhost:3000/auth/callback
  http://localhost:3000/auth/confirm
  https://<your-vercel-domain>/auth/callback
  https://<your-vercel-domain>/auth/confirm
  ```

  Wildcards like `https://*.vercel.app/*` also work for quick testing.

## 4. Email templates (confirm sign-up + password reset)

**Authentication → Email Templates.** Two options — pick one:

### Option A — default templates (works with zero changes)

Leave the templates as they are (`{{ .ConfirmationURL }}`). Confirmation
links land on Supabase, which redirects to your configured
`/auth/callback` route — the app exchanges the PKCE code and continues.
This path is fully supported by the code.

### Option B — custom links straight to the app (nicer)

Edit **Confirm signup** and set the **Confirmation URL** to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/home
```

Edit **Reset password** similarly:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
```

`/auth/confirm` verifies the token hash server-side and redirects the user.
If you use Option B, also keep
`https://<your-domain>/auth/confirm` in the redirect URLs (step 3).

> **Development tip:** default Supabase emails work but rate-limit
> aggressively (2–4/hour per email). For heavier testing, configure custom
> SMTP (Resend/SES/Mailgun) under **Authentication → SMTP Settings** — free
> tiers of those providers are enough.

## 5. Get your keys

**Project Settings → API** → copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Put them in `.env.local` (created from `.env.example`). Never commit real
values; the anon key is safe to expose to the browser **because RLS is on**.
Leave `SUPABASE_SERVICE_ROLE_KEY` empty for M1 — nothing in the core app
uses it.

## 6. Google as a sign-in provider (optional now, required later)

The **“Continue with Google”** button on login/signup needs OAuth
credentials from Google Cloud. This is *separate from* the Drive/Vault
setup, but can reuse the same Google Cloud project:

1. <https://console.cloud.google.com> → create a project (or reuse one).
2. **APIs & Services → OAuth consent screen**: External, fill app name,
   add your Google account as a **test user**, add scopes
   `email`, `profile`, `openid`.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized redirect URIs**:
     `https://<project-ref>.supabase.co/auth/v1/callback`
   (found under Supabase **Authentication → Providers → Google**).
4. Copy the **Client ID** and **Client secret** into Supabase
   **Authentication → Providers → Google** and enable it.

Skip this for now if you only want email-link sign-in; the app works
entirely with email links.

## 7. Verify everything works

```bash
npm run dev
```

1. <http://localhost:3000> → **Get started** → sign up with your email.
2. Click the confirmation link from the email (check spam).
3. You should land in the app with the “no family yet” onboarding.
4. **Create a family** → you get an invite code.
5. Open a private/incognito window, sign up with a **second** email, then
   visit `http://localhost:3000/join/<CODE>` and join.
6. Back in the first account: **Family → Members → Waiting** → approve.
7. Create a post, add a comment — the second account should see it
   **live**, with no refresh. Same for chat.

If anything fails, the browser console + Supabase **Logs → Postgres** and
**Logs → Auth** pinpoint whether it's schema, policy, or email config.

## Deploying the Edge Functions and later services

- **Edge Functions** live in `supabase/functions/` and are deployed with
  `supabase functions deploy <name>`. The project ships three:
  - `vault` and `drive-oauth-callback` — the Memory Vault; see
    **docs/SETUP-GOOGLE-DRIVE.md** for the exact commands and secrets.
  - `livekit-token` — the only minter of call join tokens; see
    **docs/SETUP-LIVEKIT.md**.
  All three are deployed with `--no-verify-jwt` because each verifies the
  caller's Supabase JWT itself (inside the function), so it can answer with a
  specific error instead of the platform's opaque 401. The flag disables the
  platform's gate, **not** the check inside the function — these endpoints are
  not open.
- **The Ludo engine is not an Edge Function.** It is pure SQL: all game rules,
  dice rolls and turn timers run inside `public.ludo_*` security-definer
  functions in `supabase/migrations/20261016060000_ludo.sql`, so the server owns
  randomness and legality and a client can never fake a roll. See
  **docs/ludo-rules.md**.
- **Calls need no migrations.** Room names are derived from existing rows
  (`family:<family_id>`, `dm:<conversation_id>`), so the only call-specific
  server code is `supabase/functions/livekit-token/`.
- **Database types**: after linking the CLI you can regenerate
  `src/types/database.types.ts` with
  `supabase gen types typescript --linked > src/types/database.types.ts`.
  The committed file is hand-written and kept in sync manually until then.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Migration fails on `create policy` | You ran files out of order — re-run in filename order |
| `relation "storage.objects" does not exist` | File 3 ran before file 1 finished, or you're not in the right project |
| Sign-up email never arrives | Check **Authentication → Logs**, SMTP rate limits, spam folder |
| `AuthImplicitGrantConfigurationError` after clicking the email link | Site URL / redirect URLs don't match (step 3) |
| “Row-level security” violation on a fresh account | Expected only for cross-family access; if your own family fails, a migration didn't apply — check **Database → Policies** |
| Google button returns `provider_not_enabled` | Step 6 not done or not enabled |
