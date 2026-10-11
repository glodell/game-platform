"use server";

import { revalidatePath } from "next/cache";
import {
  MAX_FILE_BYTES,
  isBuildId,
  isGameKey,
  isSafeFilePath,
  parseUploadedEntry,
  uploadedEntryUrl,
} from "@/lib/game-files";
import {
  ensureGameBucket,
  removeGameBuild,
  signGameUploads,
  storageObjectUrl,
  type UploadTicket,
} from "@/lib/game-storage";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/server";

/** 한 번에 끊어 주는 업로드 주소 수 — 브라우저가 파일 목록을 이 크기로 나눠 부릅니다. */
const BATCH = 60;

export type StartUploadResult =
  | { ok: true; build: string; tickets: UploadTicket[] }
  | { ok: false; error: string };

/**
 * 게임 폴더 업로드 준비 — 파일마다 1회용 업로드 주소를 끊어 줍니다.
 *
 * 파일 자체는 브라우저가 저장소로 바로 올립니다. 서버를 거치면 요청 크기 제한(4.5MB)에
 * 걸려 모델 · 텍스처 같은 큰 파일을 받을 수 없습니다.
 *
 * 첫 호출에서 빌드 번호를 만들어 돌려주고, 파일이 많아 나눠 부를 때는 그 번호를 다시 넘깁니다.
 */
export async function startGameUpload(input: {
  key: string;
  build?: string;
  files: { path: string; size: number }[];
}): Promise<StartUploadResult> {
  const { staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { key, files } = input;
  if (!isGameKey(key)) return { ok: false, error: "게임 폴더 이름이 올바르지 않습니다." };
  if (input.build !== undefined && !isBuildId(input.build)) {
    return { ok: false, error: "빌드 번호가 올바르지 않습니다." };
  }
  if (!Array.isArray(files) || files.length === 0 || files.length > BATCH) {
    return { ok: false, error: "파일 목록이 올바르지 않습니다." };
  }
  for (const file of files) {
    if (typeof file?.path !== "string" || !isSafeFilePath(file.path)) {
      return { ok: false, error: `올릴 수 없는 파일 이름입니다: ${String(file?.path)}` };
    }
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) {
      return { ok: false, error: `파일이 너무 큽니다: ${file.path}` };
    }
  }

  const admin = createAdminClient();
  const bucketError = await ensureGameBucket(admin);
  if (bucketError) return { ok: false, error: bucketError };

  const build =
    input.build ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  const signed = await signGameUploads(
    admin,
    `${key}/${build}`,
    files.map((file) => file.path),
  );
  if ("error" in signed) return { ok: false, error: signed.error };

  return { ok: true, build, tickets: signed.tickets };
}

export type FinishUploadResult =
  | { ok: true; entryUrl: string; replacedTitle: string | null }
  | { ok: false; error: string };

/**
 * 업로드 마무리.
 *
 * gameId 를 주면 그 게임의 파일을 방금 올린 빌드로 바꾸고, 전에 쓰던 빌드는 저장소에서 지웁니다.
 * 주지 않으면 게임 경로만 돌려줍니다 — 새 게임은 등록 폼에서 이름 등을 채워 등록합니다.
 */
export async function finishGameUpload(input: {
  key: string;
  build: string;
  gameId?: string;
}): Promise<FinishUploadResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const { key, build, gameId } = input;
  if (!isGameKey(key) || !isBuildId(build)) {
    return { ok: false, error: "업로드 정보가 올바르지 않습니다." };
  }

  // 시작 파일이 실제로 올라갔는지 확인합니다 — 없으면 게임 경로를 바꿔도 빈 화면만 뜹니다.
  const probe = await fetch(storageObjectUrl(`${key}/${build}/index.html`), {
    method: "HEAD",
    cache: "no-store",
  });
  if (!probe.ok) {
    return { ok: false, error: "index.html 이 올라가지 않았습니다. 다시 올려주세요." };
  }

  const entryUrl = uploadedEntryUrl(key, build);
  if (!gameId) return { ok: true, entryUrl, replacedTitle: null };

  const { data: game } = await supabase
    .from("games")
    .select("id, slug, title, entry_url")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return { ok: false, error: "게임을 찾을 수 없습니다." };

  const { error } = await supabase
    .from("games")
    .update({ source: "url", entry_url: entryUrl, html: null })
    .eq("id", gameId);
  if (error) return { ok: false, error: `게임 경로를 바꾸지 못했습니다: ${error.message}` };

  // 전에 쓰던 빌드는 이제 아무도 가리키지 않으니 지웁니다 (저장 공간이 한정돼 있습니다).
  // 실패해도 게임은 이미 새 빌드로 돌고 있으므로 조용히 넘어갑니다.
  const previous = parseUploadedEntry(game.entry_url);
  if (previous && !(previous.key === key && previous.build === build)) {
    try {
      await removeGameBuild(createAdminClient(), previous.key, previous.build);
    } catch (cause) {
      console.warn("이전 빌드 삭제 실패:", cause);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/games");
  revalidatePath(`/games/${game.slug}`);
  return { ok: true, entryUrl, replacedTitle: game.title };
}
