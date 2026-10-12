import Link from "next/link";
import type { Metadata } from "next";
import { GameCard } from "@/components/game-card";
import { EmptyState } from "@/components/ui";
import { listGames, listLiveEventGameIds } from "@/lib/queries";
import { FEATURES } from "@/lib/site";

export const metadata: Metadata = { title: "게임" };

const KINDS = [
  { value: "", label: "전체" },
  { value: "official", label: "공식" },
  { value: "community", label: "구독자 제작" },
] as const;

// "이벤트" 는 정렬이 아니라 랭킹 이벤트가 열린 게임만 추려 보는 것이지만, 고르는 쪽에서는
// 최신순 · 인기순과 나란히 놓인 단추 하나면 충분합니다.
const SORTS = [
  { value: "recent", label: "최신순" },
  { value: "popular", label: "인기순" },
  { value: "event", label: "이벤트" },
] as const;

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; sort?: string; event?: string }>;
}) {
  const params = await searchParams;
  // 구독자 제작 게임을 받지 않는 동안에는 분류가 하나뿐이라 필터를 받지 않습니다.
  const kind =
    FEATURES.community && (params.kind === "official" || params.kind === "community")
      ? params.kind
      : undefined;
  // 예전 주소도 받습니다 — 좋아요순(?sort=liked)은 인기순에 합쳤고, ?event=1 은 이벤트 보기였습니다.
  const sort =
    params.sort === "event" || params.event === "1"
      ? "event"
      : params.sort === "popular" || params.sort === "liked"
        ? "popular"
        : "recent";

  // 이벤트 중인 게임 목록은 카드 표시에도 쓰여서 항상 읽습니다.
  const eventGamesPromise = listLiveEventGameIds();
  const [games, eventGames] = await Promise.all([
    sort === "event"
      ? eventGamesPromise.then((ids) => listGames({ kind, limit: 60, ids: [...ids] }))
      : listGames({ kind, sort, limit: 60 }),
    eventGamesPromise,
  ]);

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
        {FEATURES.community
          ? "내가 만든 게임과 구독자가 만든 게임이 한곳에. 아무거나 골라 바로 플레이하세요."
          : "쇼츠에서 소개한 게임을 모아뒀습니다. 아무거나 골라 바로 플레이하세요."}
      </p>

      <div className="flex flex-wrap gap-6 mt-8 mb-7">
        {FEATURES.community && (
          <FilterGroup label="분류">
            {KINDS.map((k) => (
              <Chip key={k.value} href={href({ kind: k.value })} active={(kind ?? "") === k.value}>
                {k.label}
              </Chip>
            ))}
          </FilterGroup>
        )}
        <FilterGroup label="정렬">
          {SORTS.map((s) => (
            <Chip key={s.value} href={href({ sort: s.value })} active={sort === s.value}>
              {s.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {games.length === 0 && sort === "event" ? (
        <EmptyState
          title="지금 진행 중인 랭킹 이벤트가 없습니다"
          description="이벤트가 열리면 이곳과 게임 카드에 표시됩니다."
          action={{ href: href({ sort: "recent" }), label: "전체 게임 보기" }}
        />
      ) : games.length === 0 ? (
        FEATURES.community ? (
          <EmptyState
            title="해당하는 게임이 없습니다"
            description="다른 필터를 골라보거나, 직접 만든 게임을 올려보세요."
            action={{ href: "/submit", label: "내 게임 올리기" }}
          />
        ) : (
          <EmptyState
            title="아직 등록된 게임이 없습니다"
            description="새 게임은 쇼츠에서 먼저 소개한 뒤 이곳에 올라옵니다."
          />
        )
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} eventLive={eventGames.has(game.id)} />
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
