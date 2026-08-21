import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Comments } from "@/components/comments";
import { GameFrame } from "@/components/game-frame";
import { Leaderboard } from "@/components/leaderboard";
import { LikeButton } from "@/components/like-button";
import { Badge, SectionHeader } from "@/components/ui";
import { formatCompact, formatDate } from "@/lib/format";
import {
  getComments,
  getGameBySlug,
  getGameLeaderboard,
  getViewer,
  hasLiked,
  listTournaments,
} from "@/lib/queries";
import { siteUrl, wrapUserGame } from "@/lib/sandbox";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "게임을 찾을 수 없음" };
  return {
    title: game.title,
    description: game.tagline ?? game.description ?? undefined,
  };
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const viewer = await getViewer();
  const isStaff = viewer?.role === "owner" || viewer?.role === "moderator";
  const isAuthor = viewer?.id === game.author_id;

  if (game.status !== "published" && !isStaff && !isAuthor) notFound();

  const [leaderboard, comments, liked, allTournaments] = await Promise.all([
    getGameLeaderboard(game.id, 20),
    getComments(game.id),
    hasLiked(game.id, viewer?.id),
    listTournaments("live"),
  ]);

  const liveTournament = allTournaments.find((t) => t.game_id === game.id) ?? null;
  const srcDoc = game.source === "html" && game.html ? wrapUserGame(game.html, siteUrl()) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      {game.status !== "published" && (
        <div className="mb-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          이 게임은 아직 공개되지 않았습니다 (상태: {game.status}). 작성자와 운영자에게만 보입니다.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* 왼쪽: 플레이 + 설명 + 댓글 */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {game.kind === "official" ? (
              <Badge tone="neon">공식</Badge>
            ) : (
              <Badge tone="lime">구독자 제작</Badge>
            )}
            {game.tags.map((tag) => (
              <Badge key={tag}>#{tag}</Badge>
            ))}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{game.title}</h1>
          {game.tagline && <p className="text-ink-300 mt-2">{game.tagline}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-400 mt-3">
            {game.author && (
              <Link href={`/u/${game.author.handle}`} className="hover:text-neon-400">
                @{game.author.handle}
              </Link>
            )}
            <span>▶ {formatCompact(game.play_count)}회 플레이</span>
            {game.published_at && <span>{formatDate(game.published_at)}</span>}
          </div>

          {liveTournament && (
            <Link
              href={`/tournaments/${liveTournament.slug}`}
              className="mt-5 flex items-center gap-3 rounded-xl border border-punch-500/40 bg-punch-500/10 px-4 py-3 text-sm hover:bg-punch-500/15 transition-colors"
            >
              <span className="live-dot size-2 rounded-full bg-punch-400 shrink-0" />
              <span className="font-semibold text-punch-400">{liveTournament.title}</span>
              <span className="text-ink-300">진행 중 — 대회 페이지에서 도전하면 랭킹에 반영됩니다</span>
              <span className="ml-auto text-punch-400">→</span>
            </Link>
          )}

          <div className="mt-5">
            <GameFrame
              gameId={game.id}
              title={game.title}
              scoreUnit={game.score_unit}
              entryUrl={game.entry_url}
              srcDoc={srcDoc}
              viewer={viewer ? { id: viewer.id, display_name: viewer.display_name } : null}
            />
          </div>

          <div className="mt-5">
            <LikeButton
              gameId={game.id}
              slug={game.slug}
              initialLiked={liked}
              initialCount={game.like_count}
              canLike={Boolean(viewer)}
            />
          </div>

          {game.description && (
            <section className="mt-10">
              <h2 className="font-black text-lg mb-3">게임 설명</h2>
              <p className="text-ink-300 leading-relaxed whitespace-pre-wrap">{game.description}</p>
            </section>
          )}

          <section className="mt-12">
            <SectionHeader
              title={`댓글 ${game.comment_count > 0 ? game.comment_count : ""}`}
              description="플레이해보고 느낀 점, 버그, 개선 아이디어를 남겨주세요."
            />
            <Comments
              gameId={game.id}
              slug={game.slug}
              comments={comments}
              viewer={viewer ? { id: viewer.id, isStaff } : null}
            />
          </section>
        </div>

        {/* 오른쪽: 랭킹 */}
        <aside className="panel p-5 lg:sticky lg:top-20">
          <h2 className="font-black text-lg mb-1">전체 랭킹</h2>
          <p className="text-xs text-ink-400 mb-4">
            {game.scoring === "high" ? "점수가 높을수록" : "기록이 낮을수록"} 상위
          </p>
          <Leaderboard
            rows={leaderboard}
            scoreUnit={game.score_unit}
            viewerId={viewer?.id ?? null}
          />
        </aside>
      </div>
    </div>
  );
}
