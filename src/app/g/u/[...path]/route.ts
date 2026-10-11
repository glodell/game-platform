import { parseGamePath } from "@/lib/game-files";
import { storageObjectUrl } from "@/lib/game-storage";
import { gameFileNotFound, serveGameFile } from "@/lib/serve-game-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase Storage 에 올린 게임 파일 — /g/u/<키>/<빌드>/<파일> */
async function serve(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const target = parseGamePath((await params).path);
  if (!target) return gameFileNotFound();

  return serveGameFile(
    request,
    storageObjectUrl(`${target.key}/${target.build}/${target.file}`),
    target.file,
  );
}

export { serve as GET, serve as HEAD };
