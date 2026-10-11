import { cache } from "react";
import { FEATURES } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type {
  Comment,
  Game,
  Hackathon,
  LeaderboardRow,
  Note,
  Profile,
  Tournament,
  TournamentDetail,
} from "@/lib/types";

const GAME_FIELDS =
  "id, slug, title, tagline, description, thumbnail_url, kind, status, source, entry_url, html, author_id, hackathon_id, scoring, score_unit, tags, play_count, like_count, comment_count, published_at, created_at, author:profiles!games_author_id_fkey(handle, display_name, avatar_url)";

/**
 * 주소에서 온 슬러그·핸들을 DB 값과 맞춥니다.
 *
 * App Router 는 동적 경로 값을 퍼센트 인코딩된 그대로 넘겨줍니다. 핸들은 구글 이름에서,
 * 슬러그는 게임 제목에서 만들어져 한글이 들어갈 수 있는데, 풀어주지 않으면 조회가 빗나가
 * 멀쩡히 있는 프로필·게임이 "찾을 수 없음" 으로 나옵니다.
 */
function fromPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // 깨진 인코딩 — 어차피 일치하는 행이 없습니다.
  }
}

/**
 * 로그인한 사용자의 프로필 (없으면 null)
 *
 * cache() 로 감싸서 한 요청 안에서는 몇 번을 불러도 실제 조회는 1회만 나갑니다.
 * 헤더와 페이지가 각각 부르면서 인증 왕복이 두 번 생기던 것을 없앱니다.
 */
export const getViewer = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

export async function listGames(options: {
  kind?: "official" | "community";
  hackathonId?: string;
  sort?: "popular" | "recent" | "liked";
  limit?: number;
} = {}): Promise<Game[]> {
  const supabase = await createClient();
  let query = supabase.from("games").select(GAME_FIELDS).eq("status", "published");

  // 구독자 참여를 꺼 둔 동안에는 이미 공개된 구독자 제작 게임도 목록에 내지 않습니다.
  const kind = FEATURES.community ? options.kind : "official";
  if (kind) query = query.eq("kind", kind);
  if (options.hackathonId) query = query.eq("hackathon_id", options.hackathonId);

  const sort = options.sort ?? "recent";
  if (sort === "popular") query = query.order("play_count", { ascending: false });
  else if (sort === "liked") query = query.order("like_count", { ascending: false });
  else query = query.order("published_at", { ascending: false, nullsFirst: false });

  const { data } = await query.limit(options.limit ?? 24);
  return (data as unknown as Game[]) ?? [];
}

export async function getGameBySlug(slug: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_FIELDS)
    .eq("slug", fromPath(slug))
    .maybeSingle();
  return (data as unknown as Game) ?? null;
}

export async function getGameLeaderboard(gameId: string, limit = 20): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("game_leaderboard")
    .select("user_id, handle, display_name, avatar_url, score, duration_ms, created_at, rank")
    .eq("game_id", gameId)
    .order("rank")
    .limit(limit);
  return (data as LeaderboardRow[]) ?? [];
}

export async function getTournamentLeaderboard(
  tournamentId: string,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_leaderboard")
    .select("user_id, handle, display_name, avatar_url, score, duration_ms, created_at, rank")
    .eq("tournament_id", tournamentId)
    .order("rank")
    .limit(limit);
  return (data as LeaderboardRow[]) ?? [];
}

export async function getComments(gameId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select(
      "id, game_id, user_id, parent_id, body, is_deleted, created_at, author:profiles!comments_user_id_fkey(handle, display_name, avatar_url)",
    )
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  return (data as unknown as Comment[]) ?? [];
}

export async function hasLiked(gameId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("likes")
    .select("game_id")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

// 목록용 — 카드에 필요한 최소한만
const TOURNAMENT_FIELDS =
  "id, slug, game_id, title, description, banner_url, starts_at, ends_at, prizes, max_attempts, is_published, results_locked, created_at, game:games!tournaments_game_id_fkey(slug, title, thumbnail_url, score_unit, scoring)";

// 상세용 — 게임을 바로 띄워야 하므로 실행에 필요한 필드까지 한 번에 가져옵니다.
// (예전엔 대회를 읽고 게임을 다시 읽느라 왕복이 두 번이었습니다)
const TOURNAMENT_DETAIL_FIELDS =
  "id, slug, game_id, title, description, banner_url, starts_at, ends_at, prizes, max_attempts, is_published, results_locked, created_at, game:games!tournaments_game_id_fkey(id, slug, title, thumbnail_url, score_unit, scoring, source, entry_url, html, status)";

export async function listTournaments(filter?: "live" | "upcoming" | "ended"): Promise<Tournament[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  let query = supabase.from("tournaments").select(TOURNAMENT_FIELDS).eq("is_published", true);

  if (filter === "live") query = query.lte("starts_at", nowIso).gte("ends_at", nowIso);
  else if (filter === "upcoming") query = query.gt("starts_at", nowIso);
  else if (filter === "ended") query = query.lt("ends_at", nowIso);

  const { data } = await query.order("ends_at", { ascending: filter !== "ended" });
  return (data as unknown as Tournament[]) ?? [];
}

export async function getTournamentBySlug(slug: string): Promise<TournamentDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_DETAIL_FIELDS)
    .eq("slug", fromPath(slug))
    .maybeSingle();
  return (data as unknown as TournamentDetail) ?? null;
}

export async function getAttemptCount(tournamentId: string, userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);
  return count ?? 0;
}

export async function listHackathons(): Promise<Hackathon[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hackathons")
    .select("*")
    .eq("is_published", true)
    .order("submit_ends_at", { ascending: false });
  return (data as Hackathon[]) ?? [];
}

export async function getHackathonBySlug(slug: string): Promise<Hackathon | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hackathons")
    .select("*")
    .eq("slug", fromPath(slug))
    .maybeSingle();
  return (data as Hackathon) ?? null;
}

const NOTE_FIELDS =
  "id, slug, title, summary, cover_url, video_url, game_id, is_published, published_at, created_at, updated_at";

/**
 * 공개된 제작 노트 (최신순, 본문 제외).
 *
 * notes 테이블은 supabase/notes.sql 을 실행해야 생깁니다. 아직 안 돌린 DB 에서는
 * 조회가 오류로 끝나는데, 그때도 사이트가 죽지 않고 빈 목록으로 보이게 합니다.
 */
export async function listNotes(limit = 30): Promise<Note[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select(NOTE_FIELDS)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data as unknown as Note[]) ?? [];
}

/** 노트 한 편. 비공개 노트는 RLS 가 운영자에게만 돌려줍니다. */
export async function getNoteBySlug(slug: string): Promise<Note | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select(
      `${NOTE_FIELDS}, body, game:games!notes_game_id_fkey(slug, title, tagline, thumbnail_url, kind, status)`,
    )
    .eq("slug", fromPath(slug))
    .maybeSingle();
  return (data as unknown as Note) ?? null;
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", fromPath(handle))
    .maybeSingle();
  return (data as Profile) ?? null;
}

/** 특정 유저가 만든 공개 게임 */
export async function listGamesByAuthor(authorId: string): Promise<Game[]> {
  const supabase = await createClient();
  let query = supabase
    .from("games")
    .select(GAME_FIELDS)
    .eq("author_id", authorId)
    .eq("status", "published");
  if (!FEATURES.community) query = query.eq("kind", "official");

  const { data } = await query.order("created_at", { ascending: false });
  return (data as unknown as Game[]) ?? [];
}

/** 내가 제출한 모든 게임 (심사 대기·반려 포함) */
export async function listMySubmissions(userId: string): Promise<Game[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select(GAME_FIELDS)
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  return (data as unknown as Game[]) ?? [];
}
