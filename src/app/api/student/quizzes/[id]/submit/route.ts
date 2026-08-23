import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { visiblePublishedLessonsWhere } from "@/lib/lesson-visibility";
import { submitQuizSchema } from "@/lib/validators/quiz";
import { computeSubjectProgress } from "@/lib/progress";

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Grades one question against the trusted DB rows. All-or-nothing per question.
function gradeQuestion(
  question: {
    type: string;
    points: number;
    answers: { id: string; text: string; isCorrect: boolean }[];
  },
  answer: { answerIds?: string[]; text?: string } | undefined
): number {
  const correct = question.answers.filter((a) => a.isCorrect);
  if (!answer) return 0;

  if (question.type === "MCQ" || question.type === "TRUE_FALSE") {
    const picked = answer.answerIds?.[0];
    return picked && correct.length === 1 && correct[0].id === picked
      ? question.points
      : 0;
  }
  if (question.type === "MULTI_SELECT") {
    const picked = new Set(answer.answerIds ?? []);
    const correctIds = new Set(correct.map((a) => a.id));
    if (picked.size !== correctIds.size) return 0;
    for (const id of picked) if (!correctIds.has(id)) return 0;
    return question.points;
  }
  // SHORT_ANSWER — normalized text comparison against the model answer
  if (correct.length !== 1) return 0;
  return normalize(answer.text ?? "") === normalize(correct[0].text)
    ? question.points
    : 0;
}

// POST /api/student/quizzes/:id/submit — grade server-side ONLY:
// the request carries answers only; any "score" in the payload is ignored.
// Submissions beyond maxAttempts are rejected with ATTEMPTS_EXHAUSTED.
export async function POST(
  request: Request,
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
        questions: { include: { answers: true } },
      },
    });
    if (!quiz) {
      throw new ApiError(404, "QUIZ_NOT_FOUND", "الاختبار غير متاح");
    }

    const attemptsUsed = await prisma.result.count({
      where: { quizId: quiz.id, studentId: student.id },
    });
    if (attemptsUsed >= quiz.maxAttempts) {
      throw new ApiError(
        403,
        "ATTEMPTS_EXHAUSTED",
        `استنفدت عدد المحاولات المسموح بها (${quiz.maxAttempts})`
      );
    }

    const body = submitQuizSchema.parse(await request.json());
    const byQuestion = new Map(body.answers.map((a) => [a.questionId, a]));

    let score = 0;
    let maxScore = 0;
    for (const question of quiz.questions) {
      maxScore += question.points;
      score += gradeQuestion(question, byQuestion.get(question.id));
    }

    const result = await prisma.result.create({
      data: {
        quizId: quiz.id,
        studentId: student.id,
        score,
        maxScore,
        attempt: attemptsUsed + 1,
      },
    });

    // Keep the per-subject Progress row in sync (proportional completion).
    const { subjects, overall } = await computeSubjectProgress(student);
    const subjectId = quiz.lesson.unit.subject.id;
    const rate = subjects.find((s) => s.subjectId === subjectId)?.completionRate ?? 0;
    const existing = await prisma.progress.findFirst({
      where: { studentId: student.id, subjectId },
    });
    if (existing) {
      await prisma.progress.update({
        where: { id: existing.id },
        data: { completionRate: rate },
      });
    } else {
      await prisma.progress.create({
        data: { studentId: student.id, subjectId, completionRate: rate },
      });
    }

    return NextResponse.json({
      result: { score, maxScore, attempt: result.attempt },
      attemptsLeft: quiz.maxAttempts - result.attempt,
      subjectProgress: rate,
      overallProgress: overall,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
