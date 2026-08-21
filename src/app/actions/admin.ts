"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminResult = { ok: true; message: string } | { ok: false; error: string };

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, staff: false };

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, staff: data?.role === "owner" || data?.role === "moderator" };
}

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
    const allowed =
      url.startsWith("/") ||
      (() => {
        try {
          return ["http:", "https:"].includes(new URL(url).protocol);
        } catch {
          return false;
        }
      })();
    if (!allowed) {
      return { ok: false, error: "http(s) 주소나 / 로 시작하는 내부 경로만 넣을 수 있습니다." };
    }
    if (url.length > 2000) return { ok: false, error: "주소가 너무 깁니다." };
  }

  const { data, error } = await supabase
    .from("games")
    .update({ thumbnail_url: url || null })
    .eq("id", gameId)
    .select("slug")
    .single();

  if (error) return { ok: false, error: `저장 실패: ${error.message}` };

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
    return { ok: false, error: "게임 경로(/games/...)나 HTML 코드 중 하나는 있어야 합니다." };
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
