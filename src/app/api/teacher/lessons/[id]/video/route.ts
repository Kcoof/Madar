import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { attachVideoSchema } from "@/lib/validators/lesson";

// POST /api/teacher/lessons/:id/video — attach a video by its provider id.
// Actual upload to the streaming provider (Bunny/Mux) comes in a later phase;
// for now the providerId is entered manually (placeholder per the plan).
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const lesson = await prisma.lesson.findFirst({
      where: withSchoolScope(user.schoolId, { id: params.id }),
    });
    if (!lesson) {
      throw new ApiError(404, "LESSON_NOT_FOUND", "الدرس غير موجود في مدرستك");
    }

    const body = attachVideoSchema.parse(await request.json());
    const video = await prisma.video.create({
      data: {
        lessonId: lesson.id,
        providerId: body.providerId,
        durationSec: body.durationSec ?? null,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
