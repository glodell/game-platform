import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Countdown } from "@/components/countdown";
import { GameCard } from "@/components/game-card";
import { EmptyState, PhaseBadge, RankMedal, SectionHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getHackathonBySlug, listGames } from "@/lib/queries";
import { phaseOf, type Prize } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hackathon = await getHackathonBySlug(slug);
  return { title: hackathon?.title ?? "해커톤을 찾을 수 없음" };
}

export default async function HackathonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hackathon = await getHackathonBySlug(slug);
  if (!hackathon) notFound();

  const entries = await listGames({ hackathonId: hackathon.id, sort: "liked", limit: 100 });
  const phase = phaseOf(hackathon.starts_at, hackathon.submit_ends_at);
  const prizes = (hackathon.prizes as Prize[]) ?? [];
  const voteEnd = hackathon.vote_ends_at ?? hackathon.submit_ends_at;
  const votingOver = Date.now() > new Date(voteEnd).getTime();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <PhaseBadge phase={phase} />
          <span className="text-xs text-ink-400">
            {formatDateTime(hackathon.starts_at)} — {formatDateTime(hackathon.submit_ends_at)}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">{hackathon.title}</h1>
        {hackathon.theme && <p className="text-lg text-lime-glow mt-2">주제 · {hackathon.theme}</p>}
        {hackathon.description && (
          <p className="text-ink-300 mt-4 max-w-2xl leading-relaxed whitespace-pre-wrap">
            {hackathon.description}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-x-10 gap-y-6 mt-7">
          {phase !== "ended" && <Countdown target={hackathon.submit_ends_at} label="제출 마감까지" />}
          {phase === "live" && (
            <Link
              href={`/submit?hackathon=${hackathon.slug}`}
              className="rounded-xl bg-lime-glow text-ink-950 px-6 py-3 font-bold hover:brightness-110 transition-all"
            >
              내 게임 제출하기
            </Link>
          )}
        </div>

        {prizes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3 mt-7 pt-6 border-t border-ink-800">
            {prizes.map((p) => (
              <div key={p.rank} className="flex items-center gap-3">
                <RankMedal rank={p.rank} />
                <div className="min-w-0">
                  <p className="font-bold truncate">{p.reward}</p>
                  {p.note && <p className="text-xs text-ink-400">{p.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {hackathon.rules && (
        <section className="mt-10 panel p-6">
          <h2 className="font-black text-lg mb-3">참가 규칙</h2>
          <p className="text-sm text-ink-300 leading-relaxed whitespace-pre-wrap">
            {hackathon.rules}
          </p>
        </section>
      )}

      <section className="mt-12">
        <SectionHeader
          title={`출품작 ${entries.length > 0 ? entries.length : ""}`}
          description={
            votingOver
              ? "투표가 마감되었습니다. 좋아요가 많은 순서입니다."
              : "좋아요 순으로 정렬됩니다. 직접 해보고 마음에 드는 작품에 ♥ 를 남겨주세요."
          }
        />
        {entries.length === 0 ? (
          <EmptyState
            title="아직 출품작이 없습니다"
            description={
              phase === "live"
                ? "가장 먼저 제출해 보세요. HTML 파일 하나면 충분합니다."
                : "이번 해커톤에는 제출된 작품이 없었습니다."
            }
            action={phase === "live" ? { href: `/submit?hackathon=${hackathon.slug}`, label: "제출하러 가기" } : undefined}
          />
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {entries.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
