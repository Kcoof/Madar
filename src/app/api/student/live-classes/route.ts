import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole, subscriptionScope } from "@/lib/permissions";

// GET /api/student/live-classes — upcoming (not ended) classes of the
// student's grade and school, limited to subscribed subjects (Phase E).
// rtmpUrl/streamKey are NEVER included.
export async function GET() {
  try {
    const student = await requireRole(["STUDENT"]);
    if (!student.gradeId) {
      return NextResponse.json({
        liveClasses: [],
        message: "لم يتم تعيين صفك الدراسي بعد — راجع إدارة مدرستك",
      });
    }

    // LiveClass has plain ids (no relations, per the plan schema) — resolve
    // the grade's subjects and the school's teachers first.
    const gradeSubjects = await prisma.subject.findMany({
      where: { gradeId: student.gradeId },
      select: { id: true, name: true },
    });
    const schoolTeachers = student.schoolId
      ? await prisma.user.findMany({
          where: { schoolId: student.schoolId },
          select: { id: true, fullName: true },
        })
      : [];

    const scope = await subscriptionScope(student.id);
    const allowed = gradeSubjects.filter(
      (s) => scope.fullYear || scope.subjectIds.has(s.id)
    );

    const liveClasses = await prisma.liveClass.findMany({
      where: {
        endedAt: null,
        subjectId: { in: allowed.map((s) => s.id) },
        ...(schoolTeachers.length > 0
          ? { teacherId: { in: schoolTeachers.map((t) => t.id) } }
          : {}),
      },
      orderBy: { scheduledAt: "asc" },
    });

    const subjectById = new Map(gradeSubjects.map((s) => [s.id, s]));
    const teacherById = new Map(schoolTeachers.map((t) => [t.id, t]));

    // Strip every teacher-only field — students see scheduling info only.
    return NextResponse.json({
      liveClasses: liveClasses.map((c) => ({
        id: c.id,
        subjectName: subjectById.get(c.subjectId)?.name ?? "",
        teacherName: teacherById.get(c.teacherId)?.fullName ?? "",
        scheduledAt: c.scheduledAt,
        micGranted: c.micGrants.includes(student.id),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
