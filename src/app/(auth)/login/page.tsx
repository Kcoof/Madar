"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

const roleHome: Record<string, string> = {
  MADAR_OWNER: "/madar-admin",
  MADAR_SUPPORT: "/madar-admin",
  SCHOOL_ADMIN: "/school-admin",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { user } = await apiFetch<{ user: { id: string; role: string | null; isActive: boolean } }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      );
      if (!user.isActive) {
        setError("حسابك بانتظار التفعيل من إدارة مدار.");
        return;
      }
      router.push(roleHome[user.role ?? ""] ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
          <CardDescription>منصة مدار التعليمية</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "جارٍ الدخول..." : "دخول"}
            </Button>
            <p className="text-center text-sm text-gray-600">
              لا تملك حساباً؟{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                إنشاء حساب جديد
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
