"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";

const MAX_HTML_BYTES = 400_000; // 약 400KB — 단일 HTML 게임에는 충분합니다.

export type SubmitResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `game-${suffix}`;
}

export async function submitGame(formData: FormData): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // 제출물 하나가 최대 400KB 라, 횟수를 막지 않으면 계정 하나로 DB 를 채울 수 있습니다.
  if (
    !(await rateLimit(`submit-game-min:${user.id}`, 3, 60)) ||
    !(await rateLimit(`submit-game-day:${user.id}`, 20, 86400))
  ) {
    return { ok: false, error: TOO_MANY };
  }

  const title = String(formData.get("title") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const html = String(formData.get("html") ?? "");
  const hackathonSlug = String(formData.get("hackathon") ?? "").trim();
  const scoring = formData.get("scoring") === "low" ? "low" : "high";
  const scoreUnit = String(formData.get("score_unit") ?? "점").trim() || "점";

  if (title.length < 2) return { ok: false, error: "게임 이름을 2자 이상 입력해 주세요." };
  if (title.length > 60) return { ok: false, error: "게임 이름은 60자까지입니다." };
  if (!html.trim()) return { ok: false, error: "게임 HTML 코드를 넣어주세요." };
  if (new Blob([html]).size > MAX_HTML_BYTES) {
    return { ok: false, error: "코드가 400KB를 넘습니다. 이미지는 외부 링크 대신 용량을 줄여주세요." };
  }

  let hackathonId: string | null = null;
  if (hackathonSlug) {
    const { data: hackathon } = await supabase
      .from("hackathons")
      .select("id, submit_ends_at, starts_at")
      .eq("slug", hackathonSlug)
      .maybeSingle();

    if (!hackathon) return { ok: false, error: "해당 해커톤을 찾을 수 없습니다." };

    const now = Date.now();
    if (now < new Date(hackathon.starts_at).getTime()) {
      return { ok: false, error: "아직 접수가 시작되지 않은 해커톤입니다." };
    }
    if (now > new Date(hackathon.submit_ends_at).getTime()) {
      return { ok: false, error: "제출이 마감된 해커톤입니다." };
    }
    hackathonId = hackathon.id;
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      slug: slugify(title),
      title,
      tagline: tagline || null,
      description: description || null,
      kind: "community",
      status: "pending", // 운영자 검토 후 공개
      source: "html",
      html,
      author_id: user.id,
      hackathon_id: hackathonId,
      scoring,
      score_unit: scoreUnit,
    })
    .select("slug")
    .single();

  if (error) {
    return { ok: false, error: "제출에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/submit");
  return { ok: true, slug: data.slug };
}
