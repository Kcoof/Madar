"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/shared/app-header";
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

type Quiz = {
  id: string;
  title: string;
  lesson: { title: string; unit: { subject: { name: string } } };
  _count: { questions: number; results: number };
};

type QuizResults = {
  quiz: { title: string; maxAttempts: number; maxScore: number | null };
  results: { student: { fullName: string }; score: number; maxScore: number; attempt: number }[];
  notSubmitted: { id: string; fullName: string }[];
};

type DraftAnswer = { text: string; isCorrect: boolean };
type DraftQuestion = {
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "MULTI_SELECT";
  text: string;
  points: number;
  answers: DraftAnswer[];
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function newQuestion(type: DraftQuestion["type"] = "MCQ"): DraftQuestion {
  if (type === "TRUE_FALSE") {
    return { type, text: "", points: 1, answers: [{ text: "صواب", isCorrect: true }, { text: "خطأ", isCorrect: false }] };
  }
  if (type === "SHORT_ANSWER") {
    return { type, text: "", points: 1, answers: [{ text: "", isCorrect: true }] };
  }
  return { type, text: "", points: 1, answers: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }] };
}

export default function TeacherPage() {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
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

  const [showQuizForm, setShowQuizForm] = useState(false);
  const [quizLessonId, setQuizLessonId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(1);
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);

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
      const [curriculum, lessonsData, quizzesData] = await Promise.all([
        apiFetch<{ stages: Stage[] }>("/api/academic/curriculum"),
        apiFetch<{ lessons: Lesson[] }>("/api/teacher/lessons"),
        apiFetch<{ quizzes: Quiz[] }>("/api/teacher/quizzes"),
      ]);
      setStages(curriculum.stages);
      setLessons(lessonsData.lessons);
      setQuizzes(quizzesData.quizzes);
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

  async function onCreateQuiz(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/teacher/quizzes", {
        method: "POST",
        body: JSON.stringify({
          lessonId: quizLessonId,
          title: quizTitle,
          maxAttempts: quizMaxAttempts,
          questions,
        }),
      });
      setQuizTitle("");
      setQuizMaxAttempts(1);
      setQuestions([newQuestion()]);
      setShowQuizForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء الاختبار");
    } finally {
      setPending(false);
    }
  }

  async function onShowResults(id: string) {
    setError(null);
    try {
      const data = await apiFetch<QuizResults>(`/api/teacher/quizzes/${id}/results`);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل النتائج");
    }
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateAnswer(qIndex: number, aIndex: number, patch: Partial<DraftAnswer>) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIndex
          ? { ...q, answers: q.answers.map((a, j) => (j === aIndex ? { ...a, ...patch } : a)) }
          : q
      )
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="لوحة المعلم" />
      <div className="mx-auto max-w-5xl space-y-6 p-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>إنشاء درس جديد (مسودة)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreateLesson} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="grade">الصف</Label>
              <select id="grade" className={selectClass} required value={gradeId}
                onChange={(e) => { setGradeId(e.target.value); setSubjectId(""); setUnitId(""); }}>
                <option value="">اختر الصف</option>
                {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">المادة</Label>
              <select id="subject" className={selectClass} required value={subjectId} disabled={!gradeId}
                onChange={(e) => { setSubjectId(e.target.value); setUnitId(""); }}>
                <option value="">اختر المادة</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">الوحدة</Label>
              <select id="unit" className={selectClass} required value={unitId} disabled={!subjectId}
                onChange={(e) => setUnitId(e.target.value)}>
                <option value="">اختر الوحدة</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">عنوان الدرس</Label>
              <Input id="title" required minLength={2} value={title}
                onChange={(e) => setTitle(e.target.value)} />
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
                  <TableCell>{lesson.unit.subject.name} — {lesson.unit.subject.grade.name}</TableCell>
                  <TableCell>{lesson._count.videos}</TableCell>
                  <TableCell>{lesson._count.files}</TableCell>
                  <TableCell>
                    <Badge variant={lesson.status === "PUBLISHED" ? "default" : "secondary"}>
                      {lesson.status === "PUBLISHED" ? "منشور" : "مسودة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 space-x-reverse">
                    {lesson.status === "DRAFT" && (
                      <Button size="sm" onClick={() => onPublish(lesson.id)}>نشر</Button>
                    )}
                    <Button size="sm" variant="outline"
                      onClick={() => setSelectedLesson(selectedLesson?.id === lesson.id ? null : lesson)}>
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
                  <Input dir="ltr" placeholder="providerId" required value={providerId}
                    onChange={(e) => setProviderId(e.target.value)} />
                  <Button type="submit" size="sm">ربط الفيديو</Button>
                </form>
              </div>
              <div className="space-y-3">
                <p className="font-medium">ملف مرفق</p>
                <form onSubmit={onAttachFile} className="space-y-2">
                  <Input dir="ltr" type="url" placeholder="https://..." required value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)} />
                  <Input placeholder="اسم الملف" required value={fileName}
                    onChange={(e) => setFileName(e.target.value)} />
                  <Button type="submit" size="sm">إرفاق الملف</Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">الاختبارات</h2>
        <Button onClick={() => setShowQuizForm((v) => !v)}>
          {showQuizForm ? "إلغاء" : "إنشاء اختبار"}
        </Button>
      </div>

      {showQuizForm && (
        <Card>
          <CardHeader>
            <CardTitle>اختبار جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateQuiz} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="quizLesson">الدرس</Label>
                  <select id="quizLesson" className={selectClass} required value={quizLessonId}
                    onChange={(e) => setQuizLessonId(e.target.value)}>
                    <option value="">اختر الدرس</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title} ({l.unit.subject.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quizTitle">عنوان الاختبار</Label>
                  <Input id="quizTitle" required minLength={2} value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">عدد المحاولات المسموحة</Label>
                  <Input id="maxAttempts" type="number" min={1} max={10} required
                    value={quizMaxAttempts} onChange={(e) => setQuizMaxAttempts(Number(e.target.value))} />
                </div>
              </div>

              {questions.map((q, qi) => (
                <div key={qi} className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <select className={selectClass} value={q.type}
                      onChange={(e) => updateQuestion(qi, newQuestion(e.target.value as DraftQuestion["type"]))}>
                      <option value="MCQ">اختيار من متعدد</option>
                      <option value="TRUE_FALSE">صواب / خطأ</option>
                      <option value="MULTI_SELECT">اختيار متعدد الإجابات</option>
                      <option value="SHORT_ANSWER">إجابة قصيرة</option>
                    </select>
                    <Input placeholder={`نص السؤال ${qi + 1}`} required value={q.text}
                      onChange={(e) => updateQuestion(qi, { text: e.target.value })} />
                    <Input type="number" min={1} placeholder="النقاط" value={q.points}
                      onChange={(e) => updateQuestion(qi, { points: Number(e.target.value) || 1 })} />
                    {questions.length > 1 && (
                      <Button type="button" variant="outline"
                        onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}>
                        حذف السؤال
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {q.type === "SHORT_ANSWER" ? (
                      <div className="space-y-2">
                        <Label>الإجابة النموذجية الصحيحة</Label>
                        <Input required value={q.answers[0]?.text ?? ""}
                          onChange={(e) => updateAnswer(qi, 0, { text: e.target.value, isCorrect: true })} />
                      </div>
                    ) : (
                      q.answers.map((a, ai) => (
                        <div key={ai} className="flex items-center gap-2">
                          <input type="checkbox" className="h-4 w-4" checked={a.isCorrect}
                            onChange={(e) => updateAnswer(qi, ai, { isCorrect: e.target.checked })} />
                          <Input placeholder={`الخيار ${ai + 1}`} required value={a.text}
                            onChange={(e) => updateAnswer(qi, ai, { text: e.target.value })} />
                          {q.answers.length > 2 && (
                            <Button type="button" size="sm" variant="ghost"
                              onClick={() => updateQuestion(qi, { answers: q.answers.filter((_, i) => i !== ai) })}>
                              ×
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                    {q.type !== "SHORT_ANSWER" && (
                      <Button type="button" size="sm" variant="ghost"
                        onClick={() => updateQuestion(qi, { answers: [...q.answers, { text: "", isCorrect: false }] })}>
                        + إضافة خيار
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
                  + إضافة سؤال
                </Button>
                <Button type="submit" disabled={pending || !quizLessonId}>
                  {pending ? "جارٍ الإنشاء..." : "إنشاء الاختبار"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>اختبارات مدرستك ({quizzes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاختبار</TableHead>
                <TableHead>الدرس / المادة</TableHead>
                <TableHead>الأسئلة</TableHead>
                <TableHead>المشاركون</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.map((quiz) => (
                <TableRow key={quiz.id}>
                  <TableCell className="font-medium">{quiz.title}</TableCell>
                  <TableCell>{quiz.lesson.title} ({quiz.lesson.unit.subject.name})</TableCell>
                  <TableCell>{quiz._count.questions}</TableCell>
                  <TableCell>{quiz._count.results}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => onShowResults(quiz.id)}>
                      النتائج
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {quizzes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    لا توجد اختبارات بعد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج «{results.quiz.title}»</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الدرجة</TableHead>
                  <TableHead>المحاولة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.student.fullName}</TableCell>
                    <TableCell>{r.score} / {r.maxScore}</TableCell>
                    <TableCell>{r.attempt}</TableCell>
                  </TableRow>
                ))}
                {results.results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">
                      لا توجد نتائج بعد
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div>
              <p className="mb-2 text-sm font-medium">لم يحل بعد:</p>
              <div className="flex flex-wrap gap-2">
                {results.notSubmitted.map((s) => (
                  <Badge key={s.id} variant="secondary">{s.fullName}</Badge>
                ))}
                {results.notSubmitted.length === 0 && (
                  <span className="text-sm text-gray-500">جميع الطلاب حلوا الاختبار</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </main>
  );
}
