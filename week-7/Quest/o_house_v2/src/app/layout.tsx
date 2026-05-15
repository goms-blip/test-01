import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "오늘의집 v2 — 인테리어 영감",
  description: "오늘의집 클론 v2 (Next.js + Supabase + Toss)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-white text-zinc-900 antialiased">
        <Header />
        <main className="max-w-7xl mx-auto px-4">{children}</main>
        <footer className="border-t border-zinc-200 mt-16 py-8 text-center text-xs text-zinc-500">
          © 2026 오늘의집 클론 v2 · Next.js + Supabase + Toss
        </footer>
      </body>
    </html>
  );
}
