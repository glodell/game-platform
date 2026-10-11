import type { SupabaseClient } from "@supabase/supabase-js";
import { GAME_BUCKET } from "./game-files";

/**
 * 올린 게임 파일을 다루는 저장소 작업. 전부 service_role 클라이언트로 부릅니다.
 *
 * 브라우저가 저장소에 직접 쓰게 정책을 여는 대신, 운영자인지 확인한 서버 액션이 파일마다
 * 1회용 업로드 주소를 끊어 줍니다. 그래서 저장소 쪽에는 따로 정책을 만들 필요가 없고,
 * 누가 올릴 수 있는지는 서버 코드 한 곳에서만 정해집니다.
 */

/** 저장소의 공개 주소. 경로 조각마다 인코딩합니다 (이름에 공백 · 괄호가 들어갈 수 있습니다). */
export function storageObjectUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${GAME_BUCKET}/${encoded}`;
}

/** games 버킷이 없으면 공개 버킷으로 만듭니다. 문제가 있으면 사람이 읽을 메시지를 돌려줍니다. */
export async function ensureGameBucket(admin: SupabaseClient): Promise<string | null> {
  const { data: bucket } = await admin.storage.getBucket(GAME_BUCKET);
  if (bucket) {
    return bucket.public
      ? null
      : "저장소의 games 버킷이 비공개로 돼 있습니다. Supabase 대시보드에서 Public 으로 바꿔주세요.";
  }

  const { error } = await admin.storage.createBucket(GAME_BUCKET, { public: true });
  return error && !/already exists/i.test(error.message)
    ? `저장소 버킷을 만들지 못했습니다: ${error.message}`
    : null;
}

export type UploadTicket = { path: string; token: string };

/** 파일마다 1회용 업로드 주소를 끊습니다. paths 는 <키>/<빌드>/ 를 뺀 상대 경로입니다. */
export async function signGameUploads(
  admin: SupabaseClient,
  prefix: string,
  paths: string[],
): Promise<{ tickets: UploadTicket[] } | { error: string }> {
  const tickets: UploadTicket[] = [];
  const bucket = admin.storage.from(GAME_BUCKET);

  // 한꺼번에 수백 개를 쏘지 않도록 10개씩 나눠 보냅니다.
  for (let i = 0; i < paths.length; i += 10) {
    const results = await Promise.all(
      paths.slice(i, i + 10).map(async (path) => {
        // upsert: 올리다 끊긴 파일을 같은 주소로 다시 올릴 수 있게
        const { data, error } = await bucket.createSignedUploadUrl(`${prefix}/${path}`, {
          upsert: true,
        });
        return { path, token: data?.token ?? null, error };
      }),
    );

    for (const result of results) {
      if (!result.token) {
        return { error: `업로드 준비에 실패했습니다 (${result.path}): ${result.error?.message}` };
      }
      tickets.push({ path: result.path, token: result.token });
    }
  }
  return { tickets };
}

/** 저장소의 폴더 하나 아래에 있는 모든 파일 경로 (하위 폴더 포함). */
async function listAll(admin: SupabaseClient, prefix: string) {
  const bucket = admin.storage.from(GAME_BUCKET);
  const found: string[] = [];
  const pending = [prefix];

  while (pending.length > 0) {
    const dir = pending.pop()!;
    for (let offset = 0; ; ) {
      const { data, error } = await bucket.list(dir, { limit: 1000, offset });
      if (error || !data) break;
      for (const item of data) {
        // 폴더는 id 가 없습니다.
        if (item.id === null) pending.push(`${dir}/${item.name}`);
        else found.push(`${dir}/${item.name}`);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return found;
}

/** 빌드 하나를 통째로 지웁니다. 지운 파일 수를 돌려줍니다. */
export async function removeGameBuild(admin: SupabaseClient, key: string, build: string) {
  const paths = await listAll(admin, `${key}/${build}`);
  for (let i = 0; i < paths.length; i += 200) {
    await admin.storage.from(GAME_BUCKET).remove(paths.slice(i, i + 200));
  }
  return paths.length;
}
