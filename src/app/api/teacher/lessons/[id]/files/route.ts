import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole, withSchoolScope } from "@/lib/permissions";
import { attachFileSchema } from "@/lib/validators/lesson";

// POST /api/teacher/lessons/:id/files — attach a file (url + display name).
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

    const body = attachFileSchema.parse(await request.json());
    const file = await prisma.file.create({
      data: { lessonId: lesson.id, url: body.url, fileName: body.fileName },
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
