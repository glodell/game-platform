import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SetupGuide } from "@/components/setup-guide";
import { SocialLinks } from "@/components/social-links";
import { isSupabaseConfigured } from "@/lib/env";
import { siteUrl } from "@/lib/sandbox";

const TITLE = "바이버후드 — AI로 만든 게임, 구독자와 대결";
const DESCRIPTION =
  "바이브코딩으로 노는 이웃들. 쇼츠에서 AI로 만든 게임을 모아놓고, 제한 시간 대회에서 랭킹을 다투고, 해커톤에 직접 만든 게임을 올리는 플랫폼입니다.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "바이버후드",
  title: {
    default: TITLE,
    template: "%s · 바이버후드",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "바이버후드",
    locale: "ko_KR",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/brand/viberhood-og.png", width: 1200, height: 630, alt: "바이버후드" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/brand/viberhood-og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#07080F",
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
          <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-400 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} 바이버후드. 바이브코딩으로 노는 이웃들.</p>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <nav className="flex flex-wrap gap-x-5 gap-y-2">
                <Link href="/games" className="hover:text-ink-100">게임</Link>
                <Link href="/tournaments" className="hover:text-ink-100">대회</Link>
                <Link href="/hackathons" className="hover:text-ink-100">해커톤</Link>
                <Link href="/docs/sdk" className="hover:text-ink-100">개발 가이드</Link>
              </nav>
              <SocialLinks />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
