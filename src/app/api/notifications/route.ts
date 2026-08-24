import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// GET /api/notifications — the current user's notifications, newest first.
export async function GET() {
  try {
    const user = await requireRole([
      "MADAR_OWNER",
      "MADAR_SUPPORT",
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
      "PARENT",
    ]);

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
