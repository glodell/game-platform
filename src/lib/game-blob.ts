import { BlobNotFoundError, del, head, list } from "@vercel/blob";

/**
 * 올린 게임 파일을 Vercel Blob 에서 다루는 작업.
 *
 * Vercel 대시보드에서 Blob 저장소를 만들어 프로젝트에 연결하면 BLOB_READ_WRITE_TOKEN 이
 * 생깁니다. 그 값이 있으면 웹 업로드가 Blob 으로 가고(게임 파일이 사이트와 같은 Vercel 의
 * 전송량을 씁니다), 없으면 Supabase Storage 로 갑니다 — game-storage.ts 의 gameStore() 참고.
 */

const token = () => process.env.BLOB_READ_WRITE_TOKEN ?? "";

/**
 * Blob 의 공개 주소. 저장소가 연결돼 있지 않으면 null.
 *
 * 토큰은 vercel_blob_rw_<스토어ID>_<비밀값> 모양이고, 공개 주소는
 * https://<스토어ID>.public.blob.vercel-storage.com/<경로> 입니다. SDK 가 주소를 만드는 방식
 * (constructBlobUrl)과 같습니다. 파일마다 API 를 불러 주소를 묻지 않으려고 직접 조립합니다.
 */
export function blobObjectUrl(path: string) {
  const storeId = token().split("_")[3];
  if (!storeId) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://${storeId}.public.blob.vercel-storage.com/${encoded}`;
}

/**
 * 파일이 실제로 올라갔는지 확인하고, Blob 이 알려주는 주소를 돌려줍니다 (없으면 null).
 * 호출하는 쪽은 이 주소가 blobObjectUrl() 로 조립한 주소와 같은지 확인합니다 — 다르면 서빙
 * 라우트가 엉뚱한 곳을 보게 되므로, 올린 직후에 바로 드러나야 합니다.
 */
export async function blobUrlOf(path: string): Promise<string | null> {
  try {
    return (await head(path)).url;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

/** 빌드 하나를 통째로 지웁니다. 지운 파일 수를 돌려줍니다. */
export async function removeBlobBuild(key: string, build: string) {
  let removed = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${key}/${build}/`, limit: 1000, cursor });
    if (page.blobs.length > 0) {
      await del(page.blobs.map((blob) => blob.url));
      removed += page.blobs.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return removed;
}
