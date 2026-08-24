import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// GET /api/madar-admin/subscriptions/pending — PENDING requests with student,
// plan and subject details. MADAR_OWNER only.
export async function GET() {
  try {
    await requireRole(["MADAR_OWNER"]);

    const pending = await prisma.subscription.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        plan: { select: { name: true, type: true, price: true } },
        subject: { select: { name: true } },
      },
    });

    return NextResponse.json({ pending });
  } catch (error) {
    return errorResponse(error);
  }
}
