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

type StudentLiveClass = {
  id: string;
  subjectName: string;
  gradeName: string;
  teacherName: string;
  scheduledAt: string;
  micGranted: boolean;
};

type JoinResult = { mode: string; canPublish: boolean; roomName: string | null };

export default function StudentPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [liveClasses, setLiveClasses] = useState<StudentLiveClass[]>([]);
  const [joinResults, setJoinResults] = useState<Record<string, JoinResult | string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [lessonsData, quizzesData, liveData] = await Promise.all([
        apiFetch<{ lessons: Lesson[]; message?: string }>("/api/student/lessons"),
        apiFetch<{ quizzes: StudentQuiz[]; message?: string }>("/api/student/quizzes"),
        apiFetch<{ liveClasses: StudentLiveClass[]; message?: string }>("/api/student/live-classes"),
      ]);
      setLessons(lessonsData.lessons);
      setMessage(lessonsData.message ?? quizzesData.message ?? liveData.message ?? null);
      setQuizzes(quizzesData.quizzes);
      setLiveClasses(liveData.liveClasses);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (msg.includes("تسجيل الدخول")) router.push("/login");
      setError(msg);
    }
  }, [router]);

  async function onJoin(id: string) {
    setJoinResults((prev) => ({ ...prev, [id]: "..." }));
    try {
      const data = await apiFetch<JoinResult>(`/api/live-classes/${id}/join`, { method: "POST" });
      setJoinResults((prev) => ({ ...prev, [id]: data }));
    } catch (err) {
      setJoinResults((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "فشل الدخول",
      }));
    }
  }

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

      <h2 className="pt-4 text-lg font-bold text-gray-700">الحصص المباشرة</h2>
      <div className="grid gap-4">
        {liveClasses.map((c) => {
          const jr = joinResults[c.id];
          return (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <p className="font-medium">{c.subjectName} — {c.gradeName}</p>
                  <p className="text-sm text-gray-600">
                    مع الحصة: {c.teacherName} · {new Date(c.scheduledAt).toLocaleString("ar")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.micGranted ? "لديك إذن التحدث في هذه الحصة" : "وضع المشاهدة — يمنح المعلم المايك عند الحاجة"}
                  </p>
                </div>
                <div className="space-y-2 text-left">
                  <Button onClick={() => onJoin(c.id)}>دخول الحصة</Button>
                  {jr && typeof jr === "string" && <p className="text-xs text-gray-500">{jr}</p>}
                  {jr && typeof jr === "object" && (
                    <p className="text-xs text-gray-600">
                      تم إصدار توكن الدخول ({jr.mode}) — غرفة: <span dir="ltr">{jr.roomName}</span>.
                      مشغّل الفيديو الفعلي يُفعَّل عند ربط LiveKit.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {liveClasses.length === 0 && (
          <p className="text-center text-gray-500">لا توجد حصص مباشرة مجدولة لصفك</p>
        )}
      </div>
      </div>
    </main>
  );
}
