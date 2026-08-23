// Phase B acceptance test (madar_plan_v2.0.md):
//   1. A DRAFT lesson NEVER appears in /api/student/lessons.
//   2. A lesson created by school A's teacher does not appear for school B's
//      student even when grade and subject match.
//   3. Central content (schoolId = null) appears to students of every school.
//   4. Cross-school modification (publishing another school's lesson) is rejected.
// Run with the dev server up: node scripts/test-phase-b.mjs

const BASE = "http://localhost:3000";
const TS = Date.now();
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

async function main() {
  // --- owner sets up two fresh schools
  const owner = jar();
  await call(owner, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@madar.local", password: "MadarOwner#2026" }),
  });
  const schoolA = await call(owner, "/api/madar-admin/schools", {
    method: "POST",
    body: JSON.stringify({
      name: `مدرسة المحتوى أ ${TS}`,
      adminFullName: "مدير أ",
      adminEmail: `pb-admin-a-${TS}@school-a.local`,
      adminPassword: "PbAdmin#1",
    }),
  });
  const schoolB = await call(owner, "/api/madar-admin/schools", {
    method: "POST",
    body: JSON.stringify({
      name: `مدرسة المحتوى ب ${TS}`,
      adminFullName: "مدير ب",
      adminEmail: `pb-admin-b-${TS}@school-b.local`,
      adminPassword: "PbAdmin#2",
    }),
  });
  check("two fresh schools created", schoolA.status === 201 && schoolB.status === 201);

  // --- school A admin creates a teacher + logs in
  const adminA = jar();
  await call(adminA, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `pb-admin-a-${TS}@school-a.local`, password: "PbAdmin#1" }),
  });
  const teacherRes = await call(adminA, "/api/school-admin/users", {
    method: "POST",
    body: JSON.stringify({
      fullName: "معلم مدرسة أ",
      email: `pb-teacher-a-${TS}@school-a.local`,
      password: "PbTeacher#1",
      role: "TEACHER",
    }),
  });
  check("school A admin creates a teacher", teacherRes.status === 201);

  const teacher = jar();
  const teacherLogin = await call(teacher, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `pb-teacher-a-${TS}@school-a.local`, password: "PbTeacher#1" }),
  });
  check("teacher login (TEACHER, active)", teacherLogin.status === 200 && teacherLogin.body.user.role === "TEACHER");

  // --- teacher picks a unit from the curriculum and creates a DRAFT lesson
  const curriculum = await call(teacher, "/api/academic/curriculum");
  const firstGrade = curriculum.body?.stages?.[0]?.grades?.[0];
  const mathSubject = firstGrade?.subjects?.find((s) => s.name === "الرياضيات");
  const unit = mathSubject?.units?.[0];
  check("curriculum returned with units", Boolean(unit), `grade=${firstGrade?.name}`);

  const lesson1 = await call(teacher, "/api/teacher/lessons", {
    method: "POST",
    body: JSON.stringify({ title: `درس الجمع ${TS}`, unitId: unit.id }),
  });
  const lesson1Id = lesson1.body?.lesson?.id;
  check("teacher creates DRAFT lesson", lesson1.status === 201 && lesson1.body.lesson.status === "DRAFT");

  const video = await call(teacher, `/api/teacher/lessons/${lesson1Id}/video`, {
    method: "POST",
    body: JSON.stringify({ providerId: `bunny-${TS}` }),
  });
  const file = await call(teacher, `/api/teacher/lessons/${lesson1Id}/files`, {
    method: "POST",
    body: JSON.stringify({ url: "https://example.com/sheet.pdf", fileName: "ورقة عمل" }),
  });
  check("video and file attached", video.status === 201 && file.status === 201);

  const teacherList = await call(teacher, "/api/teacher/lessons");
  const mine = teacherList.body?.lessons?.find((l) => l.id === lesson1Id);
  check("lesson listed with counts", mine?._count?.videos === 1 && mine?._count?.files === 1);

  // --- school B student (same grade) must NOT see school A's lesson
  const adminB = jar();
  await call(adminB, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `pb-admin-b-${TS}@school-b.local`, password: "PbAdmin#2" }),
  });
  await call(adminB, "/api/school-admin/users", {
    method: "POST",
    body: JSON.stringify({
      fullName: "طالب مدرسة ب",
      email: `pb-student-b-${TS}@school-b.local`,
      password: "PbStudent#2",
      role: "STUDENT",
      gradeId: firstGrade.id,
    }),
  });
  const studentB = jar();
  await call(studentB, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `pb-student-b-${TS}@school-b.local`, password: "PbStudent#2" }),
  });

  const listB1 = await call(studentB, "/api/student/lessons");
  const titlesB1 = (listB1.body?.lessons ?? []).map((l) => l.title);
  check(
    "DRAFT school-A lesson hidden from school-B student (draft + isolation)",
    listB1.status === 200 && !titlesB1.includes(`درس الجمع ${TS}`)
  );
  check(
    "central content (schoolId=null) visible to school-B student",
    titlesB1.includes("درس تجريبي مركزي من مدار")
  );

  // --- publish; school B student STILL must not see it; school A student does
  const publish = await call(teacher, `/api/teacher/lessons/${lesson1Id}/publish`, { method: "PATCH" });
  check("teacher publishes lesson", publish.status === 200 && publish.body.lesson.status === "PUBLISHED");

  const listB2 = await call(studentB, "/api/student/lessons");
  const titlesB2 = (listB2.body?.lessons ?? []).map((l) => l.title);
  check(
    "PUBLISHED school-A lesson still hidden from school-B student",
    !titlesB2.includes(`درس الجمع ${TS}`)
  );

  await call(adminA, "/api/school-admin/users", {
    method: "POST",
    body: JSON.stringify({
      fullName: "طالب مدرسة أ",
      email: `pb-student-a-${TS}@school-a.local`,
      password: "PbStudent#1",
      role: "STUDENT",
      gradeId: firstGrade.id,
    }),
  });
  const studentA = jar();
  await call(studentA, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `pb-student-a-${TS}@school-a.local`, password: "PbStudent#1" }),
  });
  const listA = await call(studentA, "/api/student/lessons");
  const titlesA = (listA.body?.lessons ?? []).map((l) => l.title);
  check(
    "school-A student sees own school's published lesson + central lesson",
    titlesA.includes(`درس الجمع ${TS}`) && titlesA.includes("درس تجريبي مركزي من مدار")
  );

  // --- DRAFT invisibility for own school
  const lesson2 = await call(teacher, "/api/teacher/lessons", {
    method: "POST",
    body: JSON.stringify({ title: `درس مسودة ${TS}`, unitId: unit.id }),
  });
  check("second lesson created as DRAFT", lesson2.status === 201 && lesson2.body.lesson.status === "DRAFT");
  const listA2 = await call(studentA, "/api/student/lessons");
  const titlesA2 = (listA2.body?.lessons ?? []).map((l) => l.title);
  check("own-school DRAFT lesson hidden from students", !titlesA2.includes(`درس مسودة ${TS}`));

  // --- cross-school modification rejected
  const lessonB = await call(adminB, "/api/teacher/lessons", {
    method: "POST",
    body: JSON.stringify({ title: `درس مدرسة ب ${TS}`, unitId: unit.id }),
  });
  const crossPublish = await call(teacher, `/api/teacher/lessons/${lessonB.body?.lesson?.id}/publish`, {
    method: "PATCH",
  });
  check(
    "school-A teacher cannot publish school-B lesson (404)",
    crossPublish.status === 404 && crossPublish.body?.error?.code === "LESSON_NOT_FOUND"
  );

  // --- student cannot touch teacher routes
  const studentForbidden = await call(studentA, "/api/teacher/lessons");
  check("student blocked from teacher routes (403)", studentForbidden.status === 403);

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("Test script crashed:", e);
  process.exitCode = 1;
});
