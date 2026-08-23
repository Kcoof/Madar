import { ApiError } from "@/lib/api";
import { supabaseConfigured } from "@/lib/session";
import { devCreateAuthUser } from "@/lib/dev-auth";

// Creates an auth account (Supabase admin API with the service role key —
// server-side administrative use only — or the local auth.users stub in dev
// mode). The handle_new_user trigger creates the public.User row (STUDENT,
// inactive). Returns the new auth user id; callers then promote the row.
export async function createAuthUser(
  email: string,
  password: string,
  fullName: string
): Promise<string> {
  if (supabaseConfigured) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName },
    });
    if (error || !data.user) {
      throw new ApiError(400, "USER_CREATE_FAILED", error?.message ?? "فشل إنشاء الحساب");
    }
    return data.user.id;
  }
  return devCreateAuthUser(email, password, fullName);
}
