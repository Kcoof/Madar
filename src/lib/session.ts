import { getDevSessionUserId } from "@/lib/dev-auth";

// True when a Supabase project is connected (env vars set).
// Local development runs without Supabase — the dev session cookie is used instead.
export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// Returns the authenticated user's id (matches auth.users.id == public.User.id)
// or null when not signed in.
export async function getSessionUserId(): Promise<string | null> {
  if (supabaseConfigured) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  }
  return getDevSessionUserId();
}
