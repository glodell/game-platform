import Link from "next/link";
import { getViewer } from "@/lib/queries";
import { AccountMenu } from "./account-menu";
import { NavProgress } from "./nav-progress";

const NAV = [
  { href: "/games", label: "게임" },
  { href: "/tournaments", label: "대회" },
  { href: "/hackathons", label: "해커톤" },
  { href: "/docs/sdk", label: "만들기" },
];

export async function SiteHeader() {
  // getViewer 는 cache() 로 감싸져 있어 페이지 쪽에서 또 불러도 조회는 1회입니다.
  const profile = await getViewer();

  return (
    <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/80 backdrop-blur-md">
      <NavProgress />
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center gap-6">
        <Link href="/" aria-label="바이버후드 홈" className="flex items-center shrink-0">
          {/* 좁은 화면에서는 게임기 마크만, sm 부터 워드마크까지 나오는 가로 로고 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/viberhood-mark-compact.svg"
            alt=""
            aria-hidden
            className="h-8 w-auto sm:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/viberhood-logo.svg"
            alt=""
            aria-hidden
            className="hidden sm:block h-9 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-1 text-sm overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg text-ink-300 hover:text-ink-100 hover:bg-ink-800 transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto">
          <AccountMenu
            profile={profile}
            isStaff={profile?.role === "owner" || profile?.role === "moderator"}
          />
        </div>
      </div>
    </header>
  );
}
