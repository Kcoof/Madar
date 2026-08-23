"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/shared/app-header";
import { apiFetch } from "@/lib/api-client";

type Lesson = {
  id: string;
  title: string;
  unit: { title: string; subject: { name: string; grade: { name: string } } };
  _count: { videos: number; files: number };
};

type StudentQuiz = {
  id: string;
  title: string;
  lessonTitle: string;
  subjectName: string;
  questionCount: number;
  maxAttempts: number;
  attemptsUsed: number;
  bestScore: number | null;
};

export default function StudentPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [lessonsData, quizzesData] = await Promise.all([
        apiFetch<{ lessons: Lesson[]; message?: string }>("/api/student/lessons"),
        apiFetch<{ quizzes: StudentQuiz[]; message?: string }>("/api/student/quizzes"),
      ]);
      setLessons(lessonsData.lessons);
      setMessage(lessonsData.message ?? quizzesData.message ?? null);
      setQuizzes(quizzesData.quizzes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (msg.includes("تسجيل الدخول")) router.push("/login");
      setError(msg);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen">
      <AppHeader title="دروسي" />
      <div className="mx-auto max-w-4xl space-y-6 p-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-amber-600">{message}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {lessons.map((lesson) => (
          <Card key={lesson.id}>
            <CardHeader>
              <CardTitle className="text-lg">{lesson.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-600">
              <p>
                {lesson.unit.subject.name} — {lesson.unit.subject.grade.name}
              </p>
              <p>{lesson.unit.title}</p>
              <div className="flex gap-2">
                <Badge variant="secondary">{lesson._count.videos} فيديو</Badge>
                <Badge variant="secondary">{lesson._count.files} ملف</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lessons.length === 0 && !message && (
        <p className="text-center text-gray-500">لا توجد دروس منشورة لصفك بعد</p>
      )}

      <h2 className="pt-4 text-lg font-bold text-gray-700">اختباراتي</h2>
      <div className="grid gap-4">
        {quizzes.map((quiz) => {
          const canAttempt = quiz.attemptsUsed < quiz.maxAttempts;
          return (
            <Card key={quiz.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <p className="font-medium">{quiz.title}</p>
                  <p className="text-sm text-gray-600">
                    {quiz.subjectName} — {quiz.lessonTitle} · {quiz.questionCount} سؤالاً
                  </p>
                  <p className="text-xs text-gray-500">
                    المحاولات: {quiz.attemptsUsed} / {quiz.maxAttempts}
                    {quiz.bestScore !== null && ` · أفضل نتيجة: ${quiz.bestScore}`}
                  </p>
                </div>
                {canAttempt ? (
                  <Link href={`/student/quiz/${quiz.id}`}>
                    <Button>{quiz.attemptsUsed > 0 ? "إعادة المحاولة" : "ابدأ الاختبار"}</Button>
                  </Link>
                ) : (
                  <Badge variant="secondary">استنفدت المحاولات</Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
        {quizzes.length === 0 && (
          <p className="text-center text-gray-500">لا توجد اختبارات متاحة لصفك بعد</p>
        )}
      </div>
      </div>
    </main>
  );
}
