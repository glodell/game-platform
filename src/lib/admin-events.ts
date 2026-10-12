import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateTime, formatScore } from "./format";
import { createAdminClient } from "./supabase/server";
import type { LeaderboardRow } from "./types";

/** 운영자 콘솔의 이벤트 목록 한 줄 — 화면에 그대로 찍을 수 있게 서버에서 글자로 만들어 둡니다. */
export type AdminEvent = {
  id: string;
  gameId: string;
  gameTitle: string;
  gameSlug: string;
  note: string | null;
  live: boolean;
  endsAt: string;
  startsLabel: string;
  endsLabel: string;
  participants: number;
  /** 1·2·3위. 이메일은 끝난 이벤트에서만 채웁니다 (상품 안내용). */
  top: { rank: number; name: string; handle: string; score: string; email: string | null }[];
};

/** 한 번에 보여줄 이벤트 수 — 이벤트마다 순위를 따로 읽으므로 최근 것만 봅니다. */
const RECENT = 12;

/**
 * 운영자 콘솔에 보여줄 랭킹 이벤트 목록 (진행 중인 것 먼저, 그다음 최근에 끝난 순).
 *
 * 운영자 화면에서만 부릅니다. 끝난 이벤트의 1·2·3위에게는 상품을 전해야 하므로 계정 이메일을
 * 함께 가져옵니다 — 이메일은 로그인 정보(auth)에만 있어서 관리자 권한으로 읽고, 딱 그 세 명만
 * 읽습니다. 개인정보처리방침의 "이메일" 항목에 이 쓰임이 적혀 있으니 바꿀 때 함께 고칩니다.
 */
export async function loadAdminEvents(supabase: SupabaseClient): Promise<AdminEvent[]> {
  const { data } = await supabase
    .from("tournaments")
    .select(
      "id, game_id, description, starts_at, ends_at, game:games!tournaments_game_id_fkey(title, slug, score_unit)",
    )
    .is("max_attempts", null)
    .order("ends_at", { ascending: false })
    .limit(RECENT);

  const rows = (data ?? []) as unknown as {
    id: string;
    game_id: string;
    description: string | null;
    starts_at: string;
    ends_at: string;
    game: { title: string; slug: string; score_unit: string | null } | null;
  }[];
  if (rows.length === 0) return [];

  const now = Date.now();
  const standings = await Promise.all(
    rows.map(async (row) => {
      const [{ data: top }, { count }] = await Promise.all([
        supabase
          .from("tournament_leaderboard")
          .select("user_id, handle, display_name, score, rank")
          .eq("tournament_id", row.id)
          .order("rank")
          .limit(3),
        supabase
          .from("tournament_leaderboard")
          .select("user_id", { count: "exact", head: true })
          .eq("tournament_id", row.id),
      ]);
      return {
        top: (top ?? []) as Pick<
          LeaderboardRow,
          "user_id" | "handle" | "display_name" | "score" | "rank"
        >[],
        count: count ?? 0,
      };
    }),
  );

  // 끝난 이벤트의 수상자 이메일
  const winnerIds = new Set<string>();
  rows.forEach((row, index) => {
    if (new Date(row.ends_at).getTime() < now) {
      standings[index].top.forEach((winner) => winnerIds.add(winner.user_id));
    }
  });
  const emails = await loadEmails([...winnerIds]);

  return rows
    .map((row, index) => {
      const live = new Date(row.ends_at).getTime() >= now;
      return {
        id: row.id,
        gameId: row.game_id,
        gameTitle: row.game?.title ?? "삭제된 게임",
        gameSlug: row.game?.slug ?? "",
        note: row.description,
        live,
        endsAt: row.ends_at,
        startsLabel: formatDateTime(row.starts_at),
        endsLabel: formatDateTime(row.ends_at),
        participants: standings[index].count,
        top: standings[index].top.map((winner) => ({
          rank: winner.rank,
          name: winner.display_name,
          handle: winner.handle,
          score: formatScore(winner.score, row.game?.score_unit),
          email: live ? null : (emails.get(winner.user_id) ?? null),
        })),
      };
    })
    .sort((a, b) => Number(b.live) - Number(a.live));
}

/** 계정 이메일. 읽지 못한 사람은 빠집니다 (화면에서는 "확인 불가" 로 나옵니다). */
async function loadEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (userIds.length === 0) return emails;

  try {
    const admin = createAdminClient();
    await Promise.all(
      userIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data.user?.email) emails.set(id, data.user.email);
      }),
    );
  } catch (cause) {
    console.warn("수상자 이메일을 읽지 못했습니다:", cause);
  }
  return emails;
}
