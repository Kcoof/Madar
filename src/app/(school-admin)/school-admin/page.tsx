"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/shared/app-header";
import { apiFetch } from "@/lib/api-client";

type SchoolUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type Stage = { id: string; name: string; grades: { id: string; name: string }[] };

const roleLabels: Record<string, string> = {
  SCHOOL_ADMIN: "مدير مدرسة",
  TEACHER: "معلم",
  STUDENT: "طالب",
  PARENT: "ولي أمر",
};

export default function SchoolAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "TEACHER",
    gradeId: "",
  });

  const grades = useMemo(() => stages.flatMap((s) => s.grades), [stages]);

  const load = useCallback(async () => {
    try {
      const [usersData, curriculum] = await Promise.all([
        apiFetch<{ users: SchoolUser[] }>("/api/school-admin/users"),
        apiFetch<{ stages: Stage[] }>("/api/academic/curriculum"),
      ]);
      setUsers(usersData.users);
      setStages(curriculum.stages);
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
      await apiFetch(`/api/madar-admin/users/${id}/activate`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تفعيل الحساب");
    } finally {
      setBusyId(null);
    }
  }

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/school-admin/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ fullName: "", email: "", password: "", role: "TEACHER", gradeId: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء الحساب");
    } finally {
      setPending(false);
    }
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <main className="min-h-screen">
      <AppHeader title="لوحة مدير المدرسة" />
      <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-700">مستخدمو المدرسة</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "إلغاء" : "إضافة معلم / طالب"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>حساب جديد في مدرستك</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreateUser} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  required
                  minLength={2}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">الدور</Label>
                <select
                  id="role"
                  className={selectClass}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="TEACHER">معلم</option>
                  <option value="STUDENT">طالب</option>
                </select>
              </div>
              {form.role === "STUDENT" && (
                <div className="space-y-2">
                  <Label htmlFor="gradeId">الصف</Label>
                  <select
                    id="gradeId"
                    className={selectClass}
                    required
                    value={form.gradeId}
                    onChange={(e) => setForm({ ...form, gradeId: e.target.value })}
                  >
                    <option value="">اختر الصف</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
      </div>
    </main>
  );
}
