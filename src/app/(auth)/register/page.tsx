"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء الحساب");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
          <CardDescription>حساب الطالب — يُفعَّل يدوياً من إدارة مدار بعد التسجيل</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-green-700">
                تم إنشاء الحساب بنجاح. حسابك الآن بانتظار التفعيل من إدارة مدار.
              </p>
              <Link href="/login" className="block text-blue-600 hover:underline">
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
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
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
              </Button>
              <p className="text-center text-sm text-gray-600">
                تملك حساباً بالفعل؟{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  تسجيل الدخول
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
