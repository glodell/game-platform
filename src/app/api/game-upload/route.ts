import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isBuildId, isGameKey, isSafeFilePath, uploadLimits } from "@/lib/game-files";
import { requireStaff } from "@/lib/staff";

export const runtime = "nodejs";

/**
 * Vercel Blob 업로드 허가 — 브라우저가 파일을 Blob 으로 바로 올리기 전에, 파일마다 여기서
 * 1회용 토큰을 받아 갑니다. 파일 자체는 이 서버를 거치지 않습니다 (서버 함수의 요청 크기
 * 제한 4.5MB 에 걸리지 않게).
 *
 * 누가 무엇을 올릴 수 있는지는 전부 여기서 정해집니다: 운영자만, <키>/<빌드>/<파일> 모양의
 * 경로에만, 정해진 크기까지만.
 */
export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 운영자인지부터 확인합니다. handleUpload 는 토큰 설정을 먼저 살펴보기 때문에, 맡겨 두면
  // 로그인하지 않은 요청에도 "저장소가 연결돼 있지 않다" 같은 내부 상태를 답하게 됩니다.
  // (업로드 완료 통지는 Vercel 이 보내는 것이라 로그인 대신 서명으로 확인됩니다.)
  if (body?.type === "blob.generate-client-token") {
    const { staff } = await requireStaff();
    if (!staff) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const [key = "", build = "", ...rest] = pathname.split("/");
        if (!isGameKey(key) || !isBuildId(build) || !isSafeFilePath(rest.join("/"))) {
          throw new Error(`올릴 수 없는 경로입니다: ${pathname}`);
        }

        return {
          // 경로를 우리가 정한 그대로 씁니다 — 게임 안의 상대 경로가 맞아야 하기 때문입니다.
          addRandomSuffix: false,
          // 올리다 끊긴 파일을 같은 주소로 다시 올릴 수 있게
          allowOverwrite: true,
          maximumSizeInBytes: uploadLimits("blob").maxFileBytes,
          // 주소에 빌드 번호가 들어 있어 내용이 바뀌지 않으므로 오래 캐시합니다.
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "업로드를 준비하지 못했습니다." },
      { status: 400 },
    );
  }
}
