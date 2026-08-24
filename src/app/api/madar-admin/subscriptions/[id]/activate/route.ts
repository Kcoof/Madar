import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// PATCH /api/madar-admin/subscriptions/:id/activate — PENDING → ACTIVE with
// a one-year validity window + AuditLog entry. MADAR_OWNER only.
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const owner = await requireRole(["MADAR_OWNER"]);

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: {
        student: { select: { id: true, fullName: true } },
        plan: { select: { type: true } },
      },
    });
    if (!subscription) {
      throw new ApiError(404, "SUBSCRIPTION_NOT_FOUND", "الطلب غير موجود");
    }
    if (subscription.status !== "PENDING") {
      throw new ApiError(400, "NOT_PENDING", "الطلب ليس في حالة انتظار");
    }

    const now = new Date();
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        startDate: now,
        endDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: owner.id,
        action: "SUBSCRIPTION_ACTIVATED",
        targetId: subscription.id,
        metadata: {
          studentId: subscription.studentId,
          planType: subscription.plan.type,
          subjectId: subscription.subjectId,
        },
      },
    });

    return NextResponse.json({
      subscription: {
        id: updated.id,
        status: updated.status,
        startDate: updated.startDate,
        endDate: updated.endDate,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
