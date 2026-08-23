import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { supabaseConfigured } from "@/lib/session";
import { clearDevSession } from "@/lib/dev-auth";

// POST /api/auth/logout — clears the session (Supabase or local dev cookie).
export async function POST() {
  try {
    if (supabaseConfigured) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      await supabase.auth.signOut();
    } else {
      await clearDevSession();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
