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
