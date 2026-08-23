"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/shared/app-header";
import { apiFetch } from "@/lib/api-client";

type Lesson = {
  id: string;
  title: string;
  unit: { title: string; subject: { name: string; grade: { name: string } } };
  _count: { videos: number; files: number };
};

export default function StudentPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ lessons: Lesson[]; message?: string }>("/api/student/lessons");
      setLessons(data.lessons);
      setMessage(data.message ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحميل الدروس";
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
                <Badge variant="secondary">
                  {lesson._count.videos} فيديو
                </Badge>
                <Badge variant="secondary">
                  {lesson._count.files} ملف
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lessons.length === 0 && !message && (
        <p className="text-center text-gray-500">لا توجد دروس منشورة لصفك بعد</p>
      )}
      </div>
    </main>
  );
}
