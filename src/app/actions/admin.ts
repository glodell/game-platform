"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff";
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
