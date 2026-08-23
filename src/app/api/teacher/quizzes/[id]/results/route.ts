import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";

// GET /api/teacher/quizzes/:id/results — every student's Result for the quiz
// plus the students of the matching grade who have NOT submitted yet.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const quiz = await prisma.quiz.findFirst({
      where: { id: params.id, lesson: withSchoolScope(user.schoolId) },
      include: {
        lesson: { include: { unit: { include: { subject: true } } } },
        results: {
          orderBy: { createdAt: "desc" },
          include: { student: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
    if (!quiz) {
      throw new ApiError(404, "QUIZ_NOT_FOUND", "الاختبار غير موجود في مدرستك");
    }

    const gradeId = quiz.lesson.unit.subject.gradeId;
    const notSubmitted = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        schoolId: user.schoolId,
        gradeId,
        isActive: true,
        results: { none: { quizId: quiz.id } },
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        maxAttempts: quiz.maxAttempts,
        maxScore: quiz.results[0]?.maxScore ?? null,
      },
      results: quiz.results.map((r) => ({
        student: r.student,
        score: r.score,
        maxScore: r.maxScore,
        attempt: r.attempt,
        createdAt: r.createdAt,
      })),
      notSubmitted,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
