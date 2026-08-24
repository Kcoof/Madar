"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardShell } from "@/components/shared";
import { ownerNav } from "@/components/shared/navs";
import { apiFetch } from "@/lib/api-client";

type PendingSubscription = {
  id: string;
  createdAt: string;
  student: { fullName: string; email: string };
  plan: { name: string; type: string; price: number };
  subject: { name: string } | null;
};

export default function OwnerSubscriptionsPage() {
  const router = useRouter();
  const [pendingSubs, setPendingSubs] = useState<PendingSubscription[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ pending: PendingSubscription[] }>(
        "/api/madar-admin/subscriptions/pending"
      );
      setPendingSubs(data.pending);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (message.includes("تسجيل الدخول")) router.push("/login");
      setError(message);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onActivate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/madar-admin/subscriptions/${id}/activate`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تفعيل الاشتراك");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell title="لوحة إدارة مدار" nav={ownerNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>طلبات الاشتراك المعلقة ({pendingSubs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead>الخطة</TableHead>
                <TableHead>المادة</TableHead>
                <TableHead>تاريخ الطلب</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingSubs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.student.fullName}
                    <span className="block text-xs text-gray-500" dir="ltr">{s.student.email}</span>
                  </TableCell>
                  <TableCell>{s.plan.name} ({s.plan.price} ريال)</TableCell>
                  <TableCell>{s.subject?.name ?? "جميع المواد"}</TableCell>
                  <TableCell>{new Date(s.createdAt).toLocaleDateString("ar")}</TableCell>
                  <TableCell>
                    <Button size="sm" disabled={busyId === s.id} onClick={() => onActivate(s.id)}>
                      {busyId === s.id ? "..." : "تفعيل"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pendingSubs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    لا توجد طلبات معلقة
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
