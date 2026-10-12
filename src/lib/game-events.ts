import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 랭킹 이벤트 — "언제까지의 기록으로 1·2·3위를 가린다" 만 있는 가벼운 대회.
 *
 * 따로 페이지가 없고 게임 페이지에 마감 타이머와 이벤트 순위가 붙습니다. 로그인하고 그 게임을
 * 플레이하면 자동으로 참가됩니다 (/api/runs/start 가 진행 중인 이벤트를 찾아 기록에 붙입니다).
 *
 * 저장은 대회와 같은 tournaments 테이블을 씁니다. 그래서 기간 안의 기록만 세는 순위 뷰
 * (tournament_leaderboard)와 마감 확인이 그대로 통합니다. 도전 횟수 제한이 없는(max_attempts 가
 * 비어 있는) 것이 랭킹 이벤트이고, 횟수 제한이 있는 것은 대회 페이지에서만 참가하는 정식
 * 대회입니다 — 게임 페이지에서 그냥 한 판이 대회 도전 횟수를 깎으면 안 되기 때문입니다.
 */
export const EVENT_FIELDS = "id, game_id, title, description, starts_at, ends_at";

/** 이벤트 기간의 상한 — 마감 시각을 잘못 넣는 실수(연도를 틀리는 등)를 걸러냅니다. */
export const EVENT_MAX_DAYS = 366;

/** 이 게임에서 지금 진행 중인 랭킹 이벤트 (없으면 null). */
export async function findLiveEvent(
  supabase: SupabaseClient,
  gameId: string,
): Promise<{ id: string; ends_at: string } | null> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("tournaments")
    .select("id, ends_at")
    .eq("game_id", gameId)
    .eq("is_published", true)
    .is("max_attempts", null)
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .order("ends_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
