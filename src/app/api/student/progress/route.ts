import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";
import { computeSubjectProgress } from "@/lib/progress";

// GET /api/student/progress — per-subject completion rates + overall average.
export async function GET() {
  try {
    const student = await requireRole(["STUDENT"]);
    const { subjects, overall } = await computeSubjectProgress(student);
    return NextResponse.json({ subjects, overall });
  } catch (error) {
    return errorResponse(error);
  }
}
