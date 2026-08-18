"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleLike(gameId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { data: existing } = await supabase
    .from("likes")
    .select("game_id")
    .eq("game_id", gameId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("game_id", gameId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "좋아요를 취소하지 못했습니다." };
  } else {
    const { error } = await supabase.from("likes").insert({ game_id: gameId, user_id: user.id });
    if (error) return { ok: false, error: "좋아요를 남기지 못했습니다." };
  }

  revalidatePath(`/games/${slug}`);
  return { ok: true };
}

export async function addComment(
  gameId: string,
  slug: string,
  body: string,
  parentId?: string | null,
): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "댓글 내용을 입력해 주세요." };
  if (trimmed.length > 2000) return { ok: false, error: "댓글은 2000자까지 쓸 수 있습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase.from("comments").insert({
    game_id: gameId,
    user_id: user.id,
    parent_id: parentId ?? null,
    body: trimmed,
  });
  if (error) return { ok: false, error: "댓글을 남기지 못했습니다." };

  revalidatePath(`/games/${slug}`);
  return { ok: true };
}

export async function deleteComment(commentId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  // RLS 가 본인/운영자만 통과시킵니다.
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: "댓글을 지우지 못했습니다." };

  revalidatePath(`/games/${slug}`);
  return { ok: true };
}
