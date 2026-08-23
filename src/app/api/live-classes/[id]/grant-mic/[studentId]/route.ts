import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { updateParticipantPublish } from "@/lib/livekit";

// PATCH /api/live-classes/:id/grant-mic/:studentId — allow a student to
// publish audio/video in the room. TEACHER (owner) or SCHOOL_ADMIN of the
// same school; the student must be in that school and the subject's grade.
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string; studentId: string } }
) {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    const liveClass = await prisma.liveClass.findUnique({
      where: { id: params.id },
    });
    if (!liveClass) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة غير موجودة");
    }
    if (user.role === "TEACHER" && liveClass.teacherId !== user.id) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة غير موجودة");
    }

    const subject = await prisma.subject.findUnique({
      where: { id: liveClass.subjectId },
    });
    const student = await prisma.user.findFirst({
      where: {
        id: params.studentId,
        role: "STUDENT",
        schoolId: user.schoolId ?? undefined,
        gradeId: subject?.gradeId,
      },
    });
    if (!student) {
      throw new ApiError(404, "STUDENT_NOT_FOUND", "الطالب غير موجود في صف هذه الحصة");
    }

    if (!liveClass.micGrants.includes(student.id)) {
      await prisma.liveClass.update({
        where: { id: liveClass.id },
        data: { micGrants: { push: student.id } },
      });
    }
    // Live effect on a real LiveKit deployment (no-op locally)
    await updateParticipantPublish(
      liveClass.roomName ?? liveClass.id,
      student.id,
      true
    ).catch(() => {});

    return NextResponse.json({ studentId: student.id, micGranted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
