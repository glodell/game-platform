import Link from "next/link";
import type { Metadata } from "next";
import {
  AdminForms,
  NotesManager,
  ReviewRow,
  ThumbnailManager,
  type AdminNote,
} from "@/components/admin-panels";
import { AdminTabs } from "@/components/admin-tabs";
import { EventManager } from "@/components/event-manager";
import { RunReview, type ReviewRun } from "@/components/run-review";
import { loadAdminEvents } from "@/lib/admin-events";
import { parseTrace } from "@/lib/run-trace";
import { formatDate, formatRelative } from "@/lib/format";
import { gameStore } from "@/lib/game-storage";
import { getViewer } from "@/lib/queries";
import { FEATURES } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";

export const metadata: Metadata = { title: "운영자 콘솔" };

export default async function AdminPage() {
  const viewer = await getViewer();
  const isStaff = viewer?.role === "owner" || viewer?.role === "moderator";

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="text-2xl font-black mb-3">운영자 전용 페이지입니다</h1>
        <p className="text-ink-400 text-sm leading-relaxed">
          {viewer
            ? "로그인은 되어 있지만 운영자 권한이 없습니다. Supabase SQL Editor 에서 아래를 실행하면 권한이 생깁니다."
            : "먼저 로그인해 주세요."}
        </p>
        {viewer && (
          <pre className="mt-5 text-left text-xs bg-ink-900 border border-ink-700 rounded-xl p-4 overflow-x-auto">
            {`update profiles set role = 'owner'\nwhere handle = '${viewer.handle}';`}
          </pre>
        )}
        <Link href="/" className="inline-block mt-6 text-sm text-neon-400 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [
    { data: pendingRows },
    { data: games },
    { data: runs },
    { data: noteRows, error: notesError },
    events,
  ] = await Promise.all([
    supabase
      .from("games")
      .select(
        "id, slug, title, tagline, status, created_at, hackathon_id, author:profiles!games_author_id_fkey(handle, display_name, avatar_url)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // 게임 관리 목록 — 반려 · 숨김 상태도 지울 수 있어야 해서 상태를 가리지 않고 전부 가져옵니다.
    supabase
      .from("games")
      .select("id, title, slug, thumbnail_url, status, entry_url, like_count, comment_count")
      .order("title"),
    // 검토 큐는 최근 것만 봅니다 — 오래된 기록까지 훑을 일은 거의 없습니다.
    supabase
      .from("runs")
      .select(
        "id, score, duration_ms, created_at, meta, flags, voided_at, voided_reason, " +
          "game:games!runs_game_id_fkey(title, slug, score_unit), " +
          "tournament:tournaments!runs_tournament_id_fkey(title), " +
          "player:profiles!runs_user_id_fkey(handle, display_name)",
      )
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("notes")
      .select(
        "id, slug, title, summary, body, cover_url, video_url, game_id, is_published, published_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    loadAdminEvents(supabase),
  ]);

  // notes 테이블은 supabase/notes.sql 을 실행해야 생깁니다 — 없으면 조회가 오류로 끝납니다.
  const notes: AdminNote[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    slug: n.slug,
    title: n.title,
    summary: n.summary,
    body: n.body,
    cover_url: n.cover_url,
    video_url: n.video_url,
    game_id: n.game_id,
    is_published: n.is_published,
    dateLabel: formatDate(n.published_at ?? n.created_at),
  }));

  const reviewRuns: ReviewRun[] = (runs ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      score: number;
      duration_ms: number | null;
      created_at: string;
      meta: { trace?: unknown } | null;
      flags: string[] | null;
      voided_at: string | null;
      voided_reason: string | null;
      game: { title: string; slug: string; score_unit: string | null } | null;
      tournament: { title: string } | null;
      player: { handle: string; display_name: string } | null;
    };
    return {
      id: r.id,
      score: r.score,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
      flags: r.flags ?? [],
      voidedAt: r.voided_at,
      voidedReason: r.voided_reason,
      trace: parseTrace(r.meta?.trace),
      gameTitle: r.game?.title ?? "삭제된 게임",
      gameSlug: r.game?.slug ?? "",
      scoreUnit: r.game?.score_unit ?? null,
      tournamentTitle: r.tournament?.title ?? null,
      playerHandle: r.player?.handle ?? "알 수 없음",
      playerName: r.player?.display_name ?? "알 수 없음",
    };
  });

  const pending = pendingRows ?? [];
  const hasPending = pending.length > 0;
  // 탭 이름 옆에 띄울 숫자 — 표시가 달렸고 아직 무효 처리하지 않은 기록
  const flaggedRuns = reviewRuns.filter((run) => run.flags.length > 0 && !run.voidedAt).length;

  const publishedGames = (games ?? []).filter((g) => g.status === "published");

  // public/g 에 넣었지만 아직 게임으로 등록하지 않은 폴더 (목록은 빌드할 때 next.config 가 읽습니다)
  const registered = new Set((games ?? []).map((g) => g.entry_url));
  const newFolders = (process.env.GAME_FOLDERS ?? "")
    .split(",")
    .filter((folder) => folder && !registered.has(`/g/${folder}/index.html`));

  const tasks = [
    "게임 등록",
    "랭킹 이벤트",
    "제작 노트 작성",
    ...(FEATURES.tournaments ? ["대회 개설"] : []),
    ...(FEATURES.hackathons ? ["해커톤 개설"] : []),
    ...(FEATURES.community ? ["제출작 심사"] : []),
    "기록 검토",
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-black tracking-tight">운영자 콘솔</h1>
      <p className="text-ink-400 mt-2">{tasks.join(", ")}를 여기서 합니다.</p>

      <AdminTabs
        tabs={[
          {
            key: "new",
            label: "새 게임",
            content: (
              <AdminForms
                games={publishedGames}
                allGames={games ?? []}
                newFolders={newFolders}
                store={gameStore()}
              />
            ),
          },
          {
            key: "manage",
            label: "게임 관리",
            badge: pending.length + flaggedRuns,
            content: (
              <>
                {/* 제출을 받지 않는 동안에도, 이미 들어와 있는 제출작은 처리할 수 있게 남겨둡니다. */}
                {(FEATURES.community || hasPending) && (
                  <section className="mt-10">
                    <h2 className="font-black text-lg mb-4">
                      검토 대기{" "}
                      {hasPending && <span className="text-gold tabular-nums">{pending.length}</span>}
                    </h2>
                    {!hasPending ? (
                      <p className="panel px-5 py-8 text-center text-sm text-ink-400">
                        대기 중인 제출작이 없습니다.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {pending.map((game) => (
                          <ReviewRow
                            key={game.id}
                            game={{
                              id: game.id,
                              slug: game.slug,
                              title: game.title,
                              tagline: game.tagline,
                              authorHandle:
                                (game as unknown as Game).author?.handle ?? "알 수 없음",
                              createdAt: formatRelative(game.created_at),
                              isHackathonEntry: Boolean(game.hackathon_id),
                            }}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                <ThumbnailManager games={games ?? []} />

                <RunReview runs={reviewRuns} />
              </>
            ),
          },
          {
            key: "events",
            label: "이벤트",
            content: <EventManager games={publishedGames} events={events} />,
          },
          {
            key: "notes",
            label: "제작 노트",
            content: <NotesManager notes={notes} games={publishedGames} ready={!notesError} />,
          },
        ]}
      />
    </div>
  );
}
