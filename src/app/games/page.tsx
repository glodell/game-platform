import Link from "next/link";
import type { Metadata } from "next";
import { GameCard } from "@/components/game-card";
import { EmptyState } from "@/components/ui";
import { listGames } from "@/lib/queries";

export const metadata: Metadata = { title: "게임" };

const KINDS = [
  { value: "", label: "전체" },
  { value: "official", label: "공식" },
  { value: "community", label: "구독자 제작" },
] as const;

const SORTS = [
  { value: "recent", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "liked", label: "좋아요순" },
] as const;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind === "official" || params.kind === "community" ? params.kind : undefined;
  const sort =
    params.sort === "popular" || params.sort === "liked" || params.sort === "recent"
      ? params.sort
      : "recent";

  const games = await listGames({ kind, sort, limit: 60 });

  function href(next: { kind?: string; sort?: string }) {
    const sp = new URLSearchParams();
    const k = next.kind !== undefined ? next.kind : (kind ?? "");
    const s = next.sort !== undefined ? next.sort : sort;
    if (k) sp.set("kind", k);
    if (s && s !== "recent") sp.set("sort", s);
    const qs = sp.toString();
    return qs ? `/games?${qs}` : "/games";
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">게임</h1>
      <p className="text-ink-400 mt-2">
        내가 만든 게임과 구독자가 만든 게임이 한곳에. 아무거나 골라 바로 플레이하세요.
      </p>

      <div className="flex flex-wrap gap-6 mt-8 mb-7">
        <FilterGroup label="분류">
          {KINDS.map((k) => (
            <Chip key={k.value} href={href({ kind: k.value })} active={(kind ?? "") === k.value}>
              {k.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="정렬">
          {SORTS.map((s) => (
            <Chip key={s.value} href={href({ sort: s.value })} active={sort === s.value}>
              {s.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {games.length === 0 ? (
        <EmptyState
          title="해당하는 게임이 없습니다"
          description="다른 필터를 골라보거나, 직접 만든 게임을 올려보세요."
          action={{ href: "/submit", label: "내 게임 올리기" }}
        />
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-600 font-semibold">{label}</span>
      <div className="flex gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-ink-100 text-ink-950"
          : "border border-ink-700 text-ink-400 hover:text-ink-100 hover:border-ink-600"
      }`}
    >
      {children}
    </Link>
  );
}
