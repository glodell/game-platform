import { upload as uploadToBlob } from "@vercel/blob/client";
import { startImageUpload } from "@/app/actions/image-upload";
import { GAME_BUCKET, IMAGE_TYPES } from "@/lib/game-files";
import { createClient } from "@/lib/supabase/client";

/** 썸네일이 실제로 보이는 크기보다 넉넉한 정도. 이보다 큰 그림은 줄여서 올립니다. */
const MAX_SIDE = 1280;
/** 이보다 작고 크기도 안 넘으면 손대지 않고 그대로 올립니다. */
const KEEP_AS_IS_BYTES = 400_000;

/**
 * 그림을 썸네일로 쓰기 알맞게 줄입니다 (브라우저에서).
 *
 * 화면 캡처를 그대로 올리면 몇 MB 짜리 PNG 가 게임 카드마다 내려가서 목록이 느려집니다.
 * 긴 변을 1280px 로 맞추고 WebP 로 다시 저장합니다. Safari 처럼 WebP 로 저장하지 못하는
 * 브라우저는 JPEG 로 대신하고, 줄여도 이득이 없거나 뭔가 실패하면 원본을 그대로 씁니다.
 * 움직이는 GIF 는 줄이면 멈춘 그림이 되므로 건드리지 않습니다.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.type === "image/gif" || !IMAGE_TYPES[file.type]) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_AS_IS_BYTES) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    let out = await encode("image/webp");
    // WebP 로 저장하지 못하는 브라우저는 다른 형식(PNG)으로 돌려줍니다.
    if (!out || out.type !== "image/webp") out = await encode("image/jpeg");
    if (!out || !IMAGE_TYPES[out.type] || out.size >= file.size) return file;

    return new File([out], "image", { type: out.type });
  } catch {
    return file;
  }
}

/** 이미지를 저장소에 올리고, 바로 쓸 수 있는 공개 주소를 돌려줍니다. */
export async function uploadImage(original: File): Promise<string> {
  const file = await shrinkImage(original);

  const started = await startImageUpload({ type: file.type, size: file.size });
  if (!started.ok) throw new Error(started.error);

  if (started.store === "blob") {
    const blob = await uploadToBlob(started.path, file, {
      access: "public",
      handleUploadUrl: "/api/game-upload",
      contentType: file.type,
    });
    return blob.url;
  }

  if (!started.token || !started.url) throw new Error("업로드 준비에 실패했습니다.");
  const { error } = await createClient()
    .storage.from(GAME_BUCKET)
    .uploadToSignedUrl(started.path, started.token, file, { cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return started.url;
}
