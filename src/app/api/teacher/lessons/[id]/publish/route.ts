import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { notifyUsers } from "@/lib/notifications";

// PATCH /api/teacher/lessons/:id/publish — DRAFT → PUBLISHED.
// Scoped: only the lesson's own school can publish it. Students of the
// lesson's grade (own school, or every school for central content) are
// notified automatically.
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
      include: { unit: { include: { subject: true } } },
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

    if (updated.status === "PUBLISHED" && lesson.status === "DRAFT") {
      const gradeId = lesson.unit.subject.gradeId;
      // Central content (schoolId = null) targets the grade in every school.
      const students = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          isActive: true,
          gradeId,
          ...(lesson.schoolId ? { schoolId: lesson.schoolId } : {}),
        },
        select: { id: true, email: true },
      });
      await notifyUsers(
        students,
        "درس جديد لصفك",
        `تم نشر درس «${lesson.title}» في مادة ${lesson.unit.subject.name}.`
      );
    }

    return NextResponse.json({
      lesson: { id: updated.id, title: updated.title, status: updated.status },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
