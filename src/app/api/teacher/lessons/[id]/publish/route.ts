import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";

// PATCH /api/teacher/lessons/:id/publish — DRAFT → PUBLISHED.
// Scoped: only the lesson's own school can publish it.
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const lesson = await prisma.lesson.findFirst({
      where: withSchoolScope(user.schoolId, { id: params.id }),
    });
    if (!lesson) {
      throw new ApiError(404, "LESSON_NOT_FOUND", "الدرس غير موجود في مدرستك");
    }

    const updated =
      lesson.status === "PUBLISHED"
        ? lesson
        : await prisma.lesson.update({
            where: { id: lesson.id },
            data: { status: "PUBLISHED" },
          });

    return NextResponse.json({
      lesson: { id: updated.id, title: updated.title, status: updated.status },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
