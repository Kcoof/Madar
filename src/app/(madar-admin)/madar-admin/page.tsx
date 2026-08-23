"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

type School = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  _count: { users: number };
};

type MadarUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  school: { name: string } | null;
};

const roleLabels: Record<string, string> = {
  MADAR_OWNER: "مالك مدار",
  MADAR_SUPPORT: "دعم مدار",
  SCHOOL_ADMIN: "مدير مدرسة",
  TEACHER: "معلم",
  STUDENT: "طالب",
  PARENT: "ولي أمر",
};

export default function MadarAdminPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [users, setUsers] = useState<MadarUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", adminFullName: "", adminEmail: "", adminPassword: "" });

  const load = useCallback(async () => {
    try {
      const [schoolsData, usersData] = await Promise.all([
        apiFetch<{ schools: School[] }>("/api/madar-admin/schools"),
        apiFetch<{ users: MadarUser[] }>("/api/madar-admin/users"),
      ]);
      setSchools(schoolsData.schools);
      setUsers(usersData.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (message.includes("تسجيل الدخول")) router.push("/login");
      setError(message);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreateSchool(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/madar-admin/schools", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", adminFullName: "", adminEmail: "", adminPassword: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء المدرسة");
    } finally {
      setPending(false);
    }
  }

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

  const waitingCount = users.filter((u) => !u.isActive).length;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">لوحة إدارة مدار</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "إلغاء" : "إضافة مدرسة"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>مدرسة جديدة + مديرها</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateSchool} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المدرسة</Label>
                <Input
                  id="name"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminFullName">اسم المدير</Label>
                <Input
                  id="adminFullName"
                  required
                  minLength={2}
                  value={form.adminFullName}
                  onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">بريد المدير</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  dir="ltr"
                  required
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">كلمة مرور المدير</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  required
                  minLength={8}
                  value={form.adminPassword}
                  onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "جارٍ الإنشاء..." : "إنشاء المدرسة"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            الحسابات بانتظار التفعيل والمستخدمون ({users.length}
            {waitingCount > 0 ? ` — ${waitingCount} بانتظار التفعيل` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>المدرسة</TableHead>
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
                  <TableCell>{user.school?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "مفعّل" : "بانتظار التفعيل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!user.isActive && (
                      <Button
                        size="sm"
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
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    لا يوجد مستخدمون بعد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المدارس ({schools.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المدرسة</TableHead>
                <TableHead>عدد المستخدمين</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>{school._count.users}</TableCell>
                  <TableCell>
                    {new Date(school.createdAt).toLocaleDateString("ar")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={school.isActive ? "default" : "secondary"}>
                      {school.isActive ? "نشطة" : "موقوفة"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {schools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">
                    لا توجد مدارس بعد
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
