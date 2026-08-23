"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

type SchoolUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const roleLabels: Record<string, string> = {
  SCHOOL_ADMIN: "مدير مدرسة",
  TEACHER: "معلم",
  STUDENT: "طالب",
  PARENT: "ولي أمر",
};

export default function SchoolAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ users: SchoolUser[] }>("/api/school-admin/users");
      setUsers(data.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تحميل المستخدمين";
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
      await apiFetch(`/api/madar-admin/users/${id}/activate`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تفعيل الحساب");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">لوحة مدير المدرسة — المستخدمون</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>مستخدمو مدرستك ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell dir="ltr">{user.email}</TableCell>
                  <TableCell>{roleLabels[user.role] ?? user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "مفعّل" : "بانتظار التفعيل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!user.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === user.id}
                        onClick={() => onActivate(user.id)}
                      >
                        {busyId === user.id ? "..." : "تفعيل"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    لا يوجد مستخدمون بعد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
