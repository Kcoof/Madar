import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { createSchoolSchema } from "@/lib/validators/school";
import { supabaseConfigured } from "@/lib/session";
import { devCreateAuthUser } from "@/lib/dev-auth";

// Creates the school admin's auth account (Supabase admin API with the
// service role key — server-side administrative use only — or the local
// auth.users stub in dev mode). Returns the new auth user id.
async function createAdminAuthUser(
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
      throw new ApiError(400, "ADMIN_CREATE_FAILED", error?.message ?? "فشل إنشاء حساب المدير");
    }
    return data.user.id;
  }
  return devCreateAuthUser(email, password, fullName);
}

// GET /api/madar-admin/schools — list all schools. MADAR_OWNER only.
export async function GET() {
  try {
    await requireRole(["MADAR_OWNER"]);
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ schools });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/madar-admin/schools — create a school + its SCHOOL_ADMIN.
export async function POST(request: Request) {
  try {
    await requireRole(["MADAR_OWNER"]);
    const body = createSchoolSchema.parse(await request.json());
    const adminEmail = body.adminEmail.toLowerCase();

    const emailTaken = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (emailTaken) {
      throw new ApiError(409, "EMAIL_TAKEN", "بريد المدير مستخدم مسبقاً");
    }

    const school = await prisma.school.create({ data: { name: body.name } });

    try {
      // Trigger creates the User row (STUDENT); promote it to the school's admin.
      const adminId = await createAdminAuthUser(adminEmail, body.adminPassword, body.adminFullName);
      const admin = await prisma.user.update({
        where: { id: adminId },
        data: {
          fullName: body.adminFullName,
          role: "SCHOOL_ADMIN",
          schoolId: school.id,
          isActive: true,
        },
      });
      return NextResponse.json(
        { school: { id: school.id, name: school.name }, admin: { id: admin.id, email: admin.email } },
        { status: 201 }
      );
    } catch (error) {
      // Roll the school back so we never leave a school without its admin.
      await prisma.school.delete({ where: { id: school.id } }).catch(() => {});
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
