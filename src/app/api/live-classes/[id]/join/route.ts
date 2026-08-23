import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, checkSubjectAccess } from "@/lib/permissions";
import { mintJoinToken, livekitWsUrl } from "@/lib/livekit";

// POST /api/live-classes/:id/join — issues a WebRTC join token.
// Order of checks (per the plan's acceptance criteria):
//   1. the class must belong to the caller's school/grade scope,
//   2. the student's SUBJECT SUBSCRIPTION is verified first
//      (checkSubjectAccess — Phase E placeholder until subscriptions land),
//   3. canPublish is decided server-side: teachers always, students only when
//      the teacher granted them the mic (grant-mic) — view-only otherwise.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(["STUDENT", "TEACHER"]);
    const liveClass = await prisma.liveClass.findUnique({
      where: { id: params.id },
    });
    if (!liveClass || liveClass.endedAt) {
      throw new ApiError(404, "LIVE_CLASS_NOT_FOUND", "الحصة غير متاحة");
    }

    if (user.role === "STUDENT") {
      const subject = await prisma.subject.findUnique({
        where: { id: liveClass.subjectId },
      });
      if (user.gradeId !== subject?.gradeId) {
        throw new ApiError(403, "FORBIDDEN", "هذه الحصة ليست لصفك");
      }
      const teacher = await prisma.user.findUnique({
        where: { id: liveClass.teacherId },
        select: { schoolId: true },
      });
      if (teacher?.schoolId !== user.schoolId) {
        throw new ApiError(403, "FORBIDDEN", "هذه الحصة ليست لمدرستك");
      }
      // Subscription check FIRST — not just same grade (Phase E wires the real one)
      const subscribed = await checkSubjectAccess(user.id, liveClass.subjectId);
      if (!subscribed) {
        throw new ApiError(403, "SUBSCRIPTION_REQUIRED", "هذه المادة تتطلب اشتراكاً فعالاً");
      }
    } else if (liveClass.teacherId !== user.id) {
      throw new ApiError(403, "FORBIDDEN", "هذه الحصة ليست حصتك");
    }

    const canPublish =
      user.role === "TEACHER" || liveClass.micGrants.includes(user.id);

    const token = mintJoinToken(user.id, liveClass.roomName ?? liveClass.id, canPublish);

    return NextResponse.json({
      token,
      url: livekitWsUrl(),
      roomName: liveClass.roomName,
      canPublish,
      mode: canPublish ? "تفاعلي" : "مشاهدة فقط",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
