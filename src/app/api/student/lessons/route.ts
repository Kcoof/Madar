import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole, subscriptionScope } from "@/lib/permissions";
import { visiblePublishedLessonsWhere } from "@/lib/lesson-visibility";

// GET /api/student/lessons — PUBLISHED lessons of the student's grade:
// central content (schoolId = null) + their own school's lessons only,
// limited to subjects covered by an ACTIVE subscription (Phase E).
export async function GET() {
  try {
    const student = await requireRole(["STUDENT"]);

    if (!student.gradeId) {
      return NextResponse.json({
        lessons: [],
        message: "لم يتم تعيين صفك الدراسي بعد — راجع إدارة مدرستك",
      });
    }

    const scope = await subscriptionScope(student.id);
    const all = await prisma.lesson.findMany({
      where: visiblePublishedLessonsWhere(student)!,
      orderBy: { createdAt: "desc" },
      include: {
        unit: { include: { subject: { include: { grade: true } } } },
        _count: { select: { videos: true, files: true } },
      },
    });

    const lessons = scope.fullYear
      ? all
      : all.filter((l) => scope.subjectIds.has(l.unit.subject.id));

    return NextResponse.json({
      lessons,
      ...(scope.fullYear || scope.subjectIds.size > 0
        ? {}
        : { message: "لا يوجد اشتراك نشط — اطلب اشتراكاً لفتح المحتوى" }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
