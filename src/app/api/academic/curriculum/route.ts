import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// GET /api/academic/curriculum — the shared academic hierarchy
// (stage > grade > subject > unit) for pickers on teacher/student/admin screens.
export async function GET() {
  try {
    await requireRole([
      "MADAR_OWNER",
      "MADAR_SUPPORT",
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
      "PARENT",
    ]);

    const stages = await prisma.academicStage.findMany({
      orderBy: { name: "asc" },
      include: {
        grades: {
          orderBy: { name: "asc" },
          include: {
            subjects: {
              orderBy: { name: "asc" },
              include: { units: { orderBy: { title: "asc" } } },
            },
          },
        },
      },
    });

    return NextResponse.json({ stages });
  } catch (error) {
    return errorResponse(error);
  }
}
