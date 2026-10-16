# Setup guide — LiveKit (Family calls)

> **Status: Phase 6, not yet implemented.** The `/calls` page in the app is an
> honest placeholder. This guide provisions your LiveKit account so Phase 6
> can drop straight in.

LiveKit provides the WebRTC SFU that powers one-to-one and group audio/video
calls. The app never sees LiveKit secrets: a **Supabase Edge Function mints
short-lived join tokens** after checking family membership.

Estimated time: ~10 minutes. A free tier is available.

---

## 1. Create a LiveKit Cloud account

1. Go to <https://cloud.livekit.io> and sign up (GitHub or Google).
2. **Create project**:
   - **Name**: `our-cousin-family`
   - **Region**: closest to your family (e.g. `Europe` / `US East` /
     `Asia Pacific`)
3. Wait for provisioning to finish.

The free tier includes a monthly allowance of connection minutes and
concurrent participants — plenty for a family. Check the current limits on
the LiveKit pricing page; they change over time.

## 2. Copy the project URL and keys

In the project dashboard, under **Settings → Keys** (or **Project Settings**):

| Value | Goes into | Notes |
| --- | --- | --- |
| **WebSocket URL** (`wss://<subdomain>.livekit.cloud`) | `NEXT_PUBLIC_LIVEKIT_URL` | Safe for the browser — it's just an address |
| **API Key** | `LIVEKIT_API_KEY` | Secret |
| **API Secret** | `LIVEKIT_API_SECRET` | Secret — used only for signing tokens |

If no key pair exists yet, click **Create key** / **Add key** and copy both
halves immediately — the secret is shown **once**.

Add them to `.env.local`:

```
NEXT_PUBLIC_LIVEKIT_URL=wss://<subdomain>.livekit.cloud
LIVEKIT_API_KEY=<api key>
LIVEKIT_API_SECRET=<api secret>
```

> Only `NEXT_PUBLIC_LIVEKIT_URL` may reach the browser. Keep the key and
> secret server-side. In production they belong in **both** Vercel's
> environment variables (for `NEXT_PUBLIC_LIVEKIT_URL`) **and** Supabase
> function secrets (for the key/secret used by the token-minting function).

## 3. Set the secrets for the Edge Function

Once the token function exists (Phase 6), deploy its secrets:

```bash
supabase secrets set \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=... \
  LIVEKIT_URL=wss://<subdomain>.livekit.cloud
supabase functions deploy livekit-token
```

The function will:

1. Read the caller's Supabase JWT.
2. Verify the caller belongs to the requested family/room (RLS-backed check).
3. Mint a **short-lived** (≈1 hour) `AccessToken` with a per-user identity and
   grants limited to that one room.
4. Return the JWT to the client, which connects via the LiveKit SDK.

A member of one family can therefore never obtain a token for another
family's room — approval is server-side, never client-asserted.

## 4. Room naming convention (Phase 6 design)

Rooms are derived from existing data so no extra state is needed:

- Direct call: `dm:<conversation_id>` — the two members of that conversation.
- Group/family call: `family:<family_id>` — any active member of the family.

The token function maps a requested room back to a family and re-checks
membership before signing anything.

## 5. Verifying the setup (before Phase 6 exists)

1. Open the LiveKit **Agents Playground** or the
   [Example app](https://github.com/livekit-examples) and connect using your
   project URL, API key and secret to confirm the project accepts
   connections.
2. Alternatively, mint a token with the
   [LiveKit CLI](https://docs.livekit.io/reference/tooling/cli/)
   (`lk token create --room test --identity me --valid-for 1h`) and join a
   test room with the web SDK. If you can see yourself in the room, the
   project is correctly configured.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401` / token rejected | Key and secret are from different projects, or the token was minted with a mismatched API key |
| Camera/mic never starts | Browser permission blocked, or the page is not on HTTPS (WebRTC requires a secure context; `localhost` is exempt) |
| Connected but others can't be heard | Check the room name matches exactly — `dm:` and `family:` prefixes are part of the room identity |
| Secret leaked to the client | `LIVEKIT_API_SECRET` was prefixed with `NEXT_PUBLIC_` or bundled. Remove it, rotate the key in LiveKit Cloud, redeploy |
| Free tier exhausted mid-call | The project is rate-limited by minutes; upgrade or wait for the next period |
