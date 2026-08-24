import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { ApiError } from "@/lib/api";

// Session + role check — the single entry point every protected API route
// calls as its first line (fixed decision 4). Returns the authenticated,
// active user whose role is in `roles`.
export async function requireRole(roles: Role[]) {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new ApiError(401, "UNAUTHORIZED", "يجب تسجيل الدخول أولاً");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "الحساب غير موجود");
  }
  if (!user.isActive) {
    throw new ApiError(403, "ACCOUNT_INACTIVE", "الحساب بانتظار التفعيل من الإدارة");
  }
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "لا تملك صلاحية الوصول");
  }
  return user;
}

// Secondary school-isolation layer on top of RLS (fixed decision 3).
// Merges the caller's own schoolId into the where clause — a schoolId passed
// in the request body/query is never trusted.
export function withSchoolScope(schoolId: string, whereClause: object = {}): object {
  return { ...whereClause, schoolId };
}

// Subscription scope for a student: full-year access covers every subject;
// single-subject subscriptions cover exactly their subject (Phase E).
export async function subscriptionScope(studentId: string): Promise<{
  fullYear: boolean;
  subjectIds: Set<string>;
}> {
  const subs = await prisma.subscription.findMany({
    where: { studentId, status: "ACTIVE" },
    select: { subjectId: true, plan: { select: { type: true } } },
  });
  return {
    fullYear: subs.some((s) => s.plan.type === "FULL_YEAR"),
    subjectIds: new Set(
      subs.filter((s) => s.subjectId).map((s) => s.subjectId as string)
    ),
  };
}

// Subscription gate for subject-scoped student access — used by the
// student lessons/quizzes/live-classes routes. An unsubscribed subject is
// rejected with SUBSCRIPTION_REQUIRED, not a generic permission error.
export async function checkSubjectAccess(
  studentId: string,
  subjectId: string
): Promise<boolean> {
  const scope = await subscriptionScope(studentId);
  return scope.fullYear || scope.subjectIds.has(subjectId);
}
