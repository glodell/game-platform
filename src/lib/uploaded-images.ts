import type { SupabaseClient } from "@supabase/supabase-js";
import { del } from "@vercel/blob";
import { blobObjectUrl } from "./game-blob";
import { GAME_BUCKET, IMAGE_KEY, isBuildId, isImageFileName, type GameStore } from "./game-files";
import { storageObjectUrl } from "./game-storage";
import { createAdminClient } from "./supabase/server";

/** 두 주소가 같은 곳을 가리키는지 (호스트의 대소문자 같은 표기 차이는 무시합니다) */
function sameUrl(a: string, b: string | null) {
  if (!b) return false;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

/**
 * 주소가 이 사이트에서 올린 이미지(thumbs/<번호>/image.<확장자>)면 어느 저장소의 어떤 파일인지
 * 돌려줍니다. 밖에서 가져온 주소나, 모양만 비슷한 다른 저장소의 주소는 null 입니다 —
 * 우리 저장소의 주소를 다시 조립해서 정확히 일치할 때만 우리 것으로 봅니다.
 */
export function parseUploadedImage(
  url: string | null | undefined,
): { store: GameStore; path: string } | null {
  if (!url) return null;
  const match = url.match(new RegExp(`/(${IMAGE_KEY}/([a-z0-9]+)/(image\\.[a-z0-9]+))$`));
  if (!match || !isBuildId(match[2]) || !isImageFileName(match[3])) return null;

  const path = match[1];
  if (sameUrl(url, blobObjectUrl(path))) return { store: "blob", path };
  if (sameUrl(url, storageObjectUrl(path))) return { store: "supabase", path };
  return null;
}

/**
 * 더 이상 쓰이지 않는 썸네일 · 표지 이미지를 저장소에서 지웁니다. 지웠으면 true.
 *
 * 게임이나 노트에서 그림을 바꾸거나 지운 "뒤에" 부릅니다. 같은 주소를 다른 게임 · 노트가
 * 아직 쓰고 있으면(주소를 복사해 넣었을 수 있습니다) 남겨 두고, 쓰이는지 확인하지 못했을
 * 때도 지우지 않습니다 — 잘못 지우면 되돌릴 수 없지만, 남겨 두면 용량만 조금 씁니다.
 */
export async function removeUploadedImageIfUnused(
  supabase: SupabaseClient,
  url: string | null | undefined,
) {
  const image = parseUploadedImage(url);
  if (!image || !url) return false;

  const [games, notes] = await Promise.all([
    supabase.from("games").select("id", { count: "exact", head: true }).eq("thumbnail_url", url),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("cover_url", url),
  ]);
  if (games.error) return false;
  // notes 테이블은 supabase/notes.sql 을 실행해야 생깁니다. 아직 없다면 노트가 쓰고 있을 수 없습니다.
  const notesMissing = notes.error?.code === "PGRST205" || notes.error?.code === "42P01";
  if (notes.error && !notesMissing) return false;
  if ((games.count ?? 0) > 0 || (notes.count ?? 0) > 0) return false;

  try {
    if (image.store === "blob") {
      await del(url);
    } else {
      const { error } = await createAdminClient().storage.from(GAME_BUCKET).remove([image.path]);
      if (error) throw error;
    }
    return true;
  } catch (cause) {
    console.warn("이미지 삭제 실패:", cause);
    return false;
  }
}
