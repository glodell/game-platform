import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Avatar } from "@/components/account-menu";
import { GameCard } from "@/components/game-card";
import { Badge, RankMedal, SectionHeader } from "@/components/ui";
import { formatDate, formatRelative, formatScore } from "@/lib/format";
import { getProfileByHandle, listGamesByAuthor } from "@/lib/queries";
import { FEATURES } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  return { title: profile?.display_name ?? "프로필을 찾을 수 없음" };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const supabase = await createClient();
  const [games, { data: bests }] = await Promise.all([
    listGamesByAuthor(profile.id),
    supabase
      .from("game_leaderboard")
      .select("game_id, score, rank, created_at")
      .eq("user_id", profile.id)
      .order("rank")
      .limit(10),
  ]);

  // 기록이 있는 게임 이름을 한 번에 가져옵니다.
  const gameIds = (bests ?? []).map((b) => b.game_id);
  const { data: recordGames } = gameIds.length
    ? await supabase.from("games").select("id, title, slug, score_unit, kind").in("id", gameIds)
    : { data: [] as { id: string; title: string; slug: string; score_unit: string | null; kind: string }[] };

  // 지금 공개하지 않는 구독자 제작 게임의 기록은 줄째 빠집니다 (아래에서 game 이 없으면 건너뜀).
  const gameById = new Map(
    (recordGames ?? [])
      .filter((g) => FEATURES.community || g.kind === "official")
      .map((g) => [g.id, g]),
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center gap-5">
        <Avatar url={profile.avatar_url} name={profile.display_name} size={72} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight truncate">
              {profile.display_name}
            </h1>
            {profile.role === "owner" && <Badge tone="neon">운영자</Badge>}
            {profile.role === "moderator" && <Badge tone="neon">모더레이터</Badge>}
          </div>
          <p className="text-ink-400 text-sm mt-1">@{profile.handle}</p>
          <p className="text-ink-600 text-xs mt-1">{formatDate(profile.created_at)} 가입</p>
        </div>
      </div>

      {profile.bio && <p className="text-ink-300 mt-6 leading-relaxed">{profile.bio}</p>}

      <section className="mt-12">
        <SectionHeader title="최고 기록" description="게임별 개인 최고 순위" />
        {!bests || bests.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-sm text-ink-400">
            아직 남긴 기록이 없습니다.
          </p>
        ) : (
          <ul className="panel divide-y divide-ink-800">
            {bests.map((b) => {
              const game = gameById.get(b.game_id);
              if (!game) return null;
              return (
                <li key={b.game_id} className="flex items-center gap-3 px-4 py-3">
                  <RankMedal rank={b.rank} />
                  <a
                    href={`/games/${game.slug}`}
                    className="font-semibold text-sm hover:text-neon-400 transition-colors truncate"
                  >
                    {game.title}
                  </a>
                  <span className="ml-auto tabular-nums text-sm font-black shrink-0">
                    {formatScore(b.score, game.score_unit)}
                  </span>
                  <span className="text-xs text-ink-600 shrink-0 hidden sm:block">
                    {formatRelative(b.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {games.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="만든 게임" description={`${games.length}개 공개 중`} />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
