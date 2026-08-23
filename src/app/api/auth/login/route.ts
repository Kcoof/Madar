import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { loginSchema } from "@/lib/validators/auth";
import { supabaseConfigured } from "@/lib/session";
import { devVerifyLogin, setDevSession } from "@/lib/dev-auth";

// POST /api/auth/login — public. Session is managed via cookies:
// Supabase Auth cookies (@supabase/ssr) or the local dev session cookie.
export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    if (supabaseConfigured) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: body.password,
      });
      if (error || !data.user) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "البريد الإلكتروني أو كلمة المرور غير صحيحة");
      }
      const user = await prisma.user.findUnique({ where: { id: data.user.id } });
      return NextResponse.json({
        user: { id: data.user.id, email, role: user?.role ?? null, isActive: user?.isActive ?? false },
      });
    }

    // Local dev mode
    const userId = await devVerifyLogin(email, body.password);
    if (!userId) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    }
    await setDevSession(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return NextResponse.json({
      user: { id: userId, email, role: user?.role ?? null, isActive: user?.isActive ?? false },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
