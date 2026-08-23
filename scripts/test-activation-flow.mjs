// Verifies the student activation loop:
// register -> blocked (ACCOUNT_INACTIVE) -> owner lists users -> activates -> student passes activation.
const BASE = "http://localhost:3000";
const TS = Date.now();
const email = `waiting-student-${TS}@madar.local`;

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

const results = [];
const check = (name, ok, detail = "") =>
  results.push(ok) || console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);

const student = jar();
await call(null, "/api/auth/register", {
  method: "POST",
  body: JSON.stringify({ fullName: "طالب بانتظار التفعيل", email, password: "Student#1234" }),
});
const login1 = await call(student, "/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password: "Student#1234" }),
});
check("student login works but inactive", login1.status === 200 && login1.body.user.isActive === false);
const blocked = await call(student, "/api/school-admin/users");
check("blocked before activation (ACCOUNT_INACTIVE)", blocked.status === 403 && blocked.body?.error?.code === "ACCOUNT_INACTIVE");

const owner = jar();
await call(owner, "/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "owner@madar.local", password: "MadarOwner#2026" }),
});
const list = await call(owner, "/api/madar-admin/users");
const found = (list.body?.users ?? []).find((u) => u.email === email);
check("owner sees the waiting student in users list", list.status === 200 && Boolean(found), `isActive=${found?.isActive}`);

const act = await call(owner, `/api/madar-admin/users/${found.id}/activate`, { method: "PATCH" });
check("owner activates the student", act.status === 200 && act.body.user.isActive === true);

const blocked2 = await call(student, "/api/school-admin/users");
check(
  "student now passes activation, blocked only by role",
  blocked2.status === 403 && blocked2.body?.error?.code === "FORBIDDEN"
);

const failed = results.includes(false);
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exitCode = failed ? 1 : 0;
