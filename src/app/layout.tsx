import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SetupGuide } from "@/components/setup-guide";
import { SocialLinks } from "@/components/social-links";
import { isSupabaseConfigured } from "@/lib/env";
import { siteUrl } from "@/lib/sandbox";
import { FOOTER_LINKS } from "@/lib/site";

const TITLE = "바이버후드 — AI로 만든 3D 게임 체험관";
const DESCRIPTION =
  "바이브코딩으로 노는 이웃들. 쇼츠에서 소개한 AI 제작 3D 게임을 설치 없이 브라우저에서 바로 해볼 수 있는 체험관입니다.";

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
            <div className="space-y-3">
              <p>© {new Date().getFullYear()} 바이버후드. 바이브코딩으로 노는 이웃들.</p>
              {/* 메뉴가 아니라 안내 링크입니다 — 정책 페이지는 어느 화면에서든 닿아야 합니다. */}
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {FOOTER_LINKS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:text-ink-100 transition-colors">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <SocialLinks />
          </div>
        </footer>
      </body>
    </html>
  );
}
