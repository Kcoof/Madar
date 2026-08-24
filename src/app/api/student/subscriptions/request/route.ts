import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { requestSubscriptionSchema } from "@/lib/validators/subscription";

// POST /api/student/subscriptions/request — request a subscription (PENDING).
// SINGLE_SUBJECT plans must carry a subject of the student's grade.
export async function POST(request: Request) {
  try {
    const student = await requireRole(["STUDENT"]);
    const body = requestSubscriptionSchema.parse(await request.json());

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.planId } });
    if (!plan) {
      throw new ApiError(404, "PLAN_NOT_FOUND", "الخطة غير موجودة");
    }

    let subjectId: string | null = null;
    if (plan.type === "SINGLE_SUBJECT") {
      if (!body.subjectId) {
        throw new ApiError(400, "SUBJECT_REQUIRED", "يجب اختيار المادة للاشتراك");
      }
      const subject = await prisma.subject.findUnique({
        where: { id: body.subjectId },
      });
      if (!subject || subject.gradeId !== student.gradeId) {
        throw new ApiError(404, "SUBJECT_NOT_FOUND", "المادة غير متاحة لصفك");
      }
      subjectId = subject.id;
    }

    const duplicate = await prisma.subscription.findFirst({
      where: {
        studentId: student.id,
        planId: plan.id,
        subjectId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        "DUPLICATE_REQUEST",
        duplicate.status === "PENDING"
          ? "لديك طلب قيد المراجعة لنفس الخطة"
          : "أنت مشترك مسبقاً بهذه الخطة"
      );
    }

    const subscription = await prisma.subscription.create({
      data: { studentId: student.id, planId: plan.id, subjectId, status: "PENDING" },
      include: { plan: { select: { name: true, type: true } } },
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
