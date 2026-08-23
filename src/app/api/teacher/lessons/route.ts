import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { createLessonSchema } from "@/lib/validators/lesson";

// POST /api/teacher/lessons — create a DRAFT lesson in the caller's school.
// TEACHER, SCHOOL_ADMIN. The unit belongs to the shared curriculum.
export async function POST(request: Request) {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const body = createLessonSchema.parse(await request.json());
    const unit = await prisma.unit.findUnique({
      where: { id: body.unitId },
      include: { subject: { include: { grade: true } } },
    });
    if (!unit) {
      throw new ApiError(404, "UNIT_NOT_FOUND", "الوحدة غير موجودة");
    }

    const lesson = await prisma.lesson.create({
      data: {
        title: body.title,
        unitId: body.unitId,
        status: "DRAFT",
        schoolId: user.schoolId,
      },
      include: { unit: { include: { subject: true } } },
    });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/teacher/lessons — the school's lessons (central content is
// read-only and not manageable here). TEACHER, SCHOOL_ADMIN.
export async function GET() {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const lessons = await prisma.lesson.findMany({
      where: withSchoolScope(user.schoolId),
      orderBy: { createdAt: "desc" },
      include: {
        unit: { include: { subject: { include: { grade: true } } } },
        _count: { select: { videos: true, files: true } },
      },
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    return errorResponse(error);
  }
}
