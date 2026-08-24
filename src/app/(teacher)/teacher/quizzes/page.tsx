"use client";

import { useCallback, useEffect, useState } from "react";
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

type Lesson = {
  id: string;
  title: string;
  status: string;
  unit: { subject: { name: string } };
};

type Quiz = {
  id: string;
  title: string;
  lesson: { title: string; unit: { subject: { name: string } } };
  _count: { questions: number; results: number };
};

type QuizResults = {
  quiz: { title: string };
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

export default function TeacherQuizzesPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [quizLessonId, setQuizLessonId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(1);
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);

  const load = useCallback(async () => {
    try {
      const [lessonsData, quizzesData] = await Promise.all([
        apiFetch<{ lessons: Lesson[] }>("/api/teacher/lessons"),
        apiFetch<{ quizzes: Quiz[] }>("/api/teacher/quizzes"),
      ]);
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
      setShowForm(false);
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
      setResults(results?.quiz.title === data.quiz.title ? null : data);
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
    <DashboardShell title="لوحة المعلم" nav={teacherNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">الاختبارات</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "إلغاء" : "إنشاء اختبار"}
        </Button>
      </div>

      {showForm && (
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
    </DashboardShell>
  );
}
