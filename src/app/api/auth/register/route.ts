import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { registerSchema } from "@/lib/validators/auth";
import { supabaseConfigured } from "@/lib/session";
import { devCreateAuthUser } from "@/lib/dev-auth";

// POST /api/auth/register — public. Creates an account (STUDENT, isActive=false).
// The public.User row is created by the handle_new_user DB trigger in both modes.
export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "EMAIL_TAKEN", "البريد الإلكتروني مستخدم مسبقاً");
    }

    if (supabaseConfigured) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: body.password,
        options: { data: { fullName: body.fullName } },
      });
      if (error || !data.user) {
        throw new ApiError(400, "REGISTER_FAILED", error?.message ?? "فشل إنشاء الحساب");
      }
      return NextResponse.json(
        { user: { id: data.user.id, email } },
        { status: 201 }
      );
    }

    // Local dev mode — insert into the auth.users stub (trigger creates User row)
    const id = await devCreateAuthUser(email, body.password, body.fullName);
    return NextResponse.json({ user: { id, email } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
