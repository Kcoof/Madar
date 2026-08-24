import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// GET /api/student/subscriptions — my subscriptions + the available plans.
export async function GET() {
  try {
    const student = await requireRole(["STUDENT"]);

    const [subscriptions, plans] = await Promise.all([
      prisma.subscription.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        include: {
          plan: { select: { name: true, type: true, price: true } },
          subject: { select: { name: true } },
        },
      }),
      prisma.subscriptionPlan.findMany({ orderBy: { price: "asc" } }),
    ]);

    return NextResponse.json({ subscriptions, plans });
  } catch (error) {
    return errorResponse(error);
  }
}
