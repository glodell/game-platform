import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SetupGuide } from "@/components/setup-guide";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "아케이드 — AI로 만든 게임, 구독자와 대결",
    template: "%s · 아케이드",
  },
  description:
    "쇼츠에서 AI로 만든 게임을 모아놓은 플랫폼. 제한 시간 대회에서 랭킹을 다투고, 해커톤에 직접 만든 게임을 올리고, 서로의 게임에 좋아요와 피드백을 남겨보세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();

  return (
    // suppressHydrationWarning: 광고 차단기 등 브라우저 확장이 <html>/<body> 에
    // 속성을 주입하면 서버 HTML 과 달라져 hydration 경고가 납니다. 앱 문제가 아니므로 무시합니다.
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col" suppressHydrationWarning>
        {configured && <SiteHeader />}
        <main className="flex-1">{configured ? children : <SetupGuide />}</main>
        <footer className="border-t border-ink-800 mt-24">
          <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-400 flex flex-wrap gap-x-8 gap-y-3 justify-between">
            <p>© {new Date().getFullYear()} 아케이드. AI로 만들고, 같이 노는 곳.</p>
            <nav className="flex gap-5">
              <Link href="/games" className="hover:text-ink-100">게임</Link>
              <Link href="/tournaments" className="hover:text-ink-100">대회</Link>
              <Link href="/hackathons" className="hover:text-ink-100">해커톤</Link>
              <Link href="/docs/sdk" className="hover:text-ink-100">개발 가이드</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
