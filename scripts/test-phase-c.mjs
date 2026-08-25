import { grantFullYear } from "./test-helpers.mjs";
// Phase C acceptance test (madar_plan_v2.0.md):
//   1. `submit` computes the score SERVER-SIDE only — a forged "score" in the
//      request body is ignored.
//   2. Submitting after exhausting maxAttempts → ATTEMPTS_EXHAUSTED.
//   3. Quiz detail never leaks `isCorrect` to students.
//   4. Teacher results endpoint lists results + who has not submitted.
//   5. Video watch progress + overall student progress work.
//   6. School-B student cannot access school-A's quiz (404).
// Run with the dev server up: node scripts/test-phase-c.mjs

const BASE = "http://localhost:3000";
const results = [];

function check(name, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function jar() {
  const cookies = new Map();
  return {
    capture(res) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function call(j, path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(j ? { Cookie: j.header() } : {}), ...options.headers },
  });
  j?.capture(res);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(email, password) {
  const j = jar();
  const r = await call(j, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  return j;
}

async function main() {
  const teacher = await login("teacher@school-a.local", "Demo#1234");
  const student = await login("student@school-a.local", "Demo#1234");
  await grantFullYear({ call, jar, student, email: "student@school-a.local" });

  // --- find a PUBLISHED lesson matching the demo student's grade (الأول المتوسط),
  // creating one if the newest published lesson belongs to another grade.
  const lessons = await call(teacher, "/api/teacher/lessons");
  const STUDENT_GRADE = "الأول المتوسط";
  let lesson = lessons.body?.lessons?.find(
    (l) => l.status === "PUBLISHED" && l.unit.subject.grade.name === STUDENT_GRADE
  );
  if (!lesson) {
    const curriculum = await call(teacher, "/api/academic/curriculum");
    const grade = curriculum.body.stages
      .flatMap((s) => s.grades)
      .find((g) => g.name === STUDENT_GRADE);
    const unit = grade.subjects[0].units[0];
    const created = await call(teacher, "/api/teacher/lessons", {
      method: "POST",
      body: JSON.stringify({ title: `درس اختبار المرحلة ج ${Date.now()}`, unitId: unit.id }),
    });
    await call(teacher, `/api/teacher/lessons/${created.body.lesson.id}/publish`, { method: "PATCH" });
    lesson = created.body.lesson;
  }
  check("published lesson available in the student's grade", Boolean(lesson));

  // --- teacher creates a quiz: 3 question types, maxAttempts = 2
  const quizRes = await call(teacher, "/api/teacher/quizzes", {
    method: "POST",
    body: JSON.stringify({
      lessonId: lesson.id,
      title: `اختبار شامل ${Date.now()}`,
      maxAttempts: 2,
      questions: [
        {
          type: "MCQ",
          text: "ما عاصمة السعودية؟",
          points: 2,
          answers: [
            { text: "الرياض", isCorrect: true },
            { text: "جدة", isCorrect: false },
            { text: "مكة", isCorrect: false },
          ],
        },
        {
          type: "TRUE_FALSE",
          text: "٢ + ٢ = ٤",
          points: 1,
          answers: [
            { text: "صواب", isCorrect: true },
            { text: "خطأ", isCorrect: false },
          ],
        },
        {
          type: "SHORT_ANSWER",
          text: "كم عدد أيام الأسبوع؟",
          points: 1,
          answers: [{ text: "7", isCorrect: true }],
        },
      ],
    }),
  });
  const quizId = quizRes.body?.quiz?.id;
  check("teacher creates quiz with questions", quizRes.status === 201 && quizId);

  // --- invalid question shape rejected (two correct MCQ answers)
  const invalid = await call(teacher, "/api/teacher/quizzes", {
    method: "POST",
    body: JSON.stringify({
      lessonId: lesson.id,
      title: "اختبار خاطئ",
      questions: [
        {
          type: "MCQ",
          text: "سؤال",
          answers: [
            { text: "أ", isCorrect: true },
            { text: "ب", isCorrect: true },
          ],
        },
      ],
    }),
  });
  check("MCQ with two correct answers rejected (400)", invalid.status === 400);

  // --- student opens the quiz: no isCorrect anywhere in the payload
  const detail = await call(student, `/api/student/quizzes/${quizId}`);
  const leaked = JSON.stringify(detail.body ?? {}).includes("isCorrect");
  check(
    "quiz detail served without isCorrect",
    detail.status === 200 && !leaked && detail.body.quiz.canAttempt === true
  );

  // --- correct submission with a FORGED score field (must be ignored)
  const detailBody = detail.body.quiz;
  const idOf = (q, text) => q.answers.find((a) => a.text === text).id;
  const correctSubmission = {
    score: 999, // forged — the server must never read this
    answers: [
      { questionId: detailBody.questions[0].id, answerIds: [idOf(detailBody.questions[0], "الرياض")] },
      { questionId: detailBody.questions[1].id, answerIds: [idOf(detailBody.questions[1], "صواب")] },
      { questionId: detailBody.questions[2].id, text: "7" },
    ],
  };
  const sub1 = await call(student, `/api/student/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify(correctSubmission),
  });
  check(
    "score computed server-side (forged score ignored)",
    sub1.status === 200 &&
      sub1.body.result.score === 4 &&
      sub1.body.result.maxScore === 4 &&
      sub1.body.result.attempt === 1,
    `score=${sub1.body?.result?.score}/4 attempt=${sub1.body?.result?.attempt}`
  );

  // --- second attempt (allowed, maxAttempts=2) with wrong answers
  const sub2 = await call(student, `/api/student/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      answers: [
        { questionId: detailBody.questions[0].id, answerIds: [idOf(detailBody.questions[0], "جدة")] },
        { questionId: detailBody.questions[1].id, answerIds: [idOf(detailBody.questions[1], "خطأ")] },
        { questionId: detailBody.questions[2].id, text: "خمسة" },
      ],
    }),
  });
  check(
    "second attempt allowed with server-side grading (0/4)",
    sub2.status === 200 && sub2.body.result.score === 0 && sub2.body.result.attempt === 2
  );

  // --- third attempt must be rejected
  const sub3 = await call(student, `/api/student/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers: [{ questionId: detailBody.questions[0].id, answerIds: [] }] }),
  });
  check(
    "third attempt rejected with ATTEMPTS_EXHAUSTED",
    sub3.status === 403 && sub3.body?.error?.code === "ATTEMPTS_EXHAUSTED"
  );

  // --- student progress reflects the quiz result (in the quiz's own subject)
  const progress = await call(student, "/api/student/progress");
  const quizSubject = progress.body?.subjects?.find(
    (s) => s.subjectName === lesson.unit.subject.name
  );
  check(
    "progress endpoint returns per-subject rates (quiz subject > 0)",
    progress.status === 200 && Array.isArray(progress.body.subjects) && (quizSubject?.completionRate ?? 0) > 0,
    `${lesson.unit.subject.name}=${quizSubject?.completionRate}%`
  );

  // --- video watch progress
  const videoRes = await call(teacher, `/api/teacher/lessons/${lesson.id}/video`, {
    method: "POST",
    body: JSON.stringify({ providerId: `c-test-${Date.now()}` }),
  });
  const videoId = videoRes.body?.video?.id;
  const wp1 = await call(student, `/api/student/videos/${videoId}/progress`, {
    method: "POST",
    body: JSON.stringify({ watchedPercent: 95 }),
  });
  const wp2 = await call(student, `/api/student/videos/${videoId}/progress`, {
    method: "POST",
    body: JSON.stringify({ watchedPercent: 100 }),
  });
  check(
    "video progress created then updated",
    wp1.status === 200 && wp1.body.progress.watchedPercent === 95 && wp2.body.progress.watchedPercent === 100
  );

  // --- teacher sees results + who has not submitted
  const resultsRes = await call(teacher, `/api/teacher/quizzes/${quizId}/results`);
  const rBody = resultsRes.body;
  const mine = rBody?.results?.filter((r) => r.student.fullName === "طالب تجريبي");
  check(
    "teacher results show both attempts with scores",
    resultsRes.status === 200 && mine?.length === 2 && mine[0].maxScore === 4
  );
  check(
    "not-submitted list includes the other school-A student",
    (rBody?.notSubmitted ?? []).some((s) => s.fullName === "طالب مدرسة أ")
  );

  // --- school-B student cannot access school-A's quiz
  const studentB = await login("pb-student-b-1787524093717@school-b.local", "PbStudent#2");
  const cross = await call(studentB, `/api/student/quizzes/${quizId}`);
  check("school-B student blocked from school-A quiz (404)", cross.status === 404);

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Test script crashed:", e);
  process.exitCode = 1;
});
