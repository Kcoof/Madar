import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api";
import { requireRole } from "@/lib/permissions";

// PATCH /api/notifications/:id/read — mark one of MY notifications as read.
export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([
      "MADAR_OWNER",
      "MADAR_SUPPORT",
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
      "PARENT",
    ]);

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!notification) {
      throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "الإشعار غير موجود");
    }

    const updated = notification.isRead
      ? notification
      : await prisma.notification.update({
          where: { id: notification.id },
          data: { isRead: true },
        });

    return NextResponse.json({ notification: { id: updated.id, isRead: updated.isRead } });
  } catch (error) {
    return errorResponse(error);
  }
}
