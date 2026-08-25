// Shared test-setup helpers.

// Gives a student an ACTIVE FULL_YEAR subscription through the real API
// flow (request → owner activates). Needed since Phase E gated all student
// content behind subscriptions. No-op when one already exists.
export async function grantFullYear({ call, jar, student, email }) {
  const subs = await call(student, "/api/student/subscriptions");
  const full = subs.body?.plans?.find((p) => p.type === "FULL_YEAR");
  if (!full) throw new Error("FULL_YEAR plan not found — run npm run db:seed:plans");
  const req = await call(student, "/api/student/subscriptions/request", {
    method: "POST",
    body: JSON.stringify({ planId: full.id }),
  });
  if (req.status !== 201) return; // already requested or active
  const ow = jar();
  await call(ow, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "owner@madar.local", password: "MadarOwner#2026" }),
  });
  const pending = await call(ow, "/api/madar-admin/subscriptions/pending");
  const mine = (pending.body?.pending ?? []).find((p) => p.student.email === email);
  if (mine) {
    await call(ow, "/api/madar-admin/subscriptions/" + mine.id + "/activate", {
      method: "PATCH",
    });
  }
}
