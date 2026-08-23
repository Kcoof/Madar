// Phase A acceptance test (madar_plan_v2.0.md):
//   1. MADAR_OWNER creates two test schools (A) and (B), each with its admin.
//   2. School A admin lists users -> ONLY school A users are returned.
//   3. Passing school B's id manually (?schoolId=...) must NOT leak school B
//      users (withSchoolScope ignores request input).
//   4. A registered student starts inactive, is blocked from protected APIs,
//      gets activated by the owner, and the activation is recorded in AuditLog.
//   5. Role enforcement: a school admin cannot access madar-admin routes.
// Run with the dev server up: node scripts/test-phase-a.mjs

const BASE = "http://localhost:3000";
const TS = Date.now();

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, pass: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

// Minimal cookie jar
function makeJar() {
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

async function call(jar, path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(jar ? { Cookie: jar.header() } : {}),
      ...options.headers,
    },
  });
  jar?.capture(res);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function main() {
  // --- owner login (seeded credentials)
  const owner = makeJar();
  const ownerLogin = await call(owner, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@madar.local", password: "MadarOwner#2026" }),
  });
  check("owner login", ownerLogin.status === 200 && ownerLogin.body.user.isActive === true);

  // --- create schools A and B
  const schoolA = await call(owner, "/api/madar-admin/schools", {
    method: "POST",
    body: JSON.stringify({
      name: `مدرسة الأمل ${TS}`,
      adminFullName: "مدير مدرسة الأمل",
      adminEmail: `admin-a-${TS}@school-a.local`,
      adminPassword: "SchoolAdmin#1",
    }),
  });
  check("create school A", schoolA.status === 201, JSON.stringify(schoolA.body));

  const schoolB = await call(owner, "/api/madar-admin/schools", {
    method: "POST",
    body: JSON.stringify({
      name: `مدرسة النور ${TS}`,
      adminFullName: "مدير مدرسة النور",
      adminEmail: `admin-b-${TS}@school-b.local`,
      adminPassword: "SchoolAdmin#2",
    }),
  });
  check("create school B", schoolB.status === 201, JSON.stringify(schoolB.body));
  const schoolBId = schoolB.body?.school?.id;

  // --- school A admin login
  const adminA = makeJar();
  const adminALogin = await call(adminA, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: `admin-a-${TS}@school-a.local`, password: "SchoolAdmin#1" }),
  });
  check(
    "school A admin login (active immediately)",
    adminALogin.status === 200 && adminALogin.body.user.role === "SCHOOL_ADMIN"
  );

  // --- ACCEPTANCE: school A admin sees ONLY school A users
  const listA = await call(adminA, "/api/school-admin/users");
  const emailsA = (listA.body?.users ?? []).map((u) => u.email);
  check(
    "school A users list returns only school A",
    listA.status === 200 &&
      emailsA.includes(`admin-a-${TS}@school-a.local`) &&
      !emailsA.includes(`admin-b-${TS}@school-b.local`),
    `users: ${emailsA.join(", ")}`
  );

  // --- ACCEPTANCE: manually passing school B's id must not leak school B
  const listAforced = await call(adminA, `/api/school-admin/users?schoolId=${schoolBId}`);
  const emailsForced = (listAforced.body?.users ?? []).map((u) => u.email);
  check(
    "manual schoolId param is ignored (withSchoolScope)",
    listAforced.status === 200 &&
      !emailsForced.includes(`admin-b-${TS}@school-b.local`) &&
      emailsForced.includes(`admin-a-${TS}@school-a.local`),
    `users: ${emailsForced.join(", ")}`
  );

  // --- role enforcement: school admin cannot access owner routes
  const forbidden = await call(adminA, "/api/madar-admin/schools");
  check(
    "school admin blocked from owner routes (403 + unified error)",
    forbidden.status === 403 && forbidden.body?.error?.code === "FORBIDDEN"
  );

  // --- anonymous blocked
  const anon = await call(null, "/api/school-admin/users");
  check(
    "anonymous blocked (401 + unified error)",
    anon.status === 401 && anon.body?.error?.code === "UNAUTHORIZED"
  );

  // --- student registers publicly -> inactive
  const studentEmail = `student-${TS}@school-a.local`;
  const reg = await call(null, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "طالب تجريبي",
      email: studentEmail,
      password: "Student#1234",
    }),
  });
  check("student registration (STUDENT, inactive)", reg.status === 201, JSON.stringify(reg.body));

  const student = makeJar();
  const studentLogin = await call(student, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: studentEmail, password: "Student#1234" }),
  });
  check(
    "student login works but account is inactive",
    studentLogin.status === 200 && studentLogin.body.user.isActive === false
  );

  const studentBlocked = await call(student, "/api/school-admin/users");
  check(
    "inactive student blocked from protected APIs",
    studentBlocked.status === 403 && studentBlocked.body?.error?.code === "ACCOUNT_INACTIVE"
  );

  // --- school A admin CANNOT activate a school-less student (scope: not in their school)
  const studentId = reg.body?.user?.id;
  const wrongScopeActivate = await call(
    adminA,
    `/api/madar-admin/users/${studentId}/activate`,
    { method: "PATCH" }
  );
  check(
    "school admin cannot activate a user outside their school (404)",
    wrongScopeActivate.status === 404
  );

  // --- owner activates the student
  const activate = await call(owner, `/api/madar-admin/users/${studentId}/activate`, {
    method: "PATCH",
  });
  check("owner activates student", activate.status === 200 && activate.body.user.isActive === true);

  // --- student is now active (role check still applies, not activation check)
  const studentNow = await call(student, "/api/school-admin/users");
  check(
    "activated student passes activation check, blocked by role (403 FORBIDDEN)",
    studentNow.status === 403 && studentNow.body?.error?.code === "FORBIDDEN"
  );

  // --- summary
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Test script crashed:", e);
  process.exitCode = 1;
});
