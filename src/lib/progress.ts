import { prisma } from "@/lib/prisma";
import { visiblePublishedLessonsWhere } from "@/lib/lesson-visibility";

// Progress per subject, per the plan: (completed lessons + completed quizzes)
// ÷ (total lessons + total quizzes), rounded to a percentage.
// A lesson counts as completed when all of its videos are watched ≥90% — or,
// when it has no videos, when the student has a Result for one of its quizzes.
// (A lesson with neither videos nor quizzes cannot complete yet — acceptable
// for the MVP, refined when real video streaming lands.)
export async function computeSubjectProgress(student: {
  id: string;
  gradeId: string | null;
  schoolId: string | null;
}) {
  const lessonsWhere = visiblePublishedLessonsWhere(student);
  if (!lessonsWhere) return { subjects: [] as SubjectProgress[], overall: 0 };

  const lessons = await prisma.lesson.findMany({
    where: lessonsWhere,
    include: {
      videos: {
        include: {
          watchLogs: { where: { studentId: student.id }, select: { watchedPercent: true } },
        },
      },
      quizzes: {
        include: { results: { where: { studentId: student.id }, select: { id: true } } },
      },
      unit: { include: { subject: { select: { id: true, name: true } } } },
    },
  });

  const bySubject = new Map<string, { name: string; total: number; completed: number }>();
  for (const lesson of lessons) {
    const subject = lesson.unit.subject;
    const entry = bySubject.get(subject.id) ?? { name: subject.name, total: 0, completed: 0 };

    entry.total += 1 + lesson.quizzes.length;

    const hasVideos = lesson.videos.length > 0;
    const watchedAll =
      hasVideos &&
      lesson.videos.every(
        (v) => (v.watchLogs[0]?.watchedPercent ?? 0) >= 90
      );
    const answeredQuiz = lesson.quizzes.some((q) => q.results.length > 0);
    if (watchedAll || (!hasVideos && answeredQuiz)) entry.completed += 1;

    entry.completed += lesson.quizzes.filter((q) => q.results.length > 0).length;

    bySubject.set(subject.id, entry);
  }

  const subjects = [...bySubject.entries()].map(([subjectId, e]) => ({
    subjectId,
    subjectName: e.name,
    completionRate: e.total === 0 ? 0 : Math.round((e.completed / e.total) * 100),
  }));

  const overall =
    subjects.length === 0
      ? 0
      : Math.round(subjects.reduce((sum, s) => sum + s.completionRate, 0) / subjects.length);

  return { subjects, overall };
}

type SubjectProgress = {
  subjectId: string;
  subjectName: string;
  completionRate: number;
};
