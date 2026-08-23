import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "مدار التعليمية",
  description: "منصة مدار التعليمية — تعليم متكامل للمدارس والطلاب",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-[family-name:var(--font-cairo)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
