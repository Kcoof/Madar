import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { visiblePublishedLessonsWhere } from "@/lib/lesson-visibility";
import { z } from "zod";

const progressSchema = z.object({
  watchedPercent: z.coerce.number().int().min(0).max(100),
});

// POST /api/student/videos/:id/progress — update the student's watched
// percentage for a video inside a lesson visible to them.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const student = await requireRole(["STUDENT"]);
    const lessonsWhere = visiblePublishedLessonsWhere(student);
    if (!lessonsWhere) {
      throw new ApiError(404, "VIDEO_NOT_FOUND", "الفيديو غير متاح لصفك");
    }

    const video = await prisma.video.findFirst({
      where: { id: params.id, lesson: lessonsWhere },
    });
    if (!video) {
      throw new ApiError(404, "VIDEO_NOT_FOUND", "الفيديو غير متاح");
    }

    const body = progressSchema.parse(await request.json());

    const existing = await prisma.videoWatchProgress.findFirst({
      where: { videoId: video.id, studentId: student.id },
    });
    const progress = existing
      ? await prisma.videoWatchProgress.update({
          where: { id: existing.id },
          data: { watchedPercent: body.watchedPercent },
        })
      : await prisma.videoWatchProgress.create({
          data: {
            videoId: video.id,
            studentId: student.id,
            watchedPercent: body.watchedPercent,
          },
        });

    return NextResponse.json({
      progress: { videoId: video.id, watchedPercent: progress.watchedPercent },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
