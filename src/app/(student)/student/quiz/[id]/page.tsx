"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppHeader } from "@/components/shared/app-header";
import { apiFetch } from "@/lib/api-client";

type QuizQuestion = {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "MULTI_SELECT";
  text: string;
  points: number;
  answers: { id: string; text: string }[];
};

type QuizDetail = {
  id: string;
  title: string;
  subjectName: string;
  lessonTitle: string;
  maxAttempts: number;
  attemptsUsed: number;
  canAttempt: boolean;
  questions: QuizQuestion[];
};

type SubmitOutcome = {
  result: { score: number; maxScore: number; attempt: number };
  attemptsLeft: number;
};

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  // answers: questionId -> { answerIds: Set, text: string }
  const [answers, setAnswers] = useState<Record<string, { answerIds: Set<string>; text: string }>>({});

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ quiz: QuizDetail }>(`/api/student/quizzes/${id}`);
      setQuiz(data.quiz);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحميل الاختبار";
      if (msg.includes("تسجيل الدخول")) router.push("/login");
      setError(msg);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  function setEntry(questionId: string, patch: Partial<{ answerIds: Set<string>; text: string }>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { answerIds: new Set(), text: "", ...prev[questionId], ...patch },
    }));
  }

  function toggleMulti(questionId: string, answerId: string, checked: boolean) {
    const current = new Set(answers[questionId]?.answerIds ?? []);
    if (checked) current.add(answerId);
    else current.delete(answerId);
    setEntry(questionId, { answerIds: current });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz) return;
    setError(null);
    setPending(true);
    try {
      const payload = {
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          ...(q.type === "SHORT_ANSWER"
            ? { text: answers[q.id]?.text ?? "" }
            : { answerIds: [...(answers[q.id]?.answerIds ?? [])] }),
        })),
      };
      const data = await apiFetch<SubmitOutcome>(`/api/student/quizzes/${quiz.id}/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOutcome(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إرسال الإجابات");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="اختبار" />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!quiz && !error && <p className="text-gray-500">جارٍ تحميل الاختبار...</p>}

      {quiz && outcome && (
        <Card>
          <CardHeader>
            <CardTitle>نتيجتك</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">
              {outcome.result.score} / {outcome.result.maxScore}
            </p>
            <p className="text-sm text-gray-600">
              المحاولة رقم {outcome.result.attempt} · المحاولات المتبقية: {outcome.attemptsLeft}
            </p>
            <Link href="/student">
              <Button variant="outline">العودة إلى دروسي</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {quiz && !outcome && (
        <>
          {!quiz.canAttempt && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <p className="text-amber-700">
                  استنفدت عدد المحاولات المسموح بها ({quiz.maxAttempts}).
                </p>
                <Link href="/student">
                  <Button variant="outline">العودة إلى دروسي</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {quiz.canAttempt && (
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{quiz.title}</h2>
                <p className="text-sm text-gray-600">
                  {quiz.subjectName} — {quiz.lessonTitle} · المحاولة {quiz.attemptsUsed + 1} من{" "}
                  {quiz.maxAttempts}
                </p>
              </div>

              {quiz.questions.map((q, qi) => (
                <Card key={q.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {qi + 1}. {q.text}{" "}
                      <span className="text-sm font-normal text-gray-500">({q.points} نقطة)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {q.type === "SHORT_ANSWER" ? (
                      <div className="space-y-2">
                        <Label htmlFor={`q-${q.id}`}>إجابتك</Label>
                        <Input
                          id={`q-${q.id}`}
                          value={answers[q.id]?.text ?? ""}
                          onChange={(e) => setEntry(q.id, { text: e.target.value })}
                        />
                      </div>
                    ) : q.type === "MULTI_SELECT" ? (
                      q.answers.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={answers[q.id]?.answerIds.has(a.id) ?? false}
                            onChange={(e) => toggleMulti(q.id, a.id, e.target.checked)}
                          />
                          {a.text}
                        </label>
                      ))
                    ) : (
                      q.answers.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="h-4 w-4"
                            checked={answers[q.id]?.answerIds.has(a.id) ?? false}
                            onChange={() => setEntry(q.id, { answerIds: new Set([a.id]) })}
                          />
                          {a.text}
                        </label>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button type="submit" disabled={pending}>
                {pending ? "جارٍ الإرسال..." : "إرسال الإجابات"}
              </Button>
            </form>
          )}
        </>
      )}
      </div>
    </main>
  );
}
