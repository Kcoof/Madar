import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole, checkSubjectAccess } from "@/lib/permissions";

// GET /api/student/access-check?subjectId= — does the student's subscription
// cover this subject? Used internally by content/broadcast routes and by the
// UI to explain locked content.
export async function GET(request: Request) {
  try {
    const student = await requireRole(["STUDENT"]);
    const subjectId = new URL(request.url).searchParams.get("subjectId");
    if (!subjectId) {
      return NextResponse.json(
        { error: { code: "SUBJECT_REQUIRED", message: "يجب تحديد المادة" } },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      return NextResponse.json(
        { error: { code: "SUBJECT_NOT_FOUND", message: "المادة غير موجودة" } },
        { status: 404 }
      );
    }

    const access = await checkSubjectAccess(student.id, subjectId);
    return NextResponse.json({
      subjectId,
      subjectName: subject.name,
      access,
      code: access ? "OK" : "SUBSCRIPTION_REQUIRED",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
