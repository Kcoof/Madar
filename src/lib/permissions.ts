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

// Subscription gate for subject-scoped student access (Phase E will implement
// the real Subscription lookup; Phase D/E routes call it on every entry).
export async function checkSubjectAccess(
  studentId: string,
  subjectId: string
): Promise<boolean> {
  // TODO: ربط فعلي بعد المرحلة E — replace with a real Subscription check
  return true;
}
