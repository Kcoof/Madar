import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// POST /api/live-classes/:id/end — the teacher ends the class and the
// recording URL (if any) is saved. Students no longer see the class.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(["TEACHER"]);
    const liveClass = await prisma.liveClass.findUnique({
      where: { id: params.id },
    });
    if (!liveClass) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة غير موجودة");
    }
    if (liveClass.teacherId !== user.id) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة ليست حصتك");
    }
    if (liveClass.endedAt) {
      return NextResponse.json({
        liveClass: { id: liveClass.id, endedAt: liveClass.endedAt, recordingUrl: liveClass.recordingUrl },
      });
    }

    // Real recording retrieval lands with the LiveKit deployment (Egress);
    // until then the recordingUrl stays null in local mode.
    const updated = await prisma.liveClass.update({
      where: { id: liveClass.id },
      data: { endedAt: new Date() },
    });

    return NextResponse.json({
      liveClass: { id: updated.id, endedAt: updated.endedAt, recordingUrl: updated.recordingUrl },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
