"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell } from "@/components/shared";
import { studentNav } from "@/components/shared/navs";
import { apiFetch } from "@/lib/api-client";

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

export default function StudentQuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ quizzes: StudentQuiz[]; message?: string }>("/api/student/quizzes");
      setQuizzes(data.quizzes);
      setMessage(data.message ?? null);
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
    <DashboardShell title="اختباراتي" nav={studentNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-amber-600">{message}</p>}

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
    </DashboardShell>
  );
}
