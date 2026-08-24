"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell } from "@/components/shared";
import { studentNav } from "@/components/shared/navs";
import { apiFetch } from "@/lib/api-client";

type Notification = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export default function StudentNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: Notification[]; unreadCount: number }>(
        "/api/notifications"
      );
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحميل الإشعارات";
      if (msg.includes("تسجيل الدخول")) router.push("/login");
      setError(msg);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onMarkRead(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تعليم الإشعار");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell title="الإشعارات" nav={studentNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-gray-500">
        {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات غير مقروءة"}
      </p>

      <div className="grid gap-3">
        {notifications.map((n) => (
          <Card key={n.id} className={n.isRead ? "opacity-70" : ""}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-gray-600">{n.body}</p>
                <p className="text-xs text-gray-400">
                  {new Date(n.createdAt).toLocaleString("ar")}
                </p>
              </div>
              {!n.isRead && (
                <Button size="sm" variant="outline" disabled={busyId === n.id}
                  onClick={() => onMarkRead(n.id)}>
                  {busyId === n.id ? "..." : "تعليم كمقروء"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {notifications.length === 0 && (
          <p className="text-center text-gray-500">لا توجد إشعارات بعد</p>
        )}
      </div>
    </DashboardShell>
  );
}
