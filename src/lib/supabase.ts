import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when env vars are present — the app runs in connected mode.
 *  When false, every feature falls back to the local demo mode. */
export const isConfigured = Boolean(url && key);

/** Shared Supabase client (publishable key only — RLS enforced). */
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // handles password-recovery links
    },
  }
);
