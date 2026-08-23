import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-blue-50 to-white p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold text-gray-900">مدار التعليمية</h1>
        <p className="text-lg text-gray-600">
          منصة تعليمية متكاملة للمدارس والمعلمين والطلاب
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/login">
          <Button size="lg">تسجيل الدخول</Button>
        </Link>
        <Link href="/register">
          <Button size="lg" variant="outline">
            إنشاء حساب جديد
          </Button>
        </Link>
      </div>
    </main>
  );
}
