import type { SupabaseClient } from "@supabase/supabase-js";
import { removeBlobBuild } from "./game-blob";
import { parseUploadedEntry } from "./game-files";
import { removeGameBuild } from "./game-storage";
import { createAdminClient } from "./supabase/server";

/**
 * 게임 경로가 가리키던 "웹으로 올린 빌드"를 저장소에서 지웁니다.
 *
 * 게임이 다른 파일을 가리키게 됐거나 게임 자체가 지워진 "뒤에" 부릅니다. 같은 경로를 다른
 * 게임이 아직 쓰고 있으면 남겨 두고, 쓰이는지 확인하지 못했을 때도 지우지 않습니다.
 *
 *   none    — 웹으로 올린 빌드가 아님 (저장소 폴더 게임 · 붙여넣은 HTML · 외부 주소)
 *   kept    — 다른 게임이 쓰고 있어서(또는 확인하지 못해서) 남겨 둠
 *   removed — 지움
 *   failed  — 지우려 했지만 실패
 */
export async function removeUploadedBuildIfUnused(
  supabase: SupabaseClient,
  entryUrl: string | null | undefined,
): Promise<"none" | "kept" | "removed" | "failed"> {
  const build = parseUploadedEntry(entryUrl);
  if (!build || !entryUrl) return "none";

  const { count, error } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("entry_url", entryUrl);
  if (error || (count ?? 0) > 0) return "kept";

  try {
    if (build.store === "blob") await removeBlobBuild(build.key, build.build);
    else await removeGameBuild(createAdminClient(), build.key, build.build);
    return "removed";
  } catch (cause) {
    console.warn("게임 빌드 삭제 실패:", cause);
    return "failed";
  }
}
