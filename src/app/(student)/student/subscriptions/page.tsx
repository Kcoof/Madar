"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/shared";
import { studentNav } from "@/components/shared/navs";
import { apiFetch } from "@/lib/api-client";

type MySubscription = {
  id: string;
  status: string;
  createdAt: string;
  plan: { name: string; type: string; price: number };
  subject: { name: string } | null;
};

type Plan = { id: string; name: string; type: string; price: number };

type CurriculumStage = {
  id: string;
  name: string;
  grades: { id: string; name: string; subjects: { id: string; name: string }[] }[];
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function StudentSubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stages, setStages] = useState<CurriculumStage[]>([]);
  const [planId, setPlanId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [subsData, curriculum] = await Promise.all([
        apiFetch<{ subscriptions: MySubscription[]; plans: Plan[] }>("/api/student/subscriptions"),
        apiFetch<{ stages: CurriculumStage[] }>("/api/academic/curriculum"),
      ]);
      setSubscriptions(subsData.subscriptions);
      setPlans(subsData.plans);
      setStages(curriculum.stages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "فشل تحميل البيانات";
      if (msg.includes("تسجيل الدخول")) router.push("/login");
      setError(msg);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRequestSubscription(e: React.FormEvent) {
    e.preventDefault();
    setSubMessage(null);
    setError(null);
    try {
      await apiFetch("/api/student/subscriptions/request", {
        method: "POST",
        body: JSON.stringify({ planId, subjectId: subjectId || undefined }),
      });
      setPlanId("");
      setSubjectId("");
      setSubMessage("تم إرسال الطلب — بانتظار موافقة إدارة مدار");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إرسال الطلب");
    }
  }

  const gradeSubjects = stages.flatMap((s) => s.grades).flatMap((g) => g.subjects);
  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <DashboardShell title="اشتراكاتي" nav={studentNav}>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>اشتراكاتي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                <div>
                  <p className="text-sm font-medium">
                    {s.plan.name}
                    {s.subject ? ` — ${s.subject.name}` : " — جميع المواد"}
                  </p>
                  <p className="text-xs text-gray-500">{s.plan.price} ريال / سنة</p>
                </div>
                <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                  {s.status === "ACTIVE" ? "نشط" : s.status === "PENDING" ? "بانتظار الموافقة" : s.status}
                </Badge>
              </div>
            ))}
            {subscriptions.length === 0 && (
              <p className="text-sm text-gray-500">لا توجد اشتراكات — اطلب اشتراكاً لفتح المحتوى</p>
            )}
          </div>

          <form onSubmit={onRequestSubscription} className="grid gap-3 sm:grid-cols-3">
            <select className={selectClass} required value={planId}
              onChange={(e) => setPlanId(e.target.value)}>
              <option value="">اختر الخطة</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.price} ريال)
                </option>
              ))}
            </select>
            {selectedPlan?.type === "SINGLE_SUBJECT" && (
              <select className={selectClass} required value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">اختر المادة</option>
                {gradeSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <Button type="submit" disabled={!planId}>
              طلب اشتراك
            </Button>
          </form>
          {subMessage && <p className="text-sm text-green-700">{subMessage}</p>}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
