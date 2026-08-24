import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, checkSubjectAccess } from "@/lib/permissions";
import { visiblePublishedLessonsWhere } from "@/lib/lesson-visibility";

// GET /api/student/quizzes/:id — the quiz for taking it. `isCorrect` is NEVER
// included; students only see answer ids and texts. The quiz's subject must
// be covered by an ACTIVE subscription (Phase E).
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const student = await requireRole(["STUDENT"]);
    const lessonsWhere = visiblePublishedLessonsWhere(student);
    if (!lessonsWhere) {
      throw new ApiError(404, "QUIZ_NOT_FOUND", "الاختبار غير متاح لصفك");
    }

    const quiz = await prisma.quiz.findFirst({
      where: { id: params.id, lesson: lessonsWhere },
      include: {
        lesson: { include: { unit: { include: { subject: true } } } },
        questions: {
          include: { answers: { select: { id: true, text: true } } },
        },
        results: { where: { studentId: student.id }, select: { id: true } },
      },
    });
    if (!quiz) {
      throw new ApiError(404, "QUIZ_NOT_FOUND", "الاختبار غير متاح");
    }

    if (!(await checkSubjectAccess(student.id, quiz.lesson.unit.subject.id))) {
      throw new ApiError(
        403,
        "SUBSCRIPTION_REQUIRED",
        "هذه المادة تتطلب اشتراكاً فعالاً"
      );
    }

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        timeLimitMin: quiz.timeLimitMin,
        maxAttempts: quiz.maxAttempts,
        attemptsUsed: quiz.results.length,
        canAttempt: quiz.results.length < quiz.maxAttempts,
        lessonTitle: quiz.lesson.title,
        subjectName: quiz.lesson.unit.subject.name,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          points: q.points,
          answers: q.answers,
        })),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
