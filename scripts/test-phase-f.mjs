// Phase F acceptance test (madar_plan_v2.0.md):
//   1. Every sidebar link of every role opens a REAL screen (HTTP 200) —
//      no "coming soon" placeholders in the MVP.
//   2. Notifications fire automatically on: subscription activation,
//      lesson publish (to the grade's students), live class scheduling
//      (to subscribed students), and can be marked read.
// Run with the dev server up: node scripts/test-phase-f.mjs

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
  const teacher = await login("teacher@school-a.local", "Demo#1234");
  const student = await login("student@school-a.local", "Demo#1234");

  // --- 1. every sidebar screen is a real page (requires session cookies)
  const screens = [
    [teacher, "/teacher", "/teacher/quizzes", "/teacher/live"],
    [student, "/student", "/student/quizzes", "/student/live", "/student/subscriptions", "/student/notifications"],
    [owner, "/madar-admin", "/madar-admin/subscriptions"],
  ];
  for (const [who, ...paths] of screens) {
    for (const p of paths) {
      const res = await fetch(BASE + p, { headers: { Cookie: who.header() } });
      check(`screen ${p} renders`, res.status === 200);
    }
  }

  // clean slate for the notification flow
  await call(student, "/api/notifications"); // warm

  // --- 2a. lesson publish notification
  const curriculum = await call(teacher, "/api/academic/curriculum");
  const grade1 = curriculum.body.stages.flatMap((s) => s.grades).find((g) => g.name === "الأول المتوسط");
  const math = grade1.subjects.find((s) => s.name === "الرياضيات");
  const created = await call(teacher, "/api/teacher/lessons", {
    method: "POST",
    body: JSON.stringify({ title: `درس إشعار ${Date.now()}`, unitId: math.units[0].id }),
  });
  const before = await call(student, "/api/notifications");
  const beforeCount = before.body?.notifications?.length ?? 0;
  await call(teacher, `/api/teacher/lessons/${created.body.lesson.id}/publish`, { method: "PATCH" });
  const afterPublish = await call(student, "/api/notifications");
  const publishNotif = (afterPublish.body?.notifications ?? []).find((n) =>
    n.title.includes("درس جديد") && n.body.includes("درس إشعار")
  );
  check(
    "lesson publish → grade students notified",
    afterPublish.body.notifications.length === beforeCount + 1 && Boolean(publishNotif)
  );

  // --- 2b. live class scheduling notification (student is subscribed to math)
  const beforeLive = await call(student, "/api/notifications");
  const liveBefore = beforeLive.body?.notifications?.length ?? 0;
  await call(teacher, "/api/teacher/live-classes", {
    method: "POST",
    body: JSON.stringify({ subjectId: math.id, scheduledAt: new Date(Date.now() + 3600_000).toISOString() }),
  });
  const afterLive = await call(student, "/api/notifications");
  const liveNotif = (afterLive.body?.notifications ?? []).find((n) => n.title.includes("حصة مباشرة"));
  check(
    "live class scheduled → subscribed students notified",
    (afterLive.body?.notifications?.length ?? 0) === liveBefore + 1 && Boolean(liveNotif)
  );

  // --- 2c. subscription activation notification (fresh student → idempotent)
  const adminA = await login("pb-admin-a-1787524093717@school-a.local", "PbAdmin#1");
  const F_EMAIL = `pf-student-${Date.now()}@school-a.local`;
  const createdStudent = await call(adminA, "/api/school-admin/users", {
    method: "POST",
    body: JSON.stringify({
      fullName: "طالب إشعارات",
      email: F_EMAIL,
      password: "PfStudent#1",
      role: "STUDENT",
      gradeId: grade1.id,
    }),
  });
  if (createdStudent.status !== 201) throw new Error("failed to create pf student");
  const notifStudent = await login(F_EMAIL, "PfStudent#1");

  const subs = await call(notifStudent, "/api/student/subscriptions");
  const science = grade1.subjects.find((s) => s.name === "العلوم");
  const singlePlan = subs.body.plans.find((p) => p.type === "SINGLE_SUBJECT");
  await call(notifStudent, "/api/student/subscriptions/request", {
    method: "POST",
    body: JSON.stringify({ planId: singlePlan.id, subjectId: science.id }),
  });
  const pendingList = await call(owner, "/api/madar-admin/subscriptions/pending");
  const req = (pendingList.body?.pending ?? []).find(
    (p) => p.student.email === F_EMAIL && p.subject?.name === "العلوم"
  );
  const beforeAct = await call(notifStudent, "/api/notifications");
  const actBefore = beforeAct.body?.notifications?.length ?? 0;
  await call(owner, `/api/madar-admin/subscriptions/${req.id}/activate`, { method: "PATCH" });
  const afterAct = await call(notifStudent, "/api/notifications");
  const actNotif = (afterAct.body?.notifications ?? []).find((n) => n.title.includes("تم تفعيل اشتراكك"));
  check(
    "subscription activated → student notified",
    (afterAct.body?.notifications?.length ?? 0) === actBefore + 1 && Boolean(actNotif)
  );

  // --- 3. mark as read
  const unread = afterAct.body.notifications.find((n) => !n.isRead);
  const marked = await call(notifStudent, `/api/notifications/${unread.id}/read`, { method: "PATCH" });
  check("notification marked as read", marked.status === 200 && marked.body.notification.isRead === true);

  // --- notifications are per-user (teacher must not see student's)
  const teacherNotifs = await call(teacher, "/api/notifications");
  check(
    "notifications are isolated per user",
    !(teacherNotifs.body?.notifications ?? []).some((n) => n.title.includes("تم تفعيل اشتراكك"))
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Test script crashed:", e);
  process.exitCode = 1;
});
