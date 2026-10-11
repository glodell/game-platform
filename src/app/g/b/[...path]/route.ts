import { blobObjectUrl } from "@/lib/game-blob";
import { parseGamePath } from "@/lib/game-files";
import { gameFileNotFound, serveGameFile } from "@/lib/serve-game-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Blob 에 올린 게임 파일 — /g/b/<키>/<빌드>/<파일> */
async function serve(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const target = parseGamePath((await params).path);
  if (!target) return gameFileNotFound();

  // Blob 저장소가 연결돼 있지 않으면 주소를 만들 수 없습니다.
  const source = blobObjectUrl(`${target.key}/${target.build}/${target.file}`);
  if (!source) return gameFileNotFound();

  return serveGameFile(request, source, target.file);
}

export { serve as GET, serve as HEAD };
