"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

// Shared dashboard header — title + logout so users can switch accounts.
export function AppHeader({ title }: { title: string }) {
  const router = useRouter();

  async function onLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Session is cleared server-side; still send the user to login.
    }
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <h1 className="text-xl font-bold">{title}</h1>
      <Button variant="outline" size="sm" onClick={onLogout}>
        تسجيل الخروج
      </Button>
    </header>
  );
}
