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
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="grid place-items-center size-8 rounded-lg bg-gradient-to-br from-neon-400 to-punch-500 text-ink-950 font-black text-lg">
            A
          </span>
          <span className="font-black tracking-tight text-lg hidden sm:block">아케이드</span>
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
