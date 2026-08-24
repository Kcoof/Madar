// Phase E acceptance test (madar_plan_v2.0.md):
//   1. A student subscribed (SINGLE_SUBJECT) to Math only is REJECTED with
//      SUBSCRIPTION_REQUIRED when accessing Physics/Science content —
//      lessons list, quiz detail, and live-class join.
//   2. Before activation nothing is accessible; the owner approves the
//      request and access to the subscribed subject opens immediately.
//   3. FULL_YEAR subscription opens every subject.
// Run with the dev server up: node scripts/test-phase-e.mjs

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
  if (r.status !== 200) throw new Error(`login failed for ${email}`);
  return j;
}

async function main() {
  const owner = await login("owner@madar.local", "MadarOwner#2026");
  const student = await login("student@school-a.local", "Demo#1234");

  // --- fresh curriculum references
  const curriculum = await call(student, "/api/academic/curriculum");
  const grade1 = curriculum.body.stages.flatMap((s) => s.grades).find((g) => g.name === "الأول المتوسط");
  const math = grade1.subjects.find((s) => s.name === "الرياضيات");
  const science = grade1.subjects.find((s) => s.name === "العلوم");

  const subsData = await call(student, "/api/student/subscriptions");
  const singlePlan = subsData.body?.plans?.find((p) => p.type === "SINGLE_SUBJECT");
  const fullPlan = subsData.body?.plans?.find((p) => p.type === "FULL_YEAR");
  check("plans available (FULL_YEAR + SINGLE_SUBJECT)", Boolean(singlePlan && fullPlan));

  // --- before any active subscription everything is locked
  const lessonsBefore = await call(student, "/api/student/lessons");
  check(
    "no active subscription → lessons empty",
    lessonsBefore.status === 200 && (lessonsBefore.body.lessons ?? []).length === 0
  );

  // --- request SINGLE_SUBJECT for Math
  const request = await call(student, "/api/student/subscriptions/request", {
    method: "POST",
    body: JSON.stringify({ planId: singlePlan.id, subjectId: math.id }),
  });
  check("student requests Math-only subscription (PENDING)", request.status === 201);

  const duplicate = await call(student, "/api/student/subscriptions/request", {
    method: "POST",
    body: JSON.stringify({ planId: singlePlan.id, subjectId: math.id }),
  });
  check("duplicate request rejected (409)", duplicate.status === 409);

  // --- while PENDING, still locked
  const lessonsPending = await call(student, "/api/student/lessons");
  check("pending request does not open content", (lessonsPending.body.lessons ?? []).length === 0);

  // --- owner sees and activates the request
  const pending = await call(owner, "/api/madar-admin/subscriptions/pending");
  const mine = (pending.body?.pending ?? []).find(
    (p) => p.student.email === "student@school-a.local" && p.subject?.name === "الرياضيات"
  );
  check("owner sees the pending request", pending.status === 200 && Boolean(mine));

  const activate = await call(owner, `/api/madar-admin/subscriptions/${mine.id}/activate`, {
    method: "PATCH",
  });
  check(
    "owner activates subscription (ACTIVE + 1 year)",
    activate.status === 200 && activate.body.subscription.status === "ACTIVE"
  );

  const reActivate = await call(owner, `/api/madar-admin/subscriptions/${mine.id}/activate`, {
    method: "PATCH",
  });
  check("re-activating a non-pending request rejected (400)", reActivate.status === 400);

  // --- Math opens, Science stays locked with SUBSCRIPTION_REQUIRED
  const lessonsAfter = await call(student, "/api/student/lessons");
  const titles = (lessonsAfter.body.lessons ?? []).map((l) => l.title);
  const hasMath = titles.includes("درس تجريبي مركزي من مدار");
  const hasScience = titles.some((t) => t === "agg");
  check(
    "math lessons visible, science lesson hidden",
    hasMath && !hasScience,
    `math=${hasMath} science=${hasScience}`
  );

  const checkMath = await call(student, `/api/student/access-check?subjectId=${math.id}`);
  const checkScience = await call(student, `/api/student/access-check?subjectId=${science.id}`);
  check(
    "access-check: math true, science SUBSCRIPTION_REQUIRED",
    checkMath.body.access === true &&
      checkScience.body.access === false &&
      checkScience.body.code === "SUBSCRIPTION_REQUIRED"
  );

  // --- science quiz → 403 SUBSCRIPTION_REQUIRED (the plan's exact criterion)
  const teacher = await login("teacher@school-a.local", "Demo#1234");
  const teacherQuizzes = await call(teacher, "/api/teacher/quizzes");
  const scienceQuiz = (teacherQuizzes.body?.quizzes ?? []).find(
    (q) => q.lesson.unit.subject.name === "العلوم"
  );
  if (scienceQuiz) {
    const scienceQuizRes = await call(student, `/api/student/quizzes/${scienceQuiz.id}`);
    check(
      "science quiz rejected with SUBSCRIPTION_REQUIRED",
      scienceQuizRes.status === 403 && scienceQuizRes.body?.error?.code === "SUBSCRIPTION_REQUIRED"
    );
  } else {
    check("science quiz rejected with SUBSCRIPTION_REQUIRED (no science quiz to test)", false);
  }

  // --- live class on science → join rejected with SUBSCRIPTION_REQUIRED
  const schedule = await call(teacher, "/api/teacher/live-classes", {
    method: "POST",
    body: JSON.stringify({
      subjectId: science.id,
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
  });
  const scienceClassId = schedule.body?.liveClass?.id;
  const joinScience = await call(student, `/api/live-classes/${scienceClassId}/join`, {
    method: "POST",
  });
  check(
    "science live-class join rejected with SUBSCRIPTION_REQUIRED",
    joinScience.status === 403 && joinScience.body?.error?.code === "SUBSCRIPTION_REQUIRED"
  );

  // --- math live class joins fine
  const mathSchedule = await call(teacher, "/api/teacher/live-classes", {
    method: "POST",
    body: JSON.stringify({
      subjectId: math.id,
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
  });
  const joinMath = await call(student, `/api/live-classes/${mathSchedule.body?.liveClass?.id}/join`, {
    method: "POST",
  });
  check("math live-class join works", joinMath.status === 200);

  // --- student cannot access owner endpoints
  const forbidden = await call(student, "/api/madar-admin/subscriptions/pending");
  check("student blocked from owner subscription endpoints (403)", forbidden.status === 403);

  // --- FULL_YEAR opens everything (second school-A student)
  const student2 = await login("pb-student-a-1787524093717@school-a.local", "PbStudent#1");
  const req2 = await call(student2, "/api/student/subscriptions/request", {
    method: "POST",
    body: JSON.stringify({ planId: fullPlan.id }),
  });
  const pending2 = await call(owner, "/api/madar-admin/subscriptions/pending");
  const mine2 = (pending2.body?.pending ?? []).find(
    (p) => p.student.email === "pb-student-a-1787524093717@school-a.local"
  );
  await call(owner, `/api/madar-admin/subscriptions/${mine2.id}/activate`, { method: "PATCH" });
  const checkScienceFull = await call(student2, `/api/student/access-check?subjectId=${science.id}`);
  check(
    "FULL_YEAR subscription opens every subject",
    req2.status === 201 && checkScienceFull.body.access === true
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Test script crashed:", e);
  process.exitCode = 1;
});
