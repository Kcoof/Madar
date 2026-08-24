"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shared/app-header";
import { cn } from "@/lib/utils";

// Unified dashboard layout (Phase F): header + role sidebar; every nav item
// must point at a real screen — no "coming soon" placeholders in the MVP.
export function DashboardShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const link = (item: { href: string; label: string }, mobile = false) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "whitespace-nowrap rounded-md px-3 py-2 text-sm",
        mobile && "border",
        pathname === item.href
          ? mobile
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-primary text-primary-foreground"
          : "hover:bg-gray-100"
      )}
    >
      {item.label}
    </Link>
  );

  return (
    <main className="min-h-screen">
      <AppHeader title={title} />
      {/* mobile navigation chips */}
      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-white p-2 md:hidden">
        {nav.map((item) => link(item, true))}
      </nav>
      <div className="mx-auto flex max-w-6xl gap-6 p-4 md:p-6">
        <nav className="hidden w-44 shrink-0 md:block">
          <div className="sticky top-4 space-y-1 rounded-lg border bg-white p-2">
            {nav.map((item) => link(item))}
          </div>
        </nav>
        <div className="min-w-0 flex-1 space-y-6">{children}</div>
      </div>
    </main>
  );
}
