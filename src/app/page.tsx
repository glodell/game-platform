import Link from "next/link";
import { Countdown } from "@/components/countdown";
import { GameCard } from "@/components/game-card";
import { TournamentCard } from "@/components/tournament-card";
import { EmptyState, PhaseBadge, SectionHeader } from "@/components/ui";
import { listGames, listHackathons, listTournaments } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { phaseOf, type Prize } from "@/lib/types";

export default async function HomePage() {
  const [liveTournaments, upcoming, popular, community, hackathons] = await Promise.all([
    listTournaments("live"),
    listTournaments("upcoming"),
    listGames({ sort: "popular", limit: 8 }),
    listGames({ kind: "community", sort: "recent", limit: 4 }),
    listHackathons(),
  ]);

  const featuredTournaments = [...liveTournaments, ...upcoming].slice(0, 2);
  const openHackathon = hackathons.find(
    (h) => new Date(h.submit_ends_at).getTime() > Date.now(),
  );

  return (
    <div className="mx-auto max-w-6xl px-5">
      <Hero hasLive={liveTournaments.length > 0} />

      {featuredTournaments.length > 0 && (
        <section className="mt-16">
          <SectionHeader
            title="지금 열려 있는 대회"
            description="제한 시간 안에 최고 기록을 남기면 1·2·3등에게 상품이 갑니다."
            action={{ href: "/tournaments", label: "전체 대회" }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {featuredTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-16">
        <SectionHeader
          title="인기 게임"
          description="가장 많이 플레이된 순서"
          action={{ href: "/games", label: "전체 게임" }}
        />
        {popular.length === 0 ? (
          <EmptyState
            title="아직 등록된 게임이 없습니다"
            description="운영자 콘솔에서 첫 번째 게임을 등록해 보세요."
            action={{ href: "/admin", label: "운영자 콘솔 열기" }}
          />
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {popular.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

      {openHackathon && (
        <section className="mt-16">
          <Link
            href={`/hackathons/${openHackathon.slug}`}
            className="panel glow-ring block p-6 sm:p-8 hover:border-neon-400/60 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-xs font-bold text-lime-glow tracking-widest">해커톤 접수 중</span>
              <PhaseBadge phase={phaseOf(openHackathon.starts_at, openHackathon.submit_ends_at)} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{openHackathon.title}</h2>
            {openHackathon.theme && (
              <p className="text-ink-300 mt-2">주제 · {openHackathon.theme}</p>
            )}
            <div className="mt-6 flex flex-wrap items-end gap-8">
              <Countdown target={openHackathon.submit_ends_at} label="제출 마감까지" />
              <div className="text-sm text-ink-400">
                <p>마감 {formatDateTime(openHackathon.submit_ends_at)}</p>
                <p className="mt-1">
                  {(openHackathon.prizes as Prize[])?.map((p) => `${p.rank}등 ${p.reward}`).join(" · ") ||
                    "상품은 곧 공개됩니다"}
                </p>
              </div>
            </div>
          </Link>
        </section>
      )}

      {community.length > 0 && (
        <section className="mt-16">
          <SectionHeader
            title="구독자가 만든 게임"
            description="직접 짠 코드를 올리고, 서로의 게임에 피드백을 남겨보세요."
            action={{ href: "/games?kind=community", label: "더 보기" }}
          />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {community.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Hero({ hasLive }: { hasLive: boolean }) {
  return (
    <section className="pt-16 sm:pt-24 pb-4">
      <div>
        {hasLive && (
          <div className="inline-flex items-center gap-2 rounded-full border border-punch-500/40 bg-punch-500/10 px-3 py-1 text-xs font-bold text-punch-400 mb-6">
            <span className="live-dot size-1.5 rounded-full bg-punch-400" />
            지금 대회가 열려 있습니다
          </div>
        )}
        {/* 좁은 화면에서는 두 줄, lg 부터는 한 줄로 이어 붙입니다. */}
        <h1 className="text-4xl sm:text-6xl lg:text-[3.5rem] xl:text-6xl font-black tracking-tighter leading-[1.05]">
          <span className="block lg:inline">AI로 만든 게임,</span>{" "}
          <span className="block lg:inline bg-gradient-to-r from-neon-400 to-punch-400 bg-clip-text text-transparent">
            구독자와 정면 대결.
          </span>
        </h1>
        <p className="text-ink-300 mt-6 text-lg leading-relaxed max-w-3xl">
          쇼츠에서 만든 게임이 여기 다 모여 있습니다. 제한 시간 안에 최고 기록을 남기고,
          해커톤에 직접 만든 게임을 올리고, 서로의 작품에 좋아요와 피드백을 남기세요.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link
            href="/games"
            className="rounded-xl bg-ink-100 text-ink-950 px-6 py-3 font-bold hover:bg-white transition-colors"
          >
            게임하러 가기
          </Link>
          <Link
            href="/tournaments"
            className="rounded-xl border border-ink-700 px-6 py-3 font-bold text-ink-200 hover:border-neon-400/60 hover:text-neon-400 transition-colors"
          >
            대회 보기
          </Link>
          <Link
            href="/submit"
            className="rounded-xl border border-ink-700 px-6 py-3 font-bold text-ink-200 hover:border-lime-glow/60 hover:text-lime-glow transition-colors"
          >
            내 게임 올리기
          </Link>
        </div>
      </div>
    </section>
  );
}
