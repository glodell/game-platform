/**
 * 구독자가 제출한 HTML을 iframe 안에서 안전하게 띄우기 위한 래핑.
 *
 * 방어의 핵심은 iframe 의 sandbox 속성입니다. allow-same-origin 을 절대 주지 않기 때문에
 * 게임 코드는 고유(opaque) 오리진에서 실행되고, 우리 쿠키·localStorage·DOM 에 접근할 수 없습니다.
 * 여기서 추가로 하는 일은 네트워크 요청과 폼 전송을 CSP 로 한 번 더 잠그는 것입니다.
 */

export const GAME_SANDBOX = [
  "allow-scripts",
  "allow-pointer-lock",
  "allow-orientation-lock",
  "allow-modals",
].join(" ");

/**
 * 폴더 게임(/g/…)을 "게임 전용 주소"에서 내려줄 때만 쓰는 권한.
 *
 * allow-same-origin 이 없으면 게임은 오리진이 없는(opaque) 상태라 localStorage · IndexedDB ·
 * 주소로 만드는 Web Worker 가 전부 SecurityError 로 막힙니다. 이걸 주면 풀리지만, 게임을
 * 이 사이트와 같은 주소에서 내려주는 한 그 오리진이 곧 이 사이트라 쿠키 · 세션이 통째로
 * 열립니다. 그래서 다른 주소(gameOrigin)에서 내려줄 때만 씁니다 — 그러면 게임은 자기
 * 주소의 저장소만 갖고 이 사이트에는 손대지 못합니다. resolveGameEntry() 가 그 조건을 지킵니다.
 */
export const GAME_SANDBOX_ISOLATED = `${GAME_SANDBOX} allow-same-origin`;

/** 게임 iframe 의 allow 속성. 전체화면은 운영자가 올린 게임에만 줍니다. */
export const GAME_ALLOW = "autoplay; gamepad";
export const GAME_ALLOW_TRUSTED = `${GAME_ALLOW}; fullscreen`;

const CSP = [
  "default-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "style-src 'unsafe-inline' data:",
  "script-src 'unsafe-inline' 'unsafe-eval' SDK_ORIGIN",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

export function wrapUserGame(html: string, siteUrl: string) {
  const origin = safeOrigin(siteUrl);
  const csp = CSP.replace("SDK_ORIGIN", origin);
  const sdk = `${origin}/sdk/arcade.js`;

  // 제출물이 완전한 문서든 조각이든 동작하도록 head 를 우리가 강제로 앞에 붙입니다.
  const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<script src="${sdk}"></script>
<style>html,body{margin:0;height:100%;background:#07080f;color:#e7e9f7;font-family:system-ui,sans-serif;overflow:hidden}</style>`;

  const hasHtmlTag = /<html[\s>]/i.test(html);
  if (!hasHtmlTag) {
    return `<!doctype html><html lang="ko"><head>${head}</head><body>${html}</body></html>`;
  }

  // 이미 완전한 문서라면 </head> 또는 <body> 직전에 주입
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, (m) => `${m}${head}`);
  }
  return html.replace(/<html([^>]*)>/i, (m) => `${m}<head>${head}</head>`);
}

function safeOrigin(siteUrl: string) {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/**
 * 이 사이트의 기준 주소. 제출 게임에 주입할 SDK 경로를 만드는 데 씁니다.
 *
 * 우선순위대로 찾습니다.
 *   1) NEXT_PUBLIC_SITE_URL      — 직접 지정한 값 (커스텀 도메인이 있으면 이걸 쓰세요)
 *   2) VERCEL_PROJECT_PRODUCTION_URL — Vercel 이 알려주는 운영 도메인
 *   3) VERCEL_URL                — 이번 배포에만 붙은 임시 주소 (미리보기 배포용)
 *   4) localhost
 *
 * 2·3번 덕분에 Vercel 에 배포할 때 주소를 손으로 넣지 않아도 동작합니다.
 */
export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  return "http://localhost:3000";
}

function originOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * 폴더 게임(/g/…)을 내려주는 게임 전용 주소. 없으면 null.
 *
 * 운영에서는 NEXT_PUBLIC_GAME_ORIGIN 으로 정합니다 (예: https://play.viberhood.io).
 * 같은 배포에 붙인 두 번째 도메인이면 되고, 그 주소에서는 미들웨어가 게임 파일만 내려줍니다.
 * 정하지 않으면 예전처럼 이 사이트 주소에서 오리진 없는 샌드박스로 돕니다.
 *
 * 개발 중에는 따로 정하지 않아도 localhost ↔ 127.0.0.1 을 맞바꿔 씁니다. 둘은 같은 서버지만
 * 브라우저에게는 다른 오리진이라, 운영과 같은 조건으로 확인할 수 있습니다.
 */
export function gameOrigin(): string | null {
  const explicit = originOf(process.env.NEXT_PUBLIC_GAME_ORIGIN);
  if (explicit) return explicit;

  if (process.env.NODE_ENV !== "production") {
    try {
      const site = new URL(siteUrl());
      if (site.hostname === "localhost") site.hostname = "127.0.0.1";
      else if (site.hostname === "127.0.0.1") site.hostname = "localhost";
      else return null;
      return site.origin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 게임 전용 주소가 "이 사이트와 다른 주소로" 준비돼 있을 때만 그 주소를 돌려줍니다.
 * 같은 주소로 잘못 설정된 경우를 여기서 걸러서, allow-same-origin 이 이 사이트에 열리는 일을 막습니다.
 */
export function isolatedGameOrigin(): string | null {
  const games = gameOrigin();
  return games && games !== originOf(siteUrl()) ? games : null;
}

/**
 * 게임을 실제로 띄울 주소와, 그 프레임에 자기 오리진을 줘도 되는지를 정합니다.
 *
 * 자기 오리진을 받는 것은 이 저장소의 폴더 게임(/g/…)을 게임 전용 주소에서 내려줄 때뿐입니다.
 * 붙여넣은 HTML(srcdoc)과 외부 주소는 지금처럼 오리진 없는 샌드박스에 둡니다.
 */
export function resolveGameEntry(entryUrl: string | null | undefined): {
  url: string | null;
  isolated: boolean;
} {
  const games = isolatedGameOrigin();
  // ".." 로 /g 밖을 가리키는 경로는 게임 파일이 아니므로 자기 오리진을 주지 않습니다.
  if (games && entryUrl?.startsWith("/g/") && !entryUrl.includes("..")) {
    return { url: `${games}${entryUrl}`, isolated: true };
  }
  return { url: entryUrl ?? null, isolated: false };
}
