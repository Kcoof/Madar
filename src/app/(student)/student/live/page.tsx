"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell } from "@/components/shared";
import { studentNav } from "@/components/shared/navs";
import { apiFetch } from "@/lib/api-client";

type StudentLiveClass = {
  id: string;
  subjectName: string;
  teacherName: string;
  scheduledAt: string;
  micGranted: boolean;
};

export default function StudentLivePage() {
  const router = useRouter();
  const [liveClasses, setLiveClasses] = useState<StudentLiveClass[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ liveClasses: StudentLiveClass[]; message?: string }>("/api/student/live-classes");
      setLiveClasses(data.liveClasses);
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
    <DashboardShell title="الحصص المباشرة" nav={studentNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-amber-600">{message}</p>}

      <div className="grid gap-4">
        {liveClasses.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <p className="font-medium">{c.subjectName}</p>
                <p className="text-sm text-gray-600">
                  مع الحصة: {c.teacherName} · {new Date(c.scheduledAt).toLocaleString("ar")}
                </p>
                <p className="text-xs text-gray-500">
                  {c.micGranted ? "لديك إذن التحدث في هذه الحصة" : "وضع المشاهدة — يمنح المعلم المايك عند الحاجة"}
                </p>
              </div>
              <Link href={`/live/${c.id}`}>
                <Button>دخول الغرفة</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
        {liveClasses.length === 0 && (
          <p className="text-center text-gray-500">لا توجد حصص مباشرة مجدولة لصفك</p>
        )}
      </div>
    </DashboardShell>
  );
}
