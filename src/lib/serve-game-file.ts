import { contentTypeOf } from "./game-files";

/**
 * 저장소에 있는 게임 파일 하나를 사이트 주소로 내려줍니다. /g/u/… · /g/b/… 라우트가 함께 씁니다.
 *
 * 저장소 주소로 게임을 직접 띄우지 않는 이유가 둘 있습니다. Supabase 는 HTML 을 일반
 * 텍스트로만 내려주고, 어느 저장소든 html · 스크립트가 게임과 같은 주소에서 와야 Web Worker 가
 * 동작합니다. 그래서 이 함수가 파일을 받아 올바른 Content-Type 으로 다시 내려줍니다. 주소가
 * /g/ 아래라서 저장소(public/g)에 넣은 폴더 게임과 똑같은 규칙(next.config 의 헤더, 게임
 * 전용 주소, 샌드박스)이 그대로 적용됩니다.
 *
 * 큰 파일은 흘려보내지 않고 저장소 주소로 넘깁니다(307). 서버 함수는 큰 응답을 내보내는 데
 * 제한이 있고, 모델 · 텍스처 · 소리는 다른 주소에서 받아도 문제가 없습니다.
 */
const PROXY_LIMIT = 4 * 1024 * 1024;

// 주소에 빌드 번호가 들어 있어 같은 주소의 내용은 바뀌지 않습니다. 오래 캐시해도 안전하고,
// s-maxage 덕분에 CDN 이 받아 두면 이 함수는 파일마다 한 번씩만 실행됩니다.
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

const PASS_THROUGH = ["content-range", "accept-ranges", "etag", "last-modified"];

export function gameFileNotFound() {
  return new Response("Not found", { status: 404 });
}

/**
 * @param source 저장소의 공개 주소
 * @param file   게임 폴더 안의 상대 경로 — 확장자로 Content-Type 을 정합니다
 */
export async function serveGameFile(request: Request, source: string, file: string) {
  const range = request.headers.get("range");
  // 본문을 쓰지 않기로 하면(없는 파일 · 큰 파일) 요청째 끊습니다. body.cancel() 을 기다리는 방식은
  // 프레임워크가 응답 본문을 갈라 쓰는 경우 끝나지 않아서, 큰 파일 요청이 그대로 멈춰 버립니다.
  const upstreamRequest = new AbortController();
  const upstream = await fetch(source, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    // 소리 · 영상은 브라우저가 구간 요청을 보냅니다 — 그대로 전달해야 탐색이 됩니다.
    headers: range ? { range } : undefined,
    cache: "no-store",
    signal: upstreamRequest.signal,
  });

  if (!upstream.ok) {
    upstreamRequest.abort();
    return gameFileNotFound();
  }

  const length = Number(upstream.headers.get("content-length") ?? 0);
  if (length > PROXY_LIMIT) {
    upstreamRequest.abort();
    return new Response(null, { status: 307, headers: { Location: source, "Cache-Control": CACHE } });
  }

  const { type, encoding } = contentTypeOf(file);
  const headers = new Headers({ "Content-Type": type, "Cache-Control": CACHE });
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  // 저장소가 응답을 압축해 보냈다면 fetch 가 이미 풀어서 주므로 그 길이는 더 이상 맞지 않습니다.
  if (length > 0 && !upstream.headers.get("content-encoding")) {
    headers.set("Content-Length", String(length));
  }
  if (encoding) headers.set("Content-Encoding", encoding);

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}
