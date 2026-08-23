// Phase D acceptance test (madar_plan_v2.0.md):
//   1. rtmpUrl and streamKey NEVER appear in any student-facing response
//      (list AND join) — checked against the actual secret values.
//   2. Students join in view-only mode (canPublish: false) until the teacher
//      grants the mic via grant-mic; revoke returns them to view-only.
//   3. Cross-school students cannot see or join another school's class.
//   4. Only the owning teacher can end the class; ended classes disappear
//      from the student's list.
// Run with the dev server up: node scripts/test-phase-d.mjs

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
  const teacher = await login("teacher@school-a.local", "Demo#1234");
  const student = await login("student@school-a.local", "Demo#1234");

  // --- schedule a class on grade-1 math
  const curriculum = await call(teacher, "/api/academic/curriculum");
  const grade1 = curriculum.body.stages.flatMap((s) => s.grades).find((g) => g.name === "الأول المتوسط");
  const math = grade1.subjects.find((s) => s.name === "الرياضيات");
  const scheduled = await call(teacher, "/api/teacher/live-classes", {
    method: "POST",
    body: JSON.stringify({
      subjectId: math.id,
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
  });
  const liveClass = scheduled.body?.liveClass;
  check(
    "teacher schedules class and receives OBS credentials",
    scheduled.status === 201 && Boolean(liveClass?.roomName && liveClass?.rtmpUrl && liveClass?.streamKey)
  );
  const classId = liveClass.id;

  // --- student list: must show the class but NEVER the credentials
  const listRes = await call(student, "/api/student/live-classes");
  const listed = (listRes.body?.liveClasses ?? []).find((c) => c.id === classId);
  const listLeak =
    JSON.stringify(listRes.body).includes(liveClass.streamKey) ||
    JSON.stringify(listRes.body).includes(liveClass.rtmpUrl);
  check(
    "student list shows class WITHOUT rtmpUrl/streamKey",
    listRes.status === 200 && Boolean(listed) && !listLeak
  );

  // --- join: view-only token by default, no credential leak
  const join1 = await call(student, `/api/live-classes/${classId}/join`, { method: "POST" });
  const joinLeak =
    JSON.stringify(join1.body).includes(liveClass.streamKey) ||
    JSON.stringify(join1.body).includes(liveClass.rtmpUrl);
  check(
    "student joins in view-only mode (canPublish: false), no credential leak",
    join1.status === 200 && join1.body.canPublish === false && Boolean(join1.body.token) && !joinLeak
  );

  // --- teacher views students of the class and grants the mic
  const detail = await call(teacher, `/api/teacher/live-classes/${classId}`);
  const demoStudent = (detail.body?.students ?? []).find((s) => s.fullName === "طالب تجريبي");
  check("teacher sees the grade's students in class detail", Boolean(demoStudent));

  const grant = await call(teacher, `/api/live-classes/${classId}/grant-mic/${demoStudent.id}`, { method: "PATCH" });
  check("teacher grants mic", grant.status === 200 && grant.body.micGranted === true);

  const join2 = await call(student, `/api/live-classes/${classId}/join`, { method: "POST" });
  check("granted student joins with canPublish: true", join2.status === 200 && join2.body.canPublish === true);

  const revoke = await call(teacher, `/api/live-classes/${classId}/revoke-mic/${demoStudent.id}`, { method: "PATCH" });
  const join3 = await call(student, `/api/live-classes/${classId}/join`, { method: "POST" });
  check(
    "revoked student back to view-only",
    revoke.status === 200 && join3.status === 200 && join3.body.canPublish === false
  );

  // --- students cannot manage permissions or end classes
  const studentGrant = await call(student, `/api/live-classes/${classId}/grant-mic/${demoStudent.id}`, { method: "PATCH" });
  const studentEnd = await call(student, `/api/live-classes/${classId}/end`, { method: "POST" });
  check(
    "student blocked from grant/end (403)",
    studentGrant.status === 403 && studentEnd.status === 403
  );

  // --- cross-school isolation
  const studentB = await login("pb-student-b-1787524093717@school-b.local", "PbStudent#2");
  const listB = await call(studentB, "/api/student/live-classes");
  const bSees = (listB.body?.liveClasses ?? []).some((c) => c.id === classId);
  const joinB = await call(studentB, `/api/live-classes/${classId}/join`, { method: "POST" });
  check(
    "school-B student cannot see or join school-A class",
    !bSees && joinB.status === 403
  );

  // --- teacher ends the class; it disappears for students
  const end = await call(teacher, `/api/live-classes/${classId}/end`, { method: "POST" });
  const listAfter = await call(student, "/api/student/live-classes");
  const stillListed = (listAfter.body?.liveClasses ?? []).some((c) => c.id === classId);
  const joinAfter = await call(student, `/api/live-classes/${classId}/join`, { method: "POST" });
  check(
    "ended class disappears from student list and join",
    end.status === 200 && !stillListed && joinAfter.status === 404
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Test script crashed:", e);
  process.exitCode = 1;
});
