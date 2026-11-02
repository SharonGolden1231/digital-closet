import { createClient } from "@supabase/supabase-js";

// These two values are PUBLIC by design (they ship in the browser bundle).
// The publishable key only identifies the project; it cannot read or write
// anything without a signed-in user. NEVER put the secret / service-role key
// here or in any variable starting with VITE_.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

export const authConfigured = Boolean(url && publishableKey);

// createClient throws on an empty URL, so fall back to placeholders and let
// the login screen show a clear "not set up" message instead of a blank page.
export const supabase = createClient(
  url || "http://localhost",
  publishableKey || "missing-key",
  { auth: { persistSession: true, autoRefreshToken: true } }
);
