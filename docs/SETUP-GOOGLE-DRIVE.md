# Setup guide — Google Drive (Memory Vault)

> **Status: Phase 5, not yet implemented.** The `/vault` page in the app is an
> honest placeholder. Following this guide today provisions the Google side so
> that Phase 5 work is unblocked — it will **not** make the Vault work yet.

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
- **Authorised redirect URIs** — the exact final URI is fixed in Phase 5,
  because token exchange happens **server-side in a Supabase Edge Function**
  (secrets must never reach the browser). Provision it as:

  ```
  https://<project-ref>.supabase.co/functions/v1/drive-oauth-callback
  ```

  and, for local development if we test the flow through the Next.js server
  route instead, also:

  ```
  http://localhost:3000/api/drive/callback
  https://<your-vercel-domain>/api/drive/callback
  ```

  Add all of these now — unused redirect URIs are harmless, and having them
  in place avoids a round-trip later. `.env.example` documents
  `{SITE_URL}/api/drive/callback` as the app-side endpoint.

- **Create** → copy the **Client ID** and **Client secret**.

## 5. Store the credentials (server-side only)

The client secret and the refresh token must **never** ship to the browser.

1. Generate the token-encryption key (32 random bytes, base64):

   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
   # macOS / Linux / Git Bash
   openssl rand -base64 32
   ```

2. Put these in `.env.local` **for local server-side testing only** (they are
   not needed by the M1 app):

   ```
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY=<base64 key>
   ```

3. When the Edge Function exists (Phase 5), set the same values as Supabase
   function secrets so they live server-side only:

   ```bash
   supabase secrets set \
     GOOGLE_CLIENT_ID=... \
     GOOGLE_CLIENT_SECRET=... \
     GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY=...
   ```

   **Never** prefix any of these with `NEXT_PUBLIC_`.

## 6. What the integration will do (Phase 5 design)

Once built, the flow will be:

1. A family **owner/admin** clicks *Connect Google Drive* in `/vault`.
2. The browser is sent to Google's consent screen. The user approves
   `drive.file`.
3. Google redirects back to the **Edge Function** with an authorization code.
4. The function exchanges the code for a **refresh token**, encrypts it with
   `GOOGLE_REFRESH_TOKEN_ENCRYPTION_KEY`, and stores it against the family's
   row. The token never leaves the server.
5. When a member opens the Vault, the app calls a **membership-checked**
   server endpoint. The endpoint decrypts the refresh token, obtains a
   short-lived access token, talks to Drive, and returns file metadata or a
   short-lived link. RLS and an explicit family-membership check gate every
   call, so a member of one family can never read another family's vault.
6. Uploads are written to a dedicated `Our Cousin Family` folder that the app
   creates, with one subfolder per family and per album.

Storage quotas, upload limits and shared-account concurrency are handled
server-side; the client only ever sees what it is allowed to see.

## 7. Verifying the setup (before Phase 5 exists)

You can confirm the *Google* half independently:

1. Open the OAuth playground to test your client:
   <https://developers.google.com/oauthplayground>.
2. Click the gear icon → **Use your own OAuth credentials** → paste the
   Client ID / secret.
3. Authorise the `drive.file` scope with the owner account and confirm Google
   shows the consent screen for *Our Cousin Family* without an
   `access_denied` error.

If that works, the credentials are correct and Phase 5 can rely on them.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Access blocked: app has not completed verification` | The account is not in **Test users** (step 3.3), or the app is unpublished while using sensitive scopes |
| `redirect_uri_mismatch` | The exact callback URL is missing from **Authorised redirect URIs** (step 4) — it must match byte-for-byte, including `https` and trailing path |
| Vault works for a week, then `invalid_grant` | Expected for **Testing**-mode apps: refresh tokens expire after 7 days (see step 3) |
| `insufficientPermissions` when creating files | `drive.file` scope missing, or the token was minted before the scope was added — re-connect to mint a new token |
| Secrets appear in client bundle | A variable was prefixed with `NEXT_PUBLIC_`. Remove the prefix and rotate the credential in Google Cloud |
