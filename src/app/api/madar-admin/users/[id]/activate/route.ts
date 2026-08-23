import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";

// PATCH /api/madar-admin/users/:id/activate — manual activation + AuditLog.
// MADAR_OWNER: any user. SCHOOL_ADMIN: only users of their own school
// (withSchoolScope — a school admin can never activate another school's user).
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await requireRole(["MADAR_OWNER", "SCHOOL_ADMIN"]);

    const where =
      actor.role === "MADAR_OWNER"
        ? { id: params.id }
        : withSchoolScope(actor.schoolId as string, { id: params.id });

    const target = await prisma.user.findFirst({ where });
    if (!target) {
      throw new ApiError(404, "USER_NOT_FOUND", "المستخدم غير موجود في مدرستك");
    }

    const user = target.isActive
      ? target
      : await prisma.user.update({
          where: { id: target.id },
          data: { isActive: true },
        });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "USER_ACTIVATED",
        targetId: user.id,
        metadata: { email: user.email, byRole: actor.role },
      },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, isActive: user.isActive },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
