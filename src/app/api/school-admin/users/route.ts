import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";

// GET /api/school-admin/users — the school's users only.
// Isolation: RLS (database) + withSchoolScope (app layer) — a schoolId sent
// in the query string is ignored; the admin's OWN schoolId from the session
// is always what's used.
export async function GET(request: Request) {
  try {
    const admin = await requireRole(["SCHOOL_ADMIN"]);
    if (!admin.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const users = await prisma.user.findMany({
      where: withSchoolScope(admin.schoolId),
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users, schoolId: admin.schoolId });
  } catch (error) {
    return errorResponse(error);
  }
}
