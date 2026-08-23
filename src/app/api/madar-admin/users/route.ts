import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// GET /api/madar-admin/users — all users across schools (MADAR_OWNER only).
// Inactive accounts come first so pending approvals are immediately visible.
export async function GET() {
  try {
    await requireRole(["MADAR_OWNER"]);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        school: { select: { name: true } },
      },
      orderBy: [{ isActive: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}
