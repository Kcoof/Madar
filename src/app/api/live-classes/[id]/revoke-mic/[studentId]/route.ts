import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { updateParticipantPublish } from "@/lib/livekit";

// PATCH /api/live-classes/:id/revoke-mic/:studentId — remove a student's
// publish permission. Same ownership rules as grant-mic.
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

    await prisma.liveClass.update({
      where: { id: liveClass.id },
      data: { micGrants: liveClass.micGrants.filter((id) => id !== params.studentId) },
    });
    await updateParticipantPublish(
      liveClass.roomName ?? liveClass.id,
      params.studentId,
      false
    ).catch(() => {});

    return NextResponse.json({ studentId: params.studentId, micGranted: false });
  } catch (error) {
    return errorResponse(error);
  }
}
