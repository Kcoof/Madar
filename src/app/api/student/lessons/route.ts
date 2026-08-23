import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// GET /api/student/lessons — PUBLISHED lessons of the student's grade:
// central content (schoolId = null) + their own school's lessons only.
// DRAFT lessons never appear; other schools' lessons never appear.
export async function GET() {
  try {
    const student = await requireRole(["STUDENT"]);

    if (!student.gradeId) {
      return NextResponse.json({
        lessons: [],
        message: "لم يتم تعيين صفك الدراسي بعد — راجع إدارة مدرستك",
      });
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        status: "PUBLISHED",
        unit: { subject: { gradeId: student.gradeId } },
        OR: [
          { schoolId: null },
          ...(student.schoolId ? [{ schoolId: student.schoolId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        unit: { include: { subject: { include: { grade: true } } } },
        _count: { select: { videos: true, files: true } },
      },
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    return errorResponse(error);
  }
}
