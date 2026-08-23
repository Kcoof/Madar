import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { createSchoolUserSchema } from "@/lib/validators/user";
import { createAuthUser } from "@/lib/auth-users";

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

// POST /api/school-admin/users — create a TEACHER or STUDENT for the
// admin's own school (active immediately; students get a grade).
export async function POST(request: Request) {
  try {
    const admin = await requireRole(["SCHOOL_ADMIN"]);
    if (!admin.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const body = createSchoolUserSchema.parse(await request.json());
    const email = body.email.toLowerCase();

    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      throw new ApiError(409, "EMAIL_TAKEN", "البريد الإلكتروني مستخدم مسبقاً");
    }

    let grade = null;
    if (body.role === "STUDENT") {
      grade = await prisma.grade.findUnique({
        where: { id: body.gradeId },
        include: { stage: true },
      });
      if (!grade) {
        throw new ApiError(404, "GRADE_NOT_FOUND", "الصف غير موجود");
      }
    }

    const id = await createAuthUser(email, body.password, body.fullName);
    const user = await prisma.user.update({
      where: { id },
      data: {
        fullName: body.fullName,
        role: body.role,
        schoolId: admin.schoolId,
        isActive: true,
        ...(body.role === "STUDENT" ? { gradeId: grade.id, stageId: grade.stageId } : {}),
      },
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, role: user.role } },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
