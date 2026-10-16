# Setup guide — Vercel deployment

Free tier is enough. Do this **after** [SETUP-SUPABASE.md](SETUP-SUPABASE.md)
(the app needs a database to boot).

## 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "Our Cousin Family — M1 core"
git branch -M main
git remote add origin https://github.com/<you>/our-cousin-family.git
git push -u origin main
```

> The repo already contains `.gitignore` (`.env.local` and friends are
> excluded) and the `AGENTS.md` note that `next dev` maintains — committing
> it keeps the working tree clean.

## 2. Import into Vercel

1. <https://vercel.com> → **Sign up with GitHub** (Hobby, free).
2. **Add New → Project** → import your repository.
3. Framework preset: **Next.js** (auto-detected, incl. Turbopack).
4. **Do not** add build tweaks — defaults work.

## 3. Environment variables

On the import screen (or later under **Project Settings → Environment
Variables**), add for **Production, Preview, and Development**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase **Project Settings → API** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon **public** key from the same page |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` |

Leave the Google/LiveKit/service-role variables out until their phases —
`.env.example` documents them.

> **Security note:** `NEXT_PUBLIC_*` values are baked into the client bundle.
> That is by design for the anon key — Postgres RLS is the security boundary.
> Never put the service-role key behind a `NEXT_PUBLIC_` prefix.

## 4. Update Supabase URLs

Back in Supabase **Authentication → URL Configuration**:

- **Site URL**: `https://<your-app>.vercel.app`
- **Additional redirect URLs**: keep the localhost ones for development and
  add:

  ```
  https://<your-app>.vercel.app/auth/callback
  https://<your-app>.vercel.app/auth/confirm
  ```

## 5. Deploy

**Deploy.** The first build takes ~1–2 minutes. On success the app is live
at your `.vercel.app` URL.

Every push to `main` = production deploy; every pull request = a preview
URL (add preview URLs to the Supabase redirect list if you use them for
auth testing).

## 6. Post-deploy smoke test

1. Open the URL, sign up, confirm the email (the link should now bounce
   back to your Vercel domain).
2. Create a family, copy the invite link, open it on a phone or incognito
   window with a second account, join, get approved.
3. Post + comment + chat between the two accounts — realtime should update
   both instantly.
4. Check **dark mode**, the bottom navigation, and that nothing scrolls
   horizontally at 320 px (DevTools device toolbar).

## Custom domain (optional)

**Project → Settings → Domains** → add your domain, then set DNS as
instructed, and finally update **both** `NEXT_PUBLIC_SITE_URL` and the
Supabase Site URL / redirect URLs to the new domain.

## Rollback / troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails with `TS…` | Run `npm run typecheck` locally first — Vercel runs the same check |
| App loads but redirect loop on `/login` | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` missing or wrong in Vercel env |
| Email confirm link lands on localhost | Supabase Site URL still points at localhost (step 4) |
| “Invalid origin” from Supabase | Redirect URL list doesn't include the Vercel domain |
| Need to retry a deploy | **Deployments → … → Redeploy** |
