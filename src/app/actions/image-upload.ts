"use server";

import {
  IMAGE_KEY,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  formatBytes,
  type GameStore,
} from "@/lib/game-files";
import { ensureGameBucket, gameStore, signGameUploads, storageObjectUrl } from "@/lib/game-storage";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/server";

export type StartImageUploadResult =
  | {
      ok: true;
      store: GameStore;
      /** 저장소 안의 경로 — thumbs/<번호>/image.<확장자> */
      path: string;
      /** Supabase 일 때만: 1회용 업로드 토큰과, 올린 뒤 쓰게 될 공개 주소 */
      token: string | null;
      url: string | null;
    }
  | { ok: false; error: string };

/**
 * 썸네일 · 표지 이미지 업로드 준비.
 *
 * 게임 폴더 업로드와 같은 방식입니다 — 파일은 브라우저가 저장소로 바로 올리고, 여기서는
 * 운영자인지와 파일 종류 · 크기를 확인한 뒤 올릴 자리를 정해 줍니다.
 *
 *   Blob     — 브라우저가 이 경로로 /api/game-upload 에서 허가를 받아 올립니다.
 *   Supabase — 1회용 업로드 토큰을 함께 돌려줍니다.
 */
export async function startImageUpload(input: {
  type: string;
  size: number;
}): Promise<StartImageUploadResult> {
  const { staff } = await requireStaff();
  if (!staff) return { ok: false, error: "권한이 없습니다." };

  const extension = IMAGE_TYPES[input.type];
  if (!extension) {
    return { ok: false, error: "PNG · JPG · WebP · GIF 이미지만 올릴 수 있습니다." };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: `이미지는 ${formatBytes(IMAGE_MAX_BYTES)} 까지 올릴 수 있습니다.` };
  }

  // 올릴 때마다 새 자리를 씁니다. 같은 주소에 덮어쓰면 캐시 때문에 예전 그림이 계속 보입니다.
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const file = `image.${extension}`;
  const path = `${IMAGE_KEY}/${id}/${file}`;

  const store = gameStore();
  if (store === "blob") return { ok: true, store, path, token: null, url: null };

  const admin = createAdminClient();
  const bucketError = await ensureGameBucket(admin);
  if (bucketError) return { ok: false, error: bucketError };

  const signed = await signGameUploads(admin, `${IMAGE_KEY}/${id}`, [file]);
  if ("error" in signed) return { ok: false, error: signed.error };

  return { ok: true, store, path, token: signed.tickets[0].token, url: storageObjectUrl(path) };
}
