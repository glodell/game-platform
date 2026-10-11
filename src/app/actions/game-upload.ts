"use server";

import { revalidatePath } from "next/cache";
import { blobObjectUrl, blobUrlOf, removeBlobBuild } from "@/lib/game-blob";
import {
  isBuildId,
  isGameKey,
  isSafeFilePath,
  parseUploadedEntry,
  uploadedEntryUrl,
  uploadLimits,
  type GameStore,
} from "@/lib/game-files";
import {
  ensureGameBucket,
  gameStore,
  removeGameBuild,
  signGameUploads,
  storageObjectUrl,
  type UploadTicket,
} from "@/lib/game-storage";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/server";

/** 한 번에 받는 파일 목록 크기 — 브라우저가 이 크기로 나눠 부릅니다. */
const BATCH = 60;

export type StartUploadResult =
  | { ok: true; store: GameStore; build: string; tickets: UploadTicket[] }
  | { ok: false; error: string };

/**
 * 게임 폴더 업로드 준비.
 *
 * 파일 자체는 브라우저가 저장소로 바로 올립니다. 서버를 거치면 요청 크기 제한(4.5MB)에
 * 걸려 모델 · 텍스처 같은 큰 파일을 받을 수 없습니다. 여기서는 빌드 번호를 정하고,
 * 저장소가 무엇인지 알려줍니다.
 *
 *   Supabase — 파일마다 1회용 업로드 주소(tickets)를 끊어 줍니다.
 *   Blob     — tickets 는 비어 있습니다. 브라우저가 파일마다 /api/game-upload 에서 허가를 받습니다.
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

  const store = gameStore();
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
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > uploadLimits(store).maxFileBytes) {
      return { ok: false, error: `파일이 너무 큽니다: ${file.path}` };
    }
  }

  const build =
    input.build ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  if (store === "blob") return { ok: true, store, build, tickets: [] };

  const admin = createAdminClient();
  const bucketError = await ensureGameBucket(admin);
  if (bucketError) return { ok: false, error: bucketError };

  const signed = await signGameUploads(
    admin,
    `${key}/${build}`,
    files.map((file) => file.path),
  );
  if ("error" in signed) return { ok: false, error: signed.error };

  return { ok: true, store, build, tickets: signed.tickets };
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
  const store = gameStore();
  const entryFile = `${key}/${build}/index.html`;
  const missing = { ok: false as const, error: "index.html 이 올라가지 않았습니다. 다시 올려주세요." };

  if (store === "blob") {
    const actual = await blobUrlOf(entryFile);
    if (!actual) return missing;
    // 서빙 라우트는 주소를 직접 조립합니다. Blob 이 알려준 주소와 다르면 올린 게임이 열리지
    // 않으므로, 게임을 연결하기 전에 여기서 멈추고 실제 주소를 보여줍니다.
    const expected = blobObjectUrl(entryFile);
    // 주소 문자열을 URL 로 한 번 정리해서 비교합니다 (호스트의 대소문자 차이 등은 같은 주소입니다).
    if (!expected || new URL(actual).href !== new URL(expected).href) {
      return {
        ok: false,
        error: `Blob 주소가 예상과 다릅니다. 이 메시지를 그대로 알려주세요 — 실제: ${actual}`,
      };
    }
  } else {
    const probe = await fetch(storageObjectUrl(entryFile), { method: "HEAD", cache: "no-store" });
    if (!probe.ok) return missing;
  }

  const entryUrl = uploadedEntryUrl(store, key, build);
  if (!gameId) return { ok: true, entryUrl, replacedTitle: null };

  const switched = await pointGameAt(supabase, gameId, entryUrl);
  if (!switched.ok) return switched;
  return { ok: true, entryUrl, replacedTitle: switched.title };
}

export type LinkFolderResult = { ok: true; title: string } | { ok: false; error: string };

/**
 * 명령어(add-game)로 넣어 배포한 폴더를 기존 게임에 연결합니다.
 *
 * 웹으로 올렸던 게임을 저장소 폴더로 옮길 때 씁니다. 게임을 새로 등록하면 랭킹 · 댓글이
 * 이어지지 않으므로, 게임은 그대로 두고 파일이 있는 곳만 바꿉니다.
 */
export async function linkGameFolder(gameId: string, folder: string): Promise<LinkFolderResult> {
  const { supabase, staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  // 실제로 배포된 폴더만 받습니다 (목록은 빌드할 때 next.config 가 public/g 에서 읽습니다).
  const deployed = (process.env.GAME_FOLDERS ?? "").split(",").filter(Boolean);
  if (!deployed.includes(folder)) {
    return { ok: false, error: "배포된 게임 폴더가 아닙니다. 배포가 끝났는지 확인해 주세요." };
  }

  return pointGameAt(supabase, gameId, `/g/${folder}/index.html`);
}

/**
 * 게임이 가리키는 파일 위치를 바꿉니다. 전에 쓰던 것이 웹으로 올린 빌드였다면 저장소에서 지웁니다.
 */
async function pointGameAt(
  supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"],
  gameId: string,
  entryUrl: string,
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
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

  // 전에 쓰던 빌드는 이제 아무도 가리키지 않으니, 그 빌드가 있던 저장소에서 지웁니다
  // (저장 공간이 한정돼 있습니다). 실패해도 게임은 이미 새 위치로 돌고 있으므로 조용히 넘어갑니다.
  const previous = parseUploadedEntry(game.entry_url);
  if (previous && game.entry_url !== entryUrl) {
    try {
      if (previous.store === "blob") await removeBlobBuild(previous.key, previous.build);
      else await removeGameBuild(createAdminClient(), previous.key, previous.build);
    } catch (cause) {
      console.warn("이전 빌드 삭제 실패:", cause);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/games");
  revalidatePath(`/games/${game.slug}`);
  return { ok: true, title: game.title };
}
