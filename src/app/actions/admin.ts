"use server";

import { revalidatePath } from "next/cache";
import { EVENT_MAX_DAYS, findLiveEvent } from "@/lib/game-events";
import { requireStaff } from "@/lib/staff";
import { removeUploadedBuildIfUnused } from "@/lib/uploaded-builds";
import { removeUploadedImageIfUnused } from "@/lib/uploaded-images";
import { parseYouTube } from "@/lib/youtube";

export type AdminResult = { ok: true; message: string } | { ok: false; error: string };

function slugify(input: string, fallback: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);
  return base || `${fallback}-${Math.random().toString(36).slice(2, 7)}`;
}

function parsePrizes(raw: string) {
  // "1등: 치킨 기프티콘" 형식을 한 줄에 하나씩
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(\d+)\s*등?\s*[:：-]?\s*(.+)$/);
      if (match) return { rank: Number(match[1]), reward: match[2].trim() };
      return { rank: index + 1, reward: line };
    });
}

/** img src 에 넣어도 되는 주소인지 — http(s) 와 사이트 내부 경로(/…)만 받습니다. */
function isImageUrl(url: string) {
  if (url.startsWith("/")) return true;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** 구독자 제출작 승인 / 반려 */
export async function reviewSubmission(
  gameId: string,
  decision: "approve" | "reject",
): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("games")
    .update(
      decision === "approve"
        ? { status: "published", published_at: new Date().toISOString() }
        : { status: "rejected" },
    )
    .eq("id", gameId);

  if (error) return { ok: false, error: "처리에 실패했습니다." };

  revalidatePath("/admin");
  revalidatePath("/games");
  return { ok: true, message: decision === "approve" ? "공개했습니다." : "반려했습니다." };
}

/**
 * 썸네일 지정.
 *
 * 빈 값을 보내면 지웁니다(카드에 슬러그 기반 그라디언트가 다시 나옵니다).
 * javascript: 같은 스킴이 img src 에 들어가는 것을 막기 위해 http(s) 와
 * 사이트 내부 경로(/…)만 받습니다.
 */
export async function setGameThumbnail(gameId: string, rawUrl: string): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const url = rawUrl.trim();
  if (url) {
    if (!isImageUrl(url)) {
      return { ok: false, error: "http(s) 주소나 / 로 시작하는 내부 경로만 넣을 수 있습니다." };
    }
    if (url.length > 2000) return { ok: false, error: "주소가 너무 깁니다." };
  }

  // 바꾸기 전의 그림 — 우리가 올린 파일이면 저장한 뒤에 저장소에서 지웁니다.
  const { data: before } = await supabase
    .from("games")
    .select("thumbnail_url")
    .eq("id", gameId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("games")
    .update({ thumbnail_url: url || null })
    .eq("id", gameId)
    .select("slug")
    .single();

  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

  if (before?.thumbnail_url && before.thumbnail_url !== url) {
    await removeUploadedImageIfUnused(supabase, before.thumbnail_url);
  }

  revalidatePath("/admin");
  revalidatePath("/games");
  revalidatePath(`/games/${data.slug}`);
  return { ok: true, message: url ? "썸네일을 저장했습니다." : "썸네일을 지웠습니다." };
}

/**
 * 게임 삭제.
 *
 * 게임과 함께 랭킹 기록 · 댓글 · 좋아요, 그 게임으로 연 대회가 지워집니다 (DB 가 연결된 행을
 * 함께 지웁니다). 제작 노트는 남고 게임과의 연결만 끊깁니다. 되돌릴 수 없습니다.
 *
 * DB 를 먼저 지우고 저장소 파일을 그다음에 지웁니다. 반대로 하다가 중간에 실패하면 "목록에는
 * 있는데 열리지 않는 게임" 이 남습니다. 이 순서라면 실패해도 파일만 남고, 그건 해가 없습니다.
 */
export async function deleteGame(gameId: string): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { data: game } = await supabase
    .from("games")
    .select("id, slug, title, entry_url, thumbnail_url")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return { ok: false, error: "게임을 찾을 수 없습니다." };

  const { data: removed, error } = await supabase
    .from("games")
    .delete()
    .eq("id", gameId)
    .select("id");
  if (error) return { ok: false, error: `삭제 실패: ${error.message}` };
  if (!removed || removed.length === 0) return { ok: false, error: "게임을 지우지 못했습니다." };

  const files = await removeUploadedBuildIfUnused(supabase, game.entry_url);
  await removeUploadedImageIfUnused(supabase, game.thumbnail_url);

  revalidatePath("/admin");
  revalidatePath("/games");
  revalidatePath(`/games/${game.slug}`);
  revalidatePath("/");

  let message = `「${game.title}」을 삭제했습니다.`;
  if (files === "failed") {
    message += " 다만 저장소의 게임 파일 일부를 지우지 못했습니다.";
  } else if (files === "kept") {
    message += " 게임 파일은 다른 게임이 함께 쓰고 있어 남겨 두었습니다.";
  } else if (files === "none" && game.entry_url?.startsWith("/g/")) {
    // 명령어로 넣은 게임 — 파일이 코드 저장소 안에 있어서 사이트에서는 지울 수 없습니다.
    message += ` 게임 파일은 코드 저장소의 public/g/${game.entry_url.split("/")[2]} 폴더에 남아 있습니다.`;
  }
  return { ok: true, message };
}

/* ------------------------------------------------------------------ */
/* 랭킹 이벤트 (src/lib/game-events.ts)                                  */
/* ------------------------------------------------------------------ */

/** 마감 시각 확인. 쓸 수 있으면 Date 를, 아니면 안내 문구를 돌려줍니다. */
function parseDeadline(endsAtIso: string): Date | string {
  const endsAt = new Date(endsAtIso);
  if (!endsAtIso || Number.isNaN(endsAt.getTime())) return "마감 시각을 입력해 주세요.";
  if (endsAt.getTime() <= Date.now()) return "마감 시각이 이미 지났습니다.";
  if (endsAt.getTime() > Date.now() + EVENT_MAX_DAYS * 86_400_000) {
    return "마감은 1년 이내로 정해 주세요.";
  }
  return endsAt;
}

function revalidateEvent(gameSlug: string | null | undefined) {
  revalidatePath("/admin");
  revalidatePath("/games");
  revalidatePath("/");
  if (gameSlug) revalidatePath(`/games/${gameSlug}`);
}

/**
 * 랭킹 이벤트 시작 — 지금부터 마감 시각까지의 기록으로 순위를 가립니다.
 *
 * 시작 시각은 받지 않고 "지금" 으로 둡니다. 로그인하고 그 게임을 플레이한 판이 자동으로
 * 이벤트 기록이 되므로, 시작과 동시에 참가가 열립니다.
 */
export async function startGameEvent(
  gameId: string,
  endsAtIso: string,
  note: string,
): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const endsAt = parseDeadline(endsAtIso);
  if (typeof endsAt === "string") return { ok: false, error: endsAt };

  const description = String(note ?? "").trim();
  if (description.length > 200) return { ok: false, error: "안내 문구는 200자까지입니다." };

  const { data: game } = await supabase
    .from("games")
    .select("id, slug, title, status")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return { ok: false, error: "게임을 선택해 주세요." };
  if (game.status !== "published") {
    return { ok: false, error: "공개된 게임에만 이벤트를 열 수 있습니다." };
  }

  // 한 게임에 이벤트는 하나씩 — 두 개가 겹치면 기록이 어느 쪽에 들어갈지 알 수 없습니다.
  if (await findLiveEvent(supabase, gameId)) {
    return {
      ok: false,
      error: "이 게임에는 이미 진행 중인 이벤트가 있습니다. 아래 목록에서 마감 시각을 바꿀 수 있습니다.",
    };
  }

  const { error } = await supabase.from("tournaments").insert({
    slug: `event-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    game_id: game.id,
    title: `${game.title} 랭킹 이벤트`,
    description: description || null,
    starts_at: new Date().toISOString(),
    ends_at: endsAt.toISOString(),
    prizes: [],
    max_attempts: null,
    is_published: true,
  });
  if (error) return { ok: false, error: `이벤트를 시작하지 못했습니다: ${error.message}` };

  revalidateEvent(game.slug);
  return {
    ok: true,
    message: `「${game.title}」 랭킹 이벤트를 시작했습니다. 지금부터의 기록이 이벤트 순위에 들어갑니다.`,
  };
}

/**
 * 진행 중인 이벤트의 마감 시각을 바꿉니다. endsAtIso 를 비우면(null) 지금 바로 마감합니다.
 * 이미 끝난 이벤트는 바꾸지 않습니다 — 끝난 뒤의 기록은 이벤트에 들어가지 않았으므로, 마감을
 * 뒤로 늘려도 그사이 기록이 빠진 순위가 됩니다. 새 이벤트를 여는 쪽이 맞습니다.
 */
export async function changeEventDeadline(
  eventId: string,
  endsAtIso: string | null,
): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const endsAt = endsAtIso === null ? new Date() : parseDeadline(endsAtIso);
  if (typeof endsAt === "string") return { ok: false, error: endsAt };

  const { data: event } = await supabase
    .from("tournaments")
    .select("id, ends_at, max_attempts, game:games!tournaments_game_id_fkey(slug)")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.max_attempts !== null) {
    return { ok: false, error: "이벤트를 찾을 수 없습니다." };
  }
  if (new Date(event.ends_at).getTime() < Date.now()) {
    return { ok: false, error: "이미 끝난 이벤트입니다. 새 이벤트를 열어 주세요." };
  }

  const { error } = await supabase
    .from("tournaments")
    .update({ ends_at: endsAt.toISOString() })
    .eq("id", eventId);
  if (error) return { ok: false, error: `마감 시각을 바꾸지 못했습니다: ${error.message}` };

  revalidateEvent((event.game as unknown as { slug: string } | null)?.slug);
  return {
    ok: true,
    message: endsAtIso === null ? "이벤트를 마감했습니다." : "마감 시각을 바꿨습니다.",
  };
}

/**
 * 이벤트 삭제 — 게임 페이지의 타이머 · 결과와 이벤트 순위가 사라집니다.
 * 플레이 기록 자체는 지워지지 않고 게임의 전체 랭킹에 남습니다 (DB 가 이벤트 표시만 뗍니다).
 */
export async function deleteGameEvent(eventId: string): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { data, error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", eventId)
    .is("max_attempts", null)
    .select("id, game:games!tournaments_game_id_fkey(slug)")
    .maybeSingle();
  if (error) return { ok: false, error: `삭제 실패: ${error.message}` };
  if (!data) return { ok: false, error: "이벤트를 찾을 수 없습니다." };

  revalidateEvent((data.game as unknown as { slug: string } | null)?.slug);
  return { ok: true, message: "이벤트를 지웠습니다. 플레이 기록은 전체 랭킹에 남아 있습니다." };
}

/**
 * 기록 무효 처리 / 되돌리기.
 *
 * 지우지 않고 표시만 합니다. 지우면 (1) 대회 도전 횟수가 도로 늘어나고
 * (2) 나중에 이의가 들어왔을 때 근거가 남지 않습니다.
 * 랭킹 뷰가 voided_at is null 로 거르기 때문에 무효 처리하면 순위에서 바로 빠집니다.
 */
export async function voidRun(runId: string, reason: string): Promise<AdminResult> {
  const { supabase, user, staff } = await requireStaff();
  if (!staff || !user) return { ok: false, error: "권한이 없습니다." };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "무효 사유를 적어주세요." };
  if (trimmed.length > 300) return { ok: false, error: "사유는 300자까지입니다." };

  const { error } = await supabase
    .from("runs")
    .update({
      voided_at: new Date().toISOString(),
      voided_reason: trimmed,
      voided_by: user.id,
    })
    .eq("id", runId);

  if (error) return { ok: false, error: `처리 실패: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/tournaments");
  return { ok: true, message: "무효 처리했습니다. 랭킹에서 빠집니다." };
}

export async function restoreRun(runId: string): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { error } = await supabase
    .from("runs")
    .update({ voided_at: null, voided_reason: null, voided_by: null })
    .eq("id", runId);

  if (error) return { ok: false, error: `처리 실패: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/tournaments");
  return { ok: true, message: "되돌렸습니다." };
}

/** 공식 게임 등록 */
export async function createOfficialGame(formData: FormData): Promise<AdminResult> {
  const { supabase, user, staff } = await requireStaff();
  if (!staff || !user) return { ok: false, error: "권한이 없습니다." };

  const title = String(formData.get("title") ?? "").trim();
  const entryUrl = String(formData.get("entry_url") ?? "").trim();
  const html = String(formData.get("html") ?? "").trim();

  if (title.length < 2) return { ok: false, error: "게임 이름을 입력해 주세요." };
  if (!entryUrl && !html) {
    return { ok: false, error: "게임 폴더를 올리거나, 게임 경로 · HTML 코드 중 하나를 넣어주세요." };
  }

  const { error } = await supabase.from("games").insert({
    slug: slugify(String(formData.get("slug") ?? "") || title, "game"),
    title,
    tagline: String(formData.get("tagline") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    thumbnail_url: String(formData.get("thumbnail_url") ?? "").trim() || null,
    kind: "official",
    status: "published",
    published_at: new Date().toISOString(),
    source: entryUrl ? "url" : "html",
    entry_url: entryUrl || null,
    html: entryUrl ? null : html,
    author_id: user.id,
    scoring: formData.get("scoring") === "low" ? "low" : "high",
    score_unit: String(formData.get("score_unit") ?? "점").trim() || "점",
  });

  if (error) {
    return { ok: false, error: `등록 실패: ${error.message}` };
  }

  revalidatePath("/admin");
  revalidatePath("/games");
  return { ok: true, message: "게임을 등록했습니다." };
}

/** 대회 개설 */
export async function createTournament(formData: FormData): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const title = String(formData.get("title") ?? "").trim();
  const gameId = String(formData.get("game_id") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");

  if (!title) return { ok: false, error: "대회 이름을 입력해 주세요." };
  if (!gameId) return { ok: false, error: "대상 게임을 선택해 주세요." };
  if (!startsAt || !endsAt) return { ok: false, error: "시작·마감 시각을 입력해 주세요." };
  if (new Date(endsAt) <= new Date(startsAt)) {
    return { ok: false, error: "마감이 시작보다 빠릅니다." };
  }

  const maxAttemptsRaw = String(formData.get("max_attempts") ?? "").trim();
  const maxAttempts = maxAttemptsRaw ? Number(maxAttemptsRaw) : null;
  if (maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
    return { ok: false, error: "도전 횟수는 1 이상의 정수여야 합니다." };
  }

  const { error } = await supabase.from("tournaments").insert({
    slug: slugify(String(formData.get("slug") ?? "") || title, "cup"),
    game_id: gameId,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    prizes: parsePrizes(String(formData.get("prizes") ?? "")),
    max_attempts: maxAttempts,
    is_published: formData.get("is_published") === "on",
  });

  if (error) return { ok: false, error: `개설 실패: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/tournaments");
  return { ok: true, message: "대회를 만들었습니다." };
}

/** 해커톤 개설 */
export async function createHackathon(formData: FormData): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const title = String(formData.get("title") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "");
  const submitEndsAt = String(formData.get("submit_ends_at") ?? "");

  if (!title) return { ok: false, error: "해커톤 이름을 입력해 주세요." };
  if (!startsAt || !submitEndsAt) return { ok: false, error: "시작·마감 시각을 입력해 주세요." };
  if (new Date(submitEndsAt) <= new Date(startsAt)) {
    return { ok: false, error: "마감이 시작보다 빠릅니다." };
  }

  const voteEndsAt = String(formData.get("vote_ends_at") ?? "");

  const { error } = await supabase.from("hackathons").insert({
    slug: slugify(String(formData.get("slug") ?? "") || title, "hack"),
    title,
    theme: String(formData.get("theme") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    rules: String(formData.get("rules") ?? "").trim() || null,
    starts_at: new Date(startsAt).toISOString(),
    submit_ends_at: new Date(submitEndsAt).toISOString(),
    vote_ends_at: voteEndsAt ? new Date(voteEndsAt).toISOString() : null,
    prizes: parsePrizes(String(formData.get("prizes") ?? "")),
    is_published: formData.get("is_published") === "on",
  });

  if (error) return { ok: false, error: `개설 실패: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/hackathons");
  return { ok: true, message: "해커톤을 열었습니다." };
}

/* ------------------------------------------------------------------ */
/* 제작 노트                                                            */
/* ------------------------------------------------------------------ */

const NOTE_BODY_MAX = 50_000;

// notes 테이블은 supabase/notes.sql 을 실행해야 생깁니다.
const NOTES_NOT_READY: AdminResult = {
  ok: false,
  error: "notes 테이블이 없습니다. Supabase SQL Editor 에서 supabase/notes.sql 을 실행해 주세요.",
};

function isMissingTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** 제작 노트 저장 — id 가 있으면 고치고, 없으면 새로 만듭니다. */
export async function saveNote(formData: FormData): Promise<AdminResult> {
  const { supabase, user, staff } = await requireStaff();
  if (!staff || !user) return { ok: false, error: "권한이 없습니다." };

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n?/g, "\n").trim();
  const coverUrl = String(formData.get("cover_url") ?? "").trim();
  const videoUrl = String(formData.get("video_url") ?? "").trim();
  const gameId = String(formData.get("game_id") ?? "").trim();
  const publish = formData.get("is_published") === "on";

  if (!title) return { ok: false, error: "제목을 입력해 주세요." };
  if (title.length > 120) return { ok: false, error: "제목은 120자까지입니다." };
  if (summary.length > 300) return { ok: false, error: "요약은 300자까지입니다." };
  if (!body) return { ok: false, error: "본문을 입력해 주세요." };
  if (body.length > NOTE_BODY_MAX) return { ok: false, error: "본문이 너무 깁니다 (5만 자까지)." };
  if (coverUrl && (!isImageUrl(coverUrl) || coverUrl.length > 2000)) {
    return { ok: false, error: "표지는 http(s) 주소나 / 로 시작하는 내부 경로만 넣을 수 있습니다." };
  }
  if (videoUrl && !parseYouTube(videoUrl)) {
    return { ok: false, error: "영상은 유튜브 주소만 넣을 수 있습니다 (쇼츠 주소 포함)." };
  }

  const now = new Date().toISOString();
  const fields = {
    title,
    summary: summary || null,
    body,
    cover_url: coverUrl || null,
    video_url: videoUrl || null,
    game_id: gameId || null,
    is_published: publish,
    updated_at: now,
  };

  let slug: string;
  let error: { code?: string; message: string } | null;

  if (id) {
    const { data: existing, error: readError } = await supabase
      .from("notes")
      .select("slug, published_at, cover_url")
      .eq("id", id)
      .maybeSingle();
    if (isMissingTable(readError)) return NOTES_NOT_READY;
    if (!existing) return { ok: false, error: "노트를 찾을 수 없습니다." };

    // 주소 칸을 비워두면 기존 주소를 유지합니다 — 이미 공유된 링크가 죽지 않게.
    slug = slugInput ? slugify(slugInput, "note") : existing.slug;
    ({ error } = await supabase
      .from("notes")
      .update({ ...fields, slug, published_at: existing.published_at ?? (publish ? now : null) })
      .eq("id", id));

    if (!error && slug !== existing.slug) revalidatePath(`/notes/${existing.slug}`);
    // 표지를 바꾸거나 지웠으면, 전에 쓰던 그림(우리가 올린 파일일 때)은 저장소에서 지웁니다.
    if (!error && existing.cover_url && existing.cover_url !== coverUrl) {
      await removeUploadedImageIfUnused(supabase, existing.cover_url);
    }
  } else {
    slug = slugify(slugInput || title, "note");
    ({ error } = await supabase
      .from("notes")
      .insert({ ...fields, slug, author_id: user.id, published_at: publish ? now : null }));
  }

  if (error) {
    if (isMissingTable(error)) return NOTES_NOT_READY;
    if (error.code === "23505") {
      return { ok: false, error: "같은 주소의 노트가 이미 있습니다. 주소 슬러그를 바꿔주세요." };
    }
    return { ok: false, error: `저장 실패: ${error.message}` };
  }

  revalidatePath("/admin");
  revalidatePath("/notes");
  revalidatePath(`/notes/${slug}`);
  revalidatePath("/");
  return { ok: true, message: publish ? "공개로 저장했습니다." : "비공개로 저장했습니다." };
}

export async function deleteNote(noteId: string): Promise<AdminResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .select("slug, cover_url")
    .maybeSingle();

  if (error) return { ok: false, error: `삭제 실패: ${error.message}` };

  // 노트와 함께 표지 그림도 정리합니다.
  if (data?.cover_url) await removeUploadedImageIfUnused(supabase, data.cover_url);

  revalidatePath("/admin");
  revalidatePath("/notes");
  if (data) revalidatePath(`/notes/${data.slug}`);
  revalidatePath("/");
  return { ok: true, message: "노트를 지웠습니다." };
}
