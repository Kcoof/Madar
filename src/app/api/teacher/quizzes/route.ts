import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { createQuizSchema } from "@/lib/validators/quiz";

// POST /api/teacher/quizzes — create a quiz with its questions and answers.
// TEACHER only (per the Phase C table). The lesson must belong to the
// teacher's school. isCorrect flags are stored server-side and are never
// returned to students.
export async function POST(request: Request) {
  try {
    const user = await requireRole(["TEACHER"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const body = createQuizSchema.parse(await request.json());

    const lesson = await prisma.lesson.findFirst({
      where: withSchoolScope(user.schoolId, { id: body.lessonId }),
    });
    if (!lesson) {
      throw new ApiError(404, "LESSON_NOT_FOUND", "الدرس غير موجود في مدرستك");
    }

    // Validate answer correctness shape per question type.
    for (const [i, q] of body.questions.entries()) {
      const correctCount = q.answers.filter((a) => a.isCorrect).length;
      if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
        if (q.answers.length < 2)
          throw new ApiError(400, "INVALID_QUESTION", `السؤال ${i + 1}: يحتاج خيارين على الأقل`);
        if (correctCount !== 1)
          throw new ApiError(400, "INVALID_QUESTION", `السؤال ${i + 1}: يجب تحديد إجابة صحيحة واحدة بالضبط`);
      } else if (q.type === "MULTI_SELECT") {
        if (correctCount < 1)
          throw new ApiError(400, "INVALID_QUESTION", `السؤال ${i + 1}: حدد إجابة صحيحة واحدة على الأقل`);
      } else if (q.type === "SHORT_ANSWER") {
        if (q.answers.length !== 1 || !q.answers[0].isCorrect)
          throw new ApiError(400, "INVALID_QUESTION", `السؤال ${i + 1}: أدخل الإجابة النموذجية الصحيحة فقط`);
      }
    }

    const quiz = await prisma.quiz.create({
      data: {
        lessonId: lesson.id,
        title: body.title,
        timeLimitMin: body.timeLimitMin ?? null,
        maxAttempts: body.maxAttempts,
        questions: {
          create: body.questions.map((q) => ({
            type: q.type,
            text: q.text,
            points: q.points,
            answers: {
              create: q.answers.map((a) => ({
                text: a.text,
                isCorrect: a.isCorrect ?? false,
              })),
            },
          })),
        },
      },
      include: { _count: { select: { questions: true } } },
    });

    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/teacher/quizzes — the school's quizzes.
export async function GET() {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const quizzes = await prisma.quiz.findMany({
      where: { lesson: withSchoolScope(user.schoolId) },
      orderBy: { id: "desc" },
      include: {
        lesson: { include: { unit: { include: { subject: true } } } },
        _count: { select: { questions: true, results: true } },
      },
    });

    return NextResponse.json({ quizzes });
  } catch (error) {
    return errorResponse(error);
  }
}
