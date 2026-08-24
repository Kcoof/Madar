"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardShell } from "@/components/shared";
import { teacherNav } from "@/components/shared/navs";
import { apiFetch } from "@/lib/api-client";

type Stage = { id: string; name: string; grades: { id: string; name: string; subjects: { id: string; name: string }[] }[] };

type LiveClass = {
  id: string;
  roomName: string | null;
  rtmpUrl: string | null;
  whipUrl?: string | null;
  scheduledAt: string;
  endedAt: string | null;
  subject: { name: string; grade: { name: string } };
};

type LiveClassDetail = {
  liveClass: LiveClass;
  students: { id: string; fullName: string; email: string; micGranted: boolean }[];
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function TeacherLivePage() {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [liveDetail, setLiveDetail] = useState<LiveClassDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [liveSubjectId, setLiveSubjectId] = useState("");
  const [liveScheduledAt, setLiveScheduledAt] = useState("");

  const grades = useMemo(() => stages.flatMap((s) => s.grades), [stages]);

  const load = useCallback(async () => {
    try {
      const [curriculum, liveData] = await Promise.all([
        apiFetch<{ stages: Stage[] }>("/api/academic/curriculum"),
        apiFetch<{ liveClasses: LiveClass[] }>("/api/teacher/live-classes"),
      ]);
      setStages(curriculum.stages);
      setLiveClasses(liveData.liveClasses);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (message.includes("تسجيل الدخول")) router.push("/login");
      setError(message);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSchedule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/teacher/live-classes", {
        method: "POST",
        body: JSON.stringify({ subjectId: liveSubjectId, scheduledAt: liveScheduledAt }),
      });
      setLiveSubjectId("");
      setLiveScheduledAt("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل جدولة الحصة");
    } finally {
      setPending(false);
    }
  }

  async function onShowDetail(id: string) {
    setError(null);
    try {
      const data = await apiFetch<LiveClassDetail>(`/api/teacher/live-classes/${id}`);
      setLiveDetail(liveDetail?.liveClass.id === id ? null : data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل تفاصيل الحصة");
    }
  }

  async function onToggleMic(classId: string, studentId: string, grant: boolean) {
    setError(null);
    try {
      await apiFetch(`/api/live-classes/${classId}/${grant ? "grant-mic" : "revoke-mic"}/${studentId}`, {
        method: "PATCH",
      });
      await onShowDetail(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحديث الإذن");
    }
  }

  async function onEndLive(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/live-classes/${id}/end`, { method: "POST" });
      setLiveDetail(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنهاء الحصة");
    }
  }

  return (
    <DashboardShell title="لوحة المعلم" nav={teacherNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">البث المباشر</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "إلغاء" : "جدولة حصة مباشرة"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>حصة مباشرة جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSchedule} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="liveSubject">المادة</Label>
                <select id="liveSubject" className={selectClass} required value={liveSubjectId}
                  onChange={(e) => setLiveSubjectId(e.target.value)}>
                  <option value="">اختر المادة</option>
                  {grades.flatMap((g) =>
                    g.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {g.name} — {s.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="liveAt">موعد الحصة</Label>
                <Input id="liveAt" type="datetime-local" required value={liveScheduledAt}
                  onChange={(e) => setLiveScheduledAt(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={pending || !liveSubjectId}>
                  {pending ? "جارٍ الجدولة..." : "جدولة"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>الحصص المباشرة ({liveClasses.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المادة / الصف</TableHead>
                <TableHead>الموعد</TableHead>
                <TableHead>الغرفة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveClasses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.subject.name} — {c.subject.grade.name}
                  </TableCell>
                  <TableCell>{new Date(c.scheduledAt).toLocaleString("ar")}</TableCell>
                  <TableCell dir="ltr" className="text-xs">{c.roomName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.endedAt ? "secondary" : "default"}>
                      {c.endedAt ? "منتهية" : "مجدولة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 space-x-reverse">
                    {!c.endedAt && (
                      <>
                        <Link href={`/live/${c.id}`}>
                          <Button size="sm">دخول الغرفة</Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => onShowDetail(c.id)}>
                          {liveDetail?.liveClass.id === c.id ? "إغلاق" : "الطلاب والأذونات"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onEndLive(c.id)}>
                          إنهاء
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {liveClasses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    لا توجد حصص مجدولة بعد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {liveDetail && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1 rounded bg-gray-50 p-3 text-sm">
                <p className="font-medium">إعدادات البث (سرية — لك وحدك):</p>
                <p dir="ltr" className="break-all">WHIP: {liveDetail.liveClass.whipUrl ?? "غير متاح"}</p>
                <p className="text-xs text-gray-500">
                  انسخ رابط WHIP إلى OBS (إخراج WHIP) أو تطبيق Larix Broadcaster على الجوال لبث الكاميرا
                </p>
                <p dir="ltr" className="break-all text-xs text-gray-400">RTMP: {liveDetail.liveClass.rtmpUrl}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">أذونات المايك — طلاب الصف:</p>
                <div className="space-y-2">
                  {liveDetail.students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded border p-2">
                      <span className="text-sm">{s.fullName}</span>
                      <Button
                        size="sm"
                        variant={s.micGranted ? "destructive" : "outline"}
                        onClick={() => onToggleMic(liveDetail.liveClass.id, s.id, !s.micGranted)}
                      >
                        {s.micGranted ? "سحب المايك" : "منح المايك"}
                      </Button>
                    </div>
                  ))}
                  {liveDetail.students.length === 0 && (
                    <p className="text-sm text-gray-500">لا يوجد طلاب في هذا الصف بعد</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
