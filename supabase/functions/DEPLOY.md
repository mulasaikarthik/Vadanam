# Deploying the `gemini-chat` Edge Function (Vadanam)

The function code lives at `supabase/functions/gemini-chat/index.ts`.
It does NOT appear in the Supabase Dashboard until it is deployed —
files in this repo are not auto-deployed.

There are two ways to deploy. Use whichever you prefer.

---------------------------------------------------------------------
OPTION A — Supabase CLI (recommended)
---------------------------------------------------------------------
Run these from the project root (where this repo's `supabase/` folder is):

  # 1. Log in (opens a browser; or set SUPABASE_ACCESS_TOKEN env var)
  npx supabase login

  # 2. Set the Gemini secret (server-side only; never goes in the frontend)
  npx supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_KEY --project-ref cwkthhowrxdvrmuornkk

  # 3. Deploy the function
  npx supabase functions deploy gemini-chat --project-ref cwkthhowrxdvrmuornkk

  # 4. Verify it is live
  npx supabase functions list --project-ref cwkthhowrxdvrmuornkk
  # -> gemini-chat should show STATUS: ACTIVE

IMPORTANT: run `secrets set` with NO SPACE around `=` and no space after
`GEMINI_API_KEY=`. A leading space makes the key invalid.

---------------------------------------------------------------------
OPTION B — Supabase Dashboard (no CLI needed)
---------------------------------------------------------------------
1. Open https://supabase.com/dashboard/project/cwkthhowrxdvrmuornkk/functions
2. Click "Deploy a new function" -> "Via Editor".
3. Name it exactly:  gemini-chat
4. Delete the sample code and paste the ENTIRE contents of
   supabase/functions/gemini-chat/index.ts
5. Click "Deploy function".
6. Go to Edge Functions -> Secrets (or Settings -> Edge Functions) and add:
      Name:  GEMINI_API_KEY
      Value: your Gemini API key (no leading/trailing spaces)
7. Done. The AI Mentor in the app will work immediately.

---------------------------------------------------------------------
Verify end-to-end
---------------------------------------------------------------------
1. Sign in to the app, open a team -> AI Mentor, ask a question.
2. You should get a real Gemini reply within a few seconds.
3. The conversation persists in the `mentor_messages` table
   (reload the page to confirm).

Troubleshooting:
- "AI mentor is unreachable / not deployed"  -> function 404: deploy it (above).
- "not configured yet"                        -> GEMINI_API_KEY secret missing.
- 401 "Sign in to use the AI mentor."         -> user session expired; sign in again.
- 403 "not a member of this team"             -> the signed-in user isn't in team_members.
- 429                                         -> rate limit (8 questions/min/user) or Gemini quota.
- Check logs: Dashboard -> Edge Functions -> gemini-chat -> Logs.
  (Logs never contain the API key.)
