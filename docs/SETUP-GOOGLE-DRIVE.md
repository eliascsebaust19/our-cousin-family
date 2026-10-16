# Setup guide — Google Drive (Memory Vault)

> **Status: implemented, not deployed.** The code is complete: the `vault` and
> `drive-oauth-callback` Edge Functions, the `/api/drive/content` media proxy,
> the `vault_items` Postgres index with column-level RLS, and the `/vault` UI.
> Nothing is live until you finish this guide, run `supabase db push`, deploy the
> two functions, and connect a Drive account. Until then `/vault` says exactly
> that instead of pretending to work.

The Memory Vault stores family photos, videos and documents in a **single
Google Drive account** owned by the family. Individual family members do *not*
connect their own Google accounts: one account holds the files, and the app
mediates every read/write through membership-checked server endpoints.

Estimated time: ~20 minutes. All free.

---

## 1. Create (or reuse) a Google Cloud project

1. Go to <https://console.cloud.google.com> and sign in with the Google
   account that will **own the Drive storage** — the project brief uses
   `eliasahmad3224@gmail.com`. Use that account for the steps below so the
   OAuth client belongs to the same identity that will later be connected.
2. Top bar → **Select a project → New project**.
   - **Name**: `our-cousin-family`
   - **Location**: no organisation (personal account)
3. Wait for it to be created, then make sure it is selected.

## 2. Enable the Drive API

1. **APIs & Services → Library**.
2. Search for **Google Drive API** → open it → **Enable**.
3. (Optional, recommended later) also enable **Google Picker API** if you
   want families to browse existing Drive folders.

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**.

1. **User type**: **External** → **Create**.
2. **App information**
   - **App name**: `Our Cousin Family`
   - **User support email**: your Google account
   - **Developer contact information**: your Google account
3. **Audience** → **Test users**: add **every** Google account that will
   connect a family Drive (in practice: the owner account above, plus any
   account you use for testing). While the app is in **Testing** mode, only
   listed test users can complete the consent flow.
4. **Data access / Scopes** → **Add or remove scopes**, then add:
   - `.../auth/drive.file` — create and manage **only the files the app
     creates** (recommended: least privilege, no access to unrelated files)
   - `.../auth/userinfo.email` — identify the connected account
   - `.../auth/userinfo.profile` — account display name in the UI
   - `openid` — required by the OAuth flow

   > ⚠️ Do **not** request the full `.../auth/drive` scope unless you truly
   > need to browse the user's existing Drive. `drive.file` is much easier to
   > justify and keeps the app out of unrelated data.

### The 7-day refresh-token gotcha (important)

While an OAuth app is **unverified** and in **Testing** mode, Google expires
its **refresh tokens after 7 days**. For a persistent family vault that means
the connected account must re-authorise weekly — acceptable while building,
not for real use.

To make it permanent, publish the app: **OAuth consent screen → Publish app**
→ status becomes **In production** (Google may request verification if you
use sensitive scopes; `drive.file` + basic profile scopes is a *non-sensitive*
combination for many apps, so verification is often not required). Publishing
is free. Do this before real family use.

## 4. Create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**.

- **Application type**: **Web application**
- **Name**: `Our Cousin Family — server`
- **Authorised JavaScript origins**: `https://<your-vercel-domain>`
- **Authorised redirect URIs** — there is exactly **one** redirect URI, and it
  belongs to the Supabase Edge Function (the token exchange happens server-side;
  the client secret never reaches the browser):

  ```
  https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback
  ```

  `<project-ref>` is the subdomain of your Supabase project URL
  (`https://<project-ref>.supabase.co`). The path must match byte-for-byte,
  including the function name: the deployed function is
  `supabase/functions/drive-oauth-callback/`.

  You do **not** need a `localhost` redirect URI: the OAuth dance runs entirely
  inside Supabase, and the function sends the browser back to `SITE_URL` when it
  finishes.

- **Create** → copy the **Client ID** and **Client secret**.

## 5. Store the credentials as Supabase function secrets

The client secret, the refresh token, and the token-encryption key must
**never** ship to the browser. They are read with `Deno.env.get(...)` inside the
Edge Functions, so they go on **Supabase**, not in `.env.local`.

1. Generate the token-encryption key (32 random bytes, base64):

   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
   # macOS / Linux / Git Bash
   openssl rand -base64 32
   ```

2. Set them on the project:

   ```bash
   supabase secrets set \
     GOOGLE_CLIENT_ID=<client id> \
     GOOGLE_CLIENT_SECRET=<client secret> \
     GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY=<base64 key> \
     SITE_URL=https://<your-vercel-domain>
   ```

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
   injected automatically into every Edge Function — do not set them yourself.

   **Never** prefix any of these with `NEXT_PUBLIC_`. The only Google value the
   browser ever sees is the consent URL the `vault` function builds for it.

3. Apply the Vault schema (three tables, RLS, column grants) and deploy the
   functions:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   supabase functions deploy vault --no-verify-jwt
   supabase functions deploy drive-oauth-callback --no-verify-jwt
   ```

   `--no-verify-jwt` is deliberate: the platform's own JWT gate cannot be used
   because the Google callback arrives with no Supabase token at all. Both
   functions verify the caller themselves — `vault` from the `Authorization`
   header, `drive-oauth-callback` from an HMAC-signed `state` parameter plus a
   fresh `family_members` lookup.

## 6. How it works

1. A family **owner/admin** opens `/vault` and taps *Connect Google Drive*. The
   page asks the `vault` function for a consent URL; the function signs a
   `state` value (family id + user id + nonce + timestamp, HMAC-SHA256) with
   `GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY`.
2. The browser goes to Google, the user approves `drive.file`.
3. Google redirects to `drive-oauth-callback`. The function verifies the
   `state` signature, re-checks that the user is still an owner/admin of that
   family, exchanges the code for a **refresh token**, encrypts it with
   AES-256-GCM (key derived from the same secret through HKDF), and upserts it
   into `vault_connections` — a table no client role can read.
4. It creates the `Our Cousin Family` folder, then redirects to
   `SITE_URL/vault?drive=connected`.
5. Uploads go browser → `vault` function → Drive. The function checks
   membership, writes the `vault_items` index row, uploads the bytes, and reads
   back Drive's own metadata (size, EXIF capture time) before marking the row
   `ready`.
6. Reads go through `/api/drive/content?item=<id>`. `<img>` and `<video>` cannot
   send an `Authorization` header, so that Next.js route forwards the caller's
   session cookie as a bearer token to the function, which checks membership
   against the item's family and streams the bytes back. `Range` is forwarded,
   so video seeking works.
7. Photos are downscaled in the browser before upload (2560 px long edge, JPEG
   q0.85) and the EXIF capture date is read *before* re-encoding, so the archive
   can be grouped by the year the memory actually happened.

Every read and write is gated twice: Postgres RLS (`vault_item_family_id` +
`is_family_member`) for the index rows, and an explicit `family_members` check
inside the Edge Functions for the Drive bytes.

## 7. Verifying the setup

1. **Google half, independently of the app:** open the OAuth playground
   <https://developers.google.com/oauthplayground>, click the gear icon → **Use
   your own OAuth credentials** → paste the Client ID/secret, authorise
   `drive.file`, and confirm the consent screen appears without
   `access_denied`.
2. **Secrets are set:**
   ```bash
   supabase secrets list
   ```
   You should see the four names from step 5 (values are hashed).
3. **Functions are deployed:**
   ```bash
   curl -i "https://<project-ref>.supabase.co/functions/v1/vault?action=status&family_id=<uuid>"
   ```
   With no `Authorization` header this must answer **401**, not 200 and not 404.
   A 404 means the function is not deployed; the `/vault` page will show the
   same thing.
4. **In the app:** open `/vault` as a family owner. You should see *Connect
   Google Drive*, complete the consent screen, land back on `/vault?drive=connected`,
   and see the connected account's email. Upload one photo and confirm it
   appears — and that it exists in the `Our Cousin Family` folder in Drive.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Access blocked: app has not completed verification` | The account is not in **Test users** (step 3.3), or the app is unpublished while using sensitive scopes |
| `redirect_uri_mismatch` | The exact callback URL is missing from **Authorised redirect URIs** (step 4) — it must match byte-for-byte, including `https` and trailing path |
| Vault works for a week, then `invalid_grant` | Expected for **Testing**-mode apps: refresh tokens expire after 7 days (see step 3) |
| `insufficientPermissions` when creating files | `drive.file` scope missing, or the token was minted before the scope was added — re-connect to mint a new token |
| Secrets appear in client bundle | A variable was prefixed with `NEXT_PUBLIC_`. Remove the prefix and rotate the credential in Google Cloud |
| `/vault` says *the Vault server function has not been deployed* | `vault` is not deployed, or `NEXT_PUBLIC_SUPABASE_URL` is wrong in the Vercel project. Re-run `supabase functions deploy vault` |
| `/vault` says the Google credentials are not set | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY` are missing from `supabase secrets list` |
| Photos show as broken images | The `vault` function is deployed but `drive-oauth-callback` was skipped, so no refresh token exists — connect Drive first |
| Changing `GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY` breaks every read | It decrypts the stored refresh tokens. Changing it makes existing tokens unreadable; reconnect Drive (or keep the old key) |
