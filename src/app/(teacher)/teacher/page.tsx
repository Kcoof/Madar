"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

type Unit = { id: string; title: string };
type Subject = { id: string; name: string; units: Unit[] };
type Grade = { id: string; name: string; subjects: Subject[] };
type Stage = { id: string; name: string; grades: Grade[] };

type Lesson = {
  id: string;
  title: string;
  status: string;
  unit: { title: string; subject: { name: string; grade: { name: string } } };
  _count: { videos: number; files: number };
};

export default function TeacherPage() {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [gradeId, setGradeId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");

  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [providerId, setProviderId] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");

  const grades = useMemo(() => stages.flatMap((s) => s.grades), [stages]);
  const subjects = useMemo(
    () => grades.find((g) => g.id === gradeId)?.subjects ?? [],
    [grades, gradeId]
  );
  const units = useMemo(
    () => subjects.find((s) => s.id === subjectId)?.units ?? [],
    [subjects, subjectId]
  );

  const load = useCallback(async () => {
    try {
      const [curriculum, lessonsData] = await Promise.all([
        apiFetch<{ stages: Stage[] }>("/api/academic/curriculum"),
        apiFetch<{ lessons: Lesson[] }>("/api/teacher/lessons"),
      ]);
      setStages(curriculum.stages);
      setLessons(lessonsData.lessons);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (message.includes("تسجيل الدخول")) router.push("/login");
      setError(message);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/teacher/lessons", {
        method: "POST",
        body: JSON.stringify({ title, unitId }),
      });
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء الدرس");
    } finally {
      setPending(false);
    }
  }

  async function onPublish(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/teacher/lessons/${id}/publish`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل نشر الدرس");
    }
  }

  async function onAttachVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLesson) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/lessons/${selectedLesson.id}/video`, {
        method: "POST",
        body: JSON.stringify({ providerId }),
      });
      setProviderId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إضافة الفيديو");
    }
  }

  async function onAttachFile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLesson) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/lessons/${selectedLesson.id}/files`, {
        method: "POST",
        body: JSON.stringify({ url: fileUrl, fileName }),
      });
      setFileUrl("");
      setFileName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إضافة الملف");
    }
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">لوحة المعلم — الدروس</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>إنشاء درس جديد (مسودة)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreateLesson} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="grade">الصف</Label>
              <select
                id="grade"
                className={selectClass}
                required
                value={gradeId}
                onChange={(e) => {
                  setGradeId(e.target.value);
                  setSubjectId("");
                  setUnitId("");
                }}
              >
                <option value="">اختر الصف</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">المادة</Label>
              <select
                id="subject"
                className={selectClass}
                required
                value={subjectId}
                disabled={!gradeId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setUnitId("");
                }}
              >
                <option value="">اختر المادة</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">الوحدة</Label>
              <select
                id="unit"
                className={selectClass}
                required
                value={unitId}
                disabled={!subjectId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">اختر الوحدة</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">عنوان الدرس</Label>
              <Input
                id="title"
                required
                minLength={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <Button type="submit" disabled={pending || !unitId}>
                {pending ? "جارٍ الإنشاء..." : "إنشاء الدرس"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>دروس مدرستك ({lessons.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الدرس</TableHead>
                <TableHead>المادة / الصف</TableHead>
                <TableHead>الفيديوهات</TableHead>
                <TableHead>الملفات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lessons.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell className="font-medium">{lesson.title}</TableCell>
                  <TableCell>
                    {lesson.unit.subject.name} — {lesson.unit.subject.grade.name}
                  </TableCell>
                  <TableCell>{lesson._count.videos}</TableCell>
                  <TableCell>{lesson._count.files}</TableCell>
                  <TableCell>
                    <Badge variant={lesson.status === "PUBLISHED" ? "default" : "secondary"}>
                      {lesson.status === "PUBLISHED" ? "منشور" : "مسودة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 space-x-reverse">
                    {lesson.status === "DRAFT" && (
                      <Button size="sm" onClick={() => onPublish(lesson.id)}>
                        نشر
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelectedLesson(selectedLesson?.id === lesson.id ? null : lesson)
                      }
                    >
                      {selectedLesson?.id === lesson.id ? "إغلاق" : "إضافة محتوى"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lessons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    لا توجد دروس بعد — ابدأ بإنشاء درس جديد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {selectedLesson && (
            <div className="grid gap-6 rounded-lg border p-4 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="font-medium">فيديو — «{selectedLesson.title}»</p>
                <p className="text-xs text-gray-500">
                  أدخل معرّف الفيديو لدى مزوّد البث (سيُربط بمزوّد حقيقي في مرحلة لاحقة)
                </p>
                <form onSubmit={onAttachVideo} className="space-y-2">
                  <Input
                    dir="ltr"
                    placeholder="providerId"
                    required
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                  />
                  <Button type="submit" size="sm">
                    ربط الفيديو
                  </Button>
                </form>
              </div>
              <div className="space-y-3">
                <p className="font-medium">ملف مرفق</p>
                <form onSubmit={onAttachFile} className="space-y-2">
                  <Input
                    dir="ltr"
                    type="url"
                    placeholder="https://..."
                    required
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                  />
                  <Input
                    placeholder="اسم الملف"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                  <Button type="submit" size="sm">
                    إرفاق الملف
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
