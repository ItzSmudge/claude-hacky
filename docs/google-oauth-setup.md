# Google sign-in setup

How to turn on "Sign in with Google" (PR-03) in production and locally. The app code is in
`src/components/projects/account-menu.tsx` and `src/app/app/auth/callback/route.ts`. Nothing else
in the repo needs changing for production.

How it works: the browser calls `supabase.auth.signInWithOAuth({ provider: "google" })`. Google
returns to **Supabase** (`/auth/v1/callback`), then Supabase redirects to **our app**
(`/app/auth/callback?code=…`), where the code becomes a session cookie. So there are two redirect
lists to fill in: one at Google and one at Supabase.

## 1. Google Cloud: create the OAuth client

1. Go to <https://console.cloud.google.com/> and select a project, or create one (e.g. "PaperCut").
2. **APIs & Services → OAuth consent screen** (now called "Google Auth Platform → Branding /
   Audience"):
   - User type: **External**.
   - App name `PaperCut`, plus a support email and a developer contact email.
   - Scopes: the defaults (`openid`, `email`, `profile`) are enough.
   - **Audience / Test users:** while the app is in **Testing**, only listed accounts can sign in.
     Add every Google account you'll demo with (up to 100), or click **Publish app**. The basic
     scopes don't need Google verification.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name `PaperCut Supabase`.
   - **Authorised JavaScript origins:** `https://example.com` (plus `http://localhost:3000` for
     local).
   - **Authorised redirect URIs:**
     - Production: `https://<project-ref>.supabase.co/auth/v1/callback` (copy it from the
       Supabase Google provider page, step 2).
     - Local Supabase: `http://127.0.0.1:54421/auth/v1/callback`.
   - Create, then copy the **Client ID** and **Client secret**.

## 2. Supabase (hosted, production): ItzSmudge

1. Dashboard → **Authentication → Sign In / Providers → Google** → enable it.
2. Paste the **Client ID** and **Client Secret**, then save. Leave "Skip nonce checks" off.
3. **Authentication → URL Configuration:**
   - **Site URL:** `https://example.com`
   - **Redirect URLs:** add
     - `https://example.com/app/auth/callback`
     - `https://*-<vercel-team>.vercel.app/**`, if you want Google sign-in on preview deploys
       (optional)
4. Keep **Allow anonymous sign-ins** on, because guests still start anonymous.

No env vars change in Vercel: the client ID and secret live in Supabase, not in our app.

## 3. Local (optional)

1. Export the credentials in your shell. Never commit them:

   ```sh
   export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…
   ```

2. In `supabase/config.toml`, set `enabled = true` under `[auth.external.google]`. Don't commit
   this change.
3. `pnpm db:stop && pnpm db:start` (Supabase reads the config at start-up), then `pnpm dev`.
4. `additional_redirect_urls` already allows `http://localhost:3000/**`, so the callback works.

## 4. Check it works

1. Open `/app` and click **Sign in with Google** (it shows "Sign in" on phones). Pick an account.
   You should land back on the same page, with your name in the header.
2. On a second device, or in a private window, sign in with a different Google account.
3. On device 1, open a project, then **Group** to get the join code. On device 2, go to `/app/join`
   and enter the code. Both names appear in the group view.
4. **Sign out** returns you to a fresh guest session.

## Troubleshooting

| Symptom                                                                           | Fix                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Google says `redirect_uri_mismatch`                                               | The Supabase callback URL (step 1.3) is missing or has a typo in the Google client.                                            |
| Google says "Access blocked: app not verified" / "has not completed verification" | The account isn't a test user. Add it (step 1.2) or publish the app.                                                           |
| You land on `/app?auth=failed`                                                    | Check the Supabase auth logs. Often the PKCE verifier cookie is missing: the sign-in must start and finish on the same domain. |
| You land on the Site URL instead of `/app/auth/callback`                          | `/app/auth/callback` for that domain isn't in the Supabase **Redirect URLs** list (step 2.3).                                  |
| "Unsupported provider: provider is not enabled"                                   | The Google provider is off in Supabase (step 2.1), or locally `enabled = true` wasn't picked up (restart Supabase).            |

## Known limitation

Signing in with Google creates or opens that Google account. It doesn't link the current guest
session, so a guest's projects stay with the guest. For demos, sign in first and then create or join
a project. Linking would need `enable_manual_linking` and `auth.linkIdentity()`, plus copying the
Google name into `profiles.display_name`.
