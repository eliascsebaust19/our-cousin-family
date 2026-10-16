# Setup guide — LiveKit (Family calls)

> **Status: implemented; not yet run against a real LiveKit project.** The code
> in `supabase/functions/livekit-token/` and `src/components/calls/` is complete
> and type-checked. Until the three values below exist, `/calls` shows an honest
> "LiveKit is not configured" notice instead of a fake room.

LiveKit provides the WebRTC SFU that powers one-to-one and group audio/video
calls. **The app never holds a LiveKit secret.** A Supabase Edge Function is the
only thing that can mint a join token, and it mints one only after re-checking
membership in the database.

Estimated time: ~10 minutes. A free tier is available.

---

## 1. Create a LiveKit Cloud account

1. Go to <https://cloud.livekit.io> and sign up (GitHub or Google).
2. **Create project**:
   - **Name**: `our-cousin-family`
   - **Region**: closest to your family (e.g. `Europe` / `US East` /
     `Asia Pacific`)
3. Wait for provisioning to finish.

The free tier includes a monthly allowance of connection minutes and concurrent
participants — plenty for a family. Check the current limits on the LiveKit
pricing page; they change over time.

## 2. Copy the project URL and keys

In the project dashboard, under **Settings → Keys** (or **Project Settings**):

| Value | Goes into | Notes |
| --- | --- | --- |
| **WebSocket URL** (`wss://<subdomain>.livekit.cloud`) | `NEXT_PUBLIC_LIVEKIT_URL` | Safe for the browser — it is only an address |
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

The browser reads **only** `NEXT_PUBLIC_LIVEKIT_URL`. The key and the secret are
never sent to the client — they are read inside the Edge Function from its own
secret store (step 3).

## 3. Deploy the token function

The function lives in `supabase/functions/livekit-token/index.ts`. It verifies
the caller's Supabase JWT itself, so deploy it with `--no-verify-jwt` (that flag
disables the platform's own gate, not the check inside the function — this way
"no token" and "bad token" produce clear errors instead of an opaque 401).

```bash
supabase secrets set \
  LIVEKIT_API_KEY=... \
  LIVEKIT_API_SECRET=... \
  LIVEKIT_URL=wss://<subdomain>.livekit.cloud

supabase functions deploy livekit-token --no-verify-jwt
```

`LIVEKIT_URL` (no `NEXT_PUBLIC_` prefix) is what the function uses; it falls back
to `NEXT_PUBLIC_LIVEKIT_URL` if you only set that one. `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
the platform.

Then set `NEXT_PUBLIC_LIVEKIT_URL` in **Vercel → Project → Settings →
Environment Variables** (and redeploy) so the browser knows where to connect.

### What the function exposes

| Request | Answer |
| --- | --- |
| `GET ?action=participants&room=family:<uuid>` | `{ room, participants: [{ identity, name, joinedAt }] }` — who is in the room right now |
| `POST ?action=token` with `{ "room": "...", "canPublish": true }` | `{ url, room, identity, token }` |

Every request is authorized the same way:

1. Read the caller's Supabase access token and resolve the user (`not_authenticated`).
2. Parse the room name and reject anything that is not `family:<uuid>` or
   `dm:<uuid>` (`unknown_room`) — the UUID is validated before it reaches the
   database.
3. Re-check membership **in the database**: `family_members` for a family room,
   `conversation_members` for a conversation room (`not_a_member` /
   `not_a_conversation_member`).
4. Only then sign a token, scoped to that one room, valid for 1 hour.

A member of one family can therefore never obtain a token for another family's
room, and the browser can never promote itself into one.

**Privacy note.** LiveKit records participant identities and room names in its
logs and traces. Both are opaque here: the identity is the user's Supabase UUID
and the room is `family:<uuid>` / `dm:<uuid>` — never a name, email or phone
number. The human-readable label travels in the separate `name` field, which is
what other participants see.

## 4. Room naming convention

Rooms are derived from rows that already exist, so **calls need no new tables**:

- Family call: `family:<family_id>` — any active member of the family.
- Direct / group call: `dm:<conversation_id>` — any member of that conversation.

The prefix is part of the room identity, so the two can never collide. Because a
URL segment cannot carry the colon comfortably, links use a dash slug
(`/calls/family-<uuid>`, `/calls/dm-<uuid>`) and the room name is rebuilt from it.

### Where calls start

- **`/calls`** — the hub. Shows how many people are in the family room right now
  (refreshed every 20 seconds and whenever the tab regains focus), plus a
  **Start / Join the family call** button and the list of members who can join.
- **Any chat** — the video button in a conversation header opens
  `/calls/dm-<conversation_id>` for that conversation.
- A link can be shared directly; it still only works for members, because the
  token function re-checks membership every time.

### In the room

The layout adapts to the number of participants. Controls: mute/unmute,
camera on/off, leave. Remote audio is played through a hidden container, and if
the browser blocks autoplay (mobile Safari) a **Tap to enable sound** banner
appears.

The 1-hour token expiry is checked when a participant *connects*, so a call that
runs longer than an hour is not interrupted.

## 5. Verifying the setup

1. `npm run dev`, sign in, open `/calls`. The amber "not configured" notice
   should be gone.
2. Press **Start the family call**. Grant camera/microphone permission when the
   browser asks; you should see your own tile and the timer start.
3. Open the same URL in a second browser (or a phone on the same network) signed
   in as another family member: both tiles appear, mute/unmute works, and leaving
   in one tab updates the other.
4. Back on `/calls`, the family-room card should now say *"… is in the call"* —
   that line is produced by the server, not guessed by the client.
5. Server-side negative test: sign in as someone **outside** the family and try
   `family-<family_id>`. The room must refuse to load with "You are not a member
   of this family."

> The app never claims a call feature works until these steps pass on a real
> project; see the limitations list in `README.md`.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Amber "LiveKit is not configured" notice on `/calls` | `NEXT_PUBLIC_LIVEKIT_URL` is missing from the app's environment (`.env.local` / Vercel) — restart `npm run dev` after adding it |
| "The calls server function has not been deployed yet" | `supabase functions deploy livekit-token --no-verify-jwt` has not run, or `NEXT_PUBLIC_SUPABASE_URL` points at a different project |
| "LiveKit is not configured on the server yet" | `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` are missing from `supabase secrets`; re-run the `supabase secrets set` command and redeploy the function |
| `401` / token rejected by LiveKit | The key and secret come from different projects, or the secret was rotated after deploy. Re-run `supabase secrets set` |
| Camera/mic never starts | Browser permission blocked. WebRTC needs a secure context — HTTPS, or `localhost` |
| Connected but others cannot be heard | Room name mismatch. The `dm:` / `family:` prefix is part of the room identity, and both sides must compute the same name |
| No sound until you tap | Mobile Safari blocks autoplay; use the **Tap to enable sound** banner |
| `not_a_conversation_member` on a DM link | The caller is not in that conversation — the room is not joinable by link alone |
| Secret leaked to the client | `LIVEKIT_API_SECRET` was given a `NEXT_PUBLIC_` prefix or bundled. Remove it, rotate the key in LiveKit Cloud, redeploy |
| Free tier exhausted mid-call | The project is rate-limited by minutes; upgrade or wait for the next period |
