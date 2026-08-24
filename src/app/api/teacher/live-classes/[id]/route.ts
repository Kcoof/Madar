import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { mintJoinToken, whipUrl } from "@/lib/livekit";

// GET /api/teacher/live-classes/:id — class detail + the school's students of
// the subject's grade with their mic-grant status (for the grant/revoke UI).
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const liveClass = await prisma.liveClass.findUnique({ where: { id: params.id } });
    if (!liveClass) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة غير موجودة");
    }
    const owner = await prisma.user.findUnique({
      where: { id: liveClass.teacherId },
      select: { schoolId: true },
    });
    if (owner?.schoolId !== user.schoolId) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة غير موجودة في مدرستك");
    }

    const subject = await prisma.subject.findUnique({
      where: { id: liveClass.subjectId },
      include: { grade: true },
    });

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        schoolId: user.schoolId,
        gradeId: subject?.gradeId,
        isActive: true,
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      liveClass: {
        ...liveClass,
        subject: { name: subject?.name ?? "", grade: { name: subject?.grade.name ?? "" } },
        // WHIP ingest for external camera apps (OBS 30+, Larix Broadcaster):
        // publish straight into the room with this URL.
        whipUrl: liveClass.roomName
          ? whipUrl(
              liveClass.roomName,
              await mintJoinToken(user.id, liveClass.roomName, true)
            )
          : null,
      },
      students: students.map((s) => ({
        ...s,
        micGranted: liveClass.micGrants.includes(s.id),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
