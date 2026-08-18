import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Countdown } from "@/components/countdown";
import { GameFrame } from "@/components/game-frame";
import { Leaderboard, Podium } from "@/components/leaderboard";
import { PhaseBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import {
  getAttemptCount,
  getTournamentBySlug,
  getTournamentLeaderboard,
  getViewer,
} from "@/lib/queries";
import { siteUrl, wrapUserGame } from "@/lib/sandbox";
import { phaseOf, type Prize } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  return { title: tournament?.title ?? "대회를 찾을 수 없음" };
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament || !tournament.game) notFound();

  // 게임 정보는 위 조회에 함께 딸려옵니다 (추가 왕복 없음).
  const game = tournament.game;

  const [viewer, rows] = await Promise.all([
    getViewer(),
    getTournamentLeaderboard(tournament.id, 100),
  ]);

  const phase = phaseOf(tournament.starts_at, tournament.ends_at);
  const prizes = (tournament.prizes as Prize[]) ?? [];

  const attemptsUsed =
    viewer && tournament.max_attempts ? await getAttemptCount(tournament.id, viewer.id) : 0;
  const attemptsLeft = tournament.max_attempts
    ? Math.max(0, tournament.max_attempts - attemptsUsed)
    : null;

  const myRow = viewer ? rows.find((r) => r.user_id === viewer.id) : undefined;
  const srcDoc = game.source === "html" && game.html ? wrapUserGame(game.html, siteUrl()) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      {/* 헤더 */}
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <PhaseBadge phase={phase} />
          <Link
            href={`/games/${game.slug}`}
            className="text-sm text-ink-400 hover:text-neon-400 transition-colors"
          >
            🕹️ {game.title}
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">{tournament.title}</h1>
        {tournament.description && (
          <p className="text-ink-300 mt-3 max-w-2xl leading-relaxed whitespace-pre-wrap">
            {tournament.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-10 gap-y-6 mt-7">
          {phase !== "ended" && (
            <Countdown
              target={phase === "upcoming" ? tournament.starts_at : tournament.ends_at}
              label={phase === "upcoming" ? "시작까지" : "마감까지"}
            />
          )}
          <div className="text-sm text-ink-400 space-y-1">
            <p>
              <span className="text-ink-600">기간</span> {formatDateTime(tournament.starts_at)} —{" "}
              {formatDateTime(tournament.ends_at)}
            </p>
            <p>
              <span className="text-ink-600">도전 횟수</span>{" "}
              {tournament.max_attempts ? `1인 ${tournament.max_attempts}회` : "무제한"}
            </p>
            <p>
              <span className="text-ink-600">순위 기준</span>{" "}
              {game.scoring === "high" ? "최고 점수" : "최단 기록"} (개인 최고 1건만 반영)
            </p>
          </div>
        </div>

        {prizes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3 mt-7 pt-6 border-t border-ink-800">
            {prizes.map((p) => (
              <div key={p.rank} className="rounded-xl border border-ink-700 bg-ink-900/50 p-4">
                <p className="text-xs font-black text-gold">{p.rank}등</p>
                <p className="font-bold mt-1">{p.reward}</p>
                {p.note && <p className="text-xs text-ink-400 mt-1">{p.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start mt-8">
        {/* 플레이 영역 */}
        <div className="min-w-0">
          {phase === "live" ? (
            <>
              <h2 className="font-black text-lg mb-3">지금 도전하기</h2>
              <GameFrame
                gameId={game.id}
                title={game.title}
                scoreUnit={game.score_unit}
                entryUrl={game.entry_url}
                srcDoc={srcDoc}
                viewer={viewer ? { id: viewer.id, display_name: viewer.display_name } : null}
                tournament={{
                  id: tournament.id,
                  title: tournament.title,
                  endsAt: tournament.ends_at,
                }}
                attemptsLeft={attemptsLeft}
              />
            </>
          ) : (
            <div className="panel p-8 text-center">
              <p className="font-bold">
                {phase === "upcoming"
                  ? "아직 시작하지 않았습니다"
                  : "대회가 종료되었습니다"}
              </p>
              <p className="text-sm text-ink-400 mt-2">
                {phase === "upcoming"
                  ? "시작 전까지는 연습 삼아 자유롭게 플레이해 보세요. 이 기록은 대회 랭킹에 들어가지 않습니다."
                  : "아래 최종 순위를 확인하세요. 게임 자체는 언제든 다시 플레이할 수 있습니다."}
              </p>
              <Link
                href={`/games/${game.slug}`}
                className="inline-block mt-5 rounded-lg bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-semibold hover:bg-white transition-colors"
              >
                게임 페이지로 가기
              </Link>
            </div>
          )}

          <section className="mt-10">
            <h2 className="font-black text-lg mb-5">
              {phase === "ended" ? "최종 시상대" : "현재 상위권"}
            </h2>
            <div className="panel p-6">
              <Podium rows={rows} scoreUnit={game.score_unit} prizes={prizes} />
            </div>
          </section>
        </div>

        {/* 랭킹 */}
        <aside className="panel p-5 lg:sticky lg:top-20">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-black text-lg">
              {phase === "ended" ? "최종 순위" : "실시간 순위"}
            </h2>
            <span className="text-xs text-ink-400">{rows.length}명 참가</span>
          </div>

          {myRow && (
            <div className="mb-4 rounded-xl border border-neon-400/30 bg-neon-400/8 px-4 py-3">
              <p className="text-xs text-ink-400">내 순위</p>
              <p className="text-2xl font-black text-neon-400 tabular-nums">{myRow.rank}위</p>
              {attemptsLeft !== null && (
                <p className="text-xs text-ink-400 mt-1">남은 도전 {attemptsLeft}회</p>
              )}
            </div>
          )}

          <Leaderboard
            rows={rows}
            scoreUnit={game.score_unit}
            viewerId={viewer?.id ?? null}
            emptyText="아직 참가자가 없습니다. 1등 자리가 비어 있어요."
          />
        </aside>
      </div>
    </div>
  );
}
