import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { provisionLiveClass } from "@/lib/livekit";
import { z } from "zod";

const scheduleSchema = z.object({
  subjectId: z.string().min(1, "يجب اختيار المادة"),
  scheduledAt: z.coerce.date(),
});

// LiveClass stores plain subjectId/teacherId (no Prisma relations, per the
// plan schema) — compose the display fields manually.
async function decorate(
  classes: {
    id: string; subjectId: string; teacherId: string; scheduledAt: Date;
    roomName: string | null; rtmpUrl: string | null; streamKey: string | null;
    recordingUrl: string | null; endedAt: Date | null; createdAt: Date;
  }[]
) {
  const subjects = await prisma.subject.findMany({
    where: { id: { in: [...new Set(classes.map((c) => c.subjectId))] } },
    include: { grade: true },
  });
  const teachers = await prisma.user.findMany({
    where: { id: { in: [...new Set(classes.map((c) => c.teacherId))] } },
    select: { id: true, fullName: true },
  });
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  return classes.map((c) => ({
    ...c,
    subject: {
      name: subjectById.get(c.subjectId)?.name ?? "",
      grade: { name: subjectById.get(c.subjectId)?.grade.name ?? "" },
    },
    teacher: { fullName: teacherById.get(c.teacherId)?.fullName ?? "" },
  }));
}

// POST /api/teacher/live-classes — schedule a class: provisions the LiveKit
// room + RTMP ingress and returns rtmpUrl/streamKey to the TEACHER only.
export async function POST(request: Request) {
  try {
    const user = await requireRole(["TEACHER"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const body = scheduleSchema.parse(await request.json());
    const subject = await prisma.subject.findUnique({
      where: { id: body.subjectId },
      include: { grade: true },
    });
    if (!subject) {
      throw new ApiError(404, "SUBJECT_NOT_FOUND", "المادة غير موجودة");
    }

    const { roomName, rtmpUrl, streamKey } = await provisionLiveClass();

    const created = await prisma.liveClass.create({
      data: {
        subjectId: subject.id,
        teacherId: user.id,
        scheduledAt: body.scheduledAt,
        roomName,
        rtmpUrl,
        streamKey,
      },
    });

    const [liveClass] = await decorate([created]);
    return NextResponse.json({ liveClass }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /api/teacher/live-classes — the school's classes with OBS credentials
// (rtmpUrl/streamKey). TEACHER, SCHOOL_ADMIN — never exposed to students.
export async function GET() {
  try {
    const user = await requireRole(["TEACHER", "SCHOOL_ADMIN"]);
    if (!user.schoolId) {
      throw new ApiError(400, "NO_SCHOOL", "لا توجد مدرسة مرتبطة بحسابك");
    }

    const schoolTeachers = await prisma.user.findMany({
      where: withSchoolScope(user.schoolId),
      select: { id: true },
    });
    const liveClasses = await prisma.liveClass.findMany({
      where: { teacherId: { in: schoolTeachers.map((t) => t.id) } },
      orderBy: { scheduledAt: "desc" },
    });

    return NextResponse.json({ liveClasses: await decorate(liveClasses) });
  } catch (error) {
    return errorResponse(error);
  }
}
