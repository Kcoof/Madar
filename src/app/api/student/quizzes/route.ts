import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole, subscriptionScope } from "@/lib/permissions";
import { visiblePublishedLessonsWhere } from "@/lib/lesson-visibility";

// GET /api/student/quizzes — quizzes inside the student's visible published
// lessons, with attempts used / allowed. Only subjects covered by an ACTIVE
// subscription are included (Phase E).
export async function GET() {
  try {
    const student = await requireRole(["STUDENT"]);
    const lessonsWhere = visiblePublishedLessonsWhere(student);

    if (!lessonsWhere) {
      return NextResponse.json({
        quizzes: [],
        message: "لم يتم تعيين صفك الدراسي بعد — راجع إدارة مدرستك",
      });
    }

    const scope = await subscriptionScope(student.id);
    const all = await prisma.quiz.findMany({
      where: { lesson: lessonsWhere },
      orderBy: { id: "desc" },
      include: {
        lesson: { include: { unit: { include: { subject: true } } } },
        results: { where: { studentId: student.id }, select: { score: true } },
        _count: { select: { questions: true } },
      },
    });

    const quizzes = (scope.fullYear
      ? all
      : all.filter((q) => scope.subjectIds.has(q.lesson.unit.subject.id))
    ).map((q) => ({
      id: q.id,
      title: q.title,
      lessonTitle: q.lesson.title,
      subjectName: q.lesson.unit.subject.name,
      questionCount: q._count.questions,
      maxAttempts: q.maxAttempts,
      attemptsUsed: q.results.length,
      bestScore: q.results.length > 0 ? Math.max(...q.results.map((r) => r.score)) : null,
    }));

    return NextResponse.json({ quizzes });
  } catch (error) {
    return errorResponse(error);
  }
}
